import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RealtimeReservas } from '@/components/proprietario/realtime-reservas'
import { MESES, MESES_ABREV } from '@/lib/constants'
import { calcularKPIs, somarKPIs, calcularTaxaCarteira, rotuloTaxaCarteira } from '@/lib/calcular-kpis'
import { SyncButton } from '@/components/proprietario/sync-button'
import { InicioProprietario } from '@/components/proprietario/inicio'
import { PainelOcupacao } from '@/components/proprietario/painel-ocupacao'
import { getTaxasPlataforma } from '@/lib/amenitiz'

type SearchParams = Promise<{ mes?: string; ano?: string }>

type ApartamentoVinculo = {
  id: string
  numero: string
  tipo_gestao: 'adm' | 'sub' | null
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  modelo_contrato: 'administracao' | 'sublocacao' | null
  empreendimentos: { nome: string } | null
}

export default async function ProprietarioDashboard({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'proprietario') redirect('/')

  const params = await searchParams
  const now = new Date()
  // Parâmetro inválido (?ano=0, ?mes=abc) cai no período atual: "todos os anos"
  // não existe no portal e gerava datas impossíveis ("0-06-01") nas consultas.
  const mesParam = params.mes !== undefined ? parseInt(params.mes) : NaN
  const anoParam = params.ano !== undefined ? parseInt(params.ano) : NaN
  const mes = mesParam >= 0 && mesParam <= 12 ? mesParam : now.getMonth() + 1
  const ano = anoParam >= 2000 && anoParam <= 2100 ? anoParam : now.getFullYear()
  // Mês corrente: KPIs preferem amenitiz_reservas (cron 5 min + realtime) em vez
  // de diárias (sync diário 05:00) — o faturamento sobe ao vivo, taxas já descontadas.
  const isMesCorrente = mes === now.getMonth() + 1 && ano === now.getFullYear()
  const nomeMes = mes > 0 ? (MESES[mes - 1] ?? '') : ''
  const labelPeriodo = nomeMes ? `${nomeMes} ${ano}` : String(ano)
  const _firstName = profile?.full_name?.split(' ')[0] ?? 'Proprietário'
  const primeiroNome = _firstName.charAt(0).toUpperCase() + _firstName.slice(1)

  const { data: vinculos } = await supabase
    .from('proprietario_apartamentos')
    .select('apartamentos(id, numero, tipo_gestao, taxa_repasse, tipo_repasse, modelo_contrato, empreendimentos(nome))')
    .eq('proprietario_id', user.id)
    .eq('ativo', true)

  type VinculoRow = { apartamentos: ApartamentoVinculo | null }
  const apartamentos: ApartamentoVinculo[] = ((vinculos ?? []) as unknown as VinculoRow[])
    .map(v => v.apartamentos)
    .filter((a): a is ApartamentoVinculo => a !== null)

  const aptIds = apartamentos.map(a => a.id)
  // "15% sobre o lucro" numa carteira homogênea; "12% a 15%" quando os imóveis
  // ADM do proprietário têm percentuais diferentes. '' = carteira sem taxa.
  const rotuloTaxa = rotuloTaxaCarteira(apartamentos)

  // Timestamp do último ingest (cron ou webhook) — exibido pelo componente Realtime.
  // Leitura via SECURITY DEFINER: proprietário não acessa ingest_status diretamente.
  const { data: ingestAtRaw } = await supabase.rpc('ultimo_ingest_timestamp')
  const ingestAt: string | null = ingestAtRaw ?? null

  let kpis = { faturamento: 0, custos: 0, lucro: 0, taxaAlugEasy: 0, repasse: 0, margem: 0 }
  let historicoData: { label: string; faturamento: number; lucro: number; repasse: number }[] = []
  let mesesComDados = 0
  let semCategoriasConfiguradas = false
  let semDados = false
  let mesSincronizado = false
  type ReservaPanel = {
    booking_id: string
    individual_room_name: string | null
    checkin: string | null
    checkout: string | null
    plataforma_normalizada: string | null
    valor_liquido: number | null
    status: string | null
    nome_hospede: string | null
    apartamento_id: string
  }
  let reservasParaPainel: ReservaPanel[] = []

  if (aptIds.length > 0) {
    const dataInicio = mes > 0
      ? `${ano}-${String(mes).padStart(2, '0')}-01`
      : `${ano}-01-01`
    const dataFim = mes > 0
      ? new Date(ano, mes, 0).toISOString().slice(0, 10)
      : `${ano}-12-31`

    // custos: quando mes=0, busca o ano inteiro
    const custosQuery = mes > 0
      ? supabase.from('custos_proprietario')
          .select('apartamento_id, valor, tipo_gestao')
          .in('apartamento_id', aptIds)
          .eq('mes', mes).eq('ano', ano)
      : supabase.from('custos_proprietario')
          .select('apartamento_id, valor, tipo_gestao')
          .in('apartamento_id', aptIds)
          .eq('ano', ano)

    const [
      { data: diariasData },
      { data: custosData },
      { count: catCount },
      { data: reservasBruto },
    ] = await Promise.all([
      supabase.from('diarias')
        .select('apartamento_id, valor, tipo_gestao')
        .in('apartamento_id', aptIds)
        .gte('data', dataInicio).lte('data', dataFim),
      custosQuery,
      supabase.from('categorias_repassaveis')
        .select('*', { count: 'exact', head: true }),
      // Única query de reservas: sobreposição de datas cobre o período inteiro.
      // Reservas que cruzam início/fim do mês têm valor prorated logo abaixo.
      supabase.from('amenitiz_reservas')
        .select('booking_id, individual_room_name, checkin, checkout, plataforma_normalizada, valor_liquido, status, nome_hospede, apartamento_id')
        .in('apartamento_id', aptIds)
        .lte('checkin', dataFim)
        .gte('checkout', dataInicio)
        .order('checkin', { ascending: true }),
    ])

    if (mes > 0) {
      const { data: syncData } = await supabase.rpc('periodo_sincronizado', { p_mes: mes, p_ano: ano })
      mesSincronizado = syncData === true
    }

    // Proration: clipa datas ao período e calcula valor proporcional às noites no mês.
    // Ex: reserva 11/05→11/06 em junho = 10 noites de 31 → exibe 01/06→11/06, valor ×(10/31).
    // A saída é recortada para o dia 1º do mês SEGUINTE (não o último dia do mês):
    // checkout é dia de saída, sem pernoite — recortar em dataFim apagava a última
    // noite do mês na grade de ocupação.
    const firstDayMs  = mes > 0 ? new Date(dataInicio + 'T00:00:00').getTime() : 0
    const nextMonthMs = mes > 0 ? new Date(ano, mes, 1).getTime() : 0
    const proximoMesInicio = mes === 12
      ? `${ano + 1}-01-01`
      : `${ano}-${String(mes + 1).padStart(2, '0')}-01`

    const reservasProrated = (reservasBruto ?? []).flatMap(r => {
      let checkin  = r.checkin
      let checkout = r.checkout
      let valor    = r.valor_liquido

      if (mes > 0 && r.checkin && r.checkout && r.valor_liquido != null) {
        const ci = new Date(r.checkin  + 'T00:00:00').getTime()
        const co = new Date(r.checkout + 'T00:00:00').getTime()
        const totalNights = (co - ci) / 86400000
        const monthNights = (Math.min(co, nextMonthMs) - Math.max(ci, firstDayMs)) / 86400000

        if (monthNights <= 0) return []
        if (totalNights > 0 && monthNights < totalNights) {
          valor    = (monthNights / totalNights) * r.valor_liquido
          if (ci < firstDayMs)  checkin  = dataInicio
          if (co > nextMonthMs) checkout = proximoMesInicio
        }
      }

      return [{ ...r, checkin, checkout, valor_liquido: valor }]
    })

    semCategoriasConfiguradas = (catCount ?? 0) === 0

    // Painel: reservas ativas com datas/valor ajustados ao período
    reservasParaPainel = reservasProrated
      .filter(r => !['cancelled', 'canceled', 'no_show'].includes(String(r.status ?? '').toLowerCase()))
      .map(r => ({
        booking_id: r.booking_id ?? '',
        individual_room_name: r.individual_room_name,
        checkin: r.checkin,
        checkout: r.checkout,
        plataforma_normalizada: r.plataforma_normalizada,
        valor_liquido: r.valor_liquido,
        status: r.status,
        nome_hospede: r.nome_hospede,
        apartamento_id: r.apartamento_id ?? '',
      }))

    // Só reservas ativas contam: mês apenas com canceladas é mês sem dados.
    semDados = (diariasData?.length ?? 0) === 0
      && (custosData?.length ?? 0) === 0
      && reservasParaPainel.length === 0

    // KPIs: reservasProrated como fallback Amenitiz quando não há diárias importadas.
    // No mês corrente as reservas viram fonte primária (preferirReservas) para o
    // faturamento acompanhar cada reserva nova em tempo real.
    const metricas = apartamentos.map(apt => calcularKPIs(
      (diariasData  ?? []).filter(d => d.apartamento_id === apt.id),
      (custosData   ?? []).filter(c => c.apartamento_id === apt.id),
      reservasProrated.filter(r => r.apartamento_id === apt.id),
      apt,
      { preferirReservas: isMesCorrente },
    ))

    const total = somarKPIs(metricas)
    kpis = {
      faturamento:  total.receitaTotal,
      custos:       total.custosTotal,
      lucro:        total.lucroLiquido,
      taxaAlugEasy: total.valorRepasse,
      repasse:      total.valorLiquidoProprietario,
      margem:       total.margemLiquida,
    }

    const mesParaHistorico = mes > 0 ? mes : (now.getMonth() + 1)
    const periodos = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ano, mesParaHistorico - 1 - (5 - i), 1)
      return { m: d.getMonth() + 1, a: d.getFullYear(), label: MESES_ABREV[d.getMonth()] }
    })

    historicoData = await Promise.all(
      periodos.map(async ({ m, a, label }) => {
        const di = `${a}-${String(m).padStart(2, '0')}-01`
        const df = new Date(a, m, 0).toISOString().slice(0, 10)
        const [{ data: fat }, { data: cus }] = await Promise.all([
          supabase.from('diarias').select('apartamento_id, valor').in('apartamento_id', aptIds).gte('data', di).lte('data', df),
          supabase.from('custos_proprietario').select('apartamento_id, valor').in('apartamento_id', aptIds).eq('mes', m).eq('ano', a),
        ])
        // Histórico: diárias + custos repassáveis (sem fallback Amenitiz para reduzir
        // queries). Taxa imóvel a imóvel — cada ADM tem o seu percentual.
        const carteira = calcularTaxaCarteira(
          apartamentos,
          (fat ?? []) as { apartamento_id: string; valor: number | null }[],
          (cus ?? []) as { apartamento_id: string; valor: number | null }[],
        )
        return { label, faturamento: carteira.faturamento, lucro: carteira.lucro, repasse: carteira.valorProprietario }
      })
    )

    mesesComDados = historicoData.filter(h => h.faturamento > 0 || h.lucro !== 0).length
  }

  // Taxas de plataforma por imóvel ficam no servidor (lib/amenitiz tem partes só
  // de servidor); a tela recebe os percentuais prontos. Sublocação não paga a
  // taxa AlugEasy da reserva direta — ela nem aparece.
  const apartamentosOcupacao = apartamentos.map(a => {
    const taxas = getTaxasPlataforma(a.empreendimentos?.nome ?? '', a.numero, { mes, ano }, a.tipo_gestao)
    return {
      id: a.id,
      numero: a.numero,
      empreendimento: a.empreendimentos?.nome ?? null,
      tipo_gestao: a.tipo_gestao,
      taxas: { booking: taxas.booking, airbnb: taxas.airbnb, alugueasy: a.tipo_gestao === 'sub' ? null : taxas.alugueasy },
    }
  })

  return (
    <InicioProprietario
      primeiroNome={primeiroNome}
      mes={mes}
      ano={ano}
      labelPeriodo={labelPeriodo}
      isMesCorrente={isMesCorrente}
      kpis={kpis}
      rotuloTaxa={rotuloTaxa}
      semCategoriasConfiguradas={semCategoriasConfiguradas}
      semDados={semDados}
      mesSincronizado={mesSincronizado}
      historico={historicoData}
      mesesComDados={mesesComDados}
      acoes={
        <>
          {mes > 0 && <SyncButton mes={mes} ano={ano} />}
          {/* selo "atualizado há X min" + aviso de reserva nova (Realtime) */}
          <RealtimeReservas apartamentoIds={aptIds} initialIngestAt={ingestAt} />
        </>
      }
      ocupacao={aptIds.length > 0 && (
        <PainelOcupacao
          apartamentos={apartamentosOcupacao}
          reservas={reservasParaPainel}
          mes={mes}
          ano={ano}
          nomeMes={nomeMes}
          sincronizado={mesSincronizado}
        />
      )}
    />
  )
}

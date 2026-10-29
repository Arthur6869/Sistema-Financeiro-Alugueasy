import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, Receipt, Wallet, Clock, BarChart2, FileText, Download, History, AlertCircle, Percent } from 'lucide-react'
import { EvolucaoChart } from '@/components/proprietario/evolucao-chart'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { RealtimeReservas } from '@/components/proprietario/realtime-reservas'
import { MESES, MESES_ABREV } from '@/lib/constants'
import { calcularKPIs, somarKPIs, calcularTaxaCarteira, rotuloTaxaCarteira } from '@/lib/calcular-kpis'
import { OccupancyPanel } from '@/components/proprietario/occupancy-panel'
import { SyncButton } from '@/components/proprietario/sync-button'

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

function formatBRL(valor: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

  const temHistoricoSuficiente = mesesComDados >= 2

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .pg-wrap { font-family: 'DM Sans', sans-serif; max-width: 1100px; margin: 0 auto; padding: 32px 28px 64px; }

        .pg-head { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 28px; }
        .pg-greeting { font-family: 'Instrument Serif', Georgia, serif; font-size: 28px; font-weight: 400; color: #0f1a2e; margin-bottom: 4px; }
        .pg-greeting-sub { font-size: 13px; color: #5a6a82; }
        .pg-period select { font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; color: #0f1a2e; background: #fff; border: 1px solid #e7e9ee; border-radius: 9px; padding: 9px 14px; cursor: pointer; outline: none; }
        .pg-period { display: flex; gap: 8px; align-items: center; }

        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px,1fr)); gap: 14px; margin-bottom: 28px; }
        .kpi-card { background: #fff; border: 1px solid #e7e9ee; border-radius: 16px; padding: 18px 18px 16px; position: relative; overflow: hidden; transition: transform .15s, box-shadow .15s; }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15,38,71,.06); }
        .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .kpi-card.k-navy::before { background: #0f2647; }
        .kpi-card.k-red::before { background: #dc2626; }
        .kpi-card.k-green::before { background: #15803d; }
        .kpi-card.k-amber::before { background: #d97706; }
        .kpi-card.k-slate::before { background: #64748b; }
        .kpi-top { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
        .kpi-icon { width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .kpi-label { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; }
        .kpi-val { font-size: 20px; font-weight: 700; letter-spacing: -.015em; margin-bottom: 3px; color: #0f1a2e; }
        .kpi-foot { font-size: 11.5px; color: #94a3b8; }

        /* Repasse: sempre verde (regra 12 do design doc) */
        .kpi-card.k-repasse .kpi-val { color: #166534; }

        /* Mobile: filtros empilham e ocupam a largura toda — a linha
           botão+selects+badge é mais larga que a tela e criava scroll lateral */
        @media (max-width: 640px) {
          .pg-wrap { padding: 20px 16px 56px; }
          .pg-head { flex-direction: column; align-items: stretch; }
          .pg-period { align-items: stretch !important; }
          .pg-period > div:first-child { flex-wrap: wrap; }
          .pg-period .sync-btn { flex: 1 1 100%; justify-content: center; }
          .pg-period > div:first-child > div { flex: 1; }
          .pg-period select { flex: 1; min-width: 0; }
        }

        /* Mobile hero: repasse vira destaque full-width no topo do grid */
        @media (max-width: 640px) {
          .kpi-card.k-repasse {
            order: -1;
            grid-column: 1 / -1;
            padding: 22px 22px 18px;
            background: #f0fdf4;
            border-color: #bbf7d0;
          }
          .kpi-card.k-repasse .kpi-val { font-size: 34px; letter-spacing: -.02em; }
          .kpi-card.k-repasse .kpi-foot { font-size: 12.5px; }
        }

        .panel { background: #fff; border: 1px solid #e7e9ee; border-radius: 18px; padding: 24px; margin-bottom: 20px; }
        .panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 10px; }
        .panel-title { font-size: 15px; font-weight: 600; color: #0f1a2e; display: flex; align-items: center; gap: 8px; }
        .panel-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }

        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px; text-align: center; }
        .empty-icon { width: 48px; height: 48px; border-radius: 50%; background: #f8f6f1; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; color: #94a3b8; }
        .empty-title { font-size: 14px; font-weight: 600; color: #0f1a2e; margin-bottom: 4px; }
        .empty-desc { font-size: 12.5px; color: #94a3b8; max-width: 280px; }
        .progress-track { width: 200px; height: 6px; background: #f8f6f1; border-radius: 100px; margin-top: 16px; overflow: hidden; }
        .progress-fill { height: 100%; background: #193660; border-radius: 100px; }
        .progress-label { font-size: 11px; color: #94a3b8; margin-top: 8px; }

        .shortcut-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
        .shortcut-card { border: 1px solid #e7e9ee; border-radius: 14px; padding: 18px; text-decoration: none; display: flex; flex-direction: column; gap: 8px; transition: all .15s; cursor: pointer; }
        .shortcut-card:hover { border-color: #193660; background: #f8f6f1; }
        .shortcut-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
        .shortcut-title { font-size: 13.5px; font-weight: 600; color: #0f1a2e; }
        .shortcut-desc { font-size: 11.5px; color: #94a3b8; }

        @media (max-width: 900px) {
          .kpi-grid { grid-template-columns: repeat(2,1fr); }
          .shortcut-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="pg-wrap">

        <div className="pg-head">
          <div>
            <h1 className="pg-greeting">Olá, {primeiroNome}</h1>
            <p className="pg-greeting-sub">Resumo dos seus imóveis em <strong>{labelPeriodo}</strong></p>
          </div>
          <div className="pg-period" data-tour="periodo" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {mes > 0 && <SyncButton mes={mes} ano={ano} />}
              <MonthYearFilter mes={mes} ano={ano} permitirTodosAnos={false} />
            </div>
            {/* Assinatura Realtime: badge "atualizado há X min" + notificação de nova reserva */}
            <RealtimeReservas apartamentoIds={aptIds} initialIngestAt={ingestAt} />
          </div>
        </div>

        {/* Target do portal React: RealtimeReservas injeta aqui a seção "Chegaram agora" */}
        <div id="novas-reservas-portal" />

        {semDados ? (
          <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div className="empty-icon" style={{ margin: '0 auto 14px' }}><Clock size={22} /></div>
            {mesSincronizado ? (
              <>
                <div className="empty-title">Nenhuma diária em {labelPeriodo}</div>
                <div className="empty-desc">A sincronização foi realizada, mas seus imóveis não registraram receita neste período.</div>
              </>
            ) : (
              <>
                <div className="empty-title">Dados de {labelPeriodo} ainda não importados</div>
                <div className="empty-desc">A importação de planilhas ou sincronização Amenitiz para este mês ainda não foi realizada.</div>
              </>
            )}
          </div>
        ) : (
        <div className="kpi-grid" data-tour="kpis">
          <div className="kpi-card k-navy">
            <div className="kpi-top">
              <div className="kpi-icon" style={{ background: '#e6f1fb' }}><TrendingUp size={14} color="#0c447c" /></div>
              <span className="kpi-label">Faturamento</span>
            </div>
            <div className="kpi-val">R$ {formatBRL(kpis.faturamento)}</div>
            <div className="kpi-foot">{isMesCorrente ? `${labelPeriodo} · ao vivo` : labelPeriodo}</div>
          </div>

          <div className="kpi-card k-red">
            <div className="kpi-top">
              <div className="kpi-icon" style={{ background: '#fef2f2' }}><Receipt size={14} color="#dc2626" /></div>
              <span className="kpi-label">Custos</span>
            </div>
            <div className="kpi-val">R$ {formatBRL(kpis.custos)}</div>
            {semCategoriasConfiguradas ? (
              <div className="kpi-foot" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#b45309' }}>
                <AlertCircle size={11} />
                Sem categorias configuradas
              </div>
            ) : (
              <div className="kpi-foot">{labelPeriodo}</div>
            )}
          </div>

          <div className="kpi-card k-green">
            <div className="kpi-top">
              <div className="kpi-icon" style={{ background: '#eaf3de' }}><TrendingUp size={14} color="#27500a" /></div>
              <span className="kpi-label">Lucro líquido</span>
            </div>
            <div className="kpi-val" style={{ color: '#166534' }}>R$ {formatBRL(kpis.lucro)}</div>
            <div className="kpi-foot">Margem de {kpis.margem.toFixed(0)}% no período</div>
          </div>

          {rotuloTaxa !== '' && (
          <div className="kpi-card k-slate">
            <div className="kpi-top">
              <div className="kpi-icon" style={{ background: '#f1f5f9' }}><Percent size={14} color="#475569" /></div>
              <span className="kpi-label" title="Taxa de administração AlugEasy, calculada imóvel a imóvel">Taxa AlugEasy</span>
            </div>
            <div className="kpi-val" style={{ color: '#475569' }}>− R$ {formatBRL(kpis.taxaAlugEasy)}</div>
            <div className="kpi-foot">{rotuloTaxa}</div>
          </div>
          )}

          <div className="kpi-card k-amber k-repasse" data-tour="repasse">
            <div className="kpi-top">
              <div className="kpi-icon" style={{ background: '#f0fdf4' }}><Wallet size={14} color="#166534" /></div>
              <span className="kpi-label" title="Lucro do mês menos a taxa de gestão AlugEasy">Seu repasse</span>
            </div>
            <div className="kpi-val">R$ {formatBRL(kpis.repasse)}</div>
            <div className="kpi-foot">Valor líquido ao proprietário</div>
          </div>
        </div>
        )}

        {/* Evolução antes das reservas: usuário entende a tendência antes dos detalhes */}
        <div className="panel" data-tour="evolucao">
          <div className="panel-head">
            <div>
              <div className="panel-title"><BarChart2 size={16} color="#193660" /> Evolução dos últimos 6 meses</div>
              <div className="panel-sub">Faturamento e repasse mês a mês</div>
            </div>
          </div>

          {temHistoricoSuficiente ? (
            <div style={{ height: 192 }}>
              <EvolucaoChart data={historicoData} />
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><Clock size={22} /></div>
              <div className="empty-title">Histórico em construção</div>
              <div className="empty-desc">O gráfico de evolução fica disponível depois de 2 meses de operação contínua.</div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.min(100, mesesComDados * 50)}%` }} />
              </div>
              <div className="progress-label">{mesesComDados} de 2 meses necessários</div>
            </div>
          )}
        </div>

        {/* Painel de ocupação por imóvel — grade de dias + cards de reservas */}
        {aptIds.length > 0 && (
          <div data-tour="ocupacao">
          <OccupancyPanel
            apartamentos={apartamentos.map(a => ({
              id: a.id,
              numero: a.numero,
              empreendimento: a.empreendimentos?.nome ?? null,
              tipo_gestao: a.tipo_gestao,
            }))}
            reservas={reservasParaPainel}
            mes={mes}
            ano={ano}
            nomeMes={nomeMes}
            sincronizado={mesSincronizado}
          />
          </div>
        )}

        <div className="panel" data-tour="atalhos" style={{ paddingBottom: 18 }}>
          <div className="panel-head">
            <div className="panel-title">Acesso rápido</div>
          </div>
          <div className="shortcut-grid">
            <Link href={`/proprietario/extrato?mes=${mes}&ano=${ano}`} className="shortcut-card">
              <div className="shortcut-icon" style={{ background: '#e6f1fb' }}><FileText size={17} color="#0c447c" /></div>
              <div className="shortcut-title">Ver rentabilidade completa</div>
              <div className="shortcut-desc">Detalhamento por apartamento do mês atual</div>
            </Link>
            <Link href={`/proprietario/extrato?mes=${mes}&ano=${ano}`} className="shortcut-card">
              <div className="shortcut-icon" style={{ background: '#faeeda' }}><Download size={17} color="#854f0b" /></div>
              <div className="shortcut-title">Rentabilidade e PDF</div>
              <div className="shortcut-desc">Veja o demonstrativo e baixe a prestação de contas</div>
            </Link>
            <Link href="/proprietario/historico" className="shortcut-card">
              <div className="shortcut-icon" style={{ background: '#eaf3de' }}><History size={17} color="#27500a" /></div>
              <div className="shortcut-title">Consultar histórico</div>
              <div className="shortcut-desc">Acompanhe os últimos 12 meses</div>
            </Link>
          </div>
        </div>

      </div>
    </>
  )
}

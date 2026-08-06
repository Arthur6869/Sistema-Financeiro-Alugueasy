import { NextRequest, NextResponse } from 'next/server'
import { getSessaoApi } from '@/lib/supabase/api-client'
import { cabecalhosCors, respostaPreflight } from '@/lib/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { pdf } from '@react-pdf/renderer'
import { PrestacaoContasPdf } from '@/components/pdf/prestacao-contas-pdf'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { MESES, MESES_ABREV } from '@/lib/constants'

function slugify(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function r2(n: number) { return Math.round(n * 100) / 100 }

// O navegador dispara um preflight antes de um GET que leva header Authorization.
// Sem esta resposta, a versão web do app nem chega a fazer o download.
export async function OPTIONS(request: NextRequest) {
  return respostaPreflight(request)
}

export async function GET(request: NextRequest) {
  // Toda resposta — inclusive as de erro — precisa dos headers de CORS, senão o
  // navegador bloqueia a leitura e o app só vê "erro de rede", sem o motivo.
  const cors = cabecalhosCors(request)
  const erro = (mensagem: string, status: number) =>
    NextResponse.json({ error: mensagem }, { status, headers: cors })

  try {
    const { searchParams } = new URL(request.url)
    const apartamentoId = searchParams.get('apartamento_id')
    const mes = parseInt(searchParams.get('mes') || '')
    const ano = parseInt(searchParams.get('ano') || '')

    if (!apartamentoId || !mes || !ano)
      return erro('apartamento_id, mes e ano são obrigatórios', 400)

    // Auth via sessão de cookie (web) ou Authorization: Bearer (app mobile)
    const { supabase, userId, role, ativo } = await getSessaoApi(request)
    if (!userId)
      return erro('Não autenticado', 401)

    // Verificar ownership: proprietário só acessa seus próprios apartamentos
    if (role === 'proprietario') {
      // Conta suspensa não baixa prestação de contas. O proxy.ts checa `ativo`,
      // mas o matcher exclui /api — e um app mobile nunca passa pelo proxy.
      if (!ativo)
        return erro('Conta desativada', 403)

      const { count } = await supabase
        .from('proprietario_apartamentos')
        .select('*', { count: 'exact', head: true })
        .eq('proprietario_id', userId)
        .eq('apartamento_id', apartamentoId)
        .eq('ativo', true)
      if (!count || count === 0)
        return erro('Acesso negado', 403)
    } else if (!role || !['admin', 'analista'].includes(role)) {
      return erro('Acesso negado', 403)
    }

    // All data via admin client (bypasses RLS — autorização já verificada acima)
    const admin = createAdminClient()

    type AptRow = {
      id: string
      numero: string
      tipo_gestao: string | null
      taxa_repasse: number | null
      tipo_repasse: string | null
      nome_proprietario: string | null
      modelo_contrato: string | null
      empreendimentos: Array<{ nome: string }> | null
    }
    type DiariaRow = { valor: number | null; tipo_gestao: string | null }
    type CustoRow  = { valor: number | null; categoria: string | null; tipo_gestao: string | null }
    type ReservaRow = {
      valor_liquido: number | null
      status: string | null
      checkin: string | null
      checkout: string | null
      nome_hospede: string | null
      plataforma: string | null
    }

    const { data: aptRaw, error: aptErr } = await admin
      .from('apartamentos')
      .select('id, numero, tipo_gestao, taxa_repasse, tipo_repasse, nome_proprietario, modelo_contrato, empreendimentos(id, nome)')
      .eq('id', apartamentoId)
      .single()

    if (aptErr || !aptRaw)
      return erro('Apartamento não encontrado', 404)

    const apt = aptRaw as unknown as AptRow

    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)
    const empNome = (apt.empreendimentos)?.[0]?.nome ?? ''

    // ── Busca principal em paralelo ──────────────────────────────────────────
    const [
      { data: diariasRaw },
      { data: custosRaw },
      { data: reservasRawData },
    ] = await Promise.all([
      admin.from('diarias').select('valor, tipo_gestao').eq('apartamento_id', apartamentoId).gte('data', dataInicio).lte('data', dataFim),
      admin.from('custos').select('valor, categoria, tipo_gestao').eq('apartamento_id', apartamentoId).eq('mes', mes).eq('ano', ano),
      // Reservas por sobreposição de datas (não mes_competencia).
      // Reservas que cruzam o mês têm valor prorado proporcionalmente logo abaixo.
      admin.from('amenitiz_reservas')
        .select('valor_liquido, status, checkin, checkout, nome_hospede, plataforma')
        .eq('apartamento_id', apartamentoId)
        .lte('checkin', dataFim)
        .gte('checkout', dataInicio)
        .order('checkin'),
    ])
    const diarias = (diariasRaw ?? []) as DiariaRow[]
    const custos  = (custosRaw ?? []) as CustoRow[]

    // Proration: clipa datas ao mês e calcula valor proporcional às noites no período.
    const firstDayMs  = new Date(dataInicio + 'T00:00:00').getTime()
    const nextMonthMs = new Date(ano, mes, 1).getTime()
    const reservasRaw: ReservaRow[] = ((reservasRawData ?? []) as ReservaRow[]).flatMap(r => {
      let checkin  = r.checkin
      let checkout = r.checkout
      let valor    = r.valor_liquido
      if (r.checkin && r.checkout && r.valor_liquido != null) {
        const ci = new Date(r.checkin  + 'T00:00:00').getTime()
        const co = new Date(r.checkout + 'T00:00:00').getTime()
        const totalNights = (co - ci) / 86400000
        const monthNights = (Math.min(co, nextMonthMs) - Math.max(ci, firstDayMs)) / 86400000
        if (monthNights <= 0) return []
        if (totalNights > 0 && monthNights < totalNights) {
          valor    = (monthNights / totalNights) * r.valor_liquido
          if (ci < firstDayMs)  checkin  = dataInicio
          if (co > nextMonthMs) checkout = dataFim
        }
      }
      return [{ ...r, checkin, checkout, valor_liquido: valor }]
    })

    // ── Histórico 6 meses (sequencial — usa diárias + proration de reservas) ─
    const historicoMeses: Array<{ label: string; faturamento: number; custos: number; lucro: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ano, mes - 1 - i, 1)
      const m = d.getMonth() + 1
      const a = d.getFullYear()
      const di = `${a}-${String(m).padStart(2, '0')}-01`
      const df = new Date(a, m, 0).toISOString().slice(0, 10)
      const firstMs  = new Date(di + 'T00:00:00').getTime()
      const nextMs   = new Date(a, m, 1).getTime()
      const [{ data: fatDiarias }, { data: fatReservas }, { data: custH }] = await Promise.all([
        admin.from('diarias').select('valor').eq('apartamento_id', apt.id).gte('data', di).lte('data', df),
        admin.from('amenitiz_reservas').select('valor_liquido, checkin, checkout, status')
          .eq('apartamento_id', apt.id).lte('checkin', df).gte('checkout', di),
        admin.from('custos').select('valor').eq('apartamento_id', apt.id).eq('mes', m).eq('ano', a),
      ])
      const fatDiariaTotal = ((fatDiarias ?? []) as Array<{ valor: number | null }>)
        .reduce((s, r) => s + (r.valor ?? 0), 0)
      const fatReservaTotal = fatDiariaTotal > 0 ? 0 :
        ((fatReservas ?? []) as Array<{ valor_liquido: number | null; checkin: string | null; checkout: string | null; status: string | null }>)
          .filter(r => !['cancelled', 'canceled', 'no_show'].includes(String(r.status ?? '').toLowerCase()))
          .reduce((s, r) => {
            if (!r.checkin || !r.checkout || r.valor_liquido == null) return s + (r.valor_liquido ?? 0)
            const ci2 = new Date(r.checkin + 'T00:00:00').getTime()
            const co2 = new Date(r.checkout + 'T00:00:00').getTime()
            const tot = (co2 - ci2) / 86400000
            const mn  = (Math.min(co2, nextMs) - Math.max(ci2, firstMs)) / 86400000
            return s + (tot > 0 && mn < tot ? (mn / tot) * r.valor_liquido : (r.valor_liquido ?? 0))
          }, 0)
      const fat  = r2(fatDiariaTotal + fatReservaTotal)
      const cust = r2(((custH ?? []) as Array<{ valor: number | null }>).reduce((s, r) => s + (r.valor ?? 0), 0))
      historicoMeses.push({ label: `${MESES_ABREV[m - 1]}/${a}`, faturamento: fat, custos: cust, lucro: r2(fat - cust) })
    }

    // ── Cálculos de faturamento ──────────────────────────────────────────────
    const reservasValidas = (reservasRaw ?? []).filter(
      r => !['cancelled', 'canceled', 'no_show'].includes(String(r.status ?? '').toLowerCase())
    )

    const receitaAdmDiarias = (diarias ?? []).filter(d => d.tipo_gestao === 'adm').reduce((s, d) => s + Number(d.valor ?? 0), 0)
    const receitaSubDiarias = (diarias ?? []).filter(d => d.tipo_gestao === 'sub').reduce((s, d) => s + Number(d.valor ?? 0), 0)
    const receitaDiariasTotal = receitaAdmDiarias + receitaSubDiarias
    const receitaReservasTotal = reservasValidas.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)

    const usarDiarias = receitaDiariasTotal > 0
    let receitaAdm = receitaAdmDiarias
    let receitaSub = receitaSubDiarias
    if (!usarDiarias && receitaReservasTotal > 0) {
      const fallbackGestao = apt.tipo_gestao ?? (apt.modelo_contrato === 'sublocacao' ? 'sub' : 'adm')
      if (fallbackGestao === 'sub') receitaSub = receitaReservasTotal
      else receitaAdm = receitaReservasTotal
    }
    const receitaTotal = receitaAdm + receitaSub
    const custosAdm = (custos ?? []).filter(c => c.tipo_gestao === 'adm').reduce((s, c) => s + Number(c.valor ?? 0), 0)
    const custosSub = (custos ?? []).filter(c => c.tipo_gestao === 'sub').reduce((s, c) => s + Number(c.valor ?? 0), 0)
    const custosTotal = custosAdm + custosSub
    const lucroLiquido = receitaTotal - custosTotal
    const taxa = Number(apt.taxa_repasse ?? 0) / 100
    const baseCalculo = apt.tipo_repasse === 'faturamento' ? receitaTotal : lucroLiquido
    const valorRepasse = baseCalculo * taxa
    const valorLiquidoProprietario = lucroLiquido - valorRepasse

    // ── Indicadores operacionais ─────────────────────────────────────────────
    let numReservas: number
    let totalDiarias: number
    let valorMedioDiaria: number
    let mediaDiariasPorReserva: number
    if (usarDiarias) {
      totalDiarias = (diarias ?? []).reduce((s) => s + 1, 0)
      numReservas = totalDiarias > 0 ? Math.max(1, Math.round(totalDiarias / 3)) : 0
      valorMedioDiaria = totalDiarias > 0 ? receitaTotal / totalDiarias : 0
      mediaDiariasPorReserva = numReservas > 0 ? totalDiarias / numReservas : 0
    } else {
      numReservas = reservasValidas.length
      totalDiarias = reservasValidas.reduce((s, r) => {
        const noites = Math.max(1, Math.round(
          (new Date(r.checkout + 'T00:00:00').getTime() - new Date(r.checkin + 'T00:00:00').getTime()) / 86_400_000
        ))
        return s + noites
      }, 0)
      valorMedioDiaria = totalDiarias > 0 ? receitaReservasTotal / totalDiarias : 0
      mediaDiariasPorReserva = numReservas > 0 ? totalDiarias / numReservas : 0
    }
    const diasNoMes = new Date(Number(ano), Number(mes), 0).getDate()
    const taxaOcupacao = diasNoMes > 0 ? (totalDiarias / diasNoMes) * 100 : undefined

    // ── Breakdown por plataforma ─────────────────────────────────────────────
    const platMap: Record<string, number> = {}
    for (const r of reservasValidas) {
      const p = r.plataforma ?? 'Outros'
      platMap[p] = (platMap[p] ?? 0) + Number(r.valor_liquido ?? 0)
    }
    const totalPlat = Object.values(platMap).reduce((s, v) => s + v, 0)
    const porPlataforma = Object.entries(platMap)
      .map(([plataforma, valor]) => ({
        plataforma,
        valor: r2(valor),
        percentual: totalPlat > 0 ? r2((valor / totalPlat) * 100) : 0,
      }))
      .sort((a, b) => b.valor - a.valor)

    // ── Reservas enriquecidas ────────────────────────────────────────────────
    const reservasEnriquecidas = reservasValidas.map(r => {
      const noites = Math.max(1, Math.round((new Date(`${r.checkout}T00:00:00`).getTime() - new Date(`${r.checkin}T00:00:00`).getTime()) / 86_400_000))
      return {
        checkin: r.checkin ?? '',
        checkout: r.checkout ?? '',
        nome_hospede: r.nome_hospede ?? null,
        plataforma: r.plataforma ?? null,
        valor_liquido: r2(Number(r.valor_liquido ?? 0)),
        noites,
      }
    })

    // ── Custos detalhados ────────────────────────────────────────────────────
    const custosDetalhados = (custos ?? []).map(c => ({
      categoria: c.categoria ?? 'Desconhecido',
      tipoGestao: c.tipo_gestao === 'adm' ? 'ADM' : 'SUB',
      valor: r2(Number(c.valor ?? 0)),
    }))

    // ── Logo ─────────────────────────────────────────────────────────────────
    const logoPath = path.resolve(process.cwd(), 'public', 'logo-alugueasy.png')
    const logoBase64 = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`

    // ── Renderizar PDF ───────────────────────────────────────────────────────
    const document = (
      <PrestacaoContasPdf
        logoBase64={logoBase64}
        empreendimento={empNome}
        apartamento={String(apt.numero)}
        mesNome={MESES[mes - 1]}
        ano={String(ano)}
        nomeProprietario={apt.nome_proprietario ?? 'Não configurado'}
        modeloContrato={apt.modelo_contrato ?? 'administracao'}
        taxaRepasse={Number(apt.taxa_repasse ?? 0)}
        tipoRepasse={apt.tipo_repasse ?? 'lucro'}
        receitaTotal={r2(receitaTotal)}
        custosTotal={r2(custosTotal)}
        lucroLiquido={r2(lucroLiquido)}
        valorRepasse={r2(valorRepasse)}
        valorLiquidoProprietario={r2(valorLiquidoProprietario)}
        receitaAdm={r2(receitaAdm)}
        receitaSub={r2(receitaSub)}
        custosAdm={r2(custosAdm)}
        custosSub={r2(custosSub)}
        custosDetalhados={custosDetalhados}
        numReservas={numReservas}
        totalDiarias={totalDiarias}
        taxaOcupacao={taxaOcupacao}
        valorMedioDiaria={r2(valorMedioDiaria)}
        mediaDiariasPorReserva={r2(mediaDiariasPorReserva)}
        usandoDiarias={usarDiarias}
        reservas={reservasEnriquecidas}
        historicoMeses={historicoMeses}
        porPlataforma={porPlataforma}
      />
    )

    const pdfBytes = await pdf(document).toBuffer()

    const fileName = `Prestacao_${slugify(empNome || 'Imovel')}_Apt-${slugify(String(apt.numero ?? '000'))}_${slugify(MESES[mes - 1] ?? String(mes))}-${ano}.pdf`

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        ...cabecalhosCors(request),
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao gerar o PDF'
    return erro(msg, 500)
  }
}

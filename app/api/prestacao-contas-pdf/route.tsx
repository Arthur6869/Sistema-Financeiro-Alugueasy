import { NextRequest, NextResponse } from 'next/server'
import { getSessaoApi } from '@/lib/supabase/api-client'
import { cabecalhosCors, respostaPreflight } from '@/lib/cors'
import { createAdminClient } from '@/lib/supabase/admin'
import { pdf } from '@react-pdf/renderer'
import {
  PrestacaoContasPdf,
  type CanalKey, type CanalResumo, type CustoLinha,
  type ProximoMesResumo, type ReservaLinha,
} from '@/components/pdf/prestacao-contas-pdf'
import { calcularKPIs } from '@/lib/calcular-kpis'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { MESES } from '@/lib/constants'

function slugify(v: string) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function r2(n: number) { return Math.round(n * 100) / 100 }
function pad2(n: number) { return String(n).padStart(2, '0') }

const DIA_MS = 86_400_000
const CANCELADAS = ['cancelled', 'canceled', 'no_show']

function canalDe(plataforma: string | null): CanalKey {
  const p = String(plataforma ?? '').toLowerCase()
  if (p.includes('booking')) return 'booking'
  if (p.includes('airbnb')) return 'airbnb'
  return 'alugueasy'
}

// LGPD: só primeiro nome + inicial do sobrenome. `nome_hospede` chega do sync
// como "Nome Sobrenome — telefone" — o telefone NUNCA vai para o PDF.
function nomeLgpd(raw: string | null): string {
  const semTelefone = String(raw ?? '').split('—')[0].split(' - ')[0]
  const partes = semTelefone.trim().split(/\s+/).filter(p => p && !/\d/.test(p))
  if (partes.length === 0) return 'Hóspede'
  if (partes.length === 1) return partes[0]
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`
}

// Custos recorrentes = mensalidades e serviços contínuos; o resto é eventual.
const RECORRENTES = [
  'condominio', 'internet', 'energia', 'luz', 'agua', 'iptu', 'lavanderia',
  'assinatura', 'mensalidade', 'gas', 'wifi', 'wi-fi', 'tv', 'streaming',
  'seguro', 'telefone', 'celular',
]
function ehRecorrente(categoria: string): boolean {
  const norm = categoria.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  return RECORRENTES.some(k => norm.includes(k))
}

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
    type DiariaRow = { valor: number | null; tipo_gestao: string | null; data: string | null }
    type CustoRow  = { valor: number | null; categoria: string | null; tipo_gestao: string | null }
    type ReservaRow = {
      valor_liquido: number | null
      valor_bruto: number | null
      status: string | null
      checkin: string | null
      checkout: string | null
      nome_hospede: string | null
      plataforma_normalizada: string | null
    }

    const { data: aptRaw, error: aptErr } = await admin
      .from('apartamentos')
      .select('id, numero, tipo_gestao, taxa_repasse, tipo_repasse, nome_proprietario, modelo_contrato, empreendimentos(id, nome)')
      .eq('id', apartamentoId)
      .single()

    if (aptErr || !aptRaw)
      return erro('Apartamento não encontrado', 404)

    const apt = aptRaw as unknown as AptRow

    const diasDoMes = new Date(ano, mes, 0).getDate()
    const dataInicio = `${ano}-${pad2(mes)}-01`
    const dataFim = `${ano}-${pad2(mes)}-${pad2(diasDoMes)}`
    const empNome = (apt.empreendimentos)?.[0]?.nome ?? ''

    // Próximo mês (seção "reservas já confirmadas")
    const proxDate = new Date(ano, mes, 1)
    const proxMes = proxDate.getMonth() + 1
    const proxAno = proxDate.getFullYear()
    const proxDias = new Date(proxAno, proxMes, 0).getDate()
    const proxInicio = `${proxAno}-${pad2(proxMes)}-01`
    const proxFim = `${proxAno}-${pad2(proxMes)}-${pad2(proxDias)}`

    // Janela de histórico: 6 meses anteriores. Uso EXCLUSIVAMENTE interno, para
    // a média de custos dos meses em operação — nada de receita histórica no PDF
    // (decisão de produto definitiva).
    const histDate = new Date(ano, mes - 7, 1)
    const histInicio = `${histDate.getFullYear()}-${pad2(histDate.getMonth() + 1)}-01`

    // ── Busca principal em paralelo ──────────────────────────────────────────
    const [
      { data: diariasRaw },
      { data: custosRaw },
      { data: reservasRawData },
      { data: histDiariasRaw },
      { data: histCustosRaw },
      { data: histReservasRaw },
      { data: proxReservasRaw },
    ] = await Promise.all([
      admin.from('diarias').select('valor, tipo_gestao, data')
        .eq('apartamento_id', apartamentoId).gte('data', dataInicio).lte('data', dataFim),
      admin.from('custos').select('valor, categoria, tipo_gestao')
        .eq('apartamento_id', apartamentoId).eq('mes', mes).eq('ano', ano),
      // Reservas por sobreposição de datas (não mes_competencia).
      // Reservas que cruzam o mês entram com rateio proporcional às noites.
      admin.from('amenitiz_reservas')
        .select('valor_liquido, valor_bruto, status, checkin, checkout, nome_hospede, plataforma_normalizada')
        .eq('apartamento_id', apartamentoId)
        .lte('checkin', dataFim)
        .gte('checkout', dataInicio)
        .order('checkin'),
      admin.from('diarias').select('valor, data')
        .eq('apartamento_id', apartamentoId).gte('data', histInicio).lt('data', dataInicio),
      admin.from('custos').select('valor, mes, ano')
        .eq('apartamento_id', apartamentoId).in('ano', [histDate.getFullYear(), ano]),
      admin.from('amenitiz_reservas').select('valor_liquido, status, checkin, checkout')
        .eq('apartamento_id', apartamentoId).lt('checkin', dataInicio).gte('checkout', histInicio),
      admin.from('amenitiz_reservas').select('valor_liquido, status, checkin, checkout')
        .eq('apartamento_id', apartamentoId).lte('checkin', proxFim).gte('checkout', proxInicio),
    ])
    const diarias = (diariasRaw ?? []) as DiariaRow[]
    const custos  = (custosRaw ?? []) as CustoRow[]

    const firstMs = Date.parse(`${dataInicio}T00:00:00Z`)
    const nextMs  = Date.parse(`${proxInicio}T00:00:00Z`)

    // ── Reservas do mês: rateio, canal e LGPD ────────────────────────────────
    type ReservaCalc = {
      hospede: string; checkin: string; checkout: string
      noitesNoMes: number; cruzaMes: boolean; canal: CanalKey
      liquidoMes: number; brutoMes: number | null
      iniMs: number; fimMs: number
    }
    const reservasCalc: ReservaCalc[] = ((reservasRawData ?? []) as ReservaRow[]).flatMap(r => {
      if (CANCELADAS.includes(String(r.status ?? '').toLowerCase())) return []
      if (!r.checkin || !r.checkout) return []
      const ci = Date.parse(`${r.checkin}T00:00:00Z`)
      const co = Date.parse(`${r.checkout}T00:00:00Z`)
      const noitesTotais = Math.round((co - ci) / DIA_MS)
      const iniMs = Math.max(ci, firstMs)
      const fimMs = Math.min(co, nextMs)
      const noitesNoMes = Math.round((fimMs - iniMs) / DIA_MS)
      if (noitesNoMes <= 0) return []
      const frac = noitesTotais > 0 ? noitesNoMes / noitesTotais : 1
      const bruto = Number(r.valor_bruto ?? 0)
      return [{
        hospede: nomeLgpd(r.nome_hospede),
        checkin: r.checkin,
        checkout: r.checkout,
        noitesNoMes,
        cruzaMes: noitesNoMes < noitesTotais,
        canal: canalDe(r.plataforma_normalizada),
        liquidoMes: Number(r.valor_liquido ?? 0) * frac,
        brutoMes: bruto > 0 ? bruto * frac : null,
        iniMs, fimMs,
      }]
    })

    // ── Calendário de ocupação (uma cor por noite) ───────────────────────────
    const ocupacaoDias: Array<CanalKey | null> = Array.from({ length: diasDoMes }, () => null)
    for (const r of reservasCalc) {
      for (let ms = r.iniMs; ms < r.fimMs; ms += DIA_MS) {
        const idx = Math.round((ms - firstMs) / DIA_MS)
        if (idx >= 0 && idx < diasDoMes) ocupacaoDias[idx] = r.canal
      }
    }
    // Mês sem reserva Amenitiz: dias ocupados vêm das diárias conferidas
    // (lançamentos manuais/planilha) — pintados como Alugueasy.
    if (reservasCalc.length === 0) {
      for (const d of diarias) {
        if (Number(d.valor ?? 0) > 0 && d.data) {
          const idx = Math.round((Date.parse(`${d.data}T00:00:00Z`) - firstMs) / DIA_MS)
          if (idx >= 0 && idx < diasDoMes) ocupacaoDias[idx] = 'alugueasy'
        }
      }
    }
    const noites = ocupacaoDias.filter(Boolean).length

    // ── Financeiro: mesma regra do portal (lib/calcular-kpis.ts) ─────────────
    const kpis = calcularKPIs(
      diarias, custos,
      reservasCalc.map(r => ({ valor_liquido: r.liquidoMes, status: 'ok' })),
      {
        tipo_gestao: (apt.tipo_gestao === 'sub' ? 'sub' : apt.tipo_gestao === 'adm' ? 'adm' : null),
        taxa_repasse: apt.taxa_repasse,
        tipo_repasse: apt.tipo_repasse === 'faturamento' ? 'faturamento' : apt.tipo_repasse === 'lucro' ? 'lucro' : null,
        modelo_contrato: apt.modelo_contrato === 'sublocacao' ? 'sublocacao' : apt.modelo_contrato === 'administracao' ? 'administracao' : null,
      },
    )
    const receita = r2(kpis.receitaTotal)

    // ── Do bruto ao líquido ──────────────────────────────────────────────────
    const comBruto = reservasCalc.filter(r => r.brutoMes !== null)
    const receitaBruta = r2(comBruto.reduce((s, r) => s + (r.brutoMes ?? 0), 0))
    const liquidoComBruto = comBruto.reduce((s, r) => s + r.liquidoMes, 0)
    const taxasPlataforma = r2(receitaBruta - liquidoComBruto)
    // Residual que fecha o encadeamento na receita da apuração: reservas sem
    // valor bruto + diferenças da planilha conferida (quando a fonte é diárias).
    const ajusteManual = r2(receita - liquidoComBruto)

    // ── Receita por canal ────────────────────────────────────────────────────
    const canaisMap = new Map<CanalKey, { reservas: number; noites: number; receita: number; bruto: number; liquidoComBruto: number }>()
    for (const r of reservasCalc) {
      const c = canaisMap.get(r.canal) ?? { reservas: 0, noites: 0, receita: 0, bruto: 0, liquidoComBruto: 0 }
      c.reservas++
      c.noites += r.noitesNoMes
      c.receita += r.liquidoMes
      if (r.brutoMes !== null) { c.bruto += r.brutoMes; c.liquidoComBruto += r.liquidoMes }
      canaisMap.set(r.canal, c)
    }
    const canais: CanalResumo[] = [...canaisMap.entries()]
      .map(([canal, c]) => ({
        canal,
        reservas: c.reservas,
        noites: c.noites,
        receita: r2(c.receita),
        taxaEfetivaPct: c.bruto > 0 ? r2(((c.bruto - c.liquidoComBruto) / c.bruto) * 100) : null,
      }))
      .sort((a, b) => b.receita - a.receita)

    // ── Linhas de reservas (LGPD já aplicado) ────────────────────────────────
    const reservasLinhas: ReservaLinha[] = reservasCalc.map(r => ({
      hospede: r.hospede,
      checkin: r.checkin,
      checkout: r.checkout,
      noites: r.noitesNoMes,
      canal: r.canal,
      valor: r2(r.liquidoMes),
      cruzaMes: r.cruzaMes,
    }))

    // ── Custos agregados por categoria + tipo Recorrente/Eventual ────────────
    const custosAgg = new Map<string, number>()
    for (const c of custos) {
      const cat = c.categoria ?? 'Outros'
      custosAgg.set(cat, (custosAgg.get(cat) ?? 0) + Number(c.valor ?? 0))
    }
    const custosLinhas: CustoLinha[] = [...custosAgg.entries()]
      .map(([categoria, valor]) => ({ categoria, recorrente: ehRecorrente(categoria), valor: r2(valor) }))

    // ── Média de custos dos meses anteriores em operação (uso interno) ───────
    const histDiarias = (histDiariasRaw ?? []) as Array<{ valor: number | null; data: string | null }>
    const histCustos  = (histCustosRaw ?? []) as Array<{ valor: number | null; mes: number | null; ano: number | null }>
    const histReservas = (histReservasRaw ?? []) as Array<{ valor_liquido: number | null; status: string | null; checkin: string | null; checkout: string | null }>
    const custosMesesOperacao: number[] = []
    for (let k = 6; k >= 1; k--) {
      const d = new Date(ano, mes - 1 - k, 1)
      const m = d.getMonth() + 1
      const a = d.getFullYear()
      const mIniMs = Date.parse(`${a}-${pad2(m)}-01T00:00:00Z`)
      const mFimMs = Date.parse(`${new Date(a, m, 1).getFullYear()}-${pad2(new Date(a, m, 1).getMonth() + 1)}-01T00:00:00Z`)
      const fatDiarias = histDiarias.reduce((s, r) => {
        if (!r.data) return s
        const ms = Date.parse(`${r.data}T00:00:00Z`)
        return ms >= mIniMs && ms < mFimMs ? s + Number(r.valor ?? 0) : s
      }, 0)
      const fatReservas = fatDiarias > 0 ? 0 : histReservas.reduce((s, r) => {
        if (CANCELADAS.includes(String(r.status ?? '').toLowerCase())) return s
        if (!r.checkin || !r.checkout) return s
        const ci = Date.parse(`${r.checkin}T00:00:00Z`)
        const co = Date.parse(`${r.checkout}T00:00:00Z`)
        const tot = Math.round((co - ci) / DIA_MS)
        const dentro = Math.round((Math.min(co, mFimMs) - Math.max(ci, mIniMs)) / DIA_MS)
        if (dentro <= 0) return s
        return s + Number(r.valor_liquido ?? 0) * (tot > 0 ? dentro / tot : 1)
      }, 0)
      if (fatDiarias + fatReservas <= 0) continue // mês fora de operação
      const custosMes = histCustos.reduce((s, r) =>
        r.mes === m && r.ano === a ? s + Number(r.valor ?? 0) : s, 0)
      custosMesesOperacao.push(custosMes)
    }
    const mediaCustosHistorica = custosMesesOperacao.length > 0
      ? r2(custosMesesOperacao.reduce((s, v) => s + v, 0) / custosMesesOperacao.length)
      : null

    // ── Próximo mês: reservas já confirmadas ─────────────────────────────────
    const proxIniMs = Date.parse(`${proxInicio}T00:00:00Z`)
    const proxFimMs = proxIniMs + proxDias * DIA_MS
    const proxOcupados = new Set<number>()
    let proxReceita = 0
    let proxCount = 0
    for (const r of (proxReservasRaw ?? []) as Array<{ valor_liquido: number | null; status: string | null; checkin: string | null; checkout: string | null }>) {
      if (CANCELADAS.includes(String(r.status ?? '').toLowerCase())) continue
      if (!r.checkin || !r.checkout) continue
      const ci = Date.parse(`${r.checkin}T00:00:00Z`)
      const co = Date.parse(`${r.checkout}T00:00:00Z`)
      const tot = Math.round((co - ci) / DIA_MS)
      const ini = Math.max(ci, proxIniMs)
      const fim = Math.min(co, proxFimMs)
      const dentro = Math.round((fim - ini) / DIA_MS)
      if (dentro <= 0) continue
      proxCount++
      proxReceita += Number(r.valor_liquido ?? 0) * (tot > 0 ? dentro / tot : 1)
      for (let ms = ini; ms < fim; ms += DIA_MS) proxOcupados.add(Math.round((ms - proxIniMs) / DIA_MS))
    }
    const proximoMes: ProximoMesResumo | null = proxCount > 0
      ? { mes: proxMes, ano: proxAno, noites: proxOcupados.size, diasDoMes: proxDias, reservas: proxCount, receitaPrevista: r2(proxReceita) }
      : null

    // ── Identificação do documento ───────────────────────────────────────────
    const tipoDoc = (apt.tipo_gestao === 'sub' || apt.modelo_contrato === 'sublocacao') ? 'SUB' : 'ADM'
    const documento = `PC-${tipoDoc}-${ano}${pad2(mes)}-APT${String(apt.numero).replace(/\s+/g, '')}`
    const agora = new Date()
    const emitidoEm = agora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    const geradoEm = `${emitidoEm} ${agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}`

    // ── Logo ─────────────────────────────────────────────────────────────────
    const logoPath = path.resolve(process.cwd(), 'public', 'logo-alugueasy.png')
    const logoBase64 = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`

    // ── Renderizar PDF ───────────────────────────────────────────────────────
    const document = (
      <PrestacaoContasPdf
        logoBase64={logoBase64}
        empreendimento={empNome}
        apartamento={String(apt.numero)}
        mes={mes}
        ano={ano}
        nomeProprietario={apt.nome_proprietario ?? 'Não configurado'}
        contratoLabel={apt.modelo_contrato === 'sublocacao' ? 'Sublocação' : 'Administração'}
        taxaRepasse={Number(apt.taxa_repasse ?? 0)}
        tipoRepasse={apt.tipo_repasse ?? 'lucro'}
        documento={documento}
        emitidoEm={emitidoEm}
        geradoEm={geradoEm}
        receita={receita}
        custosTotal={r2(kpis.custosTotal)}
        lucro={r2(kpis.lucroLiquido)}
        repasse={r2(kpis.valorRepasse)}
        valorProprietario={r2(kpis.valorLiquidoProprietario)}
        numReservas={reservasCalc.length > 0 ? reservasCalc.length : null}
        noites={noites}
        mediaNoitesReserva={reservasCalc.length > 0
          ? r2(reservasCalc.reduce((s, r) => s + r.noitesNoMes, 0) / reservasCalc.length)
          : null}
        ocupacaoDias={ocupacaoDias}
        receitaBruta={receitaBruta}
        taxasPlataforma={taxasPlataforma}
        ajusteManual={ajusteManual}
        canais={canais}
        reservas={reservasLinhas}
        custos={custosLinhas}
        mediaCustosHistorica={mediaCustosHistorica}
        proximoMes={proximoMes}
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

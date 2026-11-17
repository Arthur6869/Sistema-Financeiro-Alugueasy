import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MESES } from '@/lib/constants'
import { ListaEmpreendimentos } from '@/components/empreendimentos/lista-empreendimentos'
import { DetalheEmpreendimento } from '@/components/empreendimentos/detalhe-empreendimento'
import { DetalheApartamento } from '@/components/empreendimentos/detalhe-apartamento'
import type { Fin, Visao } from '@/components/empreendimentos/fin'

// Esta página busca e soma; quem desenha são os três componentes acima
// (lista → empreendimento → apartamento). Nenhum deles recalcula valores.

type ReservaAmenitizRow = {
  valor_liquido: number | null
  individual_room_number: string | number | null
  status: string | null
  checkin: string | null
  checkout: string | null
}

type AptReservaRow = {
  valor_liquido: number | null
  status: string | null
  checkin: string | null
  checkout: string | null
}

type AptInfoRow = {
  id: string
  numero: string
  empreendimento_id: string
  tipo_gestao: string | null
}

type DiariaEmpRow = {
  valor: number | null
  tipo_gestao: string | null
  apartamento_id: string | null
  apartamentos: { empreendimento_id: string } | null
}

type CustoEmpRow = {
  valor: number | null
  tipo_gestao: string | null
  apartamentos: { empreendimento_id: string } | null
}

type FinData = {
  fat: number; custos: number
  fatAdm: number; fatSub: number
  custosAdm: number; custosSub: number
  gestao: Set<string>
}

function emptyFin(): FinData {
  return { fat: 0, custos: 0, fatAdm: 0, fatSub: 0, custosAdm: 0, custosSub: 0, gestao: new Set() }
}

function getApartamentoCount(value: unknown): number {
  if (!value) return 0
  if (Array.isArray(value)) return value.length
  if (typeof value === 'object') return Object.keys(value).length
  return 0
}

/** Só os números vão para os componentes de tela (o Set de gestões fica aqui). */
function plano(f: FinData): Fin {
  return { fat: f.fat, custos: f.custos, fatAdm: f.fatAdm, fatSub: f.fatSub, custosAdm: f.custosAdm, custosSub: f.custosSub }
}

export default async function EmpreendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ emp?: string; apt?: string; mes?: string; ano?: string; view?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // FAIL-CLOSED: na dúvida, papel de menor privilégio (admin = somente leitura),
  // nunca 'analista' (que habilita escrita). O middleware/layout já barram não-internos.
  const role = profile?.role ?? 'admin'

  const { emp: empId, apt: aptId, mes: mesParam, ano: anoParam, view } = await searchParams
  const now = new Date()
  const mesRaw = mesParam ? parseInt(mesParam) : now.getMonth() + 1
  const anoRaw = anoParam ? parseInt(anoParam) : now.getFullYear()
  // Esta aba consulta custos por mês: "Todos os meses" (0), que outras abas
  // aceitam e o menu carrega na URL, zerava os custos e quebrava o título.
  // Valor fora de 1–12 cai no mês atual (mesmo critério de /prestacao-contas).
  const mes = mesRaw >= 1 && mesRaw <= 12 ? mesRaw : now.getMonth() + 1
  const ano = anoRaw >= 2020 && anoRaw <= 2100 ? anoRaw : now.getFullYear()
  const periodo = `${MESES[mes - 1]} ${ano}`
  const visao: Visao = view === 'list' ? 'list' : 'grid'
  const dataInicio = mes > 0 ? `${ano}-${String(mes).padStart(2, '0')}-01` : `${ano}-01-01`
  const dataFim = mes > 0 ? new Date(ano, mes, 0).toISOString().slice(0, 10) : `${ano}-12-31`

  const [
    { data: empreendimentos },
    { data: diariasData },
    { data: custosData },
    { data: reservasDataRaw },
    { data: apartamentosData },
  ] = await Promise.all([
    supabase.from('empreendimentos').select('id, nome, apartamentos(id)').order('nome'),
    supabase.from('diarias').select('valor, tipo_gestao, apartamento_id, apartamentos(empreendimento_id)').gte('data', dataInicio).lte('data', dataFim),
    supabase.from('custos').select('valor, tipo_gestao, apartamentos(empreendimento_id)').eq('mes', mes).eq('ano', ano),
    // Fallback Amenitiz: reservas por sobreposição de datas (proradas ao mês logo abaixo).
    supabase.from('amenitiz_reservas').select('valor_liquido, individual_room_number, status, checkin, checkout').lte('checkin', dataFim).gte('checkout', dataInicio),
    // Mapa de número do apartamento → empreendimento_id + tipo_gestao (para o fallback Amenitiz)
    supabase.from('apartamentos').select('id, numero, empreendimento_id, tipo_gestao'),
  ])

  // Proration: proporciona valor_liquido de reservas que cruzam o limite do mês.
  const empFDayMs  = mes > 0 ? new Date(dataInicio + 'T00:00:00').getTime() : 0
  const empNMonthMs = mes > 0 ? new Date(ano, mes, 1).getTime() : 0
  const reservasRows = (reservasDataRaw ?? []) as unknown as ReservaAmenitizRow[]
  const reservasData = mes > 0
    ? reservasRows.flatMap((r) => {
        if (!r.checkin || !r.checkout || r.valor_liquido == null) return [r]
        const ci = new Date(r.checkin + 'T00:00:00').getTime()
        const co = new Date(r.checkout + 'T00:00:00').getTime()
        const tot = (co - ci) / 86400000
        const mn  = (Math.min(co, empNMonthMs) - Math.max(ci, empFDayMs)) / 86400000
        if (mn <= 0) return []
        return [{ ...r, valor_liquido: tot > 0 && mn < tot ? (mn / tot) * r.valor_liquido : r.valor_liquido }]
      })
    : reservasRows

  // Mapa: apartamento_id → empreendimento_id + tipo_gestao
  const aptInfoMap: Record<string, { empId: string; tipoGestao: string }> = {}
  // Mapa: numero_upper → apartamento_id (para cruzar com individual_room_number do Amenitiz)
  const aptNumeroToId: Record<string, string> = {}
  ;((apartamentosData ?? []) as unknown as AptInfoRow[]).forEach((a) => {
    aptInfoMap[a.id] = { empId: a.empreendimento_id, tipoGestao: a.tipo_gestao ?? 'adm' }
    aptNumeroToId[String(a.numero).trim().toUpperCase()] = a.id
  })

  // finMap: por empreendimento_id, com breakdown ADM/SUB
  const finMap: Record<string, FinData> = {}
  // Rastrear quais apartamento_ids já têm dados de diárias (para não duplicar com Amenitiz)
  const aptsComDiarias = new Set<string>()

  ;((diariasData ?? []) as unknown as DiariaEmpRow[]).forEach((d) => {
    const id = d.apartamentos?.empreendimento_id
    if (!id) return
    if (!finMap[id]) finMap[id] = emptyFin()
    const v = d.valor || 0
    finMap[id].fat += v
    if (d.tipo_gestao === 'adm') finMap[id].fatAdm += v
    else if (d.tipo_gestao === 'sub') finMap[id].fatSub += v
    if (d.tipo_gestao) finMap[id].gestao.add(d.tipo_gestao)
    if (d.apartamento_id) aptsComDiarias.add(d.apartamento_id)
  })

  // Fallback Amenitiz: adicionar apartamentos sem diárias via amenitiz_reservas
  reservasData.forEach((r) => {
    // Ignorar canceladas/no-shows
    if (['cancelled', 'canceled', 'no_show'].includes(r.status ?? '')) return
    const aptId = aptNumeroToId[String(r.individual_room_number ?? '').trim().toUpperCase()]
    if (!aptId) return
    // Só usar Amenitiz se este apartamento NÃO tem dados na tabela diárias
    if (aptsComDiarias.has(aptId)) return
    const info = aptInfoMap[aptId]
    if (!info) return
    const empId = info.empId
    if (!finMap[empId]) finMap[empId] = emptyFin()
    const v = r.valor_liquido || 0
    finMap[empId].fat += v
    if (info.tipoGestao === 'adm') finMap[empId].fatAdm += v
    else if (info.tipoGestao === 'sub') finMap[empId].fatSub += v
    finMap[empId].gestao.add(info.tipoGestao)
  })

  ;((custosData ?? []) as unknown as CustoEmpRow[]).forEach((c) => {
    const id = c.apartamentos?.empreendimento_id
    if (!id) return
    if (!finMap[id]) finMap[id] = emptyFin()
    const v = c.valor || 0
    finMap[id].custos += v
    if (c.tipo_gestao === 'adm') finMap[id].custosAdm += v
    else if (c.tipo_gestao === 'sub') finMap[id].custosSub += v
    if (c.tipo_gestao) finMap[id].gestao.add(c.tipo_gestao)
  })

  // ── DETALHE DO APARTAMENTO ───────────────────────────────────────
  if (empId && aptId) {
    const emp = empreendimentos?.find((e) => e.id === empId)
    if (!emp) redirect('/empreendimentos')

    const { data: apt } = await supabase.from('apartamentos').select('id, numero, tipo_gestao').eq('id', aptId).single()

    const [{ data: aptDiarias }, { data: aptCustos }, { data: aptReservasRaw }] = await Promise.all([
      supabase.from('diarias').select('data, valor, tipo_gestao').eq('apartamento_id', aptId).gte('data', dataInicio).lte('data', dataFim).order('data'),
      supabase.from('custos').select('categoria, valor, tipo_gestao').eq('apartamento_id', aptId).eq('mes', mes).eq('ano', ano).order('categoria'),
      supabase.from('amenitiz_reservas').select('valor_liquido, status, checkin, checkout').lte('checkin', dataFim).gte('checkout', dataInicio).eq('individual_room_number', apt?.numero ?? 0),
    ])

    const aptReservasRows = (aptReservasRaw ?? []) as unknown as AptReservaRow[]
    const aptReservas = mes > 0
      ? aptReservasRows.flatMap((r) => {
          if (!r.checkin || !r.checkout || r.valor_liquido == null) return [r]
          const ci = new Date(r.checkin + 'T00:00:00').getTime()
          const co = new Date(r.checkout + 'T00:00:00').getTime()
          const tot = (co - ci) / 86400000
          const mn  = (Math.min(co, empNMonthMs) - Math.max(ci, empFDayMs)) / 86400000
          if (mn <= 0) return []
          return [{ ...r, valor_liquido: tot > 0 && mn < tot ? (mn / tot) * r.valor_liquido : r.valor_liquido }]
        })
      : aptReservasRows

    const af = emptyFin()
    const aptTemDiarias = (aptDiarias?.length ?? 0) > 0

    aptDiarias?.forEach((d) => {
      const v = d.valor || 0; af.fat += v
      if (d.tipo_gestao === 'adm') af.fatAdm += v
      else if (d.tipo_gestao === 'sub') af.fatSub += v
      if (d.tipo_gestao) af.gestao.add(d.tipo_gestao)
    })

    // Fallback: usar amenitiz_reservas se não há diárias importadas
    if (!aptTemDiarias) {
      const tipoGestaoApt = (apt as { tipo_gestao?: string | null } | null)?.tipo_gestao ?? 'adm'
      aptReservas.forEach((r) => {
        if (['cancelled', 'canceled', 'no_show'].includes(r.status ?? '')) return
        const v = r.valor_liquido || 0
        af.fat += v
        if (tipoGestaoApt === 'adm') af.fatAdm += v
        else if (tipoGestaoApt === 'sub') af.fatSub += v
        af.gestao.add(tipoGestaoApt)
      })
    }
    aptCustos?.forEach((c) => {
      const v = c.valor || 0; af.custos += v
      if (c.tipo_gestao === 'adm') af.custosAdm += v
      else if (c.tipo_gestao === 'sub') af.custosSub += v
      if (c.tipo_gestao) af.gestao.add(c.tipo_gestao)
    })

    return (
      <DetalheApartamento
        mes={mes}
        ano={ano}
        periodo={periodo}
        visao={visao}
        emp={{ id: empId, nome: emp.nome }}
        apt={{ numero: apt?.numero ?? '—' }}
        fin={plano(af)}
        diarias={(aptDiarias ?? []).map((d) => ({ data: d.data, valor: d.valor || 0, tipo_gestao: d.tipo_gestao ?? null }))}
        custos={(aptCustos ?? []).map((c) => ({ categoria: c.categoria, valor: c.valor || 0, tipo_gestao: c.tipo_gestao ?? null }))}
      />
    )
  }

  // ── DETALHE DO EMPREENDIMENTO ─────────────────────────────────────
  if (empId) {
    const emp = empreendimentos?.find((e) => e.id === empId)
    if (!emp) redirect('/empreendimentos')

    const [{ data: apartamentos }, { data: aptDiarias }, { data: aptCustos }] = await Promise.all([
      supabase.from('apartamentos').select('id, numero, created_at, tipo_gestao, taxa_repasse, tipo_repasse, nome_proprietario, modelo_contrato').eq('empreendimento_id', empId).order('numero'),
      supabase.from('diarias').select('valor, apartamento_id, tipo_gestao').gte('data', dataInicio).lte('data', dataFim),
      supabase.from('custos').select('valor, apartamento_id, tipo_gestao').eq('mes', mes).eq('ano', ano),
    ])

    const aptFinMap: Record<string, FinData> = {}
    aptDiarias?.forEach((d) => {
      if (!aptFinMap[d.apartamento_id]) aptFinMap[d.apartamento_id] = emptyFin()
      const v = d.valor || 0; aptFinMap[d.apartamento_id].fat += v
      if (d.tipo_gestao === 'adm') aptFinMap[d.apartamento_id].fatAdm += v
      else if (d.tipo_gestao === 'sub') aptFinMap[d.apartamento_id].fatSub += v
      if (d.tipo_gestao) aptFinMap[d.apartamento_id].gestao.add(d.tipo_gestao)
    })
    aptCustos?.forEach((c) => {
      if (!aptFinMap[c.apartamento_id]) aptFinMap[c.apartamento_id] = emptyFin()
      const v = c.valor || 0; aptFinMap[c.apartamento_id].custos += v
      if (c.tipo_gestao === 'adm') aptFinMap[c.apartamento_id].custosAdm += v
      else if (c.tipo_gestao === 'sub') aptFinMap[c.apartamento_id].custosSub += v
      if (c.tipo_gestao) aptFinMap[c.apartamento_id].gestao.add(c.tipo_gestao)
    })

    // Apartamentos combinados (ex: "1701 - 1701A") sem room_id próprio no Amenitiz:
    // agregar os dados dos componentes individuais.
    const numeroParaId = Object.fromEntries((apartamentos ?? []).map((a) => [a.numero, a.id]))
    ;(apartamentos ?? []).forEach((apt) => {
      if (!apt.numero.includes(' - ')) return
      const existing = aptFinMap[apt.id]
      if (existing && (existing.fat > 0 || existing.custos > 0)) return
      const parts = apt.numero.split(' - ').map((s: string) => s.trim())
      const combined = emptyFin()
      let found = false
      parts.forEach((num: string) => {
        const compId = numeroParaId[num]
        if (!compId || compId === apt.id) return
        const cf = aptFinMap[compId]
        if (!cf) return
        found = true
        combined.fat += cf.fat; combined.fatAdm += cf.fatAdm; combined.fatSub += cf.fatSub
        combined.custos += cf.custos; combined.custosAdm += cf.custosAdm; combined.custosSub += cf.custosSub
        cf.gestao.forEach((g) => combined.gestao.add(g))
      })
      if (found) aptFinMap[apt.id] = combined
    })

    const fin = finMap[empId] ?? emptyFin()

    return (
      <DetalheEmpreendimento
        mes={mes}
        ano={ano}
        periodo={periodo}
        visao={visao}
        role={role}
        emp={{ id: empId, nome: emp.nome }}
        fin={plano(fin)}
        apartamentos={(apartamentos ?? []).map((apt) => ({
          id: apt.id,
          numero: apt.numero,
          tipo_gestao: apt.tipo_gestao,
          taxa_repasse: apt.taxa_repasse,
          tipo_repasse: apt.tipo_repasse,
          nome_proprietario: apt.nome_proprietario,
          modelo_contrato: apt.modelo_contrato,
          fin: aptFinMap[apt.id] ? plano(aptFinMap[apt.id]) : null,
        }))}
      />
    )
  }

  // ── LISTA DE EMPREENDIMENTOS ──────────────────────────────────────
  return (
    <ListaEmpreendimentos
      mes={mes}
      ano={ano}
      periodo={periodo}
      visao={visao}
      podeEditar={role === 'analista'}
      empreendimentos={(empreendimentos ?? []).map((e) => ({
        id: e.id,
        nome: e.nome,
        apartamentos: getApartamentoCount(e.apartamentos),
        fin: finMap[e.id] ? plano(finMap[e.id]) : null,
      }))}
    />
  )
}

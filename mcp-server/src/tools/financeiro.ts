import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSupabaseClient } from '../supabase.js'

// ─── Shared schemas ────────────────────────────────────────────────────────────

const periodoSchema = {
  mes: z
    .number()
    .int()
    .min(0)
    .max(12)
    .describe('Month number (1–12). Pass 0 to include all months.'),
  ano: z
    .number()
    .int()
    .min(2020)
    .max(2030)
    .describe('Year (2020–2030). Pass 0 to include all years.'),
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function margem(faturamento: number, lucro: number): number {
  return faturamento > 0 ? round2((lucro / faturamento) * 100) : 0
}

function periodLabel(mes: number, ano: number): string {
  if (mes > 0 && ano > 0) return `${String(mes).padStart(2, '0')}/${ano}`
  if (ano > 0) return String(ano)
  if (mes > 0) return `Mês ${mes} (todos os anos)`
  return 'Todos os períodos'
}

function mesLabel(mes: number, ano: number): string {
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${names[mes - 1]}/${ano}`
}

/** Returns the last `count` calendar months in ascending order ending at (mes, ano). */
function lastNMonths(count: number): Array<{ mes: number; ano: number }> {
  const now = new Date()
  const months: Array<{ mes: number; ano: number }> = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({ mes: d.getMonth() + 1, ano: d.getFullYear() })
  }
  return months
}

// ─── Tool 1 — get_kpis ────────────────────────────────────────────────────────

async function fetchFaturamento(
  mes: number,
  ano: number
): Promise<number> {
  const supabase = getSupabaseClient()
  let q = supabase.from('amenitiz_reservas').select('valor_liquido')
  if (mes > 0) q = q.eq('mes_competencia', mes)
  if (ano > 0) q = q.eq('ano_competencia', ano)
  const { data, error } = await q
  if (error) throw new Error(`Supabase error em get_kpis (faturamento): ${error.message}`)
  return (data ?? []).reduce((s, r) => s + (r.valor_liquido ?? 0), 0)
}

async function fetchCustos(mes: number, ano: number): Promise<number> {
  const supabase = getSupabaseClient()
  let q = supabase.from('custos').select('valor')
  if (mes > 0) q = q.eq('mes', mes)
  if (ano > 0) q = q.eq('ano', ano)
  const { data, error } = await q
  if (error) throw new Error(`Supabase error em get_kpis (custos): ${error.message}`)
  return (data ?? []).reduce((s, c) => s + (c.valor ?? 0), 0)
}

// ─── Tool 2 helpers ───────────────────────────────────────────────────────────

type ApartamentoMap = Map<string, { empreendimento_id: string; empreendimento: string }>

async function buildApartamentoMap(): Promise<ApartamentoMap> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase
    .from('apartamentos')
    .select('id, numero, empreendimento_id, empreendimentos(nome)')
  if (error) throw new Error(`Supabase error em buildApartamentoMap: ${error.message}`)

  const map: ApartamentoMap = new Map()
  for (const apt of data ?? []) {
    const raw = apt.empreendimentos as unknown
    const emp = Array.isArray(raw) ? (raw[0] as { nome: string } | undefined) : (raw as { nome: string } | null)
    map.set(String(apt.numero), {
      empreendimento_id: apt.empreendimento_id,
      empreendimento: emp?.nome ?? 'Desconhecido',
    })
    // Also index by id for cost queries
    map.set(apt.id, {
      empreendimento_id: apt.empreendimento_id,
      empreendimento: emp?.nome ?? 'Desconhecido',
    })
  }
  return map
}

// ─── Register all tools ───────────────────────────────────────────────────────

export function registerFinanceiroTools(server: McpServer): void {
  // ── 1. get_kpis ────────────────────────────────────────────────────────────
  server.tool(
    'get_kpis',
    `Returns aggregated financial KPIs for AlugEasy: total revenue (from Amenitiz reservations),
total costs, profit, and margin percentage. Use mes=0 and/or ano=0 to aggregate across all
months or all years respectively.`,
    periodoSchema,
    async ({ mes, ano }) => {
      const [faturamento, totalCustos] = await Promise.all([
        fetchFaturamento(mes, ano),
        fetchCustos(mes, ano),
      ])

      const lucro = faturamento - totalCustos

      const result = {
        faturamento: round2(faturamento),
        custos: round2(totalCustos),
        lucro: round2(lucro),
        margem_percent: margem(faturamento, lucro),
        periodo: periodLabel(mes, ano),
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  // ── 2. get_kpis_por_empreendimento ─────────────────────────────────────────
  server.tool(
    'get_kpis_por_empreendimento',
    `Returns financial KPIs (revenue, costs, profit, margin) broken down by empreendimento
(real-estate development). Revenue comes from amenitiz_reservas matched by room number;
costs come from the custos table. Results are sorted by revenue descending.`,
    periodoSchema,
    async ({ mes, ano }) => {
      const supabase = getSupabaseClient()

      // Fetch all three datasets in parallel
      let reservasQ = supabase
        .from('amenitiz_reservas')
        .select('individual_room_number, valor_liquido')
      if (mes > 0) reservasQ = reservasQ.eq('mes_competencia', mes)
      if (ano > 0) reservasQ = reservasQ.eq('ano_competencia', ano)

      let custosQ = supabase.from('custos').select('apartamento_id, valor')
      if (mes > 0) custosQ = custosQ.eq('mes', mes)
      if (ano > 0) custosQ = custosQ.eq('ano', ano)

      const [
        { data: reservas, error: eRes },
        { data: custosRows, error: eCus },
        aptMap,
      ] = await Promise.all([reservasQ, custosQ, buildApartamentoMap()])

      if (eRes) throw new Error(`Supabase error em get_kpis_por_empreendimento (reservas): ${eRes.message}`)
      if (eCus) throw new Error(`Supabase error em get_kpis_por_empreendimento (custos): ${eCus.message}`)

      // Aggregate faturamento by empreendimento
      const fat: Record<string, number> = {}
      for (const r of reservas ?? []) {
        const info = aptMap.get(String(r.individual_room_number))
        const emp = info?.empreendimento ?? 'Não identificado'
        fat[emp] = (fat[emp] ?? 0) + (r.valor_liquido ?? 0)
      }

      // Aggregate custos by empreendimento
      const cus: Record<string, number> = {}
      for (const c of custosRows ?? []) {
        const info = aptMap.get(c.apartamento_id)
        const emp = info?.empreendimento ?? 'Não identificado'
        cus[emp] = (cus[emp] ?? 0) + (c.valor ?? 0)
      }

      // Merge all known empreendimentos
      const allEmps = new Set([...Object.keys(fat), ...Object.keys(cus)])
      const rows = Array.from(allEmps).map((emp) => {
        const f = fat[emp] ?? 0
        const c = cus[emp] ?? 0
        const l = f - c
        return {
          empreendimento: emp,
          faturamento: round2(f),
          custos: round2(c),
          lucro: round2(l),
          margem_percent: margem(f, l),
        }
      })

      rows.sort((a, b) => b.faturamento - a.faturamento)

      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] }
    }
  )

  // ── 3. get_custos_detalhados ───────────────────────────────────────────────
  server.tool(
    'get_custos_detalhados',
    `Returns a detailed cost breakdown for a given period. Results are grouped by category
and include per-line details (empreendimento, apartment, category, value, management type).
Filter by empreendimento name (case-insensitive partial match) and/or tipo_gestao.`,
    {
      ...periodoSchema,
      empreendimento: z
        .string()
        .optional()
        .describe('Filter by empreendimento name (case-insensitive, partial match).'),
      tipo_gestao: z
        .enum(['adm', 'sub', 'todos'])
        .default('todos')
        .describe("Management type filter: 'adm', 'sub', or 'todos' (default)."),
    },
    async ({ mes, ano, empreendimento, tipo_gestao }) => {
      const supabase = getSupabaseClient()

      let q = supabase
        .from('custos')
        .select('id, apartamento_id, categoria, valor, tipo_gestao, mes, ano, origem')
      if (mes > 0) q = q.eq('mes', mes)
      if (ano > 0) q = q.eq('ano', ano)
      if (tipo_gestao !== 'todos') q = q.eq('tipo_gestao', tipo_gestao)

      const { data: custosRows, error } = await q
      if (error) throw new Error(`Supabase error em get_custos_detalhados: ${error.message}`)

      const aptMap = await buildApartamentoMap()

      // Enrich rows and apply optional empreendimento filter
      const empFilter = empreendimento?.toLowerCase()
      const enriched = (custosRows ?? [])
        .map((c) => {
          const info = aptMap.get(c.apartamento_id)
          return {
            id: (c as any).id as string,
            empreendimento: info?.empreendimento ?? 'Não identificado',
            apartamento: String(c.apartamento_id),
            categoria: c.categoria ?? 'Sem categoria',
            valor: c.valor ?? 0,
            tipo_gestao: c.tipo_gestao,
            origem: (c as any).origem ?? 'importacao',
          }
        })
        .filter((r) =>
          empFilter ? r.empreendimento.toLowerCase().includes(empFilter) : true
        )

      // Group by categoria
      const catMap: Record<string, number> = {}
      for (const r of enriched) {
        catMap[r.categoria] = (catMap[r.categoria] ?? 0) + r.valor
      }
      const total = enriched.reduce((s, r) => s + r.valor, 0)

      const por_categoria = Object.entries(catMap)
        .map(([categoria, valor]) => ({
          categoria,
          valor: round2(valor),
          percentual: total > 0 ? round2((valor / total) * 100) : 0,
        }))
        .sort((a, b) => b.valor - a.valor)

      const result = {
        total: round2(total),
        por_categoria,
        detalhes: enriched.map((r) => ({ ...r, valor: round2(r.valor) })),
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  // ── 4. get_relatorio_semestral ─────────────────────────────────────────────
  server.tool(
    'get_relatorio_semestral',
    `Returns a 6-month rolling financial report ending at the current month. Each entry contains
revenue, costs, profit, and margin for that month, plus the month-over-month profit change
in percentage (null for the first month). Useful for trend analysis and dashboards.`,
    {},
    async () => {
      const months = lastNMonths(6)

      // Fetch all reservas and custos for the 6-month window in one query each
      const minMes = months[0].mes
      const minAno = months[0].ano
      const maxMes = months[months.length - 1].mes
      const maxAno = months[months.length - 1].ano

      const supabase = getSupabaseClient()

      // Fetch with a broad date range then filter in JS to avoid complex OR queries
      const { data: reservas, error: eRes } = await supabase
        .from('amenitiz_reservas')
        .select('valor_liquido, mes_competencia, ano_competencia')
        .or(
          months
            .map((m) => `and(mes_competencia.eq.${m.mes},ano_competencia.eq.${m.ano})`)
            .join(',')
        )

      const { data: custosRows, error: eCus } = await supabase
        .from('custos')
        .select('valor, mes, ano')
        .or(months.map((m) => `and(mes.eq.${m.mes},ano.eq.${m.ano})`).join(','))

      if (eRes) throw new Error(`Supabase error em get_relatorio_semestral (reservas): ${eRes.message}`)
      if (eCus) throw new Error(`Supabase error em get_relatorio_semestral (custos): ${eCus.message}`)

      // Index by "mes-ano" key
      const fatByMonth: Record<string, number> = {}
      for (const r of reservas ?? []) {
        const key = `${r.mes_competencia}-${r.ano_competencia}`
        fatByMonth[key] = (fatByMonth[key] ?? 0) + (r.valor_liquido ?? 0)
      }

      const cusByMonth: Record<string, number> = {}
      for (const c of custosRows ?? []) {
        const key = `${c.mes}-${c.ano}`
        cusByMonth[key] = (cusByMonth[key] ?? 0) + (c.valor ?? 0)
      }

      // Suppress unused variable warnings from the broad range vars
      void minMes; void minAno; void maxMes; void maxAno

      type Row = {
        mes_label: string
        mes: number
        ano: number
        faturamento: number
        custos: number
        lucro: number
        margem_percent: number
        variacao_lucro_percent: number | null
      }

      const rows: Row[] = months.map(({ mes, ano }) => {
        const key = `${mes}-${ano}`
        const f = fatByMonth[key] ?? 0
        const c = cusByMonth[key] ?? 0
        const l = f - c
        return {
          mes_label: mesLabel(mes, ano),
          mes,
          ano,
          faturamento: round2(f),
          custos: round2(c),
          lucro: round2(l),
          margem_percent: margem(f, l),
          variacao_lucro_percent: null,
        }
      })

      // Calculate MoM variation
      for (let i = 1; i < rows.length; i++) {
        const prev = rows[i - 1].lucro
        const curr = rows[i].lucro
        rows[i].variacao_lucro_percent =
          prev !== 0 ? round2(((curr - prev) / Math.abs(prev)) * 100) : null
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] }
    }
  )
}

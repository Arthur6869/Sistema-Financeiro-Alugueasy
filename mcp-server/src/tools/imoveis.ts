import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSupabaseClient } from '../supabase.js'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function registerImoveisTools(server: McpServer): void {
  // ── 1. list_empreendimentos ─────────────────────────────────────────────────
  server.tool(
    'list_empreendimentos',
    `Returns all empreendimentos (real-estate developments) in the AlugEasy system,
each with the total number of apartments registered under it.`,
    {},
    async () => {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('empreendimentos')
        .select('id, nome, apartamentos(id)')
        .order('nome')

      if (error) throw new Error(`Supabase error em list_empreendimentos: ${error.message}`)

      const result = (data ?? []).map((emp) => ({
        id: emp.id,
        nome: emp.nome,
        total_apartamentos: Array.isArray(emp.apartamentos) ? emp.apartamentos.length : 0,
      }))

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  // ── 2. list_apartamentos ────────────────────────────────────────────────────
  server.tool(
    'list_apartamentos',
    `Returns apartments with their repasse (owner payout) configuration — taxa_repasse (percentage)
and tipo_repasse (whether the percentage applies to gross revenue or net profit).
Optionally filter by empreendimento name (case-insensitive partial match).`,
    {
      empreendimento: z
        .string()
        .optional()
        .describe('Filter by empreendimento name (case-insensitive partial match). Omit for all.'),
    },
    async ({ empreendimento }) => {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('apartamentos')
        .select(
          'id, numero, taxa_repasse, tipo_repasse, nome_proprietario, modelo_contrato, tipo_gestao, empreendimentos(id, nome)'
        )
        .order('numero')

      if (error) throw new Error(`Supabase error em list_apartamentos: ${error.message}`)

      const filter = empreendimento?.toLowerCase()

      const result = (data ?? [])
        .map((apt) => {
          const raw = apt.empreendimentos as unknown
          const emp = Array.isArray(raw)
            ? (raw[0] as { id: string; nome: string } | undefined)
            : (raw as { id: string; nome: string } | null)
          return {
            id: apt.id,
            numero: apt.numero,
            empreendimento_id: emp?.id ?? null,
            empreendimento: emp?.nome ?? 'Desconhecido',
            taxa_repasse: apt.taxa_repasse ?? null,
            tipo_repasse: apt.tipo_repasse ?? null,
            nome_proprietario: apt.nome_proprietario ?? null,
            modelo_contrato: apt.modelo_contrato ?? null,
            tipo_gestao: apt.tipo_gestao ?? null,
          }
        })
        .filter((apt) => (filter ? apt.empreendimento.toLowerCase().includes(filter) : true))
        .sort((a, b) => a.empreendimento.localeCompare(b.empreendimento) || String(a.numero).localeCompare(String(b.numero)))

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  // ── 3. set_amenitiz_room_id ─────────────────────────────────────────────────
  server.tool(
    'set_amenitiz_room_id',
    `Maps an apartment to its Amenitiz room UUID. Use this to fix apartments missing amenitiz_room_id
without opening the Supabase dashboard. Always call check_apartamentos_sem_room_id before and after
to verify the change. Requires confirmar: true to execute — first call with confirmar: false to preview.`,
    {
      numero: z.string().describe('Apartment number exactly as stored in the database (ex: "B119", "812", "1709")'),
      empreendimento: z.string().describe('Property name (partial match accepted, ex: "BRISAS", "ATHOS")'),
      amenitiz_room_id: z.string().uuid().describe('Full Amenitiz room UUID (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)'),
      confirmar: z.boolean().describe('Safety flag. Must be true to execute the update. Pass false to preview without changing.'),
    },
    async ({ numero, empreendimento, amenitiz_room_id, confirmar }) => {
      if (!confirmar) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              executado: false,
              mensagem: `Preview: vai mapear apt ${numero} (${empreendimento}) → ${amenitiz_room_id}. Chame novamente com confirmar: true para aplicar.`,
            }, null, 2),
          }],
        }
      }

      const supabase = getSupabaseClient()

      const { data: emp, error: empErr } = await supabase
        .from('empreendimentos')
        .select('id, nome')
        .ilike('nome', `%${empreendimento}%`)
        .limit(1)
        .single()

      if (empErr || !emp) {
        throw new Error(`Empreendimento não encontrado: ${empreendimento}`)
      }

      const { data, error } = await supabase
        .from('apartamentos')
        .update({ amenitiz_room_id })
        .eq('numero', numero)
        .eq('empreendimento_id', emp.id)
        .select('id, numero, amenitiz_room_id')

      if (error) throw new Error(`Supabase error em set_amenitiz_room_id: ${error.message}`)
      if (!data || data.length === 0) {
        throw new Error(`Apartamento ${numero} não encontrado em ${emp.nome}`)
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            executado: true,
            apartamento: { numero: data[0].numero, amenitiz_room_id: data[0].amenitiz_room_id },
            empreendimento: emp.nome,
            mensagem: '✅ Mapeamento aplicado. Execute check_apartamentos_sem_room_id para verificar.',
          }, null, 2),
        }],
      }
    }
  )

  // ── 4. get_prestacao_contas ─────────────────────────────────────────────────
  server.tool(
    'get_prestacao_contas',
    `Calculates the monthly accountability report (prestação de contas) for a specific apartment
and period. Mirrors the logic of the /prestacao-contas page exactly:
- Revenue comes from the diarias table (daily rates), split by ADM and SUB management type
- Costs come from the custos table, also split by ADM and SUB
- Owner payout (repasse) is calculated from taxa_repasse % applied to either gross revenue
  or net profit depending on tipo_repasse ('faturamento' | 'lucro')
- Returns a full breakdown: revenue, costs, profit, repasse, and net amount to the owner`,
    {
      apartamento_id: z.string().uuid().describe('UUID of the apartment (apartamentos.id).'),
      mes: z
        .number()
        .int()
        .min(1)
        .max(12)
        .describe('Competency month (1–12).'),
      ano: z
        .number()
        .int()
        .min(2020)
        .max(2030)
        .describe('Competency year (2020–2030).'),
    },
    async ({ apartamento_id, mes, ano }) => {
      const supabase = getSupabaseClient()

      // Fetch apartment info
      const { data: apt, error: aptError } = await supabase
        .from('apartamentos')
        .select('id, numero, taxa_repasse, tipo_repasse, nome_proprietario, empreendimentos(nome)')
        .eq('id', apartamento_id)
        .single()

      if (aptError) throw new Error(`Supabase error em get_prestacao_contas (apartamento): ${aptError.message}`)
      if (!apt) throw new Error(`Apartamento não encontrado: ${apartamento_id}`)

      // Date range for diarias query — full calendar month
      const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

      const [{ data: diarias, error: eDia }, { data: custos, error: eCus }] = await Promise.all([
        supabase
          .from('diarias')
          .select('valor, tipo_gestao')
          .eq('apartamento_id', apartamento_id)
          .gte('data', dataInicio)
          .lte('data', dataFim),
        supabase
          .from('custos')
          .select('valor, categoria, tipo_gestao')
          .eq('apartamento_id', apartamento_id)
          .eq('mes', mes)
          .eq('ano', ano),
      ])

      if (eDia) throw new Error(`Supabase error em get_prestacao_contas (diarias): ${eDia.message}`)
      if (eCus) throw new Error(`Supabase error em get_prestacao_contas (custos): ${eCus.message}`)

      // Revenue split
      const receitaAdm = (diarias ?? [])
        .filter((d) => d.tipo_gestao === 'adm')
        .reduce((s, d) => s + Number(d.valor ?? 0), 0)
      const receitaSub = (diarias ?? [])
        .filter((d) => d.tipo_gestao === 'sub')
        .reduce((s, d) => s + Number(d.valor ?? 0), 0)
      const receitaTotal = receitaAdm + receitaSub

      // Cost split
      const custosAdm = (custos ?? [])
        .filter((c) => c.tipo_gestao === 'adm')
        .reduce((s, c) => s + Number(c.valor ?? 0), 0)
      const custosSub = (custos ?? [])
        .filter((c) => c.tipo_gestao === 'sub')
        .reduce((s, c) => s + Number(c.valor ?? 0), 0)
      const custosTotal = custosAdm + custosSub

      // Profit & repasse
      const lucroLiquido = receitaTotal - custosTotal
      const taxa = Number(apt.taxa_repasse ?? 0) / 100
      const baseCalculo = apt.tipo_repasse === 'faturamento' ? receitaTotal : lucroLiquido
      const valorRepasse = baseCalculo * taxa
      const valorLiquidoProprietario = lucroLiquido - valorRepasse
      const margemLiquida = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0

      const raw = apt.empreendimentos as unknown
      const emp = Array.isArray(raw)
        ? (raw[0] as { nome: string } | undefined)
        : (raw as { nome: string } | null)

      const result = {
        apartamento: {
          id: apt.id,
          numero: apt.numero,
          empreendimento: emp?.nome ?? 'Desconhecido',
          nome_proprietario: apt.nome_proprietario ?? null,
          taxa_repasse: apt.taxa_repasse ?? 0,
          tipo_repasse: apt.tipo_repasse ?? 'lucro',
        },
        periodo: {
          mes,
          ano,
          data_inicio: dataInicio,
          data_fim: dataFim,
        },
        receita: {
          adm: round2(receitaAdm),
          sub: round2(receitaSub),
          total: round2(receitaTotal),
        },
        custos: {
          adm: round2(custosAdm),
          sub: round2(custosSub),
          total: round2(custosTotal),
          detalhes: (custos ?? []).map((c) => ({
            categoria: c.categoria,
            valor: round2(Number(c.valor ?? 0)),
            tipo_gestao: c.tipo_gestao,
          })),
        },
        resultado: {
          lucro_liquido: round2(lucroLiquido),
          margem_percent: round2(margemLiquida),
          base_calculo_repasse: apt.tipo_repasse === 'faturamento' ? 'faturamento' : 'lucro',
          valor_base_calculo: round2(baseCalculo),
          valor_repasse: round2(valorRepasse),
          valor_liquido_proprietario: round2(valorLiquidoProprietario),
        },
        tem_dados: (diarias?.length ?? 0) > 0 || (custos?.length ?? 0) > 0,
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
    }
  )
}

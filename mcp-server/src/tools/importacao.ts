import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabaseClient } from '../supabase.js'

function getBaseUrl(): string {
  return process.env.ALUGUEASY_BASE_URL ?? 'http://localhost:3000'
}

async function callApi(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: Record<string, unknown>
): Promise<unknown> {
  const url = `${getBaseUrl()}${path}`
  const internalKey = process.env.ALUGUEASY_INTERNAL_API_KEY
  if (!internalKey) {
    throw new Error('Missing ALUGUEASY_INTERNAL_API_KEY for internal API authentication')
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-alugueasy-internal-key': internalKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${method} ${path} falhou [${res.status}]: ${text}`)
  }
  return res.json()
}

async function syncAmenitiz(mes: number, ano: number, empreendimento?: string) {
  const start = Date.now()
  const body: Record<string, unknown> = { mes, ano }
  if (empreendimento) body.empreendimento = empreendimento

  const data = await callApi('/api/amenitiz-sync', 'POST', body) as Record<string, unknown>

  return {
    ...data,
    duracao_ms: Date.now() - start,
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    empreendimento_filtro: empreendimento ?? 'todos',
  }
}

async function getHistoricoImportacoes(
  mes?: number,
  ano?: number,
  tipo?: string
) {
  const supabase = getSupabaseClient()

  let query = supabase
    .from('importacoes')
    .select('id, tipo, mes, ano, nome_arquivo, status, importado_por, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  if (mes && mes > 0) query = query.eq('mes', mes)
  if (ano && ano > 0) query = query.eq('ano', ano)
  if (tipo) query = query.eq('tipo', tipo)

  const { data, error } = await query
  if (error) throw new Error(`Supabase error em get_historico_importacoes: ${error.message}`)

  return {
    total: data?.length ?? 0,
    importacoes: data ?? [],
  }
}

async function checkUltimoSync(mes: number, ano: number) {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('amenitiz_syncs')
    .select('status, total_reservas, faturamento_bruto, faturamento_liquido, created_at, updated_at')
    .eq('mes', mes)
    .eq('ano', ano)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Supabase error em check_ultimo_sync: ${error.message}`)

  if (!data) {
    return {
      sincronizado: false,
      mes,
      ano,
      mensagem: `Nenhum sync encontrado para ${String(mes).padStart(2, '0')}/${ano}`,
    }
  }

  const ultima = new Date(data.updated_at ?? data.created_at)
  const diasDesdeSync = Math.floor((Date.now() - ultima.getTime()) / 86_400_000)

  return {
    sincronizado: data.status === 'concluido',
    status: data.status,
    total_reservas: data.total_reservas,
    faturamento_bruto: data.faturamento_bruto,
    faturamento_liquido: data.faturamento_liquido,
    ultima_atualizacao: ultima.toISOString(),
    dias_desde_sync: diasDesdeSync,
    alerta_desatualizado: diasDesdeSync > 3,
  }
}

async function clearPeriodo(mes: number, ano: number, confirmar: boolean) {
  if (!confirmar) {
    return {
      executado: false,
      mensagem: `Operação cancelada. Para limpar os dados de ${String(mes).padStart(2, '0')}/${ano}, `
        + 'chame novamente com confirmar: true. '
        + 'ATENÇÃO: esta ação remove TODOS os dados financeiros do período sem possibilidade de desfazer.',
    }
  }

  const data = await callApi(
    `/api/clear?mes=${mes}&ano=${ano}`,
    'DELETE'
  ) as Record<string, unknown>

  return {
    executado: true,
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    ...data,
  }
}

async function lancarCustoManual(
  lancamentos: Array<{
    apartamento_numero: string
    empreendimento: string
    mes: number
    ano: number
    categoria: string
    valor: number
    tipo_gestao: 'adm' | 'sub'
  }>
) {
  const supabase = getSupabaseClient()
  const resolvidos: Array<{
    apartamento_id: string
    mes: number
    ano: number
    categoria: string
    valor: number
    tipo_gestao: string
    origem: string
  }> = []
  const erros: string[] = []

  for (const l of lancamentos) {
    const { data: emp } = await supabase
      .from('empreendimentos')
      .select('id, nome')
      .ilike('nome', `%${l.empreendimento}%`)
      .limit(1)
      .maybeSingle()

    if (!emp) {
      erros.push(`Empreendimento não encontrado: ${l.empreendimento}`)
      continue
    }

    const { data: apt } = await supabase
      .from('apartamentos')
      .select('id, numero, tipo_gestao')
      .eq('empreendimento_id', emp.id)
      .eq('numero', l.apartamento_numero)
      .limit(1)
      .maybeSingle()

    if (!apt) {
      erros.push(`Apt ${l.apartamento_numero} não encontrado em ${emp.nome}`)
      continue
    }

    resolvidos.push({
      apartamento_id: apt.id,
      mes: l.mes,
      ano: l.ano,
      categoria: l.categoria,
      valor: l.valor,
      tipo_gestao: l.tipo_gestao,
      origem: 'manual',
    })
  }

  if (erros.length > 0 && resolvidos.length === 0) {
    throw new Error(`Nenhum lançamento resolvido. Erros: ${erros.join('; ')}`)
  }

  const { data, error } = await supabase
    .from('custos')
    .insert(resolvidos)
    .select()

  if (error) throw new Error(`Supabase error em lancar_custo_manual: ${error.message}`)

  return {
    inseridos: data?.length ?? 0,
    erros: erros.length > 0 ? erros : undefined,
    mensagem: `✅ ${data?.length ?? 0} lançamento(s) inserido(s)${erros.length > 0 ? ` | ⚠️ ${erros.length} erro(s)` : ''}`,
    lancamentos: data,
  }
}

export function registerImportacaoTools(server: McpServer): void {
  const mesSchema = z.number().int().min(1).max(12).describe('Mês (1-12)')
  const anoSchema = z.number().int().min(2020).max(2030).describe('Ano (ex: 2026)')

  server.tool(
    'sync_amenitiz',
    'Triggers Amenitiz reservation sync for a given month/year. Fetches reservations from the Amenitiz API, applies platform fees, and updates the diarias table. Returns a summary with reservation count, gross/net revenue, and synced/unmatched apartments.',
    {
      mes: mesSchema,
      ano: anoSchema,
      empreendimento: z.string().optional().describe(
        'Optional: sync only one property by name (ex: "ESSENCE"). Leave empty to sync all properties.'
      ),
    },
    async ({ mes, ano, empreendimento }) => ({
      content: [{ type: 'text', text: JSON.stringify(await syncAmenitiz(mes, ano, empreendimento), null, 2) }],
    })
  )

  server.tool(
    'get_historico_importacoes',
    'Returns the import history log (planilhas and Amenitiz syncs). Shows file name, type, period, status (concluido/erro) and timestamp. Useful for auditing what was imported and when.',
    {
      mes: z.number().int().min(0).max(12).optional().describe('Filter by month (1-12). Omit for all months.'),
      ano: z.number().int().min(2020).max(2030).optional().describe('Filter by year. Omit for all years.'),
      tipo: z.enum(['custos_adm', 'custos_sub', 'diarias_adm', 'diarias_sub']).optional().describe(
        'Filter by import type. Omit for all types.'
      ),
    },
    async ({ mes, ano, tipo }) => ({
      content: [{ type: 'text', text: JSON.stringify(await getHistoricoImportacoes(mes, ano, tipo), null, 2) }],
    })
  )

  server.tool(
    'check_ultimo_sync',
    'Checks the Amenitiz sync status for a given month/year. Returns sync date, reservation count, revenue totals, and whether the data is stale (more than 3 days since last sync).',
    { mes: mesSchema, ano: anoSchema },
    async ({ mes, ano }) => ({
      content: [{ type: 'text', text: JSON.stringify(await checkUltimoSync(mes, ano), null, 2) }],
    })
  )

  server.tool(
    'clear_periodo',
    'DESTRUCTIVE: Deletes all financial data (diarias, custos, importacoes) for a given month/year. Requires confirmar: true as an explicit safety check. Always call without confirmar first to show the warning, then ask the user before calling with confirmar: true.',
    {
      mes: mesSchema,
      ano: anoSchema,
      confirmar: z.boolean().describe(
        'Safety flag. Must be explicitly true to execute. Call with false first to show the warning message.'
      ),
    },
    async ({ mes, ano, confirmar }) => ({
      content: [{ type: 'text', text: JSON.stringify(await clearPeriodo(mes, ano, confirmar), null, 2) }],
    })
  )

  server.tool(
    'lancar_custo_manual',
    'Manually inserts one or more cost entries directly into the database without needing an Excel import. Use for one-off corrections, adjustments, or costs not in the standard spreadsheet. Always call verificar_importacao_custos after to confirm the insertion.',
    {
      lancamentos: z.array(z.object({
        apartamento_numero: z.string()
          .describe('Apartment number as stored in DB (ex: "18", "204", "1615A-1615")'),
        empreendimento: z.string()
          .describe('Property name (partial match, ex: "ATHOS", "ESSENCE")'),
        mes: z.number().int().min(1).max(12),
        ano: z.number().int().min(2020).max(2030),
        categoria: z.string().min(3)
          .describe('Cost category (ex: "Amenitiz", "Condomínio", "Manutenção")'),
        valor: z.number().positive()
          .describe('Cost value in BRL (positive number)'),
        tipo_gestao: z.enum(['adm', 'sub'])
          .describe('Management type: adm = administration, sub = sublease'),
      })).min(1).max(50)
        .describe('List of cost entries to insert. Max 50 per call.'),
    },
    async ({ lancamentos }) => ({
      content: [{ type: 'text' as const, text: JSON.stringify(await lancarCustoManual(lancamentos), null, 2) }],
    })
  )

  server.tool(
    'enviar_extrato_email',
    'Sends the monthly financial statement email to a property owner. Use after closing the month to notify owners. Requires the owner\'s UUID, month, and year. Fetches financial data from diarias + custos tables and generates a styled HTML email via Resend.',
    {
      proprietario_id: z.string().uuid()
        .describe('UUID of the proprietario user (from profiles table, role=proprietario)'),
      mes: z.number().int().min(1).max(12).describe('Month number (1=Janeiro, 12=Dezembro)'),
      ano: z.number().int().min(2024).max(2030).describe('Year (e.g. 2026)'),
    },
    async ({ proprietario_id, mes, ano }) => {
      const result = await callApi('/api/enviar-extrato-email', 'POST', { proprietario_id, mes, ano })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    }
  )
}

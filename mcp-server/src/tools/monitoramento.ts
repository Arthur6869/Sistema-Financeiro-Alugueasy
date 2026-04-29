import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getSupabaseClient } from '../supabase.js'

function getBaseUrl(): string {
  return process.env.ALUGUEASY_BASE_URL ?? 'http://localhost:3000'
}

function mesAtual() {
  const d = new Date()
  return { mes: d.getMonth() + 1, ano: d.getFullYear() }
}

function ultimos6Meses(): { mes: number; ano: number }[] {
  const result = []
  const hoje = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    result.push({ mes: d.getMonth() + 1, ano: d.getFullYear() })
  }
  return result
}

async function healthCheck() {
  const timestamp = new Date().toISOString()
  const supabase = getSupabaseClient()

  let supabaseStatus = 'ok'
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
    if (error) supabaseStatus = `error: ${error.message}`
  } catch (e) {
    supabaseStatus = `error: ${(e as Error).message}`
  }

  const apiStatus = await fetch(`${getBaseUrl()}/api/amenitiz-sync`, { method: 'GET' })
    .then((r) => (r.ok || r.status === 405 ? 'ok' : `error: HTTP ${r.status}`))
    .catch((e: Error) => `error: ${e.message}`)

  const saudavel = supabaseStatus === 'ok' && apiStatus === 'ok'

  return {
    saudavel,
    supabase: supabaseStatus,
    api: apiStatus,
    timestamp,
    mensagem: saudavel
      ? 'Sistema operacional — todas as conexões respondendo.'
      : 'ATENÇÃO: uma ou mais conexões com falha. Verifique os detalhes.',
  }
}

async function alertMargemBaixa(mes: number, ano: number, threshold: number) {
  const supabase = getSupabaseClient()

  const { data: apts } = await supabase
    .from('apartamentos')
    .select('id, numero, empreendimentos(nome)')

  const numToEmp: Record<string, string> = {}
  const idToEmp: Record<string, string> = {}
  for (const a of apts ?? []) {
    const emp = (a.empreendimentos as any)?.nome ?? ''
    if (emp) {
      numToEmp[String(a.numero).trim()] = emp
      idToEmp[a.id] = emp
    }
  }

  const { data: fatData } = await supabase
    .from('amenitiz_reservas')
    .select('valor_liquido, individual_room_number')
    .eq('mes_competencia', mes)
    .eq('ano_competencia', ano)

  const { data: custData } = await supabase
    .from('custos')
    .select('valor, apartamento_id')
    .eq('mes', mes)
    .eq('ano', ano)

  const empMap: Record<string, { faturamento: number; custos: number }> = {}

  for (const r of fatData ?? []) {
    const emp = numToEmp[String(r.individual_room_number).trim()]
    if (!emp) continue
    if (!empMap[emp]) empMap[emp] = { faturamento: 0, custos: 0 }
    empMap[emp].faturamento += r.valor_liquido ?? 0
  }
  for (const r of custData ?? []) {
    const emp = idToEmp[r.apartamento_id]
    if (!emp) continue
    if (!empMap[emp]) empMap[emp] = { faturamento: 0, custos: 0 }
    empMap[emp].custos += r.valor ?? 0
  }

  const resultados = Object.entries(empMap)
    .map(([emp, { faturamento, custos }]) => {
      const lucro = faturamento - custos
      const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0
      return {
        empreendimento: emp,
        faturamento,
        custos,
        lucro,
        margem_percent: Math.round(margem * 100) / 100,
      }
    })
    .sort((a, b) => a.margem_percent - b.margem_percent)

  const abaixoThreshold = resultados.filter((r) => r.margem_percent < threshold)
  const margemGeral = resultados.reduce((acc, r) => acc + r.faturamento, 0) > 0
    ? resultados.reduce((acc, r) => acc + r.lucro, 0)
      / resultados.reduce((acc, r) => acc + r.faturamento, 0) * 100
    : 0

  return {
    alerta: abaixoThreshold.length > 0,
    threshold_percent: threshold,
    margem_geral_percent: Math.round(margemGeral * 100) / 100,
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    empreendimentos_em_alerta: abaixoThreshold,
    todos_empreendimentos: resultados,
    mensagem: abaixoThreshold.length > 0
      ? `⚠️ ${abaixoThreshold.length} empreendimento(s) com margem abaixo de ${threshold}%: `
        + abaixoThreshold.map((e) => `${e.empreendimento} (${e.margem_percent}%)`).join(', ')
      : `✅ Todos os empreendimentos com margem acima de ${threshold}%.`,
  }
}

async function checkSyncPendente(mes: number, ano: number) {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('amenitiz_syncs')
    .select('status, updated_at, created_at')
    .eq('mes', mes)
    .eq('ano', ano)
    .eq('status', 'concluido')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Supabase error em check_sync_pendente: ${error.message}`)

  if (!data) {
    return {
      sincronizado: false,
      pendente: true,
      periodo: `${String(mes).padStart(2, '0')}/${ano}`,
      dias_sem_sync: null,
      mensagem: `❌ Período ${String(mes).padStart(2, '0')}/${ano} nunca foi sincronizado com a Amenitiz.`,
    }
  }

  const ultima = new Date(data.updated_at ?? data.created_at)
  const diasSemSync = Math.floor((Date.now() - ultima.getTime()) / 86_400_000)

  return {
    sincronizado: true,
    pendente: diasSemSync > 3,
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    ultima_sync: ultima.toISOString(),
    dias_sem_sync: diasSemSync,
    mensagem: diasSemSync > 3
      ? `⚠️ Sync desatualizado — última sincronização há ${diasSemSync} dias.`
      : `✅ Sync em dia — última sincronização há ${diasSemSync} dia(s).`,
  }
}

async function resumoExecutivo(mes: number, ano: number) {
  const supabase = getSupabaseClient()

  const [{ data: fatData }, { data: custData }, { data: syncData }, { data: importData }] =
    await Promise.all([
      supabase.from('amenitiz_reservas').select('valor_liquido')
        .eq('mes_competencia', mes).eq('ano_competencia', ano),
      supabase.from('custos').select('valor')
        .eq('mes', mes).eq('ano', ano),
      supabase.from('amenitiz_syncs').select('status, total_reservas, faturamento_liquido, updated_at')
        .eq('mes', mes).eq('ano', ano)
        .order('created_at', { ascending: false }).limit(1).maybeSingle() as any,
      supabase.from('importacoes').select('tipo, status, created_at')
        .eq('mes', mes).eq('ano', ano)
        .order('created_at', { ascending: false }),
    ])

  const faturamento = (fatData ?? []).reduce((acc, r) => acc + (r.valor_liquido ?? 0), 0)
  const custos = (custData ?? []).reduce((acc, r) => acc + (r.valor ?? 0), 0)
  const lucro = faturamento - custos
  const margem = faturamento > 0 ? Math.round((lucro / faturamento) * 10000) / 100 : 0

  const sync = (syncData as any)?.data
  const diasSemSync = sync
    ? Math.floor((Date.now() - new Date(sync.updated_at).getTime()) / 86_400_000)
    : null

  const semestre = ultimos6Meses()
  const historico = await Promise.all(
    semestre.map(async ({ mes: m, ano: a }) => {
      const [{ data: f }, { data: c }] = await Promise.all([
        supabase.from('amenitiz_reservas').select('valor_liquido')
          .eq('mes_competencia', m).eq('ano_competencia', a),
        supabase.from('custos').select('valor').eq('mes', m).eq('ano', a),
      ])
      const fat = (f ?? []).reduce((acc, r) => acc + (r.valor_liquido ?? 0), 0)
      const cust = (c ?? []).reduce((acc, r) => acc + (r.valor ?? 0), 0)
      return { mes: m, ano: a, faturamento: fat, custos: cust, lucro: fat - cust }
    })
  )

  const alertas: string[] = []
  if (!sync) alertas.push(`❌ Período ${String(mes).padStart(2, '0')}/${ano} nunca sincronizado com Amenitiz`)
  if (diasSemSync !== null && diasSemSync > 3) alertas.push(`⚠️ Sync desatualizado (${diasSemSync} dias)`)
  if (margem < 20 && faturamento > 0) alertas.push(`⚠️ Margem abaixo de 20% (${margem}%)`)
  if (faturamento === 0) alertas.push('❌ Faturamento zerado — verifique sync Amenitiz')

  mesAtual()
  const mesAnterior = historico[historico.length - 2]
  const variacaoLucro = mesAnterior && mesAnterior.lucro !== 0
    ? Math.round(((lucro - mesAnterior.lucro) / Math.abs(mesAnterior.lucro)) * 10000) / 100
    : null

  return {
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    gerado_em: new Date().toISOString(),
    kpis: {
      faturamento: Math.round(faturamento * 100) / 100,
      custos: Math.round(custos * 100) / 100,
      lucro: Math.round(lucro * 100) / 100,
      margem_percent: margem,
      variacao_lucro_percent: variacaoLucro,
    },
    sync_amenitiz: {
      sincronizado: !!sync,
      status: sync?.status ?? 'nunca sincronizado',
      total_reservas: sync?.total_reservas ?? 0,
      dias_desde_sync: diasSemSync,
    },
    importacoes: {
      total: (importData ?? []).length,
      por_tipo: ['custos_adm', 'custos_sub', 'diarias_adm', 'diarias_sub'].map((tipo) => ({
        tipo,
        importado: (importData ?? []).some((i: any) => i.tipo === tipo && i.status === 'concluido'),
      })),
    },
    historico_semestral: historico,
    alertas,
    status_geral: alertas.length === 0 ? '✅ Sistema operacional sem alertas'
      : alertas.length <= 2 ? '⚠️ Sistema com alertas — verificar'
      : '🔴 Sistema com múltiplos alertas — ação necessária',
  }
}

export function registerMonitoramentoTools(server: McpServer): void {
  const mesSchema = z.number().int().min(1).max(12).describe('Mês (1-12)')
  const anoSchema = z.number().int().min(2020).max(2030).describe('Ano (ex: 2026)')

  server.tool(
    'health_check',
    'Checks system health: Supabase connectivity and Next.js API availability. Returns ok/error for each service and an overall health status. Run this first if something seems wrong.',
    {},
    async () => ({
      content: [{ type: 'text', text: JSON.stringify(await healthCheck(), null, 2) }],
    })
  )

  server.tool(
    'alert_margem_baixa',
    'Checks if any property (empreendimento) has a net profit margin below the given threshold. Returns a list of properties in alert with their revenue, costs, and margin. Default threshold is 20%.',
    {
      mes: mesSchema,
      ano: anoSchema,
      threshold_percent: z.number().min(0).max(100).default(20).describe(
        'Margin threshold in percent. Properties below this value trigger an alert. Default: 20.'
      ),
    },
    async ({ mes, ano, threshold_percent }) => ({
      content: [{ type: 'text', text: JSON.stringify(await alertMargemBaixa(mes, ano, threshold_percent), null, 2) }],
    })
  )

  server.tool(
    'check_sync_pendente',
    'Checks whether the Amenitiz sync has been completed for a given month/year and whether it is up to date (less than 3 days old). Use this to detect stale data before generating reports.',
    { mes: mesSchema, ano: anoSchema },
    async ({ mes, ano }) => ({
      content: [{ type: 'text', text: JSON.stringify(await checkSyncPendente(mes, ano), null, 2) }],
    })
  )

  server.tool(
    'resumo_executivo',
    'Returns a complete executive summary for a given month/year in a single call: KPIs, Amenitiz sync status, import checklist, 6-month historical trend, automatic alerts, and overall system status. This is the primary tool for autonomous monitoring agents — call this first.',
    { mes: mesSchema, ano: anoSchema },
    async ({ mes, ano }) => ({
      content: [{ type: 'text', text: JSON.stringify(await resumoExecutivo(mes, ano), null, 2) }],
    })
  )

  server.tool(
    'check_apartamentos_sem_room_id',
    'Checks which apartments are missing their Amenitiz room_id mapping. These apartments are invisible to the sync engine — their reservations are silently dropped. Always run this after health_check to detect data gaps before syncing.',
    {},
    async () => {
      const supabase = getSupabaseClient()

      const { data, error } = await supabase
        .from('apartamentos')
        .select('id, numero, tipo_gestao, empreendimentos(nome)')
        .is('amenitiz_room_id', null)
        .order('empreendimento_id')

      if (error) throw new Error(`Supabase error em check_apartamentos_sem_room_id: ${error.message}`)

      const total = data?.length ?? 0

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            total_sem_room_id: total,
            alerta: total > 0,
            mensagem: total > 0
              ? `⚠️ ${total} apartamento(s) sem amenitiz_room_id — reservas serão ignoradas no sync.`
              : '✅ Todos os apartamentos mapeados. Sync pode rodar com cobertura total.',
            apartamentos: data?.map((a) => ({
              numero: a.numero,
              empreendimento: (a.empreendimentos as any)?.nome ?? '—',
              tipo_gestao: a.tipo_gestao,
            })) ?? [],
          }, null, 2),
        }],
      }
    }
  )
}

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { runAmenitizSync } from '@/lib/sync-amenitiz-core'

// Autentica a chamada: aceita Authorization: Bearer <CRON_SECRET> (Vercel Cron)
// OU x-alugueasy-internal-key (MCP / chamada manual interna).
function autenticado(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')
  const xInternal = request.headers.get('x-alugueasy-internal-key')
  const cronSecret = process.env.CRON_SECRET
  const internalKey = process.env.ALUGUEASY_INTERNAL_API_KEY
  return (!!cronSecret && auth === `Bearer ${cronSecret}`)
      || (!!internalKey && xInternal === internalKey)
}

// Janela móvel: mês corrente + 2 meses anteriores (~60 dias).
// Cobre casos de reserva alterada retroativamente e falhas de webhook.
function janelaMovel(): Array<{ mes: number; ano: number }> {
  const agora = new Date()
  return Array.from({ length: 3 }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  })
}

export async function POST(request: NextRequest) {
  if (!autenticado(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const periodos = janelaMovel()
  const inicio = Date.now()
  const resultados: Record<string, unknown>[] = []
  let algumSucesso = false

  for (const { mes, ano } of periodos) {
    try {
      const r = await runAmenitizSync(supabase, mes, ano)
      resultados.push({ mes, ano, success: r.success, total_reservas: r.total_reservas,
        faturamento_liquido: r.faturamento_liquido, apts_nao_encontrados: r.apts_nao_encontrados,
        error: r.error ?? null })
      if (r.success) algumSucesso = true
    } catch (e: unknown) {
      resultados.push({ mes, ano, success: false, error: (e as Error).message })
    }
  }

  // Registrar timestamp do ingest para o badge "atualizado há X min" no portal.
  // Idempotente via upsert — sem perigo de duplicar row.
  // Cast para any: tabela nova não está nos tipos gerados ainda.
  if (algumSucesso) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('ingest_status').upsert(
      { id: 'global', ultimo_at: new Date().toISOString(), fonte: 'cron',
        updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
  }

  return NextResponse.json({
    executado_em: new Date().toISOString(),
    duracao_ms: Date.now() - inicio,
    periodos_sincronizados: periodos.length,
    resultados,
  })
}

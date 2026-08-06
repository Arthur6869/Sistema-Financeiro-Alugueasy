import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { runAmenitizSync } from '@/lib/sync-amenitiz-core'
import { temSegredoDeCron } from '@/lib/internal-key'

// Autentica a chamada: aceita Authorization: Bearer <CRON_SECRET> (Vercel Cron)
// OU x-alugueasy-internal-key (MCP / chamada manual interna).
// Comparação em tempo constante e fail-closed — ver lib/internal-key.ts.
function autenticado(request: NextRequest): boolean {
  return temSegredoDeCron(request)
}

// Permite a rota rodar até 60s (o sync completo de 3 meses leva ~30-45s).
export const maxDuration = 60

// Janela móvel: mês corrente + 2 meses anteriores (~60 dias).
// Cobre casos de reserva alterada retroativamente e falhas de webhook.
// No modo reservas (cron de 5 min) só o mês corrente — o sync completo diário
// cobre os retroativos, e 1 fetch na Amenitiz mantém a execução em ~10s.
function janelaMovel(meses: number): Array<{ mes: number; ano: number }> {
  const agora = new Date()
  return Array.from({ length: meses }, (_, i) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
  })
}

export async function POST(request: NextRequest) {
  if (!autenticado(request)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // ?modo=reservas → apenas upsert de amenitiz_reservas (leve, não-destrutivo,
  // alimenta o realtime do portal). Usado pelo pg_cron de 5 em 5 minutos.
  // Sem o parâmetro → sync completo (diarias + logs). Usado pelo pg_cron diário.
  const reservasOnly = new URL(request.url).searchParams.get('modo') === 'reservas'

  const supabase = createAdminClient()
  const periodos = janelaMovel(reservasOnly ? 1 : 3)
  const inicio = Date.now()
  const resultados: Record<string, unknown>[] = []
  let algumSucesso = false

  for (const { mes, ano } of periodos) {
    try {
      const r = await runAmenitizSync(supabase, mes, ano, { reservasOnly })
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
    modo: reservasOnly ? 'reservas' : 'completo',
    duracao_ms: Date.now() - inicio,
    periodos_sincronizados: periodos.length,
    resultados,
  })
}

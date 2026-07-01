import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAmenitizSync } from '@/lib/sync-amenitiz-core'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Auth: só proprietário autenticado pode disparar sync próprio
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'proprietario')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const mes = Number(body.mes)
  const ano = Number(body.ano)
  if (!mes || !ano || mes < 1 || mes > 12 || ano < 2020 || ano > 2100)
    return NextResponse.json({ error: 'Parâmetros mes/ano inválidos' }, { status: 400 })

  try {
    const admin = createAdminClient()
    // reservasOnly: apenas upsert em amenitiz_reservas — não toca diarias, importacoes ou syncs.
    // O proprietário verifica novas reservas sem destruir dados existentes.
    const result = await runAmenitizSync(admin, mes, ano, { actorUserId: user.id, reservasOnly: true })

    if (result.success) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('ingest_status').upsert(
        { id: 'global', ultimo_at: new Date().toISOString(), fonte: 'proprietario',
          updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
    }

    return NextResponse.json({
      success: result.success,
      total_reservas: result.total_reservas ?? 0,
      error: result.error ?? null,
    })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const ONLINE_WINDOW_SECONDS = 90

async function getRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).single()
  return data?.role ?? null
}

// POST: heartbeat do usuário logado (admin/analista/proprietario)
export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const nowIso = new Date().toISOString()

  const { error: upsertErr } = await supabase
    .from('user_presence')
    .upsert({ user_id: user.id, last_seen_at: nowIso }, { onConflict: 'user_id' })

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// GET: lista presença (apenas analista)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const role = await getRole(supabase, user.id)
  if (role !== 'analista') {
    return NextResponse.json({ error: 'Apenas analistas podem ver presença' }, { status: 403 })
  }

  const { data, error: selErr } = await supabase
    .from('user_presence')
    .select('user_id, last_seen_at')

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })

  const now = Date.now()
  const onlineThresholdMs = ONLINE_WINDOW_SECONDS * 1000

  const presencas = (data ?? []).map((row) => {
    const last = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0
    const online = last > 0 && now - last <= onlineThresholdMs
    return { user_id: row.user_id, last_seen_at: row.last_seen_at, online }
  })

  return NextResponse.json({ success: true, presencas, online_window_seconds: ONLINE_WINDOW_SECONDS })
}


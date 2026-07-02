import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

type RequireAnalistaResult =
  | { user: User; supabase: SupabaseClient; response: null }
  | { user: null; supabase: null; response: NextResponse }

/**
 * Valida que a requisição vem de um usuário autenticado com role 'analista'.
 *
 * Uso nas rotas de API:
 *   const { user, supabase, response } = await requireAnalista()
 *   if (response) return response
 */
export async function requireAnalista(): Promise<RequireAnalistaResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      user: null,
      supabase: null,
      response: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'analista') {
    return {
      user: null,
      supabase: null,
      response: NextResponse.json({ error: 'Apenas analistas podem executar esta ação' }, { status: 403 }),
    }
  }

  return { user, supabase, response: null }
}

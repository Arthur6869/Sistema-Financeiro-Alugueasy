import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase para ROTAS DE API que precisam atender tanto o site quanto um
 * cliente nativo (app mobile).
 *
 * O `createClient()` de `@/lib/supabase/server` monta a sessão exclusivamente a
 * partir dos cookies do navegador. Um app Expo/React Native não tem cookies: ele
 * guarda o token no dispositivo e o envia em `Authorization: Bearer <token>`.
 * Contra o cliente de cookies, esse pedido chega como anônimo e a rota responde
 * 401 — todas as rotas de API ficariam inalcançáveis pelo app.
 *
 * Aqui o Bearer tem precedência quando presente; sem ele, o comportamento é
 * idêntico ao de hoje (cookies). Em ambos os casos o token é validado pelo
 * Supabase via `auth.getUser()` e a RLS continua sendo quem decide as linhas —
 * este cliente usa a chave anônima, nunca a service role.
 *
 * Importante: o Bearer é aceito apenas como JWT de USUÁRIO. Segredos internos
 * (chave interna, CRON_SECRET) continuam em `lib/internal-key.ts`, com
 * comparação em tempo constante.
 */
export async function createApiClient(request: NextRequest): Promise<SupabaseClient> {
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : null

  // Um JWT do Supabase tem três partes separadas por ponto. Sem esse formato não é
  // token de usuário (pode ser o CRON_SECRET, por exemplo) — nesse caso cai para
  // o fluxo de cookies em vez de tentar autenticar com um segredo.
  const pareceJwt = !!bearer && bearer.split('.').length === 3

  if (pareceJwt) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        // Cliente sem estado: nada a ler nem gravar em cookies.
        cookies: { getAll: () => [], setAll: () => {} },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      }
    )
  }

  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookies só podem ser setados em Server Actions/Route Handlers
          }
        },
      },
    }
  )
}

/**
 * Autenticação + papel numa chamada, aceitando cookie (web) ou Bearer (mobile).
 *
 * Devolve também `ativo`, porque a suspensão de conta precisa ser verificada em
 * toda rota: `proxy.ts` checa isso, mas o matcher exclui `/api` — e um cliente
 * mobile nunca passa pelo proxy.
 */
export async function getSessaoApi(request: NextRequest): Promise<{
  supabase: SupabaseClient
  userId: string | null
  role: string | null
  ativo: boolean
}> {
  const supabase = await createApiClient(request)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { supabase, userId: null, role: null, ativo: false }

  const { data: profile } = await supabase
    .from('profiles').select('role, ativo').eq('id', user.id).single()

  return {
    supabase,
    userId: user.id,
    role: profile?.role ?? null,
    ativo: profile?.ativo !== false,
  }
}

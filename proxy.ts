import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas públicas que não exigem autenticação
const PUBLIC_ROUTES = ['/home', '/login-proprietario']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rotas públicas: landing page e login do proprietário — passam sem autenticação
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return supabaseResponse
  }

  // Não autenticado
  if (!user) {
    // Deixa a própria página de login ser exibida sem redirecionar
    if (pathname.startsWith('/login')) return supabaseResponse
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Autenticado: resolve o papel a partir do profile.
  // FAIL-CLOSED: sem default para 'analista'. Uma conta sem profile ou com papel
  // desconhecido (ex.: auto-cadastro pelo endpoint público do Supabase Auth) NÃO
  // recebe nenhum acesso.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, ativo')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  const isInterno = role === 'analista' || role === 'admin'
  const isProprietario = role === 'proprietario'

  // Proprietário desativado → encerra sessão e redireciona para login
  if (isProprietario && profile?.ativo === false) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login-proprietario?erro=conta_desativada', request.url))
  }

  // Conta sem papel de acesso válido → encerra a sessão e devolve ao login.
  // Cobre auto-cadastros e profiles ausentes/corrompidos.
  if (!isInterno && !isProprietario) {
    await supabase.auth.signOut()
    if (pathname.startsWith('/login')) return supabaseResponse // evita loop: mostra o formulário
    const url = new URL('/login', request.url)
    url.searchParams.set('erro', 'sem_acesso')
    const redirectRes = NextResponse.redirect(url)
    // propaga os cookies de sessão já limpos pelo signOut para a resposta de redirect
    supabaseResponse.cookies.getAll().forEach(c => redirectRes.cookies.set(c))
    return redirectRes
  }

  // Autenticado com papel válido tentando acessar /login → home do papel
  if (pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL(isProprietario ? '/proprietario' : '/', request.url))
  }

  // Proprietário tentando acessar rotas internas → redireciona para portal
  if (isProprietario && !pathname.startsWith('/proprietario')) {
    return NextResponse.redirect(new URL('/proprietario', request.url))
  }

  // Analista/admin tentando acessar rotas do proprietário → redireciona para dashboard
  if (isInterno && pathname.startsWith('/proprietario')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|logo-alugueasy.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

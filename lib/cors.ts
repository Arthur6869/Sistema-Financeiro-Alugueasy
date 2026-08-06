import type { NextRequest } from 'next/server'

/**
 * CORS para as rotas que o aplicativo consome.
 *
 * Por que existe: o app nativo (Android/iOS) não passa por CORS — é o navegador
 * que impõe essa regra. Mas a versão web do Expo roda em `http://localhost:8081`
 * e chama a API em outro domínio, então o navegador exige que a resposta declare
 * a origem. Sem isto, o download do PDF falha no preview web com um erro que
 * nem aparece direito no console.
 *
 * Desenho seguro, e as duas decisões abaixo são deliberadas:
 *
 * 1. Lista fechada de origens. `*` seria mais simples, mas abriria a API para
 *    qualquer site.
 * 2. NENHUM `Access-Control-Allow-Credentials`. Sem ele o navegador não envia
 *    cookie nenhum nessas chamadas — só o header Authorization, que é como o app
 *    autentica. Isso elimina qualquer vetor de CSRF: um site malicioso não
 *    consegue aproveitar a sessão de quem estiver logado no painel.
 *
 * Uma página hostil também não consegue forjar o próprio `Origin` — quem
 * preenche esse header é o navegador.
 */
const ORIGENS_PERMITIDAS = new Set([
  'http://localhost:8081',    // Expo web (padrão do SDK 54+)
  'http://localhost:19006',   // Expo web (versões anteriores)
  'http://127.0.0.1:8081',
])

export function cabecalhosCors(request: NextRequest): Record<string, string> {
  const origem = request.headers.get('origin')
  if (!origem || !ORIGENS_PERMITIDAS.has(origem)) return {}

  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    // A resposta muda conforme a origem — sem isto, um cache intermediário
    // poderia servir a um site a resposta liberada para outro.
    Vary: 'Origin',
  }
}

/** Resposta ao preflight que o navegador dispara antes do GET/POST com header. */
export function respostaPreflight(request: NextRequest): Response {
  return new Response(null, { status: 204, headers: cabecalhosCors(request) })
}

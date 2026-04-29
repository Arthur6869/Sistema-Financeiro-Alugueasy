import { NextRequest } from 'next/server'

/**
 * Autenticação interna para chamadas MCP -> API Next.
 * Usa chave dedicada para evitar expor a service role no tráfego interno.
 */
export function isInternalApiRequest(request: NextRequest): boolean {
  const headerKey = request.headers.get('x-alugueasy-internal-key')
  if (!headerKey) return false

  const internalApiKey = process.env.ALUGUEASY_INTERNAL_API_KEY
  if (!internalApiKey) return false

  return headerKey === internalApiKey
}

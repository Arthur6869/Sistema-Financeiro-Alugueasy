import { NextRequest } from 'next/server'
import { temChaveInterna } from '@/lib/internal-key'

/**
 * Autenticação interna para chamadas MCP -> API Next.
 * Usa chave dedicada para evitar expor a service role no tráfego interno.
 *
 * A comparação vive em lib/internal-key.ts: tempo constante (timingSafeEqual) e
 * fail-closed. O `===` que existia aqui saía no primeiro byte diferente, então o
 * tempo de resposta revelava o prefixo correto da chave — e esta função guarda
 * `/api/clear` (DELETE em massa), `/api/amenitiz-sync` e `/api/obsidian/sync`.
 */
export function isInternalApiRequest(request: NextRequest): boolean {
  return temChaveInterna(request)
}

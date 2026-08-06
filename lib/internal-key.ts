import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

/**
 * Comparação de segredo resistente a timing attack.
 *
 * `a === b` em JS sai no primeiro byte diferente, então o tempo de resposta
 * revela quantos caracteres do prefixo estão certos — dá para reconstruir a
 * chave byte a byte com requisições repetidas. timingSafeEqual roda em tempo
 * constante.
 *
 * Fail-closed: se o segredo esperado não estiver configurado no ambiente, a
 * resposta é sempre `false`. Nunca "sem chave configurada = libera".
 */
function segredoConfere(recebido: string | null | undefined, esperado: string | undefined): boolean {
  if (!esperado || !recebido) return false

  const a = Buffer.from(recebido, 'utf8')
  const b = Buffer.from(esperado, 'utf8')

  // timingSafeEqual exige buffers do mesmo tamanho. Comparar o tamanho antes
  // vaza apenas o comprimento da chave, que não ajuda a adivinhar o conteúdo.
  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}

/**
 * A requisição traz a chave interna válida (header x-alugueasy-internal-key)?
 * Usada pelas rotas que o MCP server e os jobs pg_cron chamam sem sessão.
 */
export function temChaveInterna(request: NextRequest): boolean {
  return segredoConfere(
    request.headers.get('x-alugueasy-internal-key'),
    process.env.ALUGUEASY_INTERNAL_API_KEY
  )
}

/**
 * A requisição é um disparo de cron autorizado?
 * Aceita `Authorization: Bearer <CRON_SECRET>` ou a chave interna.
 */
export function temSegredoDeCron(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const viaBearer = !!auth && auth.startsWith('Bearer ')
    && segredoConfere(auth.slice('Bearer '.length), cronSecret)

  return viaBearer || temChaveInterna(request)
}

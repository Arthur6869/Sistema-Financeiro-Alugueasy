type PageResult<T> = { data: T[] | null; error: { message: string } | null }

/**
 * Busca TODAS as linhas de uma query paginando via .range(), contornando o cap
 * db-max-rows do PostgREST (padrão Supabase: 1000) — um .limit(50000) simples
 * NÃO passa do cap e trunca silenciosamente.
 *
 * Uso:
 *   const { rows, error } = await fetchAllRows((from, to) =>
 *     supabase.from('custos').select('*').eq('ano', ano).range(from, to))
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) return { rows, error: error.message }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < pageSize) return { rows, error: null }
  }
}

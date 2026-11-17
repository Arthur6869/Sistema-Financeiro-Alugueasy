import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TelaCustos } from '@/components/custos/tela-custos'
import type { CustoRow } from '@/components/custos/grade-custos'

type Supabase = Awaited<ReturnType<typeof createClient>>

/** O banco devolve no máximo 1.000 linhas por consulta */
const PAGINA = 1000

/**
 * Todos os lançamentos do mês. Busca em páginas: com um corte silencioso em
 * 1.000 linhas, um mês mais cheio apareceria com o total a menor sem aviso.
 * Erro de consulta volta como erro — não como "mês sem custos".
 */
async function custosDoPeriodo(supabase: Supabase, mes: number, ano: number) {
  const linhas: CustoRow[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from('custos')
      .select(`
        id, categoria, valor, tipo_gestao, origem, observacao, mes, ano,
        apartamentos ( numero, empreendimentos ( nome ) )
      `)
      .eq('mes', mes)
      .eq('ano', ano)
      .order('created_at', { ascending: false })
      .order('id')
      .range(de, de + PAGINA - 1)

    if (error) return { linhas: [] as CustoRow[], erro: error.message }
    // `valor` sempre número: a tela soma estes campos, e um nulo viraria "R$ NaN"
    linhas.push(...((data ?? []) as unknown as CustoRow[]).map(c => ({ ...c, valor: Number(c.valor) || 0 })))
    if (!data || data.length < PAGINA) return { linhas, erro: null }
  }
}

export default async function CustosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const now = new Date()
  const mesRaw = params.mes ? parseInt(params.mes) : now.getMonth() + 1
  const anoRaw = params.ano ? parseInt(params.ano) : now.getFullYear()
  // Custo é lançado por mês. "Todos os meses" (mes=0), que o menu lateral traz
  // de outras abas, fazia a consulta procurar `mes = 0` e voltar vazia: fora
  // de 1–12 cai no mês atual (mesmo critério de /empreendimentos).
  const mes = mesRaw >= 1 && mesRaw <= 12 ? mesRaw : now.getMonth() + 1
  const ano = anoRaw >= 2020 && anoRaw <= 2100 ? anoRaw : now.getFullYear()

  const [{ data: profile }, { linhas, erro }, categoriasResult] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    custosDoPeriodo(supabase, mes, ano),
    // Sugestões para o campo de categoria. Esta consulta para em 1.000 linhas;
    // a tela completa a lista com as categorias do próprio mês.
    supabase.from('custos').select('categoria').order('categoria'),
  ])

  const categorias = [...new Set(
    (categoriasResult.data ?? []).map(r => r.categoria).filter(Boolean),
  )]

  return (
    <TelaCustos
      custos={linhas}
      mes={mes}
      ano={ano}
      podeEditar={profile?.role === 'analista'}
      categoriasSugeridas={categorias}
      erro={erro}
    />
  )
}

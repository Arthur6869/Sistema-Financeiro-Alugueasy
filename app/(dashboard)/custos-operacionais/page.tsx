import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  COLUNAS_CONTA, COLUNAS_LANCAMENTO, normalizarConta, normalizarLancamento, ordenarContas,
  type ContaOp, type LancamentoOp,
} from '@/lib/custos-operacionais'
import { TelaCustosOperacionais, type EstadoCustosOp } from '@/components/custos-operacionais/tela-custos-operacionais'

type Supabase = Awaited<ReturnType<typeof createClient>>

/** O banco devolve no máximo 1.000 linhas por consulta */
const PAGINA = 1000

// PGRST205 / 42P01: a tabela não existe — a migration 047 ainda não foi aplicada
const semTabela = (codigo?: string) => codigo === 'PGRST205' || codigo === '42P01'

/**
 * Plano de contas + todos os valores do ano. O ano inteiro vem de uma vez
 * porque a tela mostra a evolução mês a mês e o mês anterior ao lado do atual.
 * Erro de consulta volta como erro — não como "ano sem custos".
 */
async function carregar(supabase: Supabase, ano: number): Promise<
  { estado: EstadoCustosOp; contas: ContaOp[]; lancamentos: LancamentoOp[]; erro: string | null }
> {
  const vazio = { contas: [] as ContaOp[], lancamentos: [] as LancamentoOp[] }

  const contasRes = await supabase.from('custos_operacionais_contas').select(COLUNAS_CONTA).order('ordem')
  if (contasRes.error) {
    return semTabela(contasRes.error.code)
      ? { estado: 'sem-estrutura', ...vazio, erro: null }
      : { estado: 'erro', ...vazio, erro: contasRes.error.message }
  }

  const lancamentos: LancamentoOp[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from('custos_operacionais_lancamentos')
      .select(COLUNAS_LANCAMENTO)
      .eq('ano', ano)
      .order('mes')
      .order('id')
      .range(de, de + PAGINA - 1)
    if (error) {
      return semTabela(error.code)
        ? { estado: 'sem-estrutura', ...vazio, erro: null }
        : { estado: 'erro', ...vazio, erro: error.message }
    }
    lancamentos.push(...(data ?? []).map(l => normalizarLancamento(l)))
    if (!data || data.length < PAGINA) break
  }

  return {
    estado: 'ok',
    contas: ordenarContas((contasRes.data ?? []).map(c => normalizarConta(c))),
    lancamentos,
    erro: null,
  }
}

export default async function CustosOperacionaisPage({
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
  // Custo operacional é lançado por mês: "Todos os meses" (mes=0), que o menu
  // traz de outras abas, cai no mês atual — mesmo critério de /custos.
  const mes = mesRaw >= 1 && mesRaw <= 12 ? mesRaw : now.getMonth() + 1
  const ano = anoRaw >= 2020 && anoRaw <= 2100 ? anoRaw : now.getFullYear()

  const [{ data: profile }, dados] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    carregar(supabase, ano),
  ])

  return (
    <TelaCustosOperacionais
      contas={dados.contas}
      lancamentos={dados.lancamentos}
      mes={mes}
      ano={ano}
      podeEditar={profile?.role === 'analista'}
      estado={dados.estado}
      erro={dados.erro}
    />
  )
}

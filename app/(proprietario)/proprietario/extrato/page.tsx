import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Rentabilidade } from '@/components/proprietario/rentabilidade'
import { MESES } from '@/lib/constants'

type SearchParams = Promise<{ mes?: string; ano?: string }>

type ApartamentoVinculo = {
  id: string
  numero: string
  tipo_gestao: 'adm' | 'sub' | null
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  empreendimentos: { nome: string } | null
}

type CustoItem = {
  apartamento_id: string
  categoria: string
  valor: number
}

type DiariasItem = {
  apartamento_id: string
  valor: number
}

function calcularRepasse(
  faturamento: number,
  lucro: number,
  taxaRepasse: number,
  tipoRepasse: 'lucro' | 'faturamento'
) {
  const base = tipoRepasse === 'faturamento' ? faturamento : lucro
  return base * (taxaRepasse / 100)
}

export default async function ExtratoPropPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'proprietario') redirect('/')

  const params = await searchParams
  const now = new Date()
  // Parâmetro inválido (?ano=0, ?mes=abc) cai no período atual — ver proprietario/page.tsx
  const mesParam = params.mes !== undefined ? parseInt(params.mes) : NaN
  const anoParam = params.ano !== undefined ? parseInt(params.ano) : NaN
  const mes = mesParam >= 0 && mesParam <= 12 ? mesParam : now.getMonth() + 1
  const ano = anoParam >= 2000 && anoParam <= 2100 ? anoParam : now.getFullYear()
  const nomeMes = mes > 0 ? (MESES[mes - 1] ?? '') : ''
  const labelPeriodo = nomeMes ? `${nomeMes} ${ano}` : String(ano)

  const { data: vinculos } = await supabase
    .from('proprietario_apartamentos')
    .select('apartamentos(id, numero, tipo_gestao, taxa_repasse, tipo_repasse, empreendimentos(nome))')
    .eq('proprietario_id', user.id)
    .eq('ativo', true)

  type VinculoRow = { apartamentos: ApartamentoVinculo | null }
  const apartamentos: ApartamentoVinculo[] = ((vinculos ?? []) as unknown as VinculoRow[])
    .map(v => v.apartamentos)
    .filter((a): a is ApartamentoVinculo => a !== null)

  const aptIds = apartamentos.map(a => a.id)

  const dataInicio = mes > 0
    ? `${ano}-${String(mes).padStart(2, '0')}-01`
    : `${ano}-01-01`
  const dataFim = mes > 0
    ? new Date(ano, mes, 0).toISOString().slice(0, 10)
    : `${ano}-12-31`

  const admin = createAdminClient()

  // Custos completos das planilhas (todos os lançamentos) — via admin para bypass de RLS,
  // isolado pelos aptIds já filtrados pelo vínculo do proprietário autenticado.
  const custosDetalheQuery = mes > 0
    ? admin.from('custos')
        .select('apartamento_id, categoria, valor')
        .in('apartamento_id', aptIds)
        .eq('mes', mes).eq('ano', ano)
        .order('categoria')
    : admin.from('custos')
        .select('apartamento_id, categoria, valor')
        .in('apartamento_id', aptIds)
        .eq('ano', ano)
        .order('categoria')

  // Custos repassáveis — apenas para calcular lucro e repasse ao proprietário.
  const custosRepasseQuery = mes > 0
    ? supabase.from('custos_proprietario')
        .select('apartamento_id, valor')
        .in('apartamento_id', aptIds)
        .eq('mes', mes).eq('ano', ano)
    : supabase.from('custos_proprietario')
        .select('apartamento_id, valor')
        .in('apartamento_id', aptIds)
        .eq('ano', ano)

  const [
    { data: custosDetalheData },
    { data: custosRepasseData },
    { data: diariasData },
  ] = await Promise.all([
    custosDetalheQuery,
    custosRepasseQuery,
    supabase
      .from('diarias')
      .select('apartamento_id, valor')
      .in('apartamento_id', aptIds)
      .gte('data', dataInicio)
      .lte('data', dataFim),
  ])

  const custosDetalhe = (custosDetalheData ?? []) as CustoItem[]
  const custosRepasseItens = (custosRepasseData ?? []) as { apartamento_id: string; valor: number }[]
  const diarias = (diariasData ?? []) as DiariasItem[]

  const metricas = apartamentos.map(apt => {
    const faturamento = diarias
      .filter(d => d.apartamento_id === apt.id)
      .reduce((s, d) => s + (d.valor ?? 0), 0)

    // Todos os custos lançados nas planilhas (para exibição)
    const custosPorCategoria = custosDetalhe.filter(c => c.apartamento_id === apt.id)
    const totalCustosDisplay = custosPorCategoria.reduce((s, c) => s + (c.valor ?? 0), 0)
    const semCustos = custosPorCategoria.length === 0

    // Apenas custos repassáveis (para cálculo de lucro e repasse)
    const custosRepasse = custosRepasseItens
      .filter(c => c.apartamento_id === apt.id)
      .reduce((s, c) => s + (c.valor ?? 0), 0)

    const lucro = faturamento - custosRepasse
    const taxaRepasse = apt.taxa_repasse ?? 0
    const tipoRepasse = apt.tipo_repasse ?? 'lucro'
    const repasse = calcularRepasse(faturamento, lucro, taxaRepasse, tipoRepasse)
    const valorFinal = lucro - repasse

    return { apt, faturamento, totalCustosDisplay, semCustos, lucro, repasse, valorFinal, taxaRepasse, tipoRepasse, custosPorCategoria }
  })

  return (
    <Rentabilidade
      labelPeriodo={labelPeriodo}
      mes={mes}
      ano={ano}
      itens={metricas.map(m => ({
        aptId: m.apt.id,
        numero: m.apt.numero,
        empreendimento: m.apt.empreendimentos?.nome ?? null,
        tipoGestao: m.apt.tipo_gestao,
        faturamento: m.faturamento,
        totalCustos: m.totalCustosDisplay,
        semCustos: m.semCustos,
        lucro: m.lucro,
        taxa: m.repasse,
        valorFinal: m.valorFinal,
        taxaPct: m.taxaRepasse,
        tipoRepasse: m.tipoRepasse,
        custosPorCategoria: m.custosPorCategoria.map(c => ({ categoria: c.categoria, valor: c.valor })),
      }))}
    />
  )
}

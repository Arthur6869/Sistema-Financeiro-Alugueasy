import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { formatCurrency, MESES } from '@/lib/constants'
import { Home, TrendingUp, Receipt } from 'lucide-react'
import { ExtratoAptCard } from '@/components/proprietario/extrato-apt-card'

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
  const mes = params.mes !== undefined ? parseInt(params.mes) : now.getMonth() + 1
  const ano = params.ano !== undefined ? parseInt(params.ano) : now.getFullYear()
  const mesLabel = `${MESES[mes - 1]} ${ano}`

  const { data: vinculos } = await supabase
    .from('proprietario_apartamentos')
    .select('apartamentos(id, numero, tipo_gestao, taxa_repasse, tipo_repasse, empreendimentos(nome))')
    .eq('proprietario_id', user.id)
    .eq('ativo', true)

  type VinculoRow = { apartamentos: ApartamentoVinculo | null }
  const apartamentos: ApartamentoVinculo[] = ((vinculos ?? []) as unknown as VinculoRow[])
    .map(v => v.apartamentos)
    .filter((a): a is ApartamentoVinculo => a !== null)

  if (apartamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Home size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Nenhum apartamento vinculado</h2>
        <p className="text-gray-500 text-sm">Entre em contato com a AlugEasy para vincular seus imóveis.</p>
      </div>
    )
  }

  const aptIds = apartamentos.map(a => a.id)
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  const [{ data: custosData }, { data: diariasData }] = await Promise.all([
    supabase
      .from('custos')
      .select('apartamento_id, categoria, valor')
      .in('apartamento_id', aptIds)
      .eq('mes', mes)
      .eq('ano', ano)
      .order('categoria'),
    supabase
      .from('diarias')
      .select('apartamento_id, valor')
      .in('apartamento_id', aptIds)
      .gte('data', dataInicio)
      .lte('data', dataFim),
  ])

  const totalFaturamento = (diariasData ?? []).reduce((s, d) => s + (d.valor ?? 0), 0)
  const totalCustos = (custosData ?? []).reduce((s, c) => s + (c.valor ?? 0), 0)
  const totalLucro = totalFaturamento - totalCustos

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            Extrato — {mesLabel}
          </h1>
          <p className="text-gray-500 text-sm mt-1 hidden sm:block">
            Demonstrativo completo de faturamento, custos e repasse
          </p>
        </div>
        <MonthYearFilter mes={mes} ano={ano} />
      </div>

      {/* Resumo global */}
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-[#193660]" />
          <div className="p-3 md:p-4">
            <div className="flex items-center gap-1.5 mb-1.5 md:mb-2">
              <TrendingUp size={12} className="text-[#193660]" />
              <span className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wide">Fat.</span>
            </div>
            <p className="text-sm md:text-xl font-bold text-[#193660]">{formatCurrency(totalFaturamento)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-red-400" />
          <div className="p-3 md:p-4">
            <div className="flex items-center gap-1.5 mb-1.5 md:mb-2">
              <Receipt size={12} className="text-red-500" />
              <span className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wide">Custos</span>
            </div>
            <p className="text-sm md:text-xl font-bold text-red-600">{formatCurrency(totalCustos)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`h-1 ${totalLucro >= 0 ? 'bg-green-400' : 'bg-red-400'}`} />
          <div className="p-3 md:p-4">
            <div className="flex items-center gap-1.5 mb-1.5 md:mb-2">
              <TrendingUp size={12} className={totalLucro >= 0 ? 'text-green-500' : 'text-red-500'} />
              <span className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wide">Lucro</span>
            </div>
            <p className={`text-sm md:text-xl font-bold ${totalLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalLucro)}
            </p>
          </div>
        </div>
      </div>

      {/* Detalhamento por apartamento */}
      <div className="space-y-4 md:space-y-6">
        <h2 className="text-sm md:text-base font-semibold text-gray-800">Detalhamento por Apartamento</h2>

        {apartamentos.map(apt => {
          const faturamento = (diariasData ?? [])
            .filter((d: DiariasItem) => d.apartamento_id === apt.id)
            .reduce((s, d) => s + (d.valor ?? 0), 0)

          const custosPorCategoria = (custosData ?? [])
            .filter((c: CustoItem) => c.apartamento_id === apt.id)

          const custos = custosPorCategoria.reduce((s, c) => s + (c.valor ?? 0), 0)
          const lucro = faturamento - custos
          const taxaRepasse = apt.taxa_repasse ?? 0
          const tipoRepasse = apt.tipo_repasse ?? 'lucro'
          const repasse = calcularRepasse(faturamento, lucro, taxaRepasse, tipoRepasse)
          const valorProprietario = lucro - repasse

          return (
            <ExtratoAptCard
              key={apt.id}
              aptId={apt.id}
              numero={apt.numero}
              empreendimento={apt.empreendimentos?.nome ?? null}
              tipoGestao={apt.tipo_gestao}
              faturamento={faturamento}
              custos={custos}
              lucro={lucro}
              repasse={repasse}
              valorProprietario={valorProprietario}
              taxaRepasse={taxaRepasse}
              tipoRepasse={tipoRepasse}
              custosPorCategoria={custosPorCategoria.map(c => ({ categoria: c.categoria, valor: c.valor ?? 0 }))}
              semFaturamento={faturamento === 0}
              semCustos={custosPorCategoria.length === 0}
              mesLabel={mesLabel}
              mes={mes}
              ano={ano}
            />
          )
        })}
      </div>
    </div>
  )
}

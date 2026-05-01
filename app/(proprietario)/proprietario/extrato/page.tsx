import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { formatCurrency, MESES } from '@/lib/constants'
import { Home, FileText, TrendingUp, Receipt } from 'lucide-react'

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
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Extrato Detalhado — {mesLabel}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Demonstrativo completo de faturamento, custos e repasse
          </p>
        </div>
        <MonthYearFilter mes={mes} ano={ano} />
      </div>

      {/* Resumo global */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-[#193660]" />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-[#193660]" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Faturamento</span>
            </div>
            <p className="text-xl font-bold text-[#193660]">{formatCurrency(totalFaturamento)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-red-400" />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt size={14} className="text-red-500" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custos</span>
            </div>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalCustos)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`h-1 ${totalLucro >= 0 ? 'bg-green-400' : 'bg-red-400'}`} />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className={totalLucro >= 0 ? 'text-green-500' : 'text-red-500'} />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lucro</span>
            </div>
            <p className={`text-xl font-bold ${totalLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalLucro)}
            </p>
          </div>
        </div>
      </div>

      {/* Detalhamento por apartamento */}
      <div className="space-y-6">
        <h2 className="text-base font-semibold text-gray-800">Detalhamento por Apartamento</h2>

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
          const semFaturamento = faturamento === 0
          const semCustos = custosPorCategoria.length === 0

          return (
            <Card key={apt.id} className="border border-gray-100 shadow-sm overflow-hidden">
              <CardHeader className="bg-gray-50 border-b border-gray-100 py-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Home size={14} className="text-[#193660]" />
                    Apt {apt.numero} — {apt.empreendimentos?.nome}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={apt.tipo_gestao === 'adm'
                        ? 'border-blue-200 bg-blue-50 text-blue-700 text-xs'
                        : 'border-purple-200 bg-purple-50 text-purple-700 text-xs'}
                    >
                      {apt.tipo_gestao === 'adm' ? 'Administração' : 'Sublocação'}
                    </Badge>
                    <a
                      href={`/api/prestacao-contas-pdf?apartamento_id=${apt.id}&mes=${mes}&ano=${ano}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-medium text-[#193660] bg-white border border-[#193660] hover:bg-[#193660] hover:text-white transition-colors rounded-md px-2.5 py-1"
                    >
                      <FileText size={12} />
                      Baixar PDF
                    </a>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {semFaturamento && semCustos ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                    <FileText size={28} className="mb-2 text-gray-200" />
                    <p className="text-sm">Nenhum dado disponível para {mesLabel}</p>
                    <p className="text-xs mt-1">Os dados podem levar alguns dias para ser processados</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {/* Faturamento */}
                      <tr className="border-b border-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-700">Faturamento</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-[#193660]">
                          {semFaturamento
                            ? <span className="text-gray-400 font-normal italic text-xs">Faturamento não disponível</span>
                            : formatCurrency(faturamento)
                          }
                        </td>
                      </tr>

                      {/* Custos — header */}
                      <tr className="bg-gray-50">
                        <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Custos {!semCustos && `— ${formatCurrency(custos)}`}
                        </td>
                      </tr>

                      {/* Custos por categoria */}
                      {semCustos ? (
                        <tr>
                          <td colSpan={2} className="px-4 py-3 text-gray-400 text-xs italic text-center">
                            Custos não disponíveis para este período
                          </td>
                        </tr>
                      ) : (
                        custosPorCategoria.map((c, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="px-4 py-2 pl-8 text-gray-500">{c.categoria}</td>
                            <td className="px-4 py-2 text-right text-gray-700">
                              {formatCurrency(c.valor)}
                            </td>
                          </tr>
                        ))
                      )}

                      {/* Lucro */}
                      <tr className="border-t border-gray-200">
                        <td className="px-4 py-2.5 font-medium text-gray-700">Lucro</td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(lucro)}
                        </td>
                      </tr>

                      {/* Taxa repasse */}
                      <tr className="border-b border-gray-50">
                        <td className="px-4 py-2 text-gray-500">
                          Taxa repasse ({taxaRepasse}% sobre {tipoRepasse === 'faturamento' ? 'faturamento' : 'lucro'})
                        </td>
                        <td className="px-4 py-2 text-right text-amber-600">
                          − {formatCurrency(repasse)}
                        </td>
                      </tr>

                      {/* Valor ao proprietário */}
                      <tr className="bg-[#193660]/5">
                        <td className="px-4 py-3 font-bold text-gray-800">Seu repasse</td>
                        <td className={`px-4 py-3 text-right font-bold text-lg ${valorProprietario >= 0 ? 'text-[#193660]' : 'text-red-600'}`}>
                          {formatCurrency(valorProprietario)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

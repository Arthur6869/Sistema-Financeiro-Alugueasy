import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import { RelatorioLineChart } from './charts'
import { MESES_ABREV, formatCurrency } from '@/lib/constants'

function getLast6Months(): { mes: number; ano: number; label: string }[] {
  const result = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push({
      mes: d.getMonth() + 1,
      ano: d.getFullYear(),
      label: `${MESES_ABREV[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
    })
  }
  return result
}

export default async function RelatorioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const periodos = getLast6Months()

  // Filtro exato por (mes, ano) para não buscar dados além dos 6 meses
  const custosFilter = periodos.map(({ mes, ano }) => `and(mes.eq.${mes},ano.eq.${ano})`).join(',')

  const first = periodos[0]
  const last = periodos[periodos.length - 1]
  const dataInicio = `${first.ano}-${String(first.mes).padStart(2, '0')}-01`
  const dataFim = `${last.ano}-${String(last.mes).padStart(2, '0')}-${new Date(last.ano, last.mes, 0).getDate()}`

  const [{ data: custosAll }, { data: diariasAll }] = await Promise.all([
    supabase
      .from('custos')
      .select('mes, ano, categoria, valor, tipo_gestao')
      .or(custosFilter),
    supabase
      .from('diarias')
      .select('data, valor, tipo_gestao')
      .gte('data', dataInicio)
      .lte('data', dataFim),
  ])

  // Montar dados mensais para o gráfico de linha
  const monthlyData = periodos.map(({ mes, ano, label }) => {
    const fat = diariasAll
      ?.filter((d) => {
        const [dy, dm] = d.data.split('-').map(Number)
        return dm === mes && dy === ano
      })
      .reduce((acc, d) => acc + (d.valor || 0), 0) ?? 0

    const custos = custosAll
      ?.filter((c) => c.mes === mes && c.ano === ano)
      .reduce((acc, c) => acc + (c.valor || 0), 0) ?? 0

    return { label, faturamento: Math.round(fat), custos: Math.round(custos), lucro: Math.round(fat - custos) }
  })

  // Pivot: categorias de custo × meses (últimos 6 meses)
  const categoriasSet = new Set(custosAll?.map((c) => c.categoria) ?? [])
  const categorias = Array.from(categoriasSet).sort()

  const pivotData = categorias.map((cat) => {
    const row: Record<string, any> = { categoria: cat }
    let totalRow = 0
    periodos.forEach(({ mes, ano, label }) => {
      const val = custosAll
        ?.filter((c) => c.categoria === cat && c.mes === mes && c.ano === ano)
        .reduce((acc, c) => acc + (c.valor || 0), 0) ?? 0
      row[label] = val > 0 ? val : null
      totalRow += val
    })
    row['_total'] = totalRow
    return row
  })

  // Totais por coluna (mês)
  const totaisColuna: Record<string, number> = {}
  periodos.forEach(({ label }) => {
    totaisColuna[label] = pivotData.reduce((acc, row) => acc + (row[label] || 0), 0)
  })
  const grandTotal = Object.values(totaisColuna).reduce((a, b) => a + b, 0)

  // KPIs do mês atual
  const mesAtual = periodos[periodos.length - 1]
  const margemAdm = diariasAll
    ?.filter((d) => {
      const [dy, dm] = d.data.split('-').map(Number)
      return dm === mesAtual.mes && dy === mesAtual.ano && d.tipo_gestao === 'adm'
    })
    .reduce((acc, d) => acc + (d.valor || 0), 0) ?? 0
  const margemSub = diariasAll
    ?.filter((d) => {
      const [dy, dm] = d.data.split('-').map(Number)
      return dm === mesAtual.mes && dy === mesAtual.ano && d.tipo_gestao === 'sub'
    })
    .reduce((acc, d) => acc + (d.valor || 0), 0) ?? 0
  const custosAdm = custosAll
    ?.filter((c) => c.mes === mesAtual.mes && c.ano === mesAtual.ano && c.tipo_gestao === 'adm')
    .reduce((acc, c) => acc + (c.valor || 0), 0) ?? 0
  const custosSub = custosAll
    ?.filter((c) => c.mes === mesAtual.mes && c.ano === mesAtual.ano && c.tipo_gestao === 'sub')
    .reduce((acc, c) => acc + (c.valor || 0), 0) ?? 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Relatório Analítico</h1>
        <p className="text-gray-500 text-sm mt-1">
          Visão consolidada dos últimos 6 meses
        </p>
      </div>

      {/* KPIs mês atual ADM vs SUB */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">Fat. ADM ({mesAtual.label})</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-[#193660]">{formatCurrency(margemAdm)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">Fat. SUB ({mesAtual.label})</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-[#7c3aed]">{formatCurrency(margemSub)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">Lucro ADM ({mesAtual.label})</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${margemAdm - custosAdm >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(margemAdm - custosAdm)}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500">Lucro SUB ({mesAtual.label})</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${margemSub - custosSub >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(margemSub - custosSub)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de linha */}
      <RelatorioLineChart data={monthlyData} />

      {/* Tabela Pivot: Categorias × Meses */}
      {categorias.length > 0 ? (
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <BarChart3 size={18} />
              Custos por Categoria × Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium min-w-[160px]">Categoria</th>
                  {periodos.map(({ label }) => (
                    <th key={label} className="text-right py-2 px-3 text-gray-500 font-medium whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                  <th className="text-right py-2 px-3 text-gray-700 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {pivotData.map((row) => (
                  <tr key={row.categoria} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-700 font-medium">{row.categoria}</td>
                    {periodos.map(({ label }) => (
                      <td key={label} className="py-2 px-3 text-right text-gray-600">
                        {row[label]
                          ? `R$ ${Number(row[label]).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                          : <span className="text-gray-200">—</span>}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right font-bold text-gray-900">
                      R$ {Number(row['_total']).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="py-2 px-3 font-semibold text-gray-700">Total Custos</td>
                  {periodos.map(({ label }) => (
                    <td key={label} className="py-2 px-3 text-right font-semibold text-gray-900">
                      R$ {totaisColuna[label].toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-bold text-red-700">
                    R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-2 px-3 font-semibold text-gray-700">Faturamento</td>
                  {monthlyData.map((m) => (
                    <td key={m.label} className="py-2 px-3 text-right font-semibold text-[#193660]">
                      R$ {m.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-bold text-[#193660]">
                    R$ {monthlyData.reduce((a, m) => a + m.faturamento, 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="py-2 px-3 font-semibold text-gray-700">Lucro</td>
                  {monthlyData.map((m) => (
                    <td key={m.label} className={`py-2 px-3 text-right font-bold ${m.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {m.lucro >= 0 ? '+' : ''}R$ {m.lucro.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </td>
                  ))}
                  <td className={`py-2 px-3 text-right font-bold ${monthlyData.reduce((a, m) => a + m.lucro, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {monthlyData.reduce((a, m) => a + m.lucro, 0) >= 0 ? '+' : ''}R$ {monthlyData.reduce((a, m) => a + m.lucro, 0).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BarChart3 className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhum dado disponível</p>
            <p className="text-gray-400 text-sm mt-1">
              Importe planilhas para visualizar o relatório analítico
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

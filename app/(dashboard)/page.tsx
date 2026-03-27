import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BedDouble,
  Upload,
} from 'lucide-react'
import { DashboardCharts } from '@/components/dashboard-charts'
import { MonthYearFilter } from '@/components/month-year-filter'
import { Suspense } from 'react'
import { MESES } from '@/lib/constants'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const mes = params.mes ? parseInt(params.mes) : now.getMonth() + 1
  const ano = params.ano ? parseInt(params.ano) : now.getFullYear()

  const anoMesLabel = `${MESES[mes - 1]} ${ano}`
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  const supabase = await createClient()

  const { data: empreendimentos } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .order('nome')

  const { data: diariasData } = await supabase
    .from('diarias')
    .select('valor, apartamento_id, tipo_gestao, apartamentos(empreendimento_id, empreendimentos(nome))')
    .gte('data', dataInicio)
    .lte('data', dataFim)

  const { data: custosData } = await supabase
    .from('custos')
    .select('valor, apartamento_id, tipo_gestao, apartamentos(empreendimento_id, empreendimentos(nome))')
    .eq('mes', mes)
    .eq('ano', ano)

  const faturamentoTotal = diariasData?.reduce((acc, d) => acc + (d.valor || 0), 0) ?? 0
  const custosTotal = custosData?.reduce((acc, c) => acc + (c.valor || 0), 0) ?? 0
  const lucroTotal = faturamentoTotal - custosTotal
  const qtdEmpreendimentos = empreendimentos?.length ?? 0

  const empreendimentoMap: Record<string, { fat: number; custos: number }> = {}

  diariasData?.forEach((d: any) => {
    const nome = d.apartamentos?.empreendimentos?.nome
    if (nome) {
      if (!empreendimentoMap[nome]) empreendimentoMap[nome] = { fat: 0, custos: 0 }
      empreendimentoMap[nome].fat += d.valor || 0
    }
  })

  custosData?.forEach((c: any) => {
    const nome = c.apartamentos?.empreendimentos?.nome
    if (nome) {
      if (!empreendimentoMap[nome]) empreendimentoMap[nome] = { fat: 0, custos: 0 }
      empreendimentoMap[nome].custos += c.valor || 0
    }
  })

  const chartData = Object.entries(empreendimentoMap).map(([nome, vals]) => ({
    empreendimento: nome.length > 10 ? nome.substring(0, 10) : nome,
    faturamento: Math.round(vals.fat),
    lucro: Math.round(vals.fat - vals.custos),
  }))

  const empreendimentoCards = Object.entries(empreendimentoMap).map(([nome, vals]) => ({
    nome,
    fat: vals.fat,
    luc: vals.fat - vals.custos,
  }))

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Visão geral financeira — {anoMesLabel}
          </p>
        </div>
        <Suspense fallback={null}>
          <MonthYearFilter mes={mes} ano={ano} />
        </Suspense>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Faturamento Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {faturamentoTotal > 0
                ? `R$ ${faturamentoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : 'R$ —'}
            </div>
            <p className="text-xs text-gray-400 mt-1">{anoMesLabel}</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Lucro / Prejuízo
            </CardTitle>
            {lucroTotal >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                lucroTotal >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {faturamentoTotal > 0
                ? `${lucroTotal >= 0 ? '+' : ''}R$ ${lucroTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : 'R$ —'}
            </div>
            <p className="text-xs text-gray-400 mt-1">{anoMesLabel}</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Empreendimentos
            </CardTitle>
            <Building2 className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {qtdEmpreendimentos > 0 ? qtdEmpreendimentos : '—'}
            </div>
            <p className="text-xs text-gray-400 mt-1">Cadastrados</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Custos Totais
            </CardTitle>
            <BedDouble className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {custosTotal > 0
                ? `R$ ${custosTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : 'R$ —'}
            </div>
            <p className="text-xs text-gray-400 mt-1">{anoMesLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      {chartData.length > 0 ? (
        <DashboardCharts data={chartData} />
      ) : (
        <Card className="border border-gray-100 shadow-sm mb-6">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Upload className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhum dado disponível</p>
            <p className="text-gray-400 text-sm mt-1">
              Importe as planilhas Excel para visualizar os gráficos
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cards de empreendimentos */}
      {empreendimentoCards.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Resultado por Empreendimento
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {empreendimentoCards.map((emp) => (
              <Card
                key={emp.nome}
                className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-gray-800">
                      {emp.nome}
                    </CardTitle>
                    <Badge
                      className={`text-xs ${
                        emp.luc >= 0
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-red-100 text-red-700 border-red-200'
                      }`}
                      variant="outline"
                    >
                      {emp.luc >= 0 ? '▲ Lucro' : '▼ Prejuízo'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Faturamento</span>
                      <span className="font-medium text-gray-800">
                        R$ {emp.fat.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Lucro</span>
                      <span
                        className={`font-semibold ${
                          emp.luc >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {emp.luc >= 0 ? '+' : ''}R${' '}
                        {emp.luc.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

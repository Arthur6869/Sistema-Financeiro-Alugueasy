import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
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
  const margemPct = faturamentoTotal > 0 ? Math.round((lucroTotal / faturamentoTotal) * 100) : 0
  const custosPct = faturamentoTotal > 0 ? Math.min(100, Math.round((custosTotal / faturamentoTotal) * 100)) : 0

  const fmt = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

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

  const hasData = faturamentoTotal > 0

  return (
    <div className="p-8 max-w-screen-xl">
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

      {/* ── CARTÕES DE MÉTRICAS PRINCIPAIS ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

        {/* Faturamento */}
        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: '#193660' }} />
          <div className="p-6 pl-7">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Faturamento
              </span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#19366018' }}>
                <DollarSign size={17} style={{ color: '#193660' }} />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 leading-none mb-1">
              {hasData ? fmt(faturamentoTotal) : <span className="text-gray-300">R$ —</span>}
            </p>
            <p className="text-xs text-gray-400 mb-5">{anoMesLabel}</p>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Base de referência</span>
                <span>100%</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100">
                <div className="h-1.5 rounded-full" style={{ width: '100%', backgroundColor: '#193660' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Custos */}
        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl bg-red-400" />
          <div className="p-6 pl-7">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Custos Totais
              </span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-50">
                <Receipt size={17} className="text-red-500" />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 leading-none mb-1">
              {hasData ? fmt(custosTotal) : <span className="text-gray-300">R$ —</span>}
            </p>
            <p className="text-xs text-gray-400 mb-5">{anoMesLabel}</p>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>% do faturamento</span>
                <span>{hasData ? `${custosPct}%` : '—'}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-red-400"
                  style={{ width: hasData ? `${custosPct}%` : '0%' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Lucro Líquido */}
        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
          <div
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ backgroundColor: lucroTotal >= 0 ? '#16a34a' : '#dc2626' }}
          />
          <div className="p-6 pl-7">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Lucro Líquido
              </span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${lucroTotal >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                {lucroTotal >= 0
                  ? <TrendingUp size={17} className="text-green-600" />
                  : <TrendingDown size={17} className="text-red-500" />}
              </div>
            </div>
            <p className={`text-3xl font-extrabold leading-none mb-1 ${!hasData ? 'text-gray-300' : lucroTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {hasData ? `${lucroTotal >= 0 ? '+' : ''}${fmt(lucroTotal)}` : 'R$ —'}
            </p>
            <p className="text-xs text-gray-400 mb-5">{anoMesLabel}</p>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Margem sobre faturamento</span>
                <span>{hasData ? `${margemPct}%` : '—'}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: hasData ? `${Math.abs(margemPct)}%` : '0%',
                    backgroundColor: lucroTotal >= 0 ? '#16a34a' : '#dc2626',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card compacto — Empreendimentos */}
      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 w-fit mb-8">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#19366018' }}>
          <Building2 size={16} style={{ color: '#193660' }} />
        </div>
        <div>
          <p className="text-xs text-gray-400 leading-none mb-0.5">Empreendimentos cadastrados</p>
          <p className="text-sm font-bold text-gray-800">
            {qtdEmpreendimentos > 0
              ? `${qtdEmpreendimentos} empreendimento${qtdEmpreendimentos > 1 ? 's' : ''}`
              : '—'}
          </p>
        </div>
      </div>

      {/* Gráfico */}
      {chartData.length > 0 ? (
        <DashboardCharts data={chartData} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
            <Upload className="h-7 w-7 text-gray-300" />
          </div>
          <p className="text-gray-500 font-semibold">Nenhum dado disponível</p>
          <p className="text-gray-400 text-sm mt-1">
            Importe as planilhas Excel para visualizar os gráficos
          </p>
        </div>
      )}

      {/* Cards de empreendimentos */}
      {empreendimentoCards.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            Resultado por Empreendimento
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {empreendimentoCards.map((emp) => (
              <div
                key={emp.nome}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-800 truncate pr-2">{emp.nome}</span>
                  <Badge
                    className={`text-xs shrink-0 ${
                      emp.luc >= 0
                        ? 'bg-green-100 text-green-700 border-green-200'
                        : 'bg-red-100 text-red-700 border-red-200'
                    }`}
                    variant="outline"
                  >
                    {emp.luc >= 0 ? '▲ Lucro' : '▼ Prejuízo'}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Faturamento</span>
                    <span className="font-medium text-gray-800">
                      R$ {emp.fat.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Lucro</span>
                    <span className={`font-semibold ${emp.luc >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {emp.luc >= 0 ? '+' : ''}R$ {emp.luc.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

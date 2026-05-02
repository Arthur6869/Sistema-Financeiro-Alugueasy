'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building2,
  DollarSign,
  Eye,
  EyeOff,
  Receipt,
  TrendingDown,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { DashboardCharts } from '@/components/charts/dashboard-charts'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { LimparDadosButton } from '@/components/shared/limpar-dados-button'
import { Suspense } from 'react'
import { CensoredValue } from '@/components/dashboard/censored-value'

interface EmpreendimentoCard {
  nome: string
  fat: number
  luc: number
}

interface ChartData {
  empreendimento: string
  faturamento: number
  lucro: number
}

interface DashboardContentProps {
  mes: number
  ano: number
  anoMesLabel: string
  usandoDiariasXlsx: boolean
  faturamentoTotal: number
  custosTotal: number
  lucroTotal: number
  custosPct: number
  margemPct: number
  hasData: boolean
  qtdEmpreendimentos: number
  chartData: ChartData[]
  empreendimentoCards: EmpreendimentoCard[]
}

export function DashboardContent({
  mes,
  ano,
  anoMesLabel,
  usandoDiariasXlsx,
  faturamentoTotal,
  custosTotal,
  lucroTotal,
  custosPct,
  margemPct,
  hasData,
  qtdEmpreendimentos,
  chartData,
  empreendimentoCards,
}: DashboardContentProps) {
  const [globalCensorEnabled, setGlobalCensorEnabled] = useState(false)

  const fmt = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const valueCensorClass = (enabled: boolean) => (enabled ? 'text-transparent bg-gray-900/80' : '')

  return (
    <div className="p-8 w-full">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-3">
          <Button
            type="button"
            variant={globalCensorEnabled ? 'default' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => setGlobalCensorEnabled((prev) => !prev)}
          >
            {globalCensorEnabled ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {globalCensorEnabled ? 'Censura ativa' : 'Ativar censura'}
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">
              Visão geral financeira — {anoMesLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}>
            <MonthYearFilter mes={mes} ano={ano} />
          </Suspense>
          <LimparDadosButton mes={mes} ano={ano} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
          <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ backgroundColor: '#193660' }} />
          <div className="p-6 pl-7">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Faturamento
                </span>
                {usandoDiariasXlsx && (
                  <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
                    ✓ conferido
                  </span>
                )}
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#19366018' }}>
                <DollarSign size={17} style={{ color: '#193660' }} />
              </div>
            </div>
            <p className="text-3xl font-extrabold text-gray-900 leading-none mb-1">
              {hasData ? (
                <span className="group">
                  <CensoredValue
                    value={fmt(faturamentoTotal)}
                    censored={globalCensorEnabled}
                    className={valueCensorClass(globalCensorEnabled) + ' group-hover:text-transparent group-hover:bg-gray-900/80'}
                  />
                </span>
              ) : <span className="text-gray-300">R$ —</span>}
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
              {hasData ? (
                <span className="group">
                  <CensoredValue
                    value={fmt(custosTotal)}
                    censored={globalCensorEnabled}
                    className={valueCensorClass(globalCensorEnabled) + ' group-hover:text-transparent group-hover:bg-gray-900/80'}
                  />
                </span>
              ) : <span className="text-gray-300">R$ —</span>}
            </p>
            <p className="text-xs text-gray-400 mb-5">{anoMesLabel}</p>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>% do faturamento</span>
                <span className="group">
                  {hasData ? (
                    <CensoredValue
                      value={`${custosPct}%`}
                      censored={globalCensorEnabled}
                      className={valueCensorClass(globalCensorEnabled) + ' group-hover:text-transparent group-hover:bg-gray-900/80'}
                    />
                  ) : '—'}
                </span>
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
              {hasData ? (
                <span className="group">
                  <CensoredValue
                    value={`${lucroTotal >= 0 ? '+' : ''}${fmt(lucroTotal)}`}
                    censored={globalCensorEnabled}
                    className={valueCensorClass(globalCensorEnabled) + ' group-hover:text-transparent group-hover:bg-gray-900/80'}
                  />
                </span>
              ) : 'R$ —'}
            </p>
            <p className="text-xs text-gray-400 mb-5">{anoMesLabel}</p>
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Margem sobre faturamento</span>
                <span className="group">
                  {hasData ? (
                    <CensoredValue
                      value={`${margemPct}%`}
                      censored={globalCensorEnabled}
                      className={valueCensorClass(globalCensorEnabled) + ' group-hover:text-transparent group-hover:bg-gray-900/80'}
                    />
                  ) : '—'}
                </span>
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

      <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3 w-fit mb-8">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#19366018' }}>
          <Building2 size={16} style={{ color: '#193660' }} />
        </div>
        <div>
          <p className="text-xs text-gray-400 leading-none mb-0.5">Empreendimentos cadastrados</p>
          <p className="text-sm font-bold text-gray-800">
            {qtdEmpreendimentos > 0
              ? (
                <span className="group">
                  <CensoredValue
                    value={`${qtdEmpreendimentos} empreendimento${qtdEmpreendimentos > 1 ? 's' : ''}`}
                    censored={globalCensorEnabled}
                    className={valueCensorClass(globalCensorEnabled) + ' group-hover:text-transparent group-hover:bg-gray-900/80'}
                  />
                </span>
              )
              : '—'}
          </p>
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className={globalCensorEnabled ? 'rounded-xl overflow-hidden blur-[3px] pointer-events-none select-none' : ''}>
          <DashboardCharts data={chartData} />
        </div>
      ) : (
        <Link href="/importar">
          <div className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200 shadow-sm mb-6 hover:border-[#193660] hover:bg-gray-50 transition-all duration-150 cursor-pointer group">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 group-hover:bg-[#19366015] flex items-center justify-center mb-4 transition-colors">
              <Upload className="h-7 w-7 text-gray-300 group-hover:text-[#193660] transition-colors" />
            </div>
            <p className="text-gray-500 group-hover:text-gray-700 font-semibold transition-colors">Nenhum dado disponível</p>
            <p className="text-gray-400 text-sm mt-1">
              Clique aqui para importar planilhas e visualizar os gráficos
            </p>
          </div>
        </Link>
      )}

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
                    <span className="font-medium text-gray-800 group">
                      <CensoredValue
                        value={`R$ ${emp.fat.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
                        censored={globalCensorEnabled}
                        className={valueCensorClass(globalCensorEnabled) + ' group-hover:text-transparent group-hover:bg-gray-900/80'}
                      />
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Lucro</span>
                    <span className={`font-semibold ${emp.luc >= 0 ? 'text-green-600' : 'text-red-600'} group`}>
                      <CensoredValue
                        value={`${emp.luc >= 0 ? '+' : ''}R$ ${emp.luc.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`}
                        censored={globalCensorEnabled}
                        className={valueCensorClass(globalCensorEnabled) + ' group-hover:text-transparent group-hover:bg-gray-900/80'}
                      />
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

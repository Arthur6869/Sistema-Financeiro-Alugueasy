'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/constants'

export type AptRankItem = {
  numero: string
  faturamento: number
  custos: number
  lucro: number
}

export type GestaoTotals = {
  fatAdm: number
  fatSub: number
  custosAdm: number
  custosSub: number
}

const tooltipStyle = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
  fontSize: '12px',
}

const RADIAN = Math.PI / 180
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.06) return null
  const r = innerRadius + (outerRadius - innerRadius) * 0.55
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function EmpreendimentoDetailCharts({
  apts,
  gestao,
  periodo,
}: {
  apts: AptRankItem[]
  gestao: GestaoTotals
  periodo: string
}) {
  const hasGestao = (gestao.fatAdm > 0 || gestao.fatSub > 0) && gestao.fatAdm > 0 && gestao.fatSub > 0

  const fatDonutData = [
    { name: 'ADM', value: gestao.fatAdm },
    { name: 'SUB', value: gestao.fatSub },
  ].filter((d) => d.value > 0)

  const custosDonutData = [
    { name: 'ADM', value: gestao.custosAdm },
    { name: 'SUB', value: gestao.custosSub },
  ].filter((d) => d.value > 0)

  const DONUT_COLORS = ['#3b82f6', '#a855f7']

  // Sort apartments by lucro ascending (worst to best) for ranking chart
  const sorted = [...apts].sort((a, b) => a.lucro - b.lucro)

  return (
    <div className="space-y-4 mb-8">
      {/* Donuts ADM vs SUB — only when both exist */}
      {hasGestao && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-800">Composição Faturamento</CardTitle>
              <p className="text-xs text-gray-400">ADM vs SUB — {periodo}</p>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={fatDonutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                    dataKey="value" labelLine={false} label={renderCustomLabel}>
                    {fatDonutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % 2]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-gray-800">Composição Custos</CardTitle>
              <p className="text-xs text-gray-400">ADM vs SUB — {periodo}</p>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={custosDonutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                    dataKey="value" labelLine={false} label={renderCustomLabel}>
                    {custosDonutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % 2]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ranking horizontal de apartamentos por lucro */}
      {apts.length > 1 && (
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-800">Ranking de Lucratividade — Apartamentos</CardTitle>
            <p className="text-xs text-gray-400">{periodo}</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 38)}>
              <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 60, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="numero" tick={{ fontSize: 11, fill: '#6b7280' }}
                  axisLine={false} tickLine={false} width={36} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
                <ReferenceLine x={0} stroke="#e5e7eb" strokeWidth={1.5} />
                <Bar dataKey="lucro" name="Lucro Líquido" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {sorted.map((entry, i) => (
                    <Cell key={i} fill={entry.lucro >= 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/constants'

export type DiariaChartItem = { data: string; valor: number }
export type CustoChartItem = { categoria: string; valor: number }

const tooltipStyle = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
  fontSize: '12px',
}

const PIE_COLORS = [
  '#193660', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#f97316', '#eab308', '#22c55e', '#14b8a6',
]

const RADIAN = Math.PI / 180
function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function ApartamentoCharts({
  diarias,
  custos,
  periodo,
}: {
  diarias: DiariaChartItem[]
  custos: CustoChartItem[]
  periodo: string
}) {
  // Aggregate custos by category
  const custosMap: Record<string, number> = {}
  custos.forEach((c) => {
    custosMap[c.categoria] = (custosMap[c.categoria] || 0) + c.valor
  })
  const pieData = Object.entries(custosMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const hasArea = diarias.length > 0
  const hasPie = pieData.length > 0

  if (!hasArea && !hasPie) return null

  return (
    <div className={`grid grid-cols-1 ${hasArea && hasPie ? 'lg:grid-cols-2' : ''} gap-4 mb-6`}>
      {/* Evolução de faturamento (diárias) */}
      {hasArea && (
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-800">Evolução do Faturamento</CardTitle>
            <p className="text-xs text-gray-400">{periodo}</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={diarias} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <defs>
                  <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#193660" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#193660" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="valor" name="Faturamento" stroke="#193660" strokeWidth={2}
                  fill="url(#gradFat)" dot={{ r: 3, fill: '#193660', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Distribuição de custos por categoria */}
      {hasPie && (
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-800">Distribuição de Custos</CardTitle>
            <p className="text-xs text-gray-400">{periodo}</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" outerRadius={80}
                  dataKey="value" labelLine={false} label={renderLabel}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '10px', marginTop: '4px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

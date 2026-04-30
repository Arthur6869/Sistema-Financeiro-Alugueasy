'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/constants'

export type EmpChartItem = {
  nome: string
  nomeAbrev: string
  faturamento: number
  custos: number
  lucro: number
}

const tooltipStyle = {
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
  fontSize: '12px',
}

export function EmpreendimentosListCharts({ data, periodo }: { data: EmpChartItem[]; periodo: string }) {
  if (!data.length) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
      {/* Faturamento vs Custos */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-800">Faturamento vs Custos</CardTitle>
          <p className="text-xs text-gray-400">{periodo}</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="nomeAbrev" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: '11px', color: '#6b7280' }} />
              <Bar dataKey="faturamento" name="Faturamento" fill="#193660" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="custos" name="Custos" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lucro Líquido por empreendimento */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-800">Lucro Líquido por Empreendimento</CardTitle>
          <p className="text-xs text-gray-400">{periodo}</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="nomeAbrev" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1.5} />
              <Bar dataKey="lucro" name="Lucro Líquido" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.lucro >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

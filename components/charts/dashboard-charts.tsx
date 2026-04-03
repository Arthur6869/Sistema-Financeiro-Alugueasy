'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatCurrency } from '@/lib/constants'

interface ChartData {
  empreendimento: string
  faturamento: number
  lucro: number
}

interface DashboardChartsProps {
  data: ChartData[]
}


export function DashboardCharts({ data }: DashboardChartsProps) {
  return (
    <Card className="border border-gray-100 shadow-sm mb-6">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-800">
          Faturamento vs Lucro por Empreendimento
        </CardTitle>
        <CardDescription className="text-sm text-gray-400">
          Janeiro 2026
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="empreendimento"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: any) => formatCurrency(Number(value || 0))}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: '12px', color: '#6b7280' }}
            />
            <Bar dataKey="faturamento" name="Faturamento" fill="#193660" radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="lucro"
              name="Lucro"
              fill="#22c55e"
              radius={[4, 4, 0, 0]}
              label={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

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

interface DesempenhoChartProps {
  data: Array<{
    nome: string
    nomeAbrev: string
    faturamento: number
    custos: number
    lucro: number
  }>
  periodo: string
}

function formatBRL(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function DesempenhoChart({ data, periodo }: DesempenhoChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-300 text-sm">
        Sem dados para exibir em {periodo}
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="nomeAbrev"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value, name) => [
            formatBRL(Number(value)),
            name === 'faturamento' ? 'Faturamento' : name === 'custos' ? 'Custos' : 'Lucro',
          ]}
          labelFormatter={(label) => `Empreendimento: ${label}`}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <Legend
          formatter={(value) =>
            value === 'faturamento' ? 'Faturamento' : value === 'custos' ? 'Custos' : 'Lucro'
          }
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="faturamento" fill="#2563eb" radius={[3, 3, 0, 0]} />
        <Bar dataKey="custos" fill="#dc2626" radius={[3, 3, 0, 0]} />
        <Bar dataKey="lucro" fill="#16a34a" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

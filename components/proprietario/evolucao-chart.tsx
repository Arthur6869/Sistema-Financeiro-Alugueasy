'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  label: string
  faturamento: number
  lucro: number
  repasse: number
}

interface Props {
  data: DataPoint[]
}

function formatK(value: number) {
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`
  return `R$ ${value.toFixed(0)}`
}

export function EvolucaoChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatK} tick={{ fontSize: 10 }} width={52} />
        <Tooltip
          formatter={(value) =>
            typeof value === 'number'
              ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : String(value)
          }
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="faturamento"
          name="Faturamento"
          stroke="#193660"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="lucro"
          name="Lucro"
          stroke="#22c55e"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="repasse"
          name="Repasse"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

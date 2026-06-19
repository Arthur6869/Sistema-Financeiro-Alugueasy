'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type HistoricoChartProps = {
  labels: string[]
  valores: (number | null)[]
}

export function HistoricoChart({ labels, valores }: HistoricoChartProps) {
  const data = labels.map((label, i) => ({
    mes: label,
    repasse: valores[i],
  }))

  const temAlgumDado = valores.some(v => v !== null && v > 0)

  if (!temAlgumDado) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 160, color: '#94a3b8', fontSize: 13,
      }}>
        Nenhum repasse registrado ainda nos últimos 12 meses
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f2f5" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `R$${v}`}
          />
          <Tooltip
            formatter={(value) => [
              `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
              'Seu repasse',
            ]}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e7e9ee',
              fontSize: 12,
              fontFamily: 'DM Sans, sans-serif',
            }}
          />
          <Bar dataKey="repasse" fill="#15803d" radius={[6, 6, 0, 0]} maxBarSize={34} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

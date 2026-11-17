'use client'

import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { moeda } from '@/components/dashboard/valor'

export type PontoEvolucao = { label: string; faturamento: number; lucro: number; repasse: number }

/* Cores das séries: as mesmas validadas no restante do sistema */
const COR_FATURAMENTO = '#2a63b8'
const COR_REPASSE = '#15803d'

const eixoK = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} mil` : String(Math.round(v)))

type TooltipProps = {
  active?: boolean
  label?: string | number
  payload?: { dataKey?: string | number; value?: number | string; payload?: PontoEvolucao }[]
}

/** Caixa do hover: mês, faturamento e repasse no mesmo cartão. */
function Caixa({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div className="rounded-xl border border-linha bg-white px-3 py-2.5 text-[13px] shadow-lg">
      <p className="mb-1.5 font-semibold text-tinta">{label}</p>
      <p className="flex items-center justify-between gap-6 text-tinta-suave">
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: COR_FATURAMENTO }} />Faturamento</span>
        <span className="tabular-nums text-tinta">{moeda(p.faturamento)}</span>
      </p>
      <p className="mt-1 flex items-center justify-between gap-6 text-tinta-suave">
        <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: COR_REPASSE }} />Seu repasse</span>
        <span className="tabular-nums font-semibold text-tinta">{moeda(p.repasse)}</span>
      </p>
    </div>
  )
}

/**
 * Seis meses: o faturamento em colunas e, por cima, a linha do que ficou com
 * o proprietário. Um eixo só — as duas séries estão na mesma escala, então a
 * distância entre coluna e ponto é literalmente o que saiu em custos e taxa.
 */
export function EvolucaoRepasse({ dados }: { dados: PontoEvolucao[] }) {
  return (
    <div>
      {/* duas séries → legenda sempre presente */}
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-tinta-suave">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-4 rounded-sm" style={{ background: COR_FATURAMENTO }} />Faturamento</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-4 rounded-sm" style={{ background: COR_REPASSE }} />Seu repasse</li>
      </ul>
      <div className="h-56 w-full" role="img" aria-label={`Faturamento e repasse dos últimos ${dados.length} meses`}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 224 }}>
          <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="#e6e1d6" strokeDasharray="2 4" />
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#5a6a82' }} dy={6} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#5a6a82' }} tickFormatter={eixoK} width={44} />
            <Tooltip content={<Caixa />} cursor={{ fill: 'rgba(15, 26, 46, 0.04)' }} />
            <Bar dataKey="faturamento" name="Faturamento" fill={COR_FATURAMENTO} radius={[4, 4, 0, 0]} maxBarSize={24} />
            <Line
              type="monotone" dataKey="repasse" name="Seu repasse" stroke={COR_REPASSE} strokeWidth={2}
              dot={{ r: 4, fill: '#fff', stroke: COR_REPASSE, strokeWidth: 2 }} activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

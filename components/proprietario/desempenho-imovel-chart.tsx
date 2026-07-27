'use client'

import { useState } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'

/* ────────────────────────────────────────────────────────────────
   Desempenho por imóvel — Histórico do Portal do Proprietário

   Gráfico combinado por imóvel: barras de faturamento × custos
   mês a mês + linha de lucro, com seletor de imóvel e totais
   dos últimos 12 meses.

   Paleta validada (CVD-safe sobre superfície clara):
   azul #1e5aa8 · vermelho #dc2626 · verde #15803d
   ──────────────────────────────────────────────────────────────── */

export type ImovelDesempenho = {
  id: string
  nome: string
  meses: { label: string; faturamento: number; custos: number; lucro: number }[]
}

const COR_FATURAMENTO = '#1e5aa8'
const COR_CUSTOS = '#dc2626'
const COR_LUCRO = '#15803d'

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatK(v: number) {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(0)}k`
  return `R$${v.toFixed(0)}`
}

export function DesempenhoImovelChart({ imoveis }: { imoveis: ImovelDesempenho[] }) {
  const [sel, setSel] = useState(0)
  const imovel = imoveis[sel] ?? imoveis[0]

  if (!imovel) return null

  const totais = imovel.meses.reduce(
    (acc, m) => ({
      faturamento: acc.faturamento + m.faturamento,
      custos: acc.custos + m.custos,
      lucro: acc.lucro + m.lucro,
    }),
    { faturamento: 0, custos: 0, lucro: 0 },
  )

  const semDados = imovel.meses.every(m => m.faturamento === 0 && m.custos === 0)

  return (
    <div>
      <style>{`
        .di-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .di-chip {
          font-family: inherit; font-size: 12px; font-weight: 600;
          color: #5a6a82; background: #fff; border: 1px solid #e7e9ee;
          border-radius: 100px; padding: 7px 14px; cursor: pointer;
          transition: all .15s; white-space: nowrap;
        }
        .di-chip:hover { border-color: #c3cbd8; color: #0f1a2e; }
        .di-chip.ativo {
          background: #193660; border-color: #193660; color: #fff;
        }

        .di-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
        .di-tile {
          background: #f8f9fb; border: 1px solid #f0f1f4;
          border-radius: 12px; padding: 12px 14px 10px;
        }
        .di-tile-label {
          font-size: 10px; font-weight: 700; letter-spacing: .05em;
          text-transform: uppercase; color: #94a3b8;
          display: flex; align-items: center; gap: 6px; margin-bottom: 5px;
        }
        .di-tile-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
        .di-tile-val { font-size: 16px; font-weight: 700; color: #0f1a2e; letter-spacing: -.01em; }

        @media (max-width: 640px) {
          .di-tiles { grid-template-columns: 1fr; gap: 8px; }
          .di-tile { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; }
          .di-tile-label { margin-bottom: 0; }
          .di-tile-val { font-size: 14px; }
        }
      `}</style>

      {/* Seletor de imóvel — só aparece com mais de um vínculo */}
      {imoveis.length > 1 && (
        <div className="di-chips">
          {imoveis.map((im, i) => (
            <button
              key={im.id}
              className={`di-chip ${i === sel ? 'ativo' : ''}`}
              onClick={() => setSel(i)}
            >
              {im.nome}
            </button>
          ))}
        </div>
      )}

      {/* Totais dos últimos 12 meses do imóvel selecionado */}
      <div className="di-tiles">
        <div className="di-tile">
          <div className="di-tile-label">
            <span className="di-tile-dot" style={{ background: COR_FATURAMENTO }} />
            Faturamento 12m
          </div>
          <div className="di-tile-val">{formatBRL(totais.faturamento)}</div>
        </div>
        <div className="di-tile">
          <div className="di-tile-label">
            <span className="di-tile-dot" style={{ background: COR_CUSTOS }} />
            Custos 12m
          </div>
          <div className="di-tile-val">{formatBRL(totais.custos)}</div>
        </div>
        <div className="di-tile">
          <div className="di-tile-label">
            <span className="di-tile-dot" style={{ background: COR_LUCRO }} />
            Lucro 12m
          </div>
          <div className="di-tile-val" style={{ color: totais.lucro >= 0 ? '#14532d' : '#b91c1c' }}>
            {formatBRL(totais.lucro)}
          </div>
        </div>
      </div>

      {semDados ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 180, color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '0 20px',
        }}>
          Este imóvel ainda não registrou faturamento nem custos nos últimos 12 meses
        </div>
      ) : (
        <div style={{ width: '100%', height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={imovel.meses} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f2f5" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatK(Number(v))}
                width={52}
              />
              <Tooltip
                formatter={(value) => formatBRL(Number(value))}
                cursor={{ fill: 'rgba(15,26,46,.04)' }}
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #e7e9ee',
                  fontSize: 12,
                  fontFamily: 'DM Sans, sans-serif',
                }}
              />
              <Legend
                iconSize={10}
                formatter={(value) => (
                  <span style={{ color: '#374151', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>
                    {value}
                  </span>
                )}
              />
              <Bar
                dataKey="faturamento"
                name="Faturamento"
                fill={COR_FATURAMENTO}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
              <Bar
                dataKey="custos"
                name="Custos"
                fill={COR_CUSTOS}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
              <Line
                type="monotone"
                dataKey="lucro"
                name="Lucro"
                stroke={COR_LUCRO}
                strokeWidth={2}
                dot={{ r: 2.5, fill: COR_LUCRO, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

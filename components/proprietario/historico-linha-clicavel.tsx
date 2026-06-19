'use client'

import { useRouter } from 'next/navigation'

function formatBRL(valor: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type Props = {
  mes: number
  ano: number
  label: string
  faturamento: number
  custos: number | null
  lucro: number
  repasse: number
  valorFinal: number
}

export function HistoricoLinhaClicavel({
  mes, ano, label, faturamento, custos, lucro, repasse, valorFinal,
}: Props) {
  const router = useRouter()

  return (
    <tr
      className="has-data"
      onClick={() => router.push(`/proprietario/extrato?mes=${mes}&ano=${ano}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          router.push(`/proprietario/extrato?mes=${mes}&ano=${ano}`)
        }
      }}
    >
      <td className="hist-month">{label}</td>
      <td><span className="status-pill status-ok">Disponível</span></td>
      <td className="num">R$ {formatBRL(faturamento)}</td>
      <td className="num dim">{custos !== null ? `R$ ${formatBRL(custos)}` : '—'}</td>
      <td className="num">R$ {formatBRL(lucro)}</td>
      <td className="num dim">R$ {formatBRL(repasse)}</td>
      <td className="num repasse">R$ {formatBRL(valorFinal)}</td>
    </tr>
  )
}

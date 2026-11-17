'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'
import { MESES } from '@/lib/constants'

interface LimparDadosButtonProps {
  mes: number
  ano: number
}

export function LimparDadosButton({ mes, ano }: LimparDadosButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  if (mes === 0 || ano === 0) return null

  async function handleLimpar() {
    const label = `${MESES[mes - 1]} ${ano}`
    if (!confirm(`Apagar todos os dados de ${label}?\n\nIsso remove todos os custos, diárias e histórico de importações desse período. Não pode ser desfeito.`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/clear?mes=${mes}&ano=${ano}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (res.ok) {
        alert(`✓ Dados removidos com sucesso!\n\n- Diárias: ${data.removed.diarias}\n- Custos: ${data.removed.custos}\n- Histórico: ${data.removed.importacoes}`)
        router.refresh()
      } else {
        alert(`✗ Erro: ${data.error}`)
      }
    } catch (error) {
      alert(`✗ Erro de rede: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleLimpar}
      disabled={loading}
      className="inline-flex h-11 items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 text-sm font-medium text-negativo transition-colors hover:border-red-300 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-negativo disabled:cursor-not-allowed disabled:opacity-50"
      title="Apagar todos os dados do período selecionado"
    >
      {loading
        ? <Loader2 size={14} className="animate-spin" />
        : <Trash2 size={14} />
      }
      Limpar dados
    </button>
  )
}

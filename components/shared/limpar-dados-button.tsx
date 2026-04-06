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
    } catch (error: any) {
      alert(`✗ Erro de rede: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleLimpar}
      disabled={loading}
      className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

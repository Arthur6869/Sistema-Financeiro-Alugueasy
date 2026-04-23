'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface GerarPdfButtonProps {
  apartamentoId: string
  mes: number
  ano: number
  label: string
}

export function GerarPdfButton({ apartamentoId, mes, ano, label }: GerarPdfButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)

    try {
      const response = await fetch(
        `/api/prestacao-contas-pdf?apartamento_id=${encodeURIComponent(apartamentoId)}&mes=${mes}&ano=${ano}`,
        { method: 'GET' }
      )

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error || 'Não foi possível gerar o PDF.'
        alert(message)
        return
      }

      const blob = await response.blob()
      const href = URL.createObjectURL(blob)
      window.open(href, '_blank')
    } catch (error) {
      alert('Erro ao gerar PDF. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      className="inline-flex items-center gap-2 bg-[#193660] text-white hover:bg-[#152b4d]"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {loading ? 'Gerando PDF...' : label}
    </Button>
  )
}

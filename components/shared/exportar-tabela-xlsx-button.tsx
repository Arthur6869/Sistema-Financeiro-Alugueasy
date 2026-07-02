'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  tabela: 'custos' | 'reservas'
  mes: number
  ano: number
}

export function ExportarTabelaXlsxButton({ tabela, mes, ano }: Props) {
  const [loading, setLoading] = useState(false)

  const baixar = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/exportar-xlsx?tabela=${tabela}&mes=${mes}&ano=${ano}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Erro HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      link.download = match?.[1] ?? `${tabela}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
      toast.success('Planilha exportada')
    } catch (e) {
      toast.error(`Erro ao exportar: ${(e as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={baixar}
      disabled={loading}
      title={`Exportar ${tabela} em XLSX`}
      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                 border border-[#193660] text-[#193660] rounded-lg
                 hover:bg-[#193660]/5 active:scale-[0.97]
                 disabled:opacity-60 disabled:cursor-not-allowed
                 transition-all"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      <span>Exportar XLSX</span>
    </button>
  )
}

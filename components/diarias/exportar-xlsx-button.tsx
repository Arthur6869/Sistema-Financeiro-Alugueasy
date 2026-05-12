'use client'
import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface Props {
  mes: number
  ano: number
}

export function ExportarXlsxButton({ mes, ano }: Props) {
  const [loading, setLoading] = useState<'adm' | 'sub' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const baixar = async (t: 'adm' | 'sub') => {
    setLoading(t)
    setErro(null)
    try {
      const url = `/api/exportar-diarias-xlsx?mes=${mes}&ano=${ano}&tipo=${t}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Erro HTTP ${res.status}`)

      const blob = await res.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
      link.download = `conferencia_diarias_${t}_${MESES[mes-1]}_${ano}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
    } catch (e) {
      setErro(`Erro ao gerar planilha: ${(e as Error).message}`)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => baixar('adm')}
        disabled={loading !== null}
        title="Baixar planilha de conferência ADM"
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                   bg-[#193660] text-white rounded-lg
                   hover:bg-[#1e4d8c] active:scale-[0.97]
                   disabled:opacity-60 disabled:cursor-not-allowed
                   transition-all shadow-sm"
      >
        {loading === 'adm' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>ADM</span>
      </button>

      <button
        onClick={() => baixar('sub')}
        disabled={loading !== null}
        title="Baixar planilha de conferência SUB"
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium
                   border border-[#193660] text-[#193660] rounded-lg
                   hover:bg-[#193660]/5 active:scale-[0.97]
                   disabled:opacity-60 disabled:cursor-not-allowed
                   transition-all"
      >
        {loading === 'sub' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        <span>SUB</span>
      </button>

      {erro && (
        <span className="text-xs text-red-500">{erro}</span>
      )}
    </div>
  )
}

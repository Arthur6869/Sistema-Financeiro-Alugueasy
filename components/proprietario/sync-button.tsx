'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/** Busca as reservas do mês na Amenitiz e recarrega a página. */
export function SyncButton({ mes, ano }: { mes: number; ano: number }) {
  const router = useRouter()
  const [carregando, setCarregando] = useState(false)

  async function sincronizar() {
    if (carregando) return
    setCarregando(true)
    try {
      const r = await fetch('/api/proprietario/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, ano }),
      })
      const data = await r.json()
      if (data.success) {
        const n = data.total_reservas ?? 0
        toast.success(n > 0 ? `${n} ${n === 1 ? 'reserva carregada' : 'reservas carregadas'}` : 'Dados atualizados')
        router.refresh()
      } else {
        toast.error(data.error ?? 'Não foi possível atualizar agora.')
      }
    } catch {
      toast.error('Sem conexão com o servidor. Tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <button
      type="button" onClick={sincronizar} disabled={carregando} aria-label="Atualizar reservas com a Amenitiz"
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-full border border-linha bg-white px-4 text-sm font-medium text-tinta transition-colors',
        'hover:bg-creme-escuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700 disabled:opacity-60',
      )}
    >
      <RefreshCw size={16} aria-hidden="true" className={carregando ? 'animate-spin' : ''} />
      {carregando ? 'Atualizando…' : 'Atualizar dados'}
    </button>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, BedDouble, Loader2 } from 'lucide-react'

interface CriarApartamentoModalProps {
  empreendimentoId: string
  empreendimentoNome: string
}

export function CriarApartamentoModal({ empreendimentoId, empreendimentoNome }: CriarApartamentoModalProps) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [numero, setNumero] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!numero.trim()) return
    setLoading(true)
    setError('')

    const { error: err } = await supabase
      .from('apartamentos')
      .insert({ numero: numero.trim(), empreendimento_id: empreendimentoId })

    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }

    setOpen(false)
    setNumero('')
    router.refresh()
  }

  function handleClose() {
    if (loading) return
    setOpen(false)
    setNumero('')
    setError('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 active:scale-95"
        style={{ backgroundColor: '#193660' }}
      >
        <Plus size={15} />
        Criar Apartamento
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#19366015]">
                  <BedDouble size={17} style={{ color: '#193660' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Novo Apartamento</h2>
                  <p className="text-xs text-gray-400">{empreendimentoNome}</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Número / Identificação
                </label>
                <input
                  type="text"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ex: 101, Bloco A - 202"
                  autoFocus
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#193660]/30 focus:border-[#193660]/50 transition"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !numero.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                  style={{ backgroundColor: '#193660' }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

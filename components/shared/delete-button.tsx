'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2, Loader2, AlertTriangle, X } from 'lucide-react'

interface DeleteButtonProps {
  table: 'empreendimentos' | 'apartamentos'
  id: string
  label: string
}

export function DeleteButton({ table, id, label }: DeleteButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from(table).delete().eq('id', id)
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setConfirm(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirm(true) }}
        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
        title={`Excluir ${label}`}
      >
        <Trash2 size={14} />
      </button>

      {confirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!loading) setConfirm(false) }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                  <AlertTriangle size={17} className="text-red-500" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Confirmar exclusão</h2>
              </div>
              <button
                onClick={() => { if (!loading) setConfirm(false) }}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-1">
              Tem certeza que deseja excluir <span className="font-semibold text-gray-800">{label}</span>?
            </p>
            <p className="text-xs text-gray-400 mb-5">
              Esta ação não pode ser desfeita.
            </p>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { if (!loading) { setConfirm(false); setError('') } }}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

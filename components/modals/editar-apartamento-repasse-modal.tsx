'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ApartamentoRepasse {
  id: string
  numero: string
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  nome_proprietario: string | null
  modelo_contrato: 'administracao' | 'sublocacao' | null
}

interface EditarApartamentoRepasseModalProps {
  apartamento: ApartamentoRepasse
  role: string
}

export function EditarApartamentoRepasseModal({ apartamento, role }: EditarApartamentoRepasseModalProps) {
  const router = useRouter()
  const supabase = createClient()

  const [open, setOpen] = useState(false)
  const [taxaRepasse, setTaxaRepasse] = useState(apartamento.taxa_repasse ?? 0)
  const [tipoRepasse, setTipoRepasse] = useState<'lucro' | 'faturamento'>(apartamento.tipo_repasse ?? 'lucro')
  const [nomeProprietario, setNomeProprietario] = useState(apartamento.nome_proprietario ?? '')
  const [modeloContrato, setModeloContrato] = useState<'administracao' | 'sublocacao'>(apartamento.modelo_contrato ?? 'administracao')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setTaxaRepasse(apartamento.taxa_repasse ?? 0)
    setTipoRepasse(apartamento.tipo_repasse ?? 'lucro')
    setNomeProprietario(apartamento.nome_proprietario ?? '')
    setModeloContrato(apartamento.modelo_contrato ?? 'administracao')
    setError('')
  }, [open, apartamento])

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase
      .from('apartamentos')
      .update({
        taxa_repasse: taxaRepasse,
        tipo_repasse: tipoRepasse,
        nome_proprietario: nomeProprietario.trim() || null,
        modelo_contrato: modeloContrato,
      })
      .eq('id', apartamento.id)

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setOpen(false)
    router.refresh()
  }

  if (role !== 'admin') {
    return (
      <div className="text-xs text-gray-500">
        {apartamento.taxa_repasse != null
          ? `${apartamento.taxa_repasse}% s/ ${apartamento.tipo_repasse === 'faturamento' ? 'faturamento' : 'lucro'}`
          : '0% s/ lucro'}
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">
          {apartamento.taxa_repasse != null
            ? `${apartamento.taxa_repasse}% s/ ${apartamento.tipo_repasse === 'faturamento' ? 'faturamento' : 'lucro'}`
            : '0% s/ lucro'}
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center rounded-md border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50 transition"
          aria-label={`Editar repasse do apartamento ${apartamento.numero}`}
        >
          <Pencil size={16} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Configuração de Repasse</h2>
                <p className="text-sm text-gray-500">Apartamento {apartamento.numero}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 px-6 py-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Taxa de repasse</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={taxaRepasse}
                  onChange={(event) => setTaxaRepasse(Number(event.target.value))}
                  placeholder="Ex: 15 para 15%"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#193660]/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Base do repasse</label>
                <select
                  value={tipoRepasse}
                  onChange={(event) => setTipoRepasse(event.target.value as 'lucro' | 'faturamento')}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#193660]/30"
                >
                  <option value="lucro">Sobre o Lucro Líquido</option>
                  <option value="faturamento">Sobre o Faturamento Bruto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome do proprietário</label>
                <input
                  type="text"
                  value={nomeProprietario}
                  onChange={(event) => setNomeProprietario(event.target.value)}
                  placeholder="Nome completo do proprietário"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#193660]/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Modelo de contrato</label>
                <select
                  value={modeloContrato}
                  onChange={(event) => setModeloContrato(event.target.value as 'administracao' | 'sublocacao')}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#193660]/30"
                >
                  <option value="administracao">Administração</option>
                  <option value="sublocacao">Sublocação</option>
                </select>
              </div>

              <p className="text-sm text-gray-500">
                Para Sublocação, a taxa de repasse é calculada separadamente pela equipe.
              </p>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2">{error}</p>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-[#193660] hover:bg-[#152b4d] text-white" disabled={loading}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />}
                  <span>{loading ? 'Salvando...' : 'Salvar'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Loader2 } from 'lucide-react'

interface Apartamento {
  id: string
  numero: string
  empreendimento_id: string
  tipo_gestao: 'adm' | 'sub' | null
  empreendimento_nome: string
}

interface Props {
  apartamentos: Apartamento[]
  defaultMes: number
  defaultAno: number
  onInserted: (diaria: {
    id: string
    data: string
    valor: number
    tipo_gestao: string
    apartamentos: { numero: string; empreendimentos: { nome: string } | null } | null
  }) => void
}

export function DiariasNovaForm({ apartamentos, defaultMes, defaultAno, onInserted }: Props) {
  const [open, setOpen] = useState(false)
  const [empreendimentoId, setEmpreendimentoId] = useState('')
  const [apartamentoId, setApartamentoId] = useState('')
  const [tipoGestao, setTipoGestao] = useState<'adm' | 'sub'>('adm')
  const [data, setData] = useState(() => {
    const m = String(defaultMes).padStart(2, '0')
    return `${defaultAno}-${m}-01`
  })
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  const empreendimentos = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of apartamentos) map.set(a.empreendimento_id, a.empreendimento_nome)
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }))
  }, [apartamentos])

  const aptsFiltrados = useMemo(() => {
    return apartamentos.filter(
      (a) =>
        a.empreendimento_id === empreendimentoId &&
        a.tipo_gestao === tipoGestao
    )
  }, [apartamentos, empreendimentoId, tipoGestao])

  function reset() {
    setEmpreendimentoId('')
    setApartamentoId('')
    setTipoGestao('adm')
    setValor('')
    setErro(null)
    setSucesso(false)
    const m = String(defaultMes).padStart(2, '0')
    setData(`${defaultAno}-${m}-01`)
  }

  async function handleSave(keepOpen: boolean) {
    setErro(null)
    setSucesso(false)
    const parsedValor = parseFloat(valor.replace(',', '.'))
    if (!apartamentoId) { setErro('Selecione um apartamento'); return }
    if (!data) { setErro('Informe a data'); return }
    if (isNaN(parsedValor) || parsedValor < 0) { setErro('Valor inválido'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/diarias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apartamento_id: apartamentoId, data, tipo_gestao: tipoGestao, valor: parsedValor }),
      })
      const body = await res.json()
      if (!res.ok) { setErro(body.error ?? 'Erro ao inserir diária'); return }
      onInserted(body.diaria)
      setSucesso(true)
      if (keepOpen) {
        setApartamentoId('')
        setValor('')
        setErro(null)
        setTimeout(() => setSucesso(false), 2000)
      } else {
        reset()
        setOpen(false)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[#193660] border-[#193660]/30 hover:bg-[#193660]/5"
      >
        <Plus size={14} />
        Nova diária
      </Button>
    )
  }

  return (
    <div className="border border-blue-100 bg-blue-50/30 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">Inserir nova diária</span>
        <button
          onClick={() => { reset(); setOpen(false) }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Fechar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Empreendimento */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Empreendimento</label>
          <select
            value={empreendimentoId}
            onChange={(e) => { setEmpreendimentoId(e.target.value); setApartamentoId('') }}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#193660]/30"
          >
            <option value="">Selecione...</option>
            {empreendimentos.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>
        </div>

        {/* Tipo gestão */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Gestão</label>
          <div className="flex gap-1">
            {(['adm', 'sub'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTipoGestao(t); setApartamentoId('') }}
                className={`flex-1 py-1.5 text-xs rounded-md border transition-colors ${
                  tipoGestao === t
                    ? 'bg-[#193660] text-white border-[#193660]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Apartamento */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Apartamento</label>
          <select
            value={apartamentoId}
            onChange={(e) => setApartamentoId(e.target.value)}
            disabled={!empreendimentoId}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#193660]/30 disabled:opacity-50"
          >
            <option value="">Selecione...</option>
            {aptsFiltrados.map((a) => (
              <option key={a.id} value={a.id}>{a.numero}</option>
            ))}
          </select>
        </div>

        {/* Data */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Data</label>
          <Input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="text-sm h-[34px]"
          />
        </div>

        {/* Valor */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Valor (R$)</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(false) }}
            className="text-sm h-[34px]"
          />
        </div>
      </div>

      {erro && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded border border-red-100">{erro}</p>
      )}
      {sucesso && (
        <p className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded border border-green-100">Diária inserida com sucesso!</p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={() => handleSave(false)} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
          Salvar diária
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleSave(true)} disabled={saving}>
          Salvar e inserir outra
        </Button>
      </div>
    </div>
  )
}

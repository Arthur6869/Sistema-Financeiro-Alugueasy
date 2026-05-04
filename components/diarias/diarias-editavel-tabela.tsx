'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Pencil, Check, X, Trash2, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/constants'

export interface DiariaRow {
  id: string
  data: string
  valor: number
  tipo_gestao: string
  apartamentos: {
    numero: string
    empreendimentos: { nome: string } | null
  } | null
}

interface Props {
  diarias: DiariaRow[]
  role: string
}

type DeleteState = 'idle' | 'confirming' | 'deleting'

export function DiariasEditavelTabela({ diarias: initial, role }: Props) {
  const canWrite = role === 'analista'

  const [rows, setRows] = useState<DiariaRow[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deleteStateMap, setDeleteStateMap] = useState<Record<string, DeleteState>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [editadosCount, setEditadosCount] = useState(0)

  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'adm' | 'sub'>('todos')

  const filtrados = useMemo(() => {
    return rows.filter(r => {
      const matchBusca = busca === '' ||
        (r.apartamentos?.numero ?? '').toLowerCase().includes(busca.toLowerCase()) ||
        (r.apartamentos?.empreendimentos?.nome ?? '').toLowerCase().includes(busca.toLowerCase())
      const matchTipo =
        filtroTipo === 'todos' ? true : r.tipo_gestao === filtroTipo
      return matchBusca && matchTipo
    })
  }, [rows, busca, filtroTipo])

  const totalValor = useMemo(() => filtrados.reduce((a, r) => a + r.valor, 0), [filtrados])

  function beginEdit(row: DiariaRow) {
    setEditingId(row.id)
    setEditValor(String(row.valor))
    setErro(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValor('')
    setErro(null)
  }

  async function saveEdit(id: string) {
    const valor = parseFloat(editValor.replace(',', '.'))
    if (isNaN(valor) || valor < 0) {
      setErro('Valor inválido')
      return
    }
    setSavingId(id)
    setErro(null)
    try {
      const res = await fetch(`/api/diarias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor }),
      })
      const body = await res.json()
      if (!res.ok) { setErro(body.error ?? 'Erro ao salvar'); return }
      setRows(prev => prev.map(r => r.id === id ? { ...r, valor } : r))
      setEditadosCount(c => c + 1)
      setEditingId(null)
    } finally {
      setSavingId(null)
    }
  }

  function beginDelete(id: string) {
    setDeleteStateMap(prev => ({ ...prev, [id]: 'confirming' }))
  }

  function cancelDelete(id: string) {
    setDeleteStateMap(prev => ({ ...prev, [id]: 'idle' }))
  }

  async function confirmDelete(id: string) {
    setDeleteStateMap(prev => ({ ...prev, [id]: 'deleting' }))
    const res = await fetch(`/api/diarias/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRows(prev => prev.filter(r => r.id !== id))
    } else {
      const body = await res.json()
      setErro(body.error ?? 'Erro ao excluir')
      setDeleteStateMap(prev => ({ ...prev, [id]: 'idle' }))
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-gray-500">
          <strong className="text-gray-800">{filtrados.length}</strong> registro(s)
        </span>
        <span className="text-gray-500">
          Total: <strong className="text-gray-800">{formatCurrency(totalValor)}</strong>
        </span>
        {editadosCount > 0 && (
          <span className="text-green-600 font-medium">
            ✓ {editadosCount} editado(s) nesta sessão
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar imóvel..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="max-w-xs text-sm"
        />
        <div className="flex gap-1">
          {(['todos', 'adm', 'sub'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroTipo(f)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                filtroTipo === f
                  ? 'bg-[#193660] text-white border-[#193660]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f === 'todos' ? 'Todos' : f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <div className="text-sm text-red-600 px-3 py-2 bg-red-50 rounded-lg border border-red-100">
          {erro}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="border-gray-100">
            <TableHead className="text-gray-500 font-medium">Data</TableHead>
            <TableHead className="text-gray-500 font-medium">Imóvel</TableHead>
            <TableHead className="text-gray-500 font-medium">Gestão</TableHead>
            <TableHead className="text-gray-500 font-medium text-right">Valor</TableHead>
            {canWrite && <TableHead className="text-gray-500 font-medium text-right w-24">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canWrite ? 5 : 4} className="text-center text-gray-400 py-12">
                Nenhuma diária encontrada
              </TableCell>
            </TableRow>
          ) : filtrados.map((row, idx) => {
            const isEditing = editingId === row.id
            const isSaving = savingId === row.id
            const deleteState = deleteStateMap[row.id] ?? 'idle'
            const zebraClass = idx % 2 === 1 ? 'bg-gray-50/60' : ''

            if (deleteState === 'confirming' || deleteState === 'deleting') {
              return (
                <TableRow key={row.id} className="border-l-4 border-red-500 bg-red-50/30 border-red-100">
                  <TableCell colSpan={3} className="text-sm text-red-700 font-medium py-3">
                    Confirmar exclusão desta diária?{' '}
                    <span className="font-normal text-red-600">
                      {new Date(row.data + 'T00:00:00').toLocaleDateString('pt-BR')} —{' '}
                      {row.apartamentos?.empreendimentos?.nome} apt {row.apartamentos?.numero}{' '}
                      ({formatCurrency(row.valor)})
                    </span>
                  </TableCell>
                  <TableCell className="text-right" colSpan={2}>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => cancelDelete(row.id)}
                        disabled={deleteState === 'deleting'}
                      >
                        Não
                      </Button>
                      <Button
                        variant="destructive" size="sm"
                        onClick={() => confirmDelete(row.id)}
                        disabled={deleteState === 'deleting'}
                      >
                        {deleteState === 'deleting'
                          ? <Loader2 size={14} className="animate-spin" />
                          : 'Sim, excluir'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            }

            return (
              <TableRow
                key={row.id}
                className={`border-gray-100 hover:bg-gray-50 transition-colors ${
                  isEditing ? 'border-l-4 border-blue-500 bg-blue-50/30' : zebraClass
                }`}
              >
                <TableCell className="text-gray-600 font-medium text-sm">
                  {new Date(row.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900 text-sm">
                      {row.apartamentos?.empreendimentos?.nome ?? '—'}
                    </span>
                    <span className="text-xs text-gray-400">apt {row.apartamentos?.numero ?? '—'}</span>
                  </div>
                </TableCell>

                <TableCell>
                  <Badge variant="outline" className={
                    row.tipo_gestao === 'adm'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 text-xs'
                      : 'bg-purple-50 text-purple-700 border-purple-200 text-xs'
                  }>
                    {row.tipo_gestao.toUpperCase()}
                  </Badge>
                </TableCell>

                <TableCell className="text-right font-bold text-gray-900 min-w-[100px]">
                  {isEditing ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editValor}
                      onChange={e => setEditValor(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(row.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="text-sm h-8 text-right w-28 ml-auto"
                      autoFocus
                    />
                  ) : (
                    formatCurrency(row.valor)
                  )}
                </TableCell>

                {canWrite && (
                  <TableCell className="text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => saveEdit(row.id)}
                          disabled={isSaving}
                          className="p-1.5 rounded text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors"
                          title="Salvar"
                        >
                          {isSaving
                            ? <Loader2 size={15} className="animate-spin" />
                            : <Check size={15} />}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={isSaving}
                          className="p-1.5 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                          title="Cancelar"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => beginEdit(row)}
                          className="p-1.5 rounded text-gray-400 hover:text-[#193660] hover:bg-[#19366010] transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => beginDelete(row.id)}
                          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

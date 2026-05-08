'use client'

import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Pencil, Check, X, Trash2, Loader2, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
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

const ITENS_POR_PAGINA = 25

interface LinhaProps {
  row: DiariaRow
  idx: number
  isEditing: boolean
  isSaving: boolean
  editValor: string
  deleteState: DeleteState
  canWrite: boolean
  onBeginEdit: (row: DiariaRow) => void
  onCancelEdit: () => void
  onSaveEdit: (id: string) => void
  onEditValorChange: (v: string) => void
  onBeginDelete: (id: string) => void
  onCancelDelete: (id: string) => void
  onConfirmDelete: (id: string) => void
}

const DiariasLinha = React.memo(function DiariasLinha({
  row, idx, isEditing, isSaving, editValor, deleteState, canWrite,
  onBeginEdit, onCancelEdit, onSaveEdit, onEditValorChange,
  onBeginDelete, onCancelDelete, onConfirmDelete,
}: LinhaProps) {
  const zebraClass = idx % 2 === 1 ? 'bg-gray-50/60' : ''

  if (deleteState === 'confirming' || deleteState === 'deleting') {
    return (
      <TableRow className="border-l-4 border-red-500 bg-red-50/30 border-red-100">
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
            <Button variant="outline" size="sm" onClick={() => onCancelDelete(row.id)} disabled={deleteState === 'deleting'}>
              Não
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onConfirmDelete(row.id)} disabled={deleteState === 'deleting'}>
              {deleteState === 'deleting' ? <Loader2 size={14} className="animate-spin" /> : 'Sim, excluir'}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow
      className={`border-gray-100 hover:bg-gray-50 transition-colors ${
        isEditing ? 'border-l-4 border-blue-500 bg-blue-50/30' : zebraClass
      }`}
    >
      <TableCell className="text-gray-600 font-medium text-sm">
        {new Date(row.data + 'T00:00:00').toLocaleDateString('pt-BR')}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 text-sm">{row.apartamentos?.empreendimentos?.nome ?? '—'}</span>
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
            type="number" min="0" step="0.01"
            value={editValor}
            onChange={e => onEditValorChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSaveEdit(row.id)
              if (e.key === 'Escape') onCancelEdit()
            }}
            className="text-sm h-8 text-right w-28 ml-auto"
            autoFocus
          />
        ) : formatCurrency(row.valor)}
      </TableCell>
      {canWrite && (
        <TableCell className="text-right">
          {isEditing ? (
            <div className="flex justify-end gap-1">
              <button
                onClick={() => onSaveEdit(row.id)}
                disabled={isSaving}
                className="p-1.5 rounded text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors"
                title="Salvar"
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              </button>
              <button
                onClick={onCancelEdit}
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
                onClick={() => onBeginEdit(row)}
                className="p-1.5 rounded text-gray-400 hover:text-[#193660] hover:bg-[#19366010] transition-colors"
                title="Editar"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onBeginDelete(row.id)}
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
})

export function DiariasEditavelTabela({ diarias: initial, role }: Props) {
  const canWrite = role === 'analista'
  const router = useRouter()

  const [rows, setRows] = useState<DiariaRow[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValor, setEditValor] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deleteStateMap, setDeleteStateMap] = useState<Record<string, DeleteState>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [editadosCount, setEditadosCount] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [refreshing, setRefreshing] = useState(false)

  const [inputValue, setInputValue] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setSearchTerm(inputValue)
        setPagina(1)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  const filtrados = useMemo(() => {
    if (!searchTerm) return rows
    const q = searchTerm.toLowerCase()
    return rows.filter(r =>
      (r.apartamentos?.empreendimentos?.nome ?? '').toLowerCase().includes(q) ||
      (r.apartamentos?.numero ?? '').toLowerCase().includes(q)
    )
  }, [rows, searchTerm])

  const totalValor = useMemo(() => filtrados.reduce((a, r) => a + r.valor, 0), [filtrados])
  const totalPaginas = Math.ceil(filtrados.length / ITENS_POR_PAGINA)
  const paginados = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA
    return filtrados.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [filtrados, pagina])

  function handleRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 1000)
  }

  const beginEdit = useCallback((row: DiariaRow) => {
    setEditingId(row.id)
    setEditValor(String(row.valor))
    setErro(null)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditValor('')
    setErro(null)
  }, [])

  const saveEdit = useCallback(async (id: string) => {
    const valor = parseFloat(editValor.replace(',', '.'))
    if (isNaN(valor) || valor < 0) { setErro('Valor inválido'); return }
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
  }, [editValor])

  const beginDelete = useCallback((id: string) => {
    setDeleteStateMap(prev => ({ ...prev, [id]: 'confirming' }))
  }, [])

  const cancelDelete = useCallback((id: string) => {
    setDeleteStateMap(prev => ({ ...prev, [id]: 'idle' }))
  }, [])

  const confirmDelete = useCallback(async (id: string) => {
    setDeleteStateMap(prev => ({ ...prev, [id]: 'deleting' }))
    const res = await fetch(`/api/diarias/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRows(prev => prev.filter(r => r.id !== id))
    } else {
      const body = await res.json()
      setErro(body.error ?? 'Erro ao excluir')
      setDeleteStateMap(prev => ({ ...prev, [id]: 'idle' }))
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="text-gray-500">
          <strong className="text-gray-800">{filtrados.length}</strong> registro(s) — Total: <strong className="text-gray-800">{formatCurrency(totalValor)}</strong>
        </span>
        {editadosCount > 0 && (
          <span className="text-green-600 font-medium">✓ {editadosCount} editado(s) nesta sessão</span>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative">
          <Input
            placeholder="Buscar empreendimento ou apt..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            className="max-w-xs text-sm"
          />
          {isPending && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">buscando...</span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          title="Atualizar dados"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {erro && (
        <div className="text-sm text-red-600 px-3 py-2 bg-red-50 rounded-lg border border-red-100">{erro}</div>
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
          {paginados.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canWrite ? 5 : 4} className="text-center text-gray-400 py-12">
                Nenhuma diária encontrada
              </TableCell>
            </TableRow>
          ) : paginados.map((row, idx) => (
            <DiariasLinha
              key={row.id}
              row={row}
              idx={idx}
              isEditing={editingId === row.id}
              isSaving={savingId === row.id}
              editValor={editValor}
              deleteState={deleteStateMap[row.id] ?? 'idle'}
              canWrite={canWrite}
              onBeginEdit={beginEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={saveEdit}
              onEditValorChange={setEditValor}
              onBeginDelete={beginDelete}
              onCancelDelete={cancelDelete}
              onConfirmDelete={confirmDelete}
            />
          ))}
        </TableBody>
      </Table>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {((pagina - 1) * ITENS_POR_PAGINA) + 1}–{Math.min(pagina * ITENS_POR_PAGINA, filtrados.length)} de {filtrados.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded border disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={13} /> Anterior
            </button>
            <span className="text-xs text-gray-500 px-1">{pagina}/{totalPaginas}</span>
            <button
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded border disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Próxima <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

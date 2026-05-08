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

export interface CustoRow {
  id: string
  categoria: string
  valor: number
  tipo_gestao: 'adm' | 'sub'
  origem: 'manual' | 'importacao'
  observacao?: string | null
  mes: number
  ano: number
  apartamentos: {
    numero: string
    empreendimentos: { nome: string } | null
  } | null
}

interface Props {
  custos: CustoRow[]
  role: string
  categoriasSugeridas: string[]
}

type EditState = { categoria: string; valor: string }
type DeleteState = 'idle' | 'confirming' | 'deleting'

const ITENS_POR_PAGINA = 25

export function CustosEditavelTabela({ custos: initial, role, categoriasSugeridas }: Props) {
  const canWrite = role === 'analista'
  const router = useRouter()

  const [rows, setRows] = useState<CustoRow[]>(initial)
  const [refreshing, setRefreshing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ categoria: '', valor: '' })
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deleteStateMap, setDeleteStateMap] = useState<Record<string, DeleteState>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [editadosCount, setEditadosCount] = useState(0)

  // Debounce: inputValue atualiza imediatamente, searchTerm aplica após 300ms
  const [inputValue, setInputValue] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'adm' | 'sub' | 'importacao' | 'manual'>('todos')
  const [isPending, startTransition] = useTransition()
  const [pagina, setPagina] = useState(1)

  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setSearchTerm(inputValue)
        setPagina(1)
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [inputValue])

  // Reset página quando filtro de tipo muda
  useEffect(() => { setPagina(1) }, [filtroTipo])

  const filtrados = useMemo(() => {
    return rows.filter(r => {
      const matchBusca = searchTerm === '' ||
        r.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.apartamentos?.empreendimentos?.nome ?? '').toLowerCase().includes(searchTerm.toLowerCase())
      const matchTipo =
        filtroTipo === 'todos' ? true :
        filtroTipo === 'adm' ? r.tipo_gestao === 'adm' :
        filtroTipo === 'sub' ? r.tipo_gestao === 'sub' :
        filtroTipo === 'importacao' ? r.origem === 'importacao' :
        r.origem === 'manual'
      return matchBusca && matchTipo
    })
  }, [rows, searchTerm, filtroTipo])

  const totalValor = useMemo(() => filtrados.reduce((a, r) => a + r.valor, 0), [filtrados])
  const totalPaginas = Math.ceil(filtrados.length / ITENS_POR_PAGINA)
  const paginados = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA
    return filtrados.slice(inicio, inicio + ITENS_POR_PAGINA)
  }, [filtrados, pagina])

  const beginEdit = useCallback((row: CustoRow) => {
    setEditingId(row.id)
    setEditState({ categoria: row.categoria, valor: String(row.valor) })
    setErro(null)
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditState({ categoria: '', valor: '' })
    setErro(null)
  }, [])

  const saveEdit = useCallback(async (id: string, state: EditState) => {
    const valor = parseFloat(state.valor.replace(',', '.'))
    if (!state.categoria.trim() || isNaN(valor) || valor <= 0) {
      setErro('Categoria e valor válido são obrigatórios')
      return
    }
    setSavingId(id)
    setErro(null)
    try {
      const res = await fetch(`/api/custos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: state.categoria.trim(), valor }),
      })
      const body = await res.json()
      if (!res.ok) { setErro(body.error ?? 'Erro ao salvar'); return }
      setRows(prev => prev.map(r => r.id === id ? { ...r, categoria: state.categoria.trim(), valor } : r))
      setEditadosCount(c => c + 1)
      setEditingId(null)
    } finally {
      setSavingId(null)
    }
  }, [])

  const beginDelete = useCallback((id: string) => {
    setDeleteStateMap(prev => ({ ...prev, [id]: 'confirming' }))
  }, [])

  const cancelDelete = useCallback((id: string) => {
    setDeleteStateMap(prev => ({ ...prev, [id]: 'idle' }))
  }, [])

  const confirmDelete = useCallback(async (id: string) => {
    setDeleteStateMap(prev => ({ ...prev, [id]: 'deleting' }))
    const res = await fetch(`/api/custos/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRows(prev => prev.filter(r => r.id !== id))
    } else {
      const body = await res.json()
      setErro(body.error ?? 'Erro ao excluir')
      setDeleteStateMap(prev => ({ ...prev, [id]: 'idle' }))
    }
  }, [])

  function handleRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 1000)
  }

  const datalistId = 'categorias-sugeridas'

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
          <span className="text-green-600 font-medium">✓ {editadosCount} editado(s) nesta sessão</span>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Input
            placeholder="Buscar categoria ou empreendimento..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            className="max-w-xs text-sm"
          />
          {isPending && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">buscando...</span>
          )}
        </div>
        <div className="flex gap-1">
          {(['todos', 'adm', 'sub', 'importacao', 'manual'] as const).map(f => (
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

      <datalist id={datalistId}>
        {categoriasSugeridas.map(c => <option key={c} value={c} />)}
      </datalist>

      <Table>
        <TableHeader>
          <TableRow className="border-gray-100">
            <TableHead className="text-gray-500 font-medium">Imóvel</TableHead>
            <TableHead className="text-gray-500 font-medium">Categoria</TableHead>
            <TableHead className="text-gray-500 font-medium">Gestão</TableHead>
            <TableHead className="text-gray-500 font-medium">Origem</TableHead>
            <TableHead className="text-gray-500 font-medium text-right">Valor</TableHead>
            {canWrite && <TableHead className="text-gray-500 font-medium text-right w-24">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginados.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canWrite ? 6 : 5} className="text-center text-gray-400 py-12">
                Nenhum custo encontrado
              </TableCell>
            </TableRow>
          ) : paginados.map(row => {
            const isEditing = editingId === row.id
            const isSaving = savingId === row.id
            const deleteState = deleteStateMap[row.id] ?? 'idle'

            if (deleteState === 'confirming' || deleteState === 'deleting') {
              return (
                <TableRow key={row.id} className="bg-red-50 border-red-100">
                  <TableCell colSpan={canWrite ? 4 : 3} className="text-sm text-red-700 font-medium py-3">
                    Excluir {row.apartamentos?.empreendimentos?.nome} apt {row.apartamentos?.numero} — {row.categoria} ({formatCurrency(row.valor)})?
                  </TableCell>
                  <TableCell className="text-right" colSpan={2}>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => cancelDelete(row.id)} disabled={deleteState === 'deleting'}>
                        Não
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => confirmDelete(row.id)} disabled={deleteState === 'deleting'}>
                        {deleteState === 'deleting' ? <Loader2 size={14} className="animate-spin" /> : 'Sim, excluir'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            }

            return (
              <TableRow key={row.id} className="border-gray-100 hover:bg-gray-50">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900 text-sm">{row.apartamentos?.empreendimentos?.nome ?? '—'}</span>
                    <span className="text-xs text-gray-400">apt {row.apartamentos?.numero ?? '—'}</span>
                  </div>
                </TableCell>
                <TableCell className="min-w-[160px]">
                  {isEditing ? (
                    <Input
                      value={editState.categoria}
                      onChange={e => setEditState(s => ({ ...s, categoria: e.target.value }))}
                      list={datalistId}
                      className="text-sm h-8"
                      autoFocus
                    />
                  ) : (
                    <span className="text-gray-700 text-sm">{row.categoria}</span>
                  )}
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
                <TableCell>
                  <Badge variant="outline" className={
                    row.origem === 'manual'
                      ? 'bg-sky-50 text-sky-700 border-sky-200 text-xs'
                      : 'bg-gray-100 text-gray-500 border-gray-200 text-xs'
                  }>
                    {row.origem === 'manual' ? 'Manual' : 'Importado'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-bold text-gray-900 min-w-[100px]">
                  {isEditing ? (
                    <Input
                      type="number" min="0.01" step="0.01"
                      value={editState.valor}
                      onChange={e => setEditState(s => ({ ...s, valor: e.target.value }))}
                      className="text-sm h-8 text-right w-28 ml-auto"
                    />
                  ) : formatCurrency(row.valor)}
                </TableCell>
                {canWrite && (
                  <TableCell className="text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => saveEdit(row.id, editState)}
                          disabled={isSaving}
                          className="p-1.5 rounded text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors"
                          title="Salvar"
                        >
                          {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
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

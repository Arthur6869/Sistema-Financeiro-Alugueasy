'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Pencil, Check, X, Trash2, Loader2, CalendarDays } from 'lucide-react'
import { formatCurrency, MESES } from '@/lib/constants'

export interface ReservaRow {
  id: string
  booking_id: string
  checkin: string
  checkout: string
  valor_bruto: number
  valor_liquido: number
  plataforma_normalizada: string
  individual_room_number: string
  nome_hospede: string
  mes_competencia: number
  ano_competencia: number
}

interface EditState {
  nome_hospede: string
  individual_room_number: string
  plataforma_normalizada: string
  checkin: string
  checkout: string
  valor_bruto: string
  valor_liquido: string
}

type DeleteState = 'idle' | 'confirming' | 'deleting'

interface Props {
  reservas: ReservaRow[]
  role: string
  mes: number
  ano: number
}

const PLATAFORMAS = ['Booking.com', 'Airbnb', 'AlugEasy', 'Manual', 'Outros']

function badgePlatforma(plat: string) {
  const p = (plat ?? '').toLowerCase()
  if (p.includes('booking')) return 'bg-blue-50 text-blue-700 border-blue-200'
  if (p.includes('airbnb')) return 'bg-rose-50 text-rose-700 border-rose-200'
  if (p.includes('alugueasy') || p.includes('alug')) return 'bg-green-50 text-green-700 border-green-200'
  return 'bg-gray-100 text-gray-500 border-gray-200'
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

export function ReservasEditavelTabela({ reservas: initial, role, mes, ano }: Props) {
  const canWrite = role === 'analista'

  const [rows, setRows] = useState<ReservaRow[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deleteStateMap, setDeleteStateMap] = useState<Record<string, DeleteState>>({})
  const [erro, setErro] = useState<string | null>(null)
  const [editadosCount, setEditadosCount] = useState(0)

  const [busca, setBusca] = useState('')
  const [filtroPlatforma, setFiltroPlatforma] = useState<string>('Todas')
  const [ordenar, setOrdenar] = useState<'data' | 'valor' | 'quarto'>('data')

  const filtrados = useMemo(() => {
    let r = rows.filter(row => {
      const matchBusca = busca === '' ||
        (row.nome_hospede ?? '').toLowerCase().includes(busca.toLowerCase()) ||
        (row.individual_room_number ?? '').toLowerCase().includes(busca.toLowerCase()) ||
        (row.booking_id ?? '').toLowerCase().includes(busca.toLowerCase())
      const matchPlat = filtroPlatforma === 'Todas' ||
        (row.plataforma_normalizada ?? '').toLowerCase().includes(filtroPlatforma.toLowerCase())
      return matchBusca && matchPlat
    })

    r = [...r].sort((a, b) => {
      if (ordenar === 'data') return a.checkin.localeCompare(b.checkin)
      if (ordenar === 'valor') return b.valor_liquido - a.valor_liquido
      return (a.individual_room_number ?? '').localeCompare(b.individual_room_number ?? '')
    })

    return r
  }, [rows, busca, filtroPlatforma, ordenar])

  const totalBruto = useMemo(() => filtrados.reduce((a, r) => a + (r.valor_bruto ?? 0), 0), [filtrados])
  const totalLiquido = useMemo(() => filtrados.reduce((a, r) => a + (r.valor_liquido ?? 0), 0), [filtrados])

  function beginEdit(row: ReservaRow) {
    setEditingId(row.id)
    setEditState({
      nome_hospede: row.nome_hospede ?? '',
      individual_room_number: row.individual_room_number ?? '',
      plataforma_normalizada: row.plataforma_normalizada ?? '',
      checkin: row.checkin,
      checkout: row.checkout,
      valor_bruto: String(row.valor_bruto ?? 0),
      valor_liquido: String(row.valor_liquido ?? 0),
    })
    setErro(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState(null)
    setErro(null)
  }

  function validateEdit(state: EditState): string | null {
    const bruto = parseFloat(state.valor_bruto.replace(',', '.'))
    const liquido = parseFloat(state.valor_liquido.replace(',', '.'))
    if (isNaN(bruto) || bruto < 0) return 'Valor bruto inválido'
    if (isNaN(liquido) || liquido < 0) return 'Valor líquido inválido'
    if (liquido > bruto) return 'Valor líquido não pode ser maior que o bruto'
    if (state.checkin && state.checkout && state.checkout <= state.checkin)
      return 'Check-out deve ser após o check-in'
    return null
  }

  async function saveEdit(id: string) {
    if (!editState) return
    const validErr = validateEdit(editState)
    if (validErr) { setErro(validErr); return }

    setSavingId(id)
    setErro(null)
    try {
      const res = await fetch(`/api/reservas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_hospede: editState.nome_hospede,
          individual_room_number: editState.individual_room_number,
          plataforma_normalizada: editState.plataforma_normalizada,
          checkin: editState.checkin,
          checkout: editState.checkout,
          valor_bruto: parseFloat(editState.valor_bruto.replace(',', '.')),
          valor_liquido: parseFloat(editState.valor_liquido.replace(',', '.')),
        }),
      })
      const body = await res.json()
      if (!res.ok) { setErro(body.error ?? 'Erro ao salvar'); return }

      setRows(prev => prev.map(r => r.id === id ? {
        ...r,
        nome_hospede: editState.nome_hospede,
        individual_room_number: editState.individual_room_number,
        plataforma_normalizada: editState.plataforma_normalizada,
        checkin: editState.checkin,
        checkout: editState.checkout,
        valor_bruto: parseFloat(editState.valor_bruto.replace(',', '.')),
        valor_liquido: parseFloat(editState.valor_liquido.replace(',', '.')),
      } : r))
      setEditadosCount(c => c + 1)
      setEditingId(null)
      setEditState(null)
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
    const res = await fetch(`/api/reservas/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRows(prev => prev.filter(r => r.id !== id))
    } else {
      const body = await res.json()
      setErro(body.error ?? 'Erro ao excluir')
      setDeleteStateMap(prev => ({ ...prev, [id]: 'idle' }))
    }
  }

  const mesLabel = MESES[mes - 1] ?? String(mes)

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center border border-gray-100 rounded-xl bg-white">
        <CalendarDays size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Nenhuma reserva encontrada para {mesLabel}/{ano}</p>
        <p className="text-xs text-gray-400 mt-1">Execute o sync Amenitiz para carregar as reservas deste período.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 bg-white border border-gray-100 rounded-xl shadow-sm p-4">
      {/* Resumo */}
      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-gray-500">
          <strong className="text-gray-800">{filtrados.length}</strong> reserva(s)
        </span>
        <span className="text-gray-500">
          Bruto: <strong className="text-gray-800">{formatCurrency(totalBruto)}</strong>
        </span>
        <span className="text-gray-500">
          Líquido: <strong className="text-gray-800">{formatCurrency(totalLiquido)}</strong>
        </span>
        {editadosCount > 0 && (
          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-medium">
            ✓ {editadosCount} editada(s) nesta sessão
          </Badge>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Buscar hóspede, quarto ou ID..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="max-w-xs text-sm"
        />
        <div className="flex gap-1">
          {(['Todas', 'Booking.com', 'Airbnb', 'AlugEasy'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltroPlatforma(f)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                filtroPlatforma === f
                  ? 'bg-[#193660] text-white border-[#193660]'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto text-xs text-gray-500">
          <span>Ordenar:</span>
          {(['data', 'valor', 'quarto'] as const).map(o => (
            <button
              key={o}
              onClick={() => setOrdenar(o)}
              className={`px-2 py-1 rounded border transition-colors ${
                ordenar === o
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {o.charAt(0).toUpperCase() + o.slice(1)}
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
          <TableRow className="border-gray-100 bg-gray-50">
            <TableHead className="text-gray-500 font-medium text-xs uppercase">Hóspede</TableHead>
            <TableHead className="text-gray-500 font-medium text-xs uppercase">Quarto</TableHead>
            <TableHead className="text-gray-500 font-medium text-xs uppercase">Plataforma</TableHead>
            <TableHead className="text-gray-500 font-medium text-xs uppercase">Check-in</TableHead>
            <TableHead className="text-gray-500 font-medium text-xs uppercase">Check-out</TableHead>
            <TableHead className="text-gray-500 font-medium text-xs uppercase text-right">Bruto</TableHead>
            <TableHead className="text-gray-500 font-medium text-xs uppercase text-right">Líquido</TableHead>
            {canWrite && <TableHead className="w-20" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtrados.map((row, idx) => {
            const isEditing = editingId === row.id
            const isSaving = savingId === row.id
            const deleteState = deleteStateMap[row.id] ?? 'idle'
            const zebraClass = idx % 2 === 1 ? 'bg-gray-50/60' : ''

            // ── CONFIRMAÇÃO DE EXCLUSÃO ──────────────────────────────
            if (deleteState === 'confirming' || deleteState === 'deleting') {
              return (
                <TableRow key={row.id} className="border-l-4 border-red-500 bg-red-50/30">
                  <TableCell colSpan={5} className="text-sm text-red-700 py-3">
                    <span className="font-medium">Esta reserva será removida permanentemente.</span>{' '}
                    <span className="text-red-600">
                      Isso reduzirá o faturamento em {formatCurrency(row.valor_liquido)}. Confirmar?
                    </span>
                  </TableCell>
                  <TableCell colSpan={canWrite ? 3 : 2} className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => cancelDelete(row.id)}
                        disabled={deleteState === 'deleting'}
                      >
                        Cancelar
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

            // ── MODO EDIÇÃO (2 sub-linhas) ───────────────────────────
            if (isEditing && editState) {
              const validErr = validateEdit(editState)
              return (
                <>
                  <TableRow key={`${row.id}-edit-1`} className="border-l-4 border-blue-500 bg-blue-50/30 border-b-0">
                    <TableCell className="py-2">
                      <Input
                        value={editState.nome_hospede}
                        onChange={e => setEditState(s => s ? { ...s, nome_hospede: e.target.value } : s)}
                        className="text-sm h-8"
                        placeholder="Nome do hóspede"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        value={editState.individual_room_number}
                        onChange={e => setEditState(s => s ? { ...s, individual_room_number: e.target.value } : s)}
                        className="text-sm h-8 w-24"
                        placeholder="Quarto"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <select
                        value={editState.plataforma_normalizada}
                        onChange={e => setEditState(s => s ? { ...s, plataforma_normalizada: e.target.value } : s)}
                        className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 h-8"
                      >
                        {PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        type="date"
                        value={editState.checkin}
                        onChange={e => setEditState(s => s ? { ...s, checkin: e.target.value } : s)}
                        className="text-sm h-8 w-36"
                      />
                    </TableCell>
                    <TableCell className="py-2">
                      <Input
                        type="date"
                        value={editState.checkout}
                        onChange={e => setEditState(s => s ? { ...s, checkout: e.target.value } : s)}
                        className="text-sm h-8 w-36"
                      />
                    </TableCell>
                    <TableCell colSpan={canWrite ? 3 : 2} />
                  </TableRow>
                  <TableRow key={`${row.id}-edit-2`} className="border-l-4 border-blue-500 bg-blue-50/30">
                    <TableCell colSpan={3} className="py-2">
                      <div className="flex items-end gap-4">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Valor Bruto (R$)</label>
                          <Input
                            type="number" min="0" step="0.01"
                            value={editState.valor_bruto}
                            onChange={e => setEditState(s => s ? { ...s, valor_bruto: e.target.value } : s)}
                            className="text-sm h-8 w-32 text-right"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Valor Líquido (R$)</label>
                          <Input
                            type="number" min="0" step="0.01"
                            value={editState.valor_liquido}
                            onChange={e => setEditState(s => s ? { ...s, valor_liquido: e.target.value } : s)}
                            className="text-sm h-8 w-32 text-right"
                            autoFocus
                          />
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠️ Alterar o valor líquido afeta o faturamento do dashboard, prestação de contas e portal do proprietário.
                          </p>
                        </div>
                      </div>
                      {validErr && (
                        <p className="text-xs text-red-600 mt-2">{validErr}</p>
                      )}
                    </TableCell>
                    <TableCell colSpan={canWrite ? 5 : 4} className="py-2 text-right align-bottom">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => saveEdit(row.id)}
                          disabled={isSaving || !!validErr}
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
                    </TableCell>
                  </TableRow>
                </>
              )
            }

            // ── LINHA NORMAL ─────────────────────────────────────────
            return (
              <TableRow key={row.id} className={`border-gray-100 hover:bg-gray-50 transition-colors ${zebraClass}`}>
                <TableCell className="text-sm text-gray-700 max-w-[160px] truncate" title={row.nome_hospede}>
                  {row.nome_hospede || '—'}
                </TableCell>
                <TableCell className="font-medium text-gray-900 text-sm">
                  {row.individual_room_number || '—'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${badgePlatforma(row.plataforma_normalizada)}`}>
                    {row.plataforma_normalizada || '—'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-gray-600">{fmtDate(row.checkin)}</TableCell>
                <TableCell className="text-sm text-gray-600">{fmtDate(row.checkout)}</TableCell>
                <TableCell className="text-right text-sm text-gray-500">{formatCurrency(row.valor_bruto)}</TableCell>
                <TableCell className="text-right font-bold text-gray-900">{formatCurrency(row.valor_liquido)}</TableCell>
                {canWrite && (
                  <TableCell className="text-right">
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

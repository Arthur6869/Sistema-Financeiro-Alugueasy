'use client'

import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ManualCostActions } from '@/components/custos/manual-cost-actions'
import { formatCurrency } from '@/lib/constants'

interface ManualCostRow {
  id: string
  mes: number
  ano: number
  categoria: string
  valor: number
  tipo_gestao: 'adm' | 'sub'
  observacao: string | null
  origem: 'manual' | 'importacao'
  empreendimento_nome: string
  apartamento_numero: string
  criado_por_nome?: string | null
}

interface ManualCostTableProps {
  items: ManualCostRow[]
  canWrite: boolean
  onDelete: (id: string) => Promise<void>
  onEdit: (id: string, payload: { categoria: string; valor: number; observacao: string | null }) => Promise<void>
}

export function ManualCostTable({ items, canWrite, onDelete, onEdit }: ManualCostTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [categoria, setCategoria] = useState('')
  const [valor, setValor] = useState('')
  const [observacao, setObservacao] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const rows = useMemo(
    () => [...items].sort((a, b) => b.ano - a.ano || b.mes - a.mes || b.valor - a.valor),
    [items]
  )

  function beginEdit(row: ManualCostRow) {
    setEditingId(row.id)
    setCategoria(row.categoria)
    setValor(String(row.valor))
    setObservacao(row.observacao ?? '')
  }

  function cancelEdit() {
    setEditingId(null)
    setCategoria('')
    setValor('')
    setObservacao('')
  }

  async function saveEdit() {
    if (!editingId) return
    const parsedValor = Number(valor.replace(',', '.'))
    if (!categoria.trim() || isNaN(parsedValor) || parsedValor <= 0) return
    setIsSaving(true)
    try {
      await onEdit(editingId, {
        categoria: categoria.trim(),
        valor: parsedValor,
        observacao: observacao.trim() ? observacao.trim() : null,
      })
      cancelEdit()
    } finally {
      setIsSaving(false)
    }
  }

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        Nenhum lançamento encontrado para os filtros selecionados.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Competência</TableHead>
          <TableHead>Imóvel</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Origem</TableHead>
          <TableHead>Criado por</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((item) => {
          const isEditing = editingId === item.id
          return (
            <TableRow key={item.id}>
              <TableCell>{String(item.mes).padStart(2, '0')}/{item.ano}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">{item.apartamento_numero}</span>
                  <span className="text-xs text-gray-500">{item.empreendimento_nome}</span>
                </div>
              </TableCell>
              <TableCell>
                {isEditing ? (
                  <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
                ) : item.categoria}
              </TableCell>
              <TableCell>
                {isEditing ? (
                  <Input type="number" min="0" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
                ) : (
                  formatCurrency(item.valor)
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={item.origem === 'manual' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}>
                  {item.origem}
                </Badge>
              </TableCell>
              <TableCell>{item.criado_por_nome ?? '—'}</TableCell>
              <TableCell className="text-right">
                {isEditing ? (
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={cancelEdit} disabled={isSaving}>Cancelar</Button>
                    <Button size="sm" onClick={saveEdit} disabled={isSaving || !canWrite}>
                      {isSaving ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                ) : (
                  <ManualCostActions
                    disabled={!canWrite || item.origem !== 'manual'}
                    onEdit={() => beginEdit(item)}
                    onDelete={async () => {
                      const ok = window.confirm('Deseja realmente excluir este lançamento?')
                      if (ok) await onDelete(item.id)
                    }}
                  />
                )}
              </TableCell>
            </TableRow>
          )
        })}
        {editingId && (
          <TableRow>
            <TableCell colSpan={7}>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Observação do lançamento (opcional)"
              />
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

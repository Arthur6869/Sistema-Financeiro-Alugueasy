'use client'

import { useMemo, useState } from 'react'
import { Plus, Trash2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { agruparPorArea, type ItemChecklistModelo } from '@/lib/limpeza'

type Imovel = { id: string; nome: string }

export function ChecklistEditor({ itensIniciais, imoveis }: { itensIniciais: ItemChecklistModelo[]; imoveis: Imovel[] }) {
  const [itens, setItens] = useState(itensIniciais)
  const [area, setArea] = useState('')
  const [descricao, setDescricao] = useState('')
  const [aptId, setAptId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)

  const nomeImovel = useMemo(() => new Map(imoveis.map(i => [i.id, i.nome])), [imoveis])
  const areas = useMemo(() => [...new Set(itens.map(i => i.area))], [itens])
  const grupos = useMemo(
    () => agruparPorArea([...itens].sort((a, b) => a.ordem - b.ordem)),
    [itens],
  )

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!area.trim() || !descricao.trim()) { toast.error('Informe a área e a descrição'); return }
    setSalvando(true)
    try {
      const res = await fetch('/api/limpezas/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area, descricao, apartamento_id: aptId || null }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao adicionar'); return }
      setItens(prev => [...prev, data.item])
      setDescricao('')
      toast.success('Item adicionado')
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setSalvando(false)
    }
  }

  async function alternarAtivo(item: ItemChecklistModelo) {
    setOcupado(item.id)
    try {
      const res = await fetch('/api/limpezas/checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, ativo: !item.ativo }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao atualizar'); return }
      setItens(prev => prev.map(i => (i.id === item.id ? data.item : i)))
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setOcupado(null)
    }
  }

  async function remover(item: ItemChecklistModelo) {
    setOcupado(item.id)
    try {
      const res = await fetch(`/api/limpezas/checklist?id=${item.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao remover'); return }
      setItens(prev => prev.filter(i => i.id !== item.id))
      toast.success('Item removido')
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader><CardTitle className="text-base font-semibold text-gray-800">Adicionar item</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={adicionar} className="grid gap-3 md:grid-cols-[180px_1fr_200px_auto] items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Área</label>
              <Input list="areas-checklist" value={area} onChange={e => setArea(e.target.value)} placeholder="Ex.: Banheiro" disabled={salvando} />
              <datalist id="areas-checklist">{areas.map(a => <option key={a} value={a} />)}</datalist>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Descrição</label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Limpar o rejunte do box" disabled={salvando} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vale para</label>
              <select
                value={aptId}
                onChange={e => setAptId(e.target.value)}
                disabled={salvando}
                className="w-full h-9 rounded-md border border-gray-200 bg-white px-2 text-sm"
              >
                <option value="">Todos os imóveis</option>
                {imoveis.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
            </div>
            <Button type="submit" disabled={salvando} className="text-white" style={{ backgroundColor: '#193660' }}>
              {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              <span className="ml-1">Adicionar</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {grupos.map(g => (
        <Card key={g.area} className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-[#193660] uppercase tracking-wider">{g.area}</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-100">
              {g.itens.map(item => (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <span className={`flex-1 text-sm ${item.ativo ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{item.descricao}</span>
                  {item.apartamento_id && (
                    <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                      Só {nomeImovel.get(item.apartamento_id) ?? 'imóvel'}
                    </Badge>
                  )}
                  {!item.ativo && <Badge variant="outline" className="text-xs">Oculto</Badge>}
                  <button
                    type="button"
                    onClick={() => alternarAtivo(item)}
                    disabled={ocupado === item.id}
                    title={item.ativo ? 'Ocultar da equipe' : 'Mostrar para a equipe'}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  >
                    {item.ativo ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => remover(item)}
                    disabled={ocupado === item.id}
                    title="Remover item"
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

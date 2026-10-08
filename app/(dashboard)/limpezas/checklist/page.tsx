import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { ChecklistEditor } from '@/components/limpezas/checklist-editor'
import type { ItemChecklistModelo } from '@/lib/limpeza'

export default async function ChecklistModeloPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'analista') redirect('/limpezas')

  const [{ data: itens }, { data: apts }] = await Promise.all([
    supabase.from('limpeza_checklist_itens')
      .select('id, apartamento_id, area, descricao, ordem, ativo')
      .order('ordem'),
    supabase.from('apartamentos').select('id, numero, empreendimentos(nome)').order('numero'),
  ])

  const imoveis = ((apts ?? []) as unknown as { id: string; numero: string; empreendimentos: { nome: string } | null }[])
    .map(a => ({ id: a.id, nome: `${a.empreendimentos?.nome ?? ''} ${a.numero}`.trim() }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))

  return (
    <div className="p-8 max-w-4xl">
      <Link href="/limpezas" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={14} /> Voltar para Limpezas
      </Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Checklist de limpeza</h1>
        <Badge style={{ backgroundColor: '#193660' }} className="text-white text-xs">Analista only</Badge>
      </div>
      <p className="text-gray-500 text-sm mt-1 mb-6">
        Itens que a equipe marca em cada limpeza. Itens “Todos os imóveis” aparecem sempre; itens de um imóvel
        aparecem só nele. Alterar ou remover itens não muda limpezas já registradas.
      </p>

      <ChecklistEditor itensIniciais={(itens ?? []) as ItemChecklistModelo[]} imoveis={imoveis} />
    </div>
  )
}

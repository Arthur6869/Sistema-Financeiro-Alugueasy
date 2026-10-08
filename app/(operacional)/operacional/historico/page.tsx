import { createClient } from '@/lib/supabase/server'
import { CheckCircle2, AlertTriangle, Users } from 'lucide-react'
import { duracao, formatarDataHora, nomesResponsaveis, type Limpeza } from '@/lib/limpeza'

export default async function MinhasLimpezas() {
  const supabase = await createClient()

  // Sem filtro de usuário de propósito: a RLS (migration 042) devolve as limpezas
  // que a pessoa registrou E as em que foi marcada como responsável.
  const { data } = await supabase
    .from('limpezas')
    .select('id, imovel, operador_nome, responsaveis, iniciada_em, finalizada_em, total_itens, itens_concluidos, completa, observacao')
    .order('finalizada_em', { ascending: false })
    .limit(60)

  const limpezas = (data ?? []) as Pick<Limpeza,
    'id' | 'imovel' | 'operador_nome' | 'responsaveis' | 'iniciada_em' | 'finalizada_em' | 'total_itens' | 'itens_concluidos' | 'completa' | 'observacao'>[]

  return (
    <div>
      <h1 className="text-xl font-bold text-[#0f1a2e]">Minhas limpezas</h1>
      <p className="text-sm text-[#5a6a82] mt-1 mb-4">Limpezas que você registrou ou em que participou.</p>

      {limpezas.length === 0 ? (
        <div className="text-center text-sm text-gray-500 py-10 bg-white rounded-2xl border border-gray-200">
          Você ainda não registrou nenhuma limpeza.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {limpezas.map(l => {
            const tempo = duracao(l.iniciada_em, l.finalizada_em)
            return (
              <li key={l.id} className="bg-white rounded-2xl border border-gray-200 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0f1a2e] truncate">{l.imovel}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {formatarDataHora(l.finalizada_em)}{tempo ? ` · ${tempo}` : ''}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                      <Users size={11} className="text-[#0f766e]" />
                      {nomesResponsaveis(l, true)}
                    </div>
                  </div>
                  <span className={
                    l.completa
                      ? 'inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 rounded-full px-2.5 py-1 shrink-0'
                      : 'inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 rounded-full px-2.5 py-1 shrink-0'
                  }>
                    {l.completa ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                    {l.itens_concluidos}/{l.total_itens}
                  </span>
                </div>
                {l.observacao && (
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap border-t border-gray-100 pt-2">{l.observacao}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

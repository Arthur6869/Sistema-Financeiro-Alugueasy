import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import '@/components/operacional/quartos.css'
import { createClient } from '@/lib/supabase/server'
import { ChecklistForm } from '@/components/operacional/checklist-form'
import { descreverSituacao, slugPredio, type ImovelLimpeza, type ItemChecklistModelo, type MembroEquipe } from '@/lib/limpeza'

/** `id` = unidade de limpeza (limpeza_unidades.id, migration 043). */
export default async function LimpezaImovel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login-operacional')

  const [{ data: imoveis }, { data: equipe }] = await Promise.all([
    supabase.rpc('listar_imoveis_limpeza'),
    // Colegas da equipe de limpeza, para marcar quem participou (migration 041)
    supabase.rpc('listar_equipe_limpeza'),
  ])

  const imovel = ((imoveis ?? []) as ImovelLimpeza[]).find(i => i.unidade_id === id)
  if (!imovel) notFound()

  // Itens padrão + extras do imóvel (extras existem só para unidades ligadas
  // ao cadastro financeiro)
  let consulta = supabase
    .from('limpeza_checklist_itens')
    .select('id, apartamento_id, area, descricao, ordem, ativo')
    .eq('ativo', true)
  consulta = imovel.apartamento_id
    ? consulta.or(`apartamento_id.is.null,apartamento_id.eq.${imovel.apartamento_id}`)
    : consulta.is('apartamento_id', null)
  const { data: itens } = await consulta.order('ordem')

  const { titulo, detalhe } = descreverSituacao(imovel)

  return (
    <div>
      <Link
        href={`/operacional/predio/${slugPredio(imovel.empreendimento)}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[#0f766e] mb-3"
      >
        <ArrowLeft size={15} />
        Voltar para {imovel.empreendimento}
      </Link>

      <div className="mb-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#5a6a82]">{imovel.empreendimento}</div>
        <h1 className="text-2xl font-bold text-[#0f1a2e]">Apto {imovel.numero}</h1>
      </div>

      <div
        className="quarto mb-4"
        data-situacao={imovel.situacao}
        data-urgente={imovel.situacao === 'pendente' && imovel.entrada_hoje}
      >
        <div className="flex-1 min-w-0 pl-1">
          <div className="quarto-status text-sm font-semibold">{titulo}</div>
          <div className="text-xs text-gray-600 mt-0.5">{detalhe}</div>
          {imovel.situacao === 'ocupado' && (
            <div className="text-xs text-gray-600 mt-1.5">
              O hóspede ainda está no imóvel. Registre só se for uma arrumação combinada.
            </div>
          )}
          {imovel.limpa_hoje && imovel.situacao !== 'ocupado' && (
            <div className="text-xs text-gray-600 mt-1.5">
              Já houve limpeza hoje{imovel.ultima_limpeza_por ? ` (${imovel.ultima_limpeza_por})` : ''}. Registrar de novo cria um segundo registro.
            </div>
          )}
        </div>
      </div>

      <ChecklistForm
        unidadeId={id}
        voltarPara={`/operacional/predio/${slugPredio(imovel.empreendimento)}`}
        imovel={`${imovel.empreendimento} ${imovel.numero}`}
        itens={(itens ?? []) as ItemChecklistModelo[]}
        equipe={(equipe ?? []) as MembroEquipe[]}
        usuarioId={user.id}
      />
    </div>
  )
}

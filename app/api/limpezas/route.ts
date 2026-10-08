import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSessaoApi } from '@/lib/supabase/api-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { cabecalhosCors, respostaPreflight } from '@/lib/cors'
import { registrarAuditoria } from '@/lib/audit'
import { assuntoEmailLimpeza, gerarHtmlEmailLimpeza } from '@/components/emails/limpeza-concluida'
import type { ItemChecklistModelo, ItemLimpeza } from '@/lib/limpeza'

// Dois envios do mesmo imóvel pela mesma pessoa dentro desta janela são tratados
// como clique duplo (ou reenvio por rede instável) e recusados.
const JANELA_DUPLICIDADE_MS = 2 * 60 * 1000
const OBSERVACAO_MAX = 2000

export async function OPTIONS(request: NextRequest) {
  return respostaPreflight(request)
}

/**
 * POST /api/limpezas — a pessoa da limpeza finaliza o checklist de um imóvel.
 *
 * Aceita sessão por cookie (site) ou Authorization: Bearer (app mobile).
 * Só papel 'operacional' com conta ativa. A gravação usa service_role porque a
 * tabela `limpezas` não tem policy de INSERT para sessões de usuário (migration
 * 040): o registro só nasce por aqui, depois das validações abaixo.
 *
 * Body: { unidade_id, itens: [{ id, concluido }], responsaveis_ids: [uuid],
 *         observacao?, iniciada_em? }
 * `unidade_id` = quarto da lista de limpeza (limpeza_unidades, migration 043).
 * O texto dos itens e os nomes dos responsáveis vêm do banco, nunca do cliente.
 * `responsaveis_ids` = todas as pessoas que fizeram a limpeza (uma ou mais);
 * quem envia pode ou não estar entre elas — fica registrado em operador_*.
 */
export async function POST(request: NextRequest) {
  const cors = cabecalhosCors(request)
  const responder = (corpo: unknown, status = 200) => NextResponse.json(corpo, { status, headers: cors })

  const { userId, role, ativo } = await getSessaoApi(request)
  if (!userId) return responder({ error: 'Não autenticado' }, 401)
  if (role !== 'operacional') return responder({ error: 'Apenas a equipe operacional registra limpezas' }, 403)
  if (!ativo) return responder({ error: 'Conta desativada' }, 403)

  const body = await request.json().catch(() => null) as {
    unidade_id?: unknown
    itens?: unknown
    responsaveis_ids?: unknown
    observacao?: unknown
    iniciada_em?: unknown
  } | null
  if (!body) return responder({ error: 'Corpo inválido' }, 400)

  const UUID = /^[0-9a-f-]{36}$/i
  const unidadeId = typeof body.unidade_id === 'string' ? body.unidade_id : ''
  if (!UUID.test(unidadeId)) return responder({ error: 'Imóvel inválido' }, 400)

  const responsaveisIds = Array.isArray(body.responsaveis_ids)
    ? [...new Set((body.responsaveis_ids as unknown[]).filter((x): x is string => typeof x === 'string' && UUID.test(x)))].slice(0, 20)
    : []
  if (responsaveisIds.length === 0) return responder({ error: 'Selecione quem fez a limpeza.' }, 400)

  const marcados = new Map<string, boolean>()
  if (Array.isArray(body.itens)) {
    for (const i of body.itens as Array<{ id?: unknown; concluido?: unknown }>) {
      if (typeof i?.id === 'string') marcados.set(i.id, i.concluido === true)
    }
  }

  const observacao = typeof body.observacao === 'string' ? body.observacao.trim().slice(0, OBSERVACAO_MAX) : ''

  // Início informado pelo aparelho: aceito só se for plausível (até 12 h atrás).
  let iniciadaEm: string | null = null
  if (typeof body.iniciada_em === 'string') {
    const t = Date.parse(body.iniciada_em)
    if (!isNaN(t) && t <= Date.now() + 60_000 && t >= Date.now() - 12 * 3600_000) {
      iniciadaEm = new Date(Math.min(t, Date.now())).toISOString()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as SupabaseClient<any>

  const { data: unidade } = await admin
    .from('limpeza_unidades')
    .select('id, empreendimento, numero, apartamento_id')
    .eq('id', unidadeId).eq('ativo', true)
    .maybeSingle()
  if (!unidade) return responder({ error: 'Imóvel não encontrado' }, 404)
  // Cadastro financeiro ligado (pode não existir: FUSION 318, VISION 1016...)
  const apartamentoId = (unidade.apartamento_id as string | null) ?? null

  let consultaItens = admin.from('limpeza_checklist_itens')
    .select('id, apartamento_id, area, descricao, ordem, ativo')
    .eq('ativo', true)
  consultaItens = apartamentoId
    ? consultaItens.or(`apartamento_id.is.null,apartamento_id.eq.${apartamentoId}`)
    : consultaItens.is('apartamento_id', null)

  const [{ data: perfil }, { data: modelo, error: modeloErr }, { data: equipe }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    consultaItens.order('ordem'),
    // Só contas operacionais ativas podem constar como responsáveis — e o nome
    // sai daqui, não do que o cliente mandou.
    admin.from('profiles').select('id, full_name, ativo').in('id', responsaveisIds).eq('role', 'operacional'),
  ])

  if (modeloErr) return responder({ error: 'Checklist indisponível. Avise a equipe AlugEasy.' }, 500)

  const responsaveis = ((equipe ?? []) as { id: string; full_name: string | null; ativo: boolean | null }[])
    .filter(p => p.ativo !== false)
    .map(p => ({ id: p.id, nome: p.full_name?.trim() || 'Sem nome' }))
  if (responsaveis.length !== responsaveisIds.length) {
    return responder({ error: 'Um dos nomes selecionados não é da equipe de limpeza ativa. Atualize a página.' }, 400)
  }
  // Mantém a ordem em que a pessoa selecionou
  responsaveis.sort((a, b) => responsaveisIds.indexOf(a.id) - responsaveisIds.indexOf(b.id))
  const itensModelo = (modelo ?? []) as ItemChecklistModelo[]
  if (itensModelo.length === 0) return responder({ error: 'Nenhum item de checklist cadastrado' }, 400)

  const itens: ItemLimpeza[] = itensModelo.map(m => ({
    area: m.area,
    descricao: m.descricao,
    concluido: marcados.get(m.id) === true,
  }))
  const concluidos = itens.filter(i => i.concluido).length

  if (concluidos < itens.length && observacao.length < 5) {
    return responder({ error: 'Alguns itens não foram marcados. Explique nas observações o motivo.' }, 400)
  }

  const imovel = `${unidade.empreendimento} ${unidade.numero}`.trim()
  const operadorNome = perfil?.full_name?.trim() || 'Equipe operacional'

  const { data: recente } = await admin
    .from('limpezas').select('id')
    .eq('operador_id', userId).eq('unidade_id', unidadeId)
    .gte('finalizada_em', new Date(Date.now() - JANELA_DUPLICIDADE_MS).toISOString())
    .limit(1)
  if (recente && recente.length > 0) {
    return responder({ error: 'Esta limpeza já foi registrada agora há pouco.', duplicada: true, id: recente[0].id }, 409)
  }

  const finalizadaEm = new Date().toISOString()
  const { data: criada, error: insErr } = await admin
    .from('limpezas')
    .insert({
      unidade_id: unidadeId,
      apartamento_id: apartamentoId,
      imovel,
      operador_id: userId,
      operador_nome: operadorNome,
      responsaveis,
      iniciada_em: iniciadaEm,
      finalizada_em: finalizadaEm,
      itens,
      total_itens: itens.length,
      itens_concluidos: concluidos,
      observacao: observacao || null,
    })
    .select('id')
    .single()

  if (insErr || !criada) {
    console.error('[limpezas] falha ao gravar:', insErr?.message)
    return responder({ error: 'Não foi possível registrar a limpeza. Tente de novo.' }, 500)
  }

  // E-mail para a AlugEasy. Falha no e-mail não desfaz o registro: fica anotada
  // na linha (email_erro) e a limpeza aparece normalmente em /limpezas.
  let emailEnviado = false
  let emailErro: string | null = null
  const destinos = (process.env.LIMPEZA_EMAIL_DESTINO ?? '').split(',').map(s => s.trim()).filter(Boolean)

  if (!process.env.RESEND_API_KEY) {
    emailErro = 'RESEND_API_KEY não configurada'
  } else if (destinos.length === 0) {
    emailErro = 'LIMPEZA_EMAIL_DESTINO não configurada'
  } else {
    const dados = {
      imovel,
      responsaveis: responsaveis.map(r => r.nome),
      registradoPor: operadorNome,
      iniciadaEm,
      finalizadaEm,
      itens,
      observacao: observacao || null,
    }
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'noreply@alugueasy.com.br',
        to: destinos,
        subject: assuntoEmailLimpeza(dados),
        html: gerarHtmlEmailLimpeza(dados),
      })
      if (error) emailErro = error.message
      else emailEnviado = true
    } catch (e) {
      emailErro = e instanceof Error ? e.message : 'falha desconhecida no envio'
    }
  }

  await admin.from('limpezas')
    .update({ email_enviado: emailEnviado, email_erro: emailErro ? emailErro.slice(0, 300) : null })
    .eq('id', criada.id)
  if (emailErro) console.error('[limpezas] e-mail não enviado:', emailErro)

  await registrarAuditoria({
    usuarioId: userId,
    acao: 'limpeza_registrada',
    tabela: 'limpezas',
    registrosAfetados: 1,
    detalhes: { limpeza_id: criada.id, imovel, responsaveis: responsaveisIds, concluidos, total: itens.length, email_enviado: emailEnviado },
  })

  return responder({
    success: true,
    id: criada.id,
    completa: concluidos === itens.length,
    itens_concluidos: concluidos,
    total_itens: itens.length,
    email_enviado: emailEnviado,
  })
}

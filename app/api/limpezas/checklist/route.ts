import { NextRequest, NextResponse } from 'next/server'
import { requireAnalista } from '@/lib/api-auth'
import { registrarAuditoria } from '@/lib/audit'

const UUID = /^[0-9a-f-]{36}$/i

function texto(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/**
 * Modelo do checklist de limpeza — só analista edita (admin é somente leitura).
 * Usa o cliente da sessão: a RLS da migration 040 também exige analista, então
 * a regra vale nas duas camadas.
 *
 * POST   { area, descricao, apartamento_id?, ordem? }  cria item
 * PATCH  { id, descricao?, area?, ordem?, ativo? }     edita item
 * DELETE ?id=...                                       remove item
 *
 * Remover um item não altera o histórico: cada limpeza guarda a própria cópia.
 */
export async function POST(request: NextRequest) {
  const { user, supabase, response } = await requireAnalista()
  if (response) return response

  const body = await request.json().catch(() => ({}))
  const area = texto(body.area, 60)
  const descricao = texto(body.descricao, 200)
  const apartamentoId = typeof body.apartamento_id === 'string' && UUID.test(body.apartamento_id) ? body.apartamento_id : null
  if (!area || !descricao) return NextResponse.json({ error: 'Informe a área e a descrição do item' }, { status: 400 })

  let ordem = Number(body.ordem)
  if (!Number.isFinite(ordem)) {
    const { data: ultimo } = await supabase
      .from('limpeza_checklist_itens').select('ordem').eq('area', area)
      .order('ordem', { ascending: false }).limit(1).maybeSingle()
    const { data: maior } = await supabase
      .from('limpeza_checklist_itens').select('ordem').order('ordem', { ascending: false }).limit(1).maybeSingle()
    ordem = ultimo ? ultimo.ordem + 1 : (maior?.ordem ?? 0) + 100
  }

  const { data, error } = await supabase
    .from('limpeza_checklist_itens')
    .insert({ area, descricao, apartamento_id: apartamentoId, ordem: Math.round(ordem) })
    .select('id, apartamento_id, area, descricao, ordem, ativo')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await registrarAuditoria({ usuarioId: user.id, acao: 'checklist_item_criado', tabela: 'limpeza_checklist_itens', registrosAfetados: 1, detalhes: data })
  return NextResponse.json({ success: true, item: data })
}

export async function PATCH(request: NextRequest) {
  const { user, supabase, response } = await requireAnalista()
  if (response) return response

  const body = await request.json().catch(() => ({}))
  const id = typeof body.id === 'string' && UUID.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  const campos: Record<string, unknown> = {}
  if (body.descricao !== undefined) {
    const d = texto(body.descricao, 200)
    if (!d) return NextResponse.json({ error: 'Descrição vazia' }, { status: 400 })
    campos.descricao = d
  }
  if (body.area !== undefined) {
    const a = texto(body.area, 60)
    if (!a) return NextResponse.json({ error: 'Área vazia' }, { status: 400 })
    campos.area = a
  }
  if (body.ordem !== undefined && Number.isFinite(Number(body.ordem))) campos.ordem = Math.round(Number(body.ordem))
  if (typeof body.ativo === 'boolean') campos.ativo = body.ativo
  if (Object.keys(campos).length === 0) return NextResponse.json({ error: 'Nada para alterar' }, { status: 400 })

  const { data, error } = await supabase
    .from('limpeza_checklist_itens').update(campos).eq('id', id)
    .select('id, apartamento_id, area, descricao, ordem, ativo')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

  await registrarAuditoria({ usuarioId: user.id, acao: 'checklist_item_editado', tabela: 'limpeza_checklist_itens', registrosAfetados: 1, detalhes: { id, campos } })
  return NextResponse.json({ success: true, item: data[0] })
}

export async function DELETE(request: NextRequest) {
  const { user, supabase, response } = await requireAnalista()
  if (response) return response

  const id = request.nextUrl.searchParams.get('id') ?? ''
  if (!UUID.test(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })

  const { data, error } = await supabase.from('limpeza_checklist_itens').delete().eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

  await registrarAuditoria({ usuarioId: user.id, acao: 'checklist_item_removido', tabela: 'limpeza_checklist_itens', registrosAfetados: 1, detalhes: { id } })
  return NextResponse.json({ success: true, id })
}

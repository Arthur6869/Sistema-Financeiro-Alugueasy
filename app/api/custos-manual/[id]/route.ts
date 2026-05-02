import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function parseNumero(input: unknown): number {
  if (typeof input === 'number') return input
  if (typeof input !== 'string') return NaN
  return Number(input.replace(',', '.').trim())
}

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return { supabase, user: null, role: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { supabase, user, role: profile?.role ?? null }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, role } = await getAuthContext()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (role !== 'analista') {
    return NextResponse.json({ error: 'Apenas analistas podem editar custos manuais' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()

  const categoria = String(body.categoria ?? '').trim()
  const valor = parseNumero(body.valor)
  const observacao = body.observacao ? String(body.observacao).trim() : null

  if (!categoria || isNaN(valor) || valor <= 0) {
    return NextResponse.json({ error: 'Categoria e valor válido são obrigatórios' }, { status: 400 })
  }

  const { data: custoAtual, error: currentErr } = await supabase
    .from('custos')
    .select('id, apartamento_id, mes, ano, tipo_gestao, origem')
    .eq('id', id)
    .single()

  if (currentErr || !custoAtual) {
    return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
  }
  if (custoAtual.origem !== 'manual') {
    return NextResponse.json({ error: 'Somente lançamentos manuais podem ser editados por esta tela' }, { status: 400 })
  }

  const { data: duplicado } = await supabase
    .from('custos')
    .select('id')
    .eq('apartamento_id', custoAtual.apartamento_id)
    .eq('mes', custoAtual.mes)
    .eq('ano', custoAtual.ano)
    .eq('categoria', categoria)
    .eq('tipo_gestao', custoAtual.tipo_gestao)
    .eq('valor', valor)
    .neq('id', id)
    .maybeSingle()

  if (duplicado) {
    return NextResponse.json({ error: 'Já existe um custo idêntico nesta competência' }, { status: 409 })
  }

  const { error: updateErr } = await supabase
    .from('custos')
    .update({
      categoria,
      valor,
      observacao,
      origem: 'manual',
    })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { supabase, user, role } = await getAuthContext()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (role !== 'analista') {
    return NextResponse.json({ error: 'Apenas analistas podem excluir custos manuais' }, { status: 403 })
  }

  const { id } = await context.params
  const { data: custoAtual, error: currentErr } = await supabase
    .from('custos')
    .select('id, origem')
    .eq('id', id)
    .single()

  if (currentErr || !custoAtual) {
    return NextResponse.json({ error: 'Lançamento não encontrado' }, { status: 404 })
  }
  if (custoAtual.origem !== 'manual') {
    return NextResponse.json({ error: 'Somente lançamentos manuais podem ser excluídos por esta tela' }, { status: 400 })
  }

  const { error: delErr } = await supabase
    .from('custos')
    .delete()
    .eq('id', id)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

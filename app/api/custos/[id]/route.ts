import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null }

  // Aceitar chamada interna (MCP / agente)
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  return { user, role: profile?.role ?? null }
}

function acceptsInternalKey(request: NextRequest): boolean {
  const key = request.headers.get('x-alugueasy-internal-key')
  return !!(key && key === process.env.ALUGUEASY_INTERNAL_API_KEY)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const isInternal = acceptsInternalKey(request)
  if (!isInternal) {
    const { user, role } = await getAuthContext()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (role !== 'analista')
      return NextResponse.json({ error: 'Apenas analistas podem editar custos' }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json() as { categoria?: string; valor?: number; observacao?: string }

  if (body.valor !== undefined && body.valor <= 0)
    return NextResponse.json({ error: 'Valor deve ser maior que zero' }, { status: 400 })
  if (body.categoria !== undefined && body.categoria.trim().length < 2)
    return NextResponse.json({ error: 'Categoria muito curta' }, { status: 400 })

  const admin = createAdminClient()
  const { data: custo, error: findErr } = await admin
    .from('custos').select('id, categoria, valor, origem').eq('id', id).single()

  if (findErr || !custo)
    return NextResponse.json({ error: 'Custo não encontrado' }, { status: 404 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.categoria !== undefined) update.categoria = body.categoria.trim()
  if (body.valor !== undefined) update.valor = body.valor
  if (body.observacao !== undefined) update.observacao = body.observacao

  const { data, error } = await admin
    .from('custos').update(update as never).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    custo: data,
    mensagem: `Custo atualizado: ${(data as any).categoria} → R$ ${(data as any).valor}`,
  })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const isInternal = acceptsInternalKey(request)
  if (!isInternal) {
    const { user, role } = await getAuthContext()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (role !== 'analista')
      return NextResponse.json({ error: 'Apenas analistas podem excluir custos' }, { status: 403 })
  }

  const { id } = await context.params
  const admin = createAdminClient()
  const { error } = await admin.from('custos').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, id })
}

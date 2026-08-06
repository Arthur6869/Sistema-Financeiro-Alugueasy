import { createAdminClient } from '@/lib/supabase/admin'
import { requireAnalista } from '@/lib/api-auth'
import { temChaveInterna } from '@/lib/internal-key'
import { NextRequest, NextResponse } from 'next/server'

// Comparação em tempo constante e fail-closed — ver lib/internal-key.ts.
function acceptsInternalKey(request: NextRequest): boolean {
  return temChaveInterna(request)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const isInternal = acceptsInternalKey(request)
  if (!isInternal) {
    const { response } = await requireAnalista()
    if (response) return response
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

  const atualizado = data as { categoria: string; valor: number }

  return NextResponse.json({
    success: true,
    custo: data,
    mensagem: `Custo atualizado: ${atualizado.categoria} → R$ ${atualizado.valor}`,
  })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const isInternal = acceptsInternalKey(request)
  if (!isInternal) {
    const { response } = await requireAnalista()
    if (response) return response
  }

  const { id } = await context.params
  const admin = createAdminClient()
  const { error } = await admin.from('custos').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, id })
}

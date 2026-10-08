import { createClient as createAdminClient } from '@supabase/supabase-js'
import { requireAnalista } from '@/lib/api-auth'
import { NextRequest, NextResponse } from 'next/server'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada')
  return createAdminClient(url, key)
}

// PATCH /api/usuarios/[id] — desativar ou reativar um proprietário ou operacional
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAnalista()
  if (response) return response

  const { id } = await params
  const body = await request.json()
  const { ativo } = body as { ativo: boolean }

  if (typeof ativo !== 'boolean') {
    return NextResponse.json({ error: 'Campo "ativo" (boolean) é obrigatório' }, { status: 400 })
  }

  const adminClient = getAdminClient()

  const { data: profile, error: profileErr } = await adminClient
    .from('profiles').select('id, role').eq('id', id).single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }
  if (profile.role !== 'proprietario' && profile.role !== 'operacional') {
    return NextResponse.json({ error: 'Apenas proprietários e equipe operacional podem ser desativados' }, { status: 400 })
  }

  const { error: updateErr } = await adminClient
    .from('profiles').update({ ativo }).eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id, ativo })
}

// DELETE /api/usuarios/[id] — excluir permanentemente um proprietário ou operacional
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response } = await requireAnalista()
  if (response) return response

  const { id } = await params
  const adminClient = getAdminClient()

  const { data: profile, error: profileErr } = await adminClient
    .from('profiles').select('id, role').eq('id', id).single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }
  // Operacional também pode ser excluído: o histórico de limpezas sobrevive
  // (limpezas.operador_id vira NULL e o nome fica guardado em operador_nome).
  if (profile.role !== 'proprietario' && profile.role !== 'operacional') {
    return NextResponse.json({ error: 'Apenas proprietários e equipe operacional podem ser excluídos' }, { status: 400 })
  }

  // 1. Remover vínculos (defensivo — ON DELETE CASCADE cobre, mas garante consistência)
  const { error: vinculosErr } = await adminClient
    .from('proprietario_apartamentos').delete().eq('proprietario_id', id)
  if (vinculosErr) {
    return NextResponse.json({ error: `Erro ao remover vínculos: ${vinculosErr.message}` }, { status: 500 })
  }

  // 2. Remover profile
  const { error: deleteProfileErr } = await adminClient
    .from('profiles').delete().eq('id', id)
  if (deleteProfileErr) {
    return NextResponse.json({ error: `Erro ao remover perfil: ${deleteProfileErr.message}` }, { status: 500 })
  }

  // 3. Remover do Auth
  const { error: deleteAuthErr } = await adminClient.auth.admin.deleteUser(id)
  if (deleteAuthErr) {
    return NextResponse.json({ error: `Erro ao remover autenticação: ${deleteAuthErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, id })
}

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function getAuthContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, role: null }
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  return { user, role: profile?.role ?? null }
}

function isAuthorized(req: NextRequest, role: string | null): boolean {
  if (role === 'analista') return true
  const internalKey = process.env.ALUGUEASY_INTERNAL_API_KEY
  if (internalKey && req.headers.get('x-alugueasy-internal-key') === internalKey) return true
  return false
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, role } = await getAuthContext()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!isAuthorized(request, role))
    return NextResponse.json({ error: 'Apenas analistas podem editar diárias' }, { status: 403 })

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const body = await request.json()
  const { valor } = body as { valor?: number }

  if (valor === undefined || typeof valor !== 'number' || valor < 0)
    return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

  const adminSupabase = createAdminClient()

  const { data: diaria, error: findErr } = await adminSupabase
    .from('diarias')
    .select('id, valor, apartamento_id')
    .eq('id', id)
    .single()

  if (findErr || !diaria)
    return NextResponse.json({ error: 'Diária não encontrada' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (adminSupabase as any)
    .from('diarias')
    .update({ valor })
    .eq('id', id)
    .select('id, valor, data, tipo_gestao')
    .single() as { data: { id: string; valor: number; data: string; tipo_gestao: string } | null; error: { message: string } | null }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 })

  return NextResponse.json({
    success: true,
    diaria: data,
    mensagem: `Diária atualizada → R$ ${data.valor}`,
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, role } = await getAuthContext()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!isAuthorized(request, role))
    return NextResponse.json({ error: 'Apenas analistas podem excluir diárias' }, { status: 403 })

  const { id } = await params
  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase.from('diarias').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

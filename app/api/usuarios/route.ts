import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Cliente admin (service_role) — único que pode criar usuários no Auth
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada')
  return createAdminClient(url, key)
}

export async function POST(request: NextRequest) {
  // ── Autenticação e permissão ─────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'analista') {
    return NextResponse.json({ error: 'Apenas analistas podem cadastrar usuários' }, { status: 403 })
  }

  // ── Validar body ─────────────────────────────────────────────────────────
  const body = await request.json()
  const { full_name, email, password, role, apartamento_ids } = body as {
    full_name: string
    email: string
    password: string
    role: 'admin' | 'analista' | 'proprietario'
    apartamento_ids?: string[]
  }

  if (!full_name?.trim() || !email?.trim() || !password || !role) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
  }
  if (!['admin', 'analista', 'proprietario'].includes(role)) {
    return NextResponse.json({ error: 'Role inválido' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
  }

  // ── Criar usuário no Supabase Auth (service_role) ────────────────────────
  let adminClient
  try {
    adminClient = getAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY ausente' },
      { status: 500 }
    )
  }

  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name.trim() },
  })

  if (createErr || !newUser?.user) {
    const msg = createErr?.message ?? 'Erro desconhecido ao criar usuário'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  // ── Criar/atualizar perfil na tabela profiles ────────────────────────────
  const { error: profileErr } = await adminClient
    .from('profiles')
    .upsert({
      id: newUser.user.id,
      full_name: full_name.trim(),
      role,
    })

  if (profileErr) {
    // Rollback: remove o usuário criado
    await adminClient.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json(
      { error: `Erro ao salvar perfil: ${profileErr.message}` },
      { status: 500 }
    )
  }

  // Vincular apartamentos se role for proprietario e apartamento_ids foi fornecido
  if (role === 'proprietario' && Array.isArray(apartamento_ids) && apartamento_ids.length > 0) {
    await adminClient
      .from('proprietario_apartamentos')
      .upsert(
        apartamento_ids.map(apartamento_id => ({
          proprietario_id: newUser.user.id,
          apartamento_id,
          ativo: true,
        })),
        { onConflict: 'proprietario_id,apartamento_id' }
      )
  }

  return NextResponse.json({
    success: true,
    user: { id: newUser.user.id, full_name: full_name.trim(), email: email.trim(), role },
  })
}

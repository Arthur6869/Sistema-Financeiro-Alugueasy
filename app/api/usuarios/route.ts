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

async function verificarAnalista() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { erro: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }), user: null }
  }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'analista') {
    return { erro: NextResponse.json({ error: 'Apenas analistas podem gerenciar usuários' }, { status: 403 }), user: null }
  }

  return { erro: null, user }
}

async function validarProprietario(userId: string) {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single()

  if (!profile) {
    return { erro: NextResponse.json({ error: 'Proprietário não encontrado' }, { status: 404 }) }
  }

  if (profile.role !== 'proprietario') {
    return { erro: NextResponse.json({ error: 'Apenas proprietários podem ser editados nesta ação' }, { status: 400 }) }
  }

  return { erro: null }
}

export async function GET(request: NextRequest) {
  const { erro } = await verificarAnalista()
  if (erro) return erro

  const userId = request.nextUrl.searchParams.get('user_id')
  if (!userId) {
    return NextResponse.json({ error: 'user_id é obrigatório' }, { status: 400 })
  }

  const validacao = await validarProprietario(userId)
  if (validacao.erro) return validacao.erro

  let adminClient
  try {
    adminClient = getAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY ausente' },
      { status: 500 }
    )
  }

  const { data, error } = await adminClient.auth.admin.getUserById(userId)
  if (error || !data?.user) {
    return NextResponse.json({ error: error?.message ?? 'Usuário não encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email ?? '',
    },
  })
}

export async function POST(request: NextRequest) {
  // ── Autenticação e permissão ─────────────────────────────────────────────
  const { erro } = await verificarAnalista()
  if (erro) return erro

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

export async function PATCH(request: NextRequest) {
  const { erro } = await verificarAnalista()
  if (erro) return erro

  const body = await request.json()
  const { user_id, email, password } = body as {
    user_id: string
    email?: string
    password?: string
  }

  if (!user_id) {
    return NextResponse.json({ error: 'user_id é obrigatório' }, { status: 400 })
  }

  const emailNormalizado = email?.trim()
  const senhaNormalizada = password?.trim()

  if (!emailNormalizado && !senhaNormalizada) {
    return NextResponse.json({ error: 'Informe ao menos email ou senha para atualizar' }, { status: 400 })
  }

  if (email !== undefined && !emailNormalizado) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  if (senhaNormalizada && senhaNormalizada.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
  }

  const validacao = await validarProprietario(user_id)
  if (validacao.erro) return validacao.erro

  let adminClient
  try {
    adminClient = getAdminClient()
  } catch {
    return NextResponse.json(
      { error: 'Configuração do servidor incompleta: SUPABASE_SERVICE_ROLE_KEY ausente' },
      { status: 500 }
    )
  }

  const updatePayload: { email?: string; password?: string; email_confirm?: boolean } = {}
  if (emailNormalizado) {
    updatePayload.email = emailNormalizado
    updatePayload.email_confirm = true
  }
  if (senhaNormalizada) {
    updatePayload.password = senhaNormalizada
  }

  const { data, error } = await adminClient.auth.admin.updateUserById(user_id, updatePayload)
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'Falha ao atualizar credenciais' }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    user: { id: data.user.id, email: data.user.email ?? emailNormalizado ?? '' },
  })
}

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function verificarAnalista(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, erro: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'analista') return { user: null, erro: NextResponse.json({ error: 'Apenas analistas podem gerenciar vínculos' }, { status: 403 }) }

  return { user, erro: null }
}

// GET ?proprietario_id=uuid — lista vínculos de um proprietário
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const proprietarioId = request.nextUrl.searchParams.get('proprietario_id')
  if (!proprietarioId) return NextResponse.json({ error: 'proprietario_id obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('proprietario_apartamentos')
    .select('id, ativo, apartamentos(id, numero, tipo_gestao, taxa_repasse, tipo_repasse, empreendimentos(nome))')
    .eq('proprietario_id', proprietarioId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ vinculos: data })
}

// POST — vincula apartamentos a um proprietário
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { erro } = await verificarAnalista(supabase)
  if (erro) return erro

  const body = await request.json()
  const { proprietario_id, apartamento_ids } = body as {
    proprietario_id: string
    apartamento_ids: string[]
  }

  if (!proprietario_id || !Array.isArray(apartamento_ids) || apartamento_ids.length === 0) {
    return NextResponse.json({ error: 'proprietario_id e apartamento_ids são obrigatórios' }, { status: 400 })
  }

  const registros = apartamento_ids.map(apartamento_id => ({
    proprietario_id,
    apartamento_id,
    ativo: true,
  }))

  const { error } = await supabase
    .from('proprietario_apartamentos')
    .upsert(registros, { onConflict: 'proprietario_id,apartamento_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, vinculados: apartamento_ids.length })
}

// DELETE — soft delete de vínculo (ativo = false) ou remoção por IDs
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { erro } = await verificarAnalista(supabase)
  if (erro) return erro

  const body = await request.json()
  const { proprietario_id, apartamento_id } = body as {
    proprietario_id: string
    apartamento_id: string
  }

  if (!proprietario_id || !apartamento_id) {
    return NextResponse.json({ error: 'proprietario_id e apartamento_id são obrigatórios' }, { status: 400 })
  }

  const { error } = await supabase
    .from('proprietario_apartamentos')
    .update({ ativo: false })
    .eq('proprietario_id', proprietario_id)
    .eq('apartamento_id', apartamento_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// PATCH — sincroniza vínculos: recebe lista completa de apt_ids ativos para um proprietário
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { erro } = await verificarAnalista(supabase)
  if (erro) return erro

  const body = await request.json()
  const { proprietario_id, apartamento_ids_ativos } = body as {
    proprietario_id: string
    apartamento_ids_ativos: string[]
  }

  if (!proprietario_id || !Array.isArray(apartamento_ids_ativos)) {
    return NextResponse.json({ error: 'proprietario_id e apartamento_ids_ativos são obrigatórios' }, { status: 400 })
  }

  // Buscar vínculos existentes
  const { data: existentes } = await supabase
    .from('proprietario_apartamentos')
    .select('id, apartamento_id, ativo')
    .eq('proprietario_id', proprietario_id)

  const existentesMap = new Map((existentes ?? []).map(e => [e.apartamento_id, e]))

  // Calcular diff
  const toUpsert: { proprietario_id: string; apartamento_id: string; ativo: boolean }[] = []

  for (const aptId of apartamento_ids_ativos) {
    const existente = existentesMap.get(aptId)
    if (!existente || !existente.ativo) {
      toUpsert.push({ proprietario_id, apartamento_id: aptId, ativo: true })
    }
  }

  // Desativar os que não estão mais na lista
  const toDesativar = (existentes ?? [])
    .filter(e => e.ativo && !apartamento_ids_ativos.includes(e.apartamento_id))
    .map(e => e.apartamento_id)

  if (toUpsert.length > 0) {
    await supabase
      .from('proprietario_apartamentos')
      .upsert(toUpsert, { onConflict: 'proprietario_id,apartamento_id' })
  }

  if (toDesativar.length > 0) {
    await supabase
      .from('proprietario_apartamentos')
      .update({ ativo: false })
      .eq('proprietario_id', proprietario_id)
      .in('apartamento_id', toDesativar)
  }
  return NextResponse.json({ success: true })
}

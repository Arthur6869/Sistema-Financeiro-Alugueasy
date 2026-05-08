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

export async function POST(request: NextRequest) {
  const { user, role } = await getAuthContext()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (role !== 'analista') {
    return NextResponse.json({ error: 'Apenas analistas podem inserir diárias' }, { status: 403 })
  }

  const body = await request.json()
  const apartamento_id = String(body.apartamento_id ?? '').trim()
  const data = String(body.data ?? '').trim()
  const tipo_gestao = String(body.tipo_gestao ?? '').trim()
  const valor = typeof body.valor === 'number' ? body.valor : parseFloat(String(body.valor ?? '').replace(',', '.'))

  if (!apartamento_id) return NextResponse.json({ error: 'Apartamento não informado' }, { status: 400 })
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: 'Data inválida (use YYYY-MM-DD)' }, { status: 400 })
  if (!['adm', 'sub'].includes(tipo_gestao)) return NextResponse.json({ error: 'Tipo de gestão inválido' }, { status: 400 })
  if (isNaN(valor) || valor < 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

  const adminSupabase = createAdminClient()

  const { data: apt, error: aptErr } = await adminSupabase
    .from('apartamentos')
    .select('id, tipo_gestao')
    .eq('id', apartamento_id)
    .single()

  if (aptErr || !apt) return NextResponse.json({ error: 'Apartamento não encontrado' }, { status: 404 })

  const { data: inserted, error: insertErr } = await adminSupabase
    .from('diarias')
    .insert({ apartamento_id, data, tipo_gestao, valor })
    .select('id, data, valor, tipo_gestao, apartamentos(numero, empreendimentos(nome))')
    .single()

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ success: true, diaria: inserted }, { status: 201 })
}

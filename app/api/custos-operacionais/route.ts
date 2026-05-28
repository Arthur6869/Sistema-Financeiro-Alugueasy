import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/custos-operacionais?mes=5&ano=2026
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mes = parseInt(searchParams.get('mes') || '0')
  const ano = parseInt(searchParams.get('ano') || '0')

  if (!mes || !ano) return NextResponse.json({ error: 'mes e ano são obrigatórios' }, { status: 400 })

  const { data, error } = await supabase
    .from('custos_operacionais_variaveis')
    .select('diarias')
    .eq('mes', mes)
    .eq('ano', ano)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ diarias: data?.diarias ?? 0 })
}

// POST /api/custos-operacionais  { mes, ano, diarias }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'analista')
    return NextResponse.json({ error: 'Proibido' }, { status: 403 })

  const body = await request.json()
  const mes = parseInt(body.mes)
  const ano = parseInt(body.ano)
  const diarias = parseInt(body.diarias ?? 0)

  if (!mes || !ano || isNaN(diarias))
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })

  const { error } = await supabase
    .from('custos_operacionais_variaveis')
    .upsert({ mes, ano, diarias, updated_at: new Date().toISOString() }, { onConflict: 'mes,ano' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, diarias })
}

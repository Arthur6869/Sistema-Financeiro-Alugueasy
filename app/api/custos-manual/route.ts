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
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  return { supabase, user, role: profile?.role ?? null, fullName: profile?.full_name ?? null }
}

export async function GET(request: NextRequest) {
  const { supabase, user } = await getAuthContext()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mes = Number(searchParams.get('mes'))
  const ano = Number(searchParams.get('ano'))
  const tipoGestao = searchParams.get('tipo_gestao')
  const empreendimentoId = searchParams.get('empreendimento_id')

  if (!mes || !ano || !['adm', 'sub'].includes(tipoGestao ?? '')) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  let query = supabase
    .from('custos')
    .select(`
      id, mes, ano, categoria, valor, tipo_gestao, observacao, origem, criado_por, created_at,
      apartamentos!inner(id, numero, empreendimento_id, empreendimentos(nome))
    `)
    .eq('mes', mes)
    .eq('ano', ano)
    .eq('tipo_gestao', tipoGestao)
    .order('created_at', { ascending: false })

  if (empreendimentoId) {
    query = query.eq('apartamentos.empreendimento_id', empreendimentoId)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type CustoRow = {
    id: string
    mes: number
    ano: number
    categoria: string
    valor: number
    tipo_gestao: 'adm' | 'sub'
    observacao: string | null
    origem: 'manual' | 'importacao' | null
    apartamentos?: {
      numero?: string
      empreendimentos?: { nome?: string } | null
    } | null
  }

  const result = ((data ?? []) as CustoRow[]).map((row) => ({
    id: row.id,
    mes: row.mes,
    ano: row.ano,
    categoria: row.categoria,
    valor: Number(row.valor ?? 0),
    tipo_gestao: row.tipo_gestao,
    observacao: row.observacao ?? null,
    origem: row.origem ?? 'importacao',
    empreendimento_nome: row.apartamentos?.empreendimentos?.nome ?? '—',
    apartamento_numero: row.apartamentos?.numero ?? '—',
    criado_por_nome: null,
  }))

  return NextResponse.json({ data: result })
}

export async function POST(request: NextRequest) {
  const { supabase, user, role } = await getAuthContext()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (role !== 'analista') {
    return NextResponse.json({ error: 'Apenas analistas podem lançar custos manualmente' }, { status: 403 })
  }

  const body = await request.json()
  const apartamentoId = String(body.apartamento_id ?? '').trim()
  const mes = Number(body.mes)
  const ano = Number(body.ano)
  const tipoGestao = String(body.tipo_gestao ?? '').trim()
  const categoria = String(body.categoria ?? '').trim()
  const valor = parseNumero(body.valor)
  const observacao = body.observacao ? String(body.observacao).trim() : null

  if (!apartamentoId || !categoria || !mes || !ano || !['adm', 'sub'].includes(tipoGestao) || isNaN(valor) || valor <= 0) {
    return NextResponse.json({ error: 'Dados inválidos para lançamento de custo' }, { status: 400 })
  }
  if (mes < 1 || mes > 12 || ano < 2020) {
    return NextResponse.json({ error: 'Competência inválida' }, { status: 400 })
  }

  const { data: apt, error: aptErr } = await supabase
    .from('apartamentos')
    .select('id, tipo_gestao')
    .eq('id', apartamentoId)
    .single()

  if (aptErr || !apt) {
    return NextResponse.json({ error: 'Apartamento não encontrado' }, { status: 404 })
  }
  if (apt.tipo_gestao && apt.tipo_gestao !== tipoGestao) {
    return NextResponse.json({ error: 'Tipo de gestão não compatível com o apartamento selecionado' }, { status: 400 })
  }

  const { data: duplicado } = await supabase
    .from('custos')
    .select('id')
    .eq('apartamento_id', apartamentoId)
    .eq('mes', mes)
    .eq('ano', ano)
    .eq('categoria', categoria)
    .eq('tipo_gestao', tipoGestao)
    .eq('valor', valor)
    .maybeSingle()

  if (duplicado) {
    return NextResponse.json({ error: 'Já existe um custo idêntico para este apartamento na competência selecionada' }, { status: 409 })
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('custos')
    .insert({
      apartamento_id: apartamentoId,
      mes,
      ano,
      categoria,
      valor,
      tipo_gestao: tipoGestao,
      observacao,
      origem: 'manual',
      criado_por: user.id,
    })
    .select('id')
    .single()

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, id: inserted.id }, { status: 201 })
}

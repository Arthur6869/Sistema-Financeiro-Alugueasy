import { requireAnalista } from '@/lib/api-auth'
import { COLUNAS_CONTA, normalizarConta, validarConta } from '@/lib/custos-operacionais'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/custos-operacionais/contas — cria uma conta no plano de contas. Só analista.
export async function POST(request: NextRequest) {
  const { supabase, response } = await requireAnalista()
  if (response) return response

  const validado = validarConta(await request.json().catch(() => null), false)
  if ('erro' in validado) return NextResponse.json({ error: validado.erro }, { status: 400 })
  const { campos } = validado

  // A conta nova entra no fim do grupo dela
  const { data: doGrupo } = await supabase
    .from('custos_operacionais_contas')
    .select('ordem')
    .eq('grupo', campos.grupo!)
    .order('ordem', { ascending: false })
    .limit(1)
  const { data: ultima } = await supabase
    .from('custos_operacionais_contas')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
  const ordem = (doGrupo?.[0]?.ordem ?? ultima?.[0]?.ordem ?? 0) + 10

  const { data, error } = await supabase
    .from('custos_operacionais_contas')
    .insert({ ...campos, ordem })
    .select(COLUNAS_CONTA)
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Já existe uma conta com o código ${campos.codigo}` }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ conta: normalizarConta(data) }, { status: 201 })
}

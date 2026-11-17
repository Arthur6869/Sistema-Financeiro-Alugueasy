import { requireAnalista } from '@/lib/api-auth'
import { COLUNAS_CONTA, ehUuid, normalizarConta, validarConta } from '@/lib/custos-operacionais'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/custos-operacionais/contas/:id — altera uma conta (inclusive encerrar/reabrir). Só analista.
//
// Não existe DELETE de propósito: conta com valor lançado não pode sumir (o
// banco recusa), e conta sem uso se encerra (`ativo: false`).
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, response } = await requireAnalista()
  if (response) return response

  const { id } = await context.params
  if (!ehUuid(id)) return NextResponse.json({ error: 'Conta inválida' }, { status: 400 })

  const validado = validarConta(await request.json().catch(() => null), true)
  if ('erro' in validado) return NextResponse.json({ error: validado.erro }, { status: 400 })
  const { campos } = validado
  if (Object.keys(campos).length === 0) return NextResponse.json({ error: 'Nada para alterar' }, { status: 400 })

  const { data, error } = await supabase
    .from('custos_operacionais_contas')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLUNAS_CONTA)
    .maybeSingle()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Já existe uma conta com o código ${campos.codigo}` }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
  return NextResponse.json({ conta: normalizarConta(data) })
}

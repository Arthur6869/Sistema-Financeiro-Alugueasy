import { requireAnalista } from '@/lib/api-auth'
import { COLUNAS_LANCAMENTO, normalizarLancamento, validarLancamento } from '@/lib/custos-operacionais'
import { NextRequest, NextResponse } from 'next/server'

// PUT /api/custos-operacionais/lancamentos  { conta_id, mes, ano, valor }
//
// Define o valor de UMA conta em UM mês. Só analista (e a RLS da tabela repete
// a regra: a gravação vai com a sessão do usuário, não com a chave de serviço).
//   valor > 0        → grava (cria ou substitui — a tabela aceita um valor por conta/mês)
//   valor nulo ou 0  → tira o valor do mês
export async function PUT(request: NextRequest) {
  const { supabase, response } = await requireAnalista()
  if (response) return response

  const dados = validarLancamento(await request.json().catch(() => null))
  if ('erro' in dados) return NextResponse.json({ error: dados.erro }, { status: 400 })
  const { conta_id, mes, ano, valor } = dados

  if (valor === null) {
    const { error } = await supabase
      .from('custos_operacionais_lancamentos')
      .delete()
      .eq('conta_id', conta_id).eq('mes', mes).eq('ano', ano)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ lancamento: null })
  }

  const { data, error } = await supabase
    .from('custos_operacionais_lancamentos')
    // `origem: 'manual'`: um valor vindo da planilha e corrigido aqui passa a ser manual
    .upsert({ conta_id, mes, ano, valor, origem: 'manual', updated_at: new Date().toISOString() }, { onConflict: 'conta_id,mes,ano' })
    .select(COLUNAS_LANCAMENTO)
    .single()

  if (error) {
    // 23503: a conta não existe (ou foi apagada enquanto a tela estava aberta)
    if (error.code === '23503') return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ lancamento: normalizarLancamento(data) })
}

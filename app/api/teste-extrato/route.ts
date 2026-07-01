import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { enviarExtratoProprietario } from '@/lib/enviar-extrato-core'
import { NextRequest, NextResponse } from 'next/server'

const TEST_EMAIL = 'arthuralugueasy@gmail.com'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'analista') {
    return NextResponse.json({ error: 'Apenas analistas podem executar o teste' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const now = new Date()
  const mes = typeof body.mes === 'number' ? body.mes : (now.getMonth() === 0 ? 12 : now.getMonth())
  const ano = typeof body.ano === 'number' ? body.ano : (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear())

  const admin = createAdminClient()
  const { data: proprietarios } = await admin
    .from('profiles').select('id, full_name').eq('role', 'proprietario').limit(5)

  if (!proprietarios || proprietarios.length === 0) {
    return NextResponse.json({ error: 'Nenhum proprietário cadastrado no sistema' }, { status: 404 })
  }

  const resultados = []
  for (const prop of proprietarios as Array<{ id: string; full_name: string }>) {
    const result = await enviarExtratoProprietario(prop.id, mes, ano, TEST_EMAIL, 'onboarding@resend.dev')
    resultados.push({ proprietario: prop.full_name, ...result })
    if (result.success) break // envia só o primeiro que funcionar
  }

  const sucesso = resultados.find(r => r.success)
  if (sucesso) {
    return NextResponse.json({
      ok: true,
      email_enviado_para: TEST_EMAIL,
      proprietario_usado: sucesso.proprietario,
      apartamentos: sucesso.apartamentos,
      periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    })
  }

  return NextResponse.json({
    ok: false,
    tentativas: resultados,
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
  }, { status: 500 })
}

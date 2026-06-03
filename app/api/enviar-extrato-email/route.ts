import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { enviarExtratoProprietario } from '@/lib/enviar-extrato-core'

export async function POST(request: NextRequest) {
  const internalKey = request.headers.get('x-alugueasy-internal-key')
  const validInternalKey = process.env.ALUGUEASY_INTERNAL_API_KEY

  let autorizado = false

  if (internalKey && validInternalKey && internalKey === validInternalKey) {
    autorizado = true
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'analista') autorizado = true
    }
  }

  if (!autorizado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { proprietario_id, mes, ano } = body as { proprietario_id: string; mes: number; ano: number }

  if (!proprietario_id || !mes || !ano) {
    return NextResponse.json({ error: 'proprietario_id, mes e ano são obrigatórios' }, { status: 400 })
  }

  const result = await enviarExtratoProprietario(proprietario_id, mes, ano)

  if (!result.success) {
    const status = result.error?.includes('não encontrado') ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({
    success: true,
    email_enviado_para: result.email_enviado_para,
    apartamentos: result.apartamentos,
    mes, ano,
  })
}

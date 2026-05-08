import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'analista') return NextResponse.json({ error: 'Proibido' }, { status: 403 })

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any

  // Buscar ID do ATHOS
  const { data: emp } = await adminAny.from('empreendimentos').select('id').eq('nome', 'ATHOS').single()
  if (!emp) return NextResponse.json({ error: 'Empreendimento ATHOS não encontrado' }, { status: 404 })

  // Antes: listar estado atual
  const { data: antes } = await adminAny
    .from('apartamentos')
    .select('numero, tipo_gestao')
    .eq('empreendimento_id', emp.id)
    .in('numero', ['1101', '812'])

  // Corrigir
  const { data: updated, error } = await adminAny
    .from('apartamentos')
    .update({ tipo_gestao: 'sub' })
    .eq('empreendimento_id', emp.id)
    .in('numero', ['1101', '812'])
    .select('numero, tipo_gestao')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, antes, depois: updated })
}

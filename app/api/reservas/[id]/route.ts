import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

async function getAuthContext(request: NextRequest) {
  const internalKey = request.headers.get('x-alugueasy-internal-key')
  const isInternal = !!internalKey && internalKey === process.env.ALUGUEASY_INTERNAL_API_KEY

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, authorized: false }

  if (isInternal) return { user, authorized: true }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  return { user, authorized: profile?.role === 'analista' }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await getAuthContext(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!authorized)
    return NextResponse.json({ error: 'Apenas analistas podem editar reservas' }, { status: 403 })

  const { id } = await params

  const body = await request.json()
  const {
    valor_bruto,
    valor_liquido,
    plataforma_normalizada,
    individual_room_number,
    nome_hospede,
    checkin,
    checkout,
  } = body as {
    valor_bruto?: number
    valor_liquido?: number
    plataforma_normalizada?: string
    individual_room_number?: string
    nome_hospede?: string
    checkin?: string
    checkout?: string
  }

  if (valor_liquido !== undefined && valor_liquido < 0)
    return NextResponse.json({ error: 'Valor líquido não pode ser negativo' }, { status: 400 })
  if (valor_bruto !== undefined && valor_bruto < 0)
    return NextResponse.json({ error: 'Valor bruto não pode ser negativo' }, { status: 400 })
  if (valor_liquido !== undefined && valor_bruto !== undefined && valor_liquido > valor_bruto)
    return NextResponse.json({ error: 'Valor líquido não pode ser maior que o bruto' }, { status: 400 })

  const adminSupabase = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = adminSupabase as any

  const { data: reserva, error: findErr } = await admin
    .from('amenitiz_reservas')
    .select('id, booking_id, valor_liquido, valor_bruto')
    .eq('id', id)
    .single() as { data: { id: string; booking_id: string; valor_liquido: number; valor_bruto: number } | null; error: unknown }

  if (findErr || !reserva)
    return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (valor_bruto !== undefined) update.valor_bruto = valor_bruto
  if (valor_liquido !== undefined) update.valor_liquido = valor_liquido
  if (plataforma_normalizada !== undefined) update.plataforma_normalizada = plataforma_normalizada.trim()
  if (individual_room_number !== undefined) update.individual_room_number = individual_room_number.trim()
  if (nome_hospede !== undefined) update.nome_hospede = nome_hospede.trim()
  if (checkin !== undefined) update.checkin = checkin
  if (checkout !== undefined) update.checkout = checkout

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })

  const brutoFinal = valor_bruto ?? reserva.valor_bruto
  const liquidoFinal = valor_liquido ?? reserva.valor_liquido
  if (liquidoFinal > brutoFinal)
    return NextResponse.json({ error: 'Valor líquido não pode ser maior que o bruto' }, { status: 400 })

  const { data, error } = await admin
    .from('amenitiz_reservas')
    .update(update)
    .eq('id', id)
    .select('id, booking_id, checkin, checkout, valor_bruto, valor_liquido, plataforma_normalizada, individual_room_number, nome_hospede')
    .single() as { data: Record<string, unknown> | null; error: { message: string } | null }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 })

  return NextResponse.json({
    success: true,
    reserva: data,
    campos_atualizados: Object.keys(update),
    mensagem: `Reserva ${reserva.booking_id} atualizada`,
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, authorized } = await getAuthContext(request)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!authorized)
    return NextResponse.json({ error: 'Apenas analistas podem excluir reservas' }, { status: 403 })

  const { id } = await params
  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase.from('amenitiz_reservas').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('=== TODOS OS APARTAMENTOS ATHOS — room_ids ===\n')

  const { data: emps } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .ilike('nome', '%athos%')

  if (!emps?.length) {
    console.error('Empreendimento ATHOS não encontrado!')
    return
  }
  const athosId = emps[0].id
  console.log(`Empreendimento: ${emps[0].nome} (id: ${athosId})\n`)

  const { data: apts } = await supabase
    .from('apartamentos')
    .select('id, numero, tipo_gestao, amenitiz_room_id')
    .eq('empreendimento_id', athosId)
    .order('numero')

  console.table(apts?.map(a => ({
    numero: a.numero,
    tipo_gestao: a.tipo_gestao,
    amenitiz_room_id: a.amenitiz_room_id ?? 'NULL',
    room_id_curto: a.amenitiz_room_id?.slice(0, 8) ?? 'NULL',
  })))

  // Detectar UUIDs duplicados entre apartamentos
  const roomIds = apts?.map(a => a.amenitiz_room_id).filter(Boolean) ?? []
  const duplicados = roomIds.filter((id, i) => roomIds.indexOf(id) !== i)

  if (duplicados.length > 0) {
    console.log('\n⚠️  UUIDs DUPLICADOS ENCONTRADOS:')
    duplicados.forEach(id => {
      const aptsComEsteId = apts?.filter(a => a.amenitiz_room_id === id)
      console.log(`  UUID ${id?.slice(0, 8)}... → apts: ${aptsComEsteId?.map(a => a.numero).join(', ')}`)
    })
  } else {
    console.log('\n✅ Nenhum UUID duplicado — colisão já resolvida')
  }

  // Verificar diárias jan/2026 para ATHOS
  console.log('\n=== DIÁRIAS ATHOS JAN/2026 ===')
  const aptIds = apts?.map(a => a.id) ?? []
  const { data: diarias } = await supabase
    .from('diarias')
    .select('valor, apartamento_id')
    .in('apartamento_id', aptIds)
    .gte('data', '2026-01-01')
    .lte('data', '2026-01-31')

  if (!diarias || diarias.length === 0) {
    console.log('Nenhuma diária encontrada para ATHOS em jan/2026')
  } else {
    const aptNumMap: Record<string, string> = {}
    apts?.forEach(a => { aptNumMap[a.id] = a.numero })
    console.table(diarias.map(d => ({
      apt: aptNumMap[d.apartamento_id] ?? d.apartamento_id.slice(0, 8),
      valor: d.valor,
    })))
  }

  // Verificar reservas Amenitiz jan/2026 que mencionam quartos ATHOS
  console.log('\n=== RESERVAS AMENITIZ JAN/2026 — quartos ATHOS ===')
  const numerosAthos = apts?.map(a => String(a.numero)) ?? []
  const { data: reservas } = await supabase
    .from('amenitiz_reservas')
    .select('individual_room_number, valor_liquido, nome_hospede, checkin, checkout, status')
    .eq('mes_competencia', 1)
    .eq('ano_competencia', 2026)
    .in('individual_room_number', numerosAthos)

  if (!reservas || reservas.length === 0) {
    console.log('Nenhuma reserva Amenitiz encontrada para quartos ATHOS em jan/2026')
    console.log('→ Verificar se sync foi executado para jan/2026')

    // Também buscar pela room_id fallback pattern
    console.log('\n=== RESERVAS COM PADRÃO "room:*" (fallback room_id) ===')
    const { data: reservasRoomId } = await supabase
      .from('amenitiz_reservas')
      .select('individual_room_number, individual_room_name, valor_liquido, checkin, checkout, status')
      .eq('mes_competencia', 1)
      .eq('ano_competencia', 2026)
      .like('individual_room_number', 'room:%')

    if (!reservasRoomId?.length) {
      console.log('Nenhuma reserva com padrão room_id fallback')
    } else {
      console.table(reservasRoomId.map(r => ({
        room_number: r.individual_room_number,
        room_name: r.individual_room_name?.slice(0, 40),
        checkin: r.checkin,
        valor: r.valor_liquido,
        status: r.status,
      })))
    }
  } else {
    console.table(reservas.map(r => ({
      quarto: r.individual_room_number,
      hospede: r.nome_hospede?.slice(0, 30),
      checkin: r.checkin,
      checkout: r.checkout,
      valor: r.valor_liquido,
      status: r.status,
    })))
  }
}

main().catch(console.error)

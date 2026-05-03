import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('=== AUDITORIA COMPLETA DE UUID AMENITIZ ===\n')

  const { data: apts } = await supabase
    .from('apartamentos')
    .select('id, numero, amenitiz_room_id, empreendimentos(nome)')
    .order('empreendimento_id')

  // Detectar duplicatas globais
  const mapa: Record<string, { numero: string; emp: string }[]> = {}
  for (const a of apts ?? []) {
    const rid = (a as any).amenitiz_room_id
    if (!rid) continue
    if (!mapa[rid]) mapa[rid] = []
    mapa[rid].push({
      numero: a.numero,
      emp: ((a as any).empreendimentos as any)?.nome ?? '?',
    })
  }

  const conflitos = Object.entries(mapa).filter(([, list]) => list.length > 1)

  if (conflitos.length === 0) {
    console.log('✅ Nenhum UUID duplicado em todo o sistema\n')
  } else {
    console.log(`⚠️  ${conflitos.length} UUID(s) com conflito:\n`)
    conflitos.forEach(([uuid, apts]) => {
      console.log(`  UUID: ${uuid.slice(0, 8)}...`)
      apts.forEach(a => console.log(`    → ${a.emp} apt ${a.numero}`))
    })
  }

  // Resumo de cobertura
  const todos = apts ?? []
  const comRoomId = todos.filter(a => (a as any).amenitiz_room_id)
  const semRoomId = todos.filter(a => !(a as any).amenitiz_room_id)

  console.log(`\n=== COBERTURA GERAL ===`)
  console.log(`Total de apartamentos: ${todos.length}`)
  console.log(`Com amenitiz_room_id:  ${comRoomId.length} (${Math.round(comRoomId.length / todos.length * 100)}%)`)
  console.log(`Sem amenitiz_room_id:  ${semRoomId.length}`)

  if (semRoomId.length > 0) {
    console.log('\nApartamentos SEM room_id (dependem só do parsing por nome):')
    semRoomId.forEach(a =>
      console.log(`  ${((a as any).empreendimentos as any)?.nome ?? '?'} apt ${a.numero}`)
    )
  }
}

main().catch(console.error)

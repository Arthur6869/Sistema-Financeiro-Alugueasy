import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import * as path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── mapeamentos confirmados via fetch-amenitiz-rooms.ts (29/04/2026) ────────
const MAPEAMENTOS_CONFIRMADOS: Array<{
  numero: string
  empreendimento: string
  amenitiz_room_id: string
}> = [
  // 007 — BRISAS B119
  { numero: 'B119',        empreendimento: 'BRISAS',        amenitiz_room_id: 'da16ed3a-cf0e-41b6-a109-9cf0353fe20b' },
  // 008 — demais empreendimentos
  { numero: '1709',        empreendimento: 'FUSION',        amenitiz_room_id: '968a704e-20fa-4432-85e4-34657adee7aa' },
  { numero: '803',         empreendimento: 'NOBILE',        amenitiz_room_id: '468805a9-db1d-4d58-9faa-4adf58189b0e' },
  { numero: '812',         empreendimento: 'ATHOS',         amenitiz_room_id: '4460cedb-4cb2-4f26-b104-3d19cfc76532' },
  { numero: '1209',        empreendimento: 'ATHOS',         amenitiz_room_id: '806d43eb-f08d-45e2-9e09-21ca1a4f4878' },
  { numero: '1101',        empreendimento: 'ATHOS',         amenitiz_room_id: '762ab4fb-6069-4968-9ca4-d7f6f6f56342' },
  { numero: '1016',        empreendimento: 'ATHOS',         amenitiz_room_id: '27ebb147-a8bc-4852-9fb5-20c4193f7939' },
  { numero: '1304',        empreendimento: 'CULLINAN',      amenitiz_room_id: 'b5bd8440-d74d-45fc-ade9-723861afe6f4' },
  { numero: '220',         empreendimento: 'VISION',        amenitiz_room_id: 'c9b3c489-1338-45a9-89c2-8ac77748f389' },
  { numero: '106',         empreendimento: 'RAMADA',        amenitiz_room_id: '6b923082-dac5-4b53-b679-2fbe18ce3c4f' },
  { numero: '606',         empreendimento: 'RAMADA',        amenitiz_room_id: 'a2477c2a-0e0c-4343-8d55-ff6e0b5bbc70' },
  { numero: '1615A - 1615',empreendimento: 'METROPOLITAN',  amenitiz_room_id: '037dc1ea-79a1-4ae0-be38-159b84951331' },
  { numero: '1701 - 1701A',empreendimento: 'METROPOLITAN',  amenitiz_room_id: '64cd95af-3478-4ad4-adb3-20ad72237c17' },
]

async function main() {
  console.log('🔍 Estado atual — apartamentos sem amenitiz_room_id:')
  const { data: antes } = await supabase
    .from('apartamentos')
    .select('numero, empreendimentos(nome)')
    .is('amenitiz_room_id', null)
    .order('empreendimento_id')

  console.table(antes?.map(a => ({
    numero: a.numero,
    empreendimento: (a.empreendimentos as any)?.nome
  })))
  console.log(`Total sem room_id ANTES: ${antes?.length ?? 0}\n`)

  const reais = MAPEAMENTOS_CONFIRMADOS.filter(
    m => !m.amenitiz_room_id.startsWith('PREENCHER')
  )
  console.log(`🚀 Aplicando ${reais.length} mapeamentos confirmados...\n`)

  let ok = 0, erros = 0, naoEncontrado = 0

  for (const m of reais) {
    const { data: emp } = await supabase
      .from('empreendimentos')
      .select('id')
      .ilike('nome', `%${m.empreendimento}%`)
      .limit(1)
      .single()

    if (!emp) {
      console.error(`  ❌ Empreendimento não encontrado: ${m.empreendimento}`)
      erros++
      continue
    }

    const { data, error } = await supabase
      .from('apartamentos')
      .update({ amenitiz_room_id: m.amenitiz_room_id })
      .eq('numero', m.numero)
      .eq('empreendimento_id', emp.id)
      .select('numero, amenitiz_room_id')

    if (error) {
      console.error(`  ❌ ${m.empreendimento} apt ${m.numero}: ${error.message}`)
      erros++
    } else if (!data || data.length === 0) {
      console.warn(`  ⚠️  ${m.empreendimento} apt ${m.numero}: não encontrado no banco`)
      naoEncontrado++
    } else {
      console.log(`  ✅ ${m.empreendimento} apt ${m.numero} → ${m.amenitiz_room_id.slice(0,8)}...`)
      ok++
    }
  }

  console.log(`\nResumo: ✅ ${ok} ok | ❌ ${erros} erro(s) | ⚠️ ${naoEncontrado} não encontrado(s)\n`)

  console.log('🔍 Estado após aplicação:')
  const { data: depois } = await supabase
    .from('apartamentos')
    .select('numero, amenitiz_room_id, empreendimentos(nome)')
    .is('amenitiz_room_id', null)
    .order('empreendimento_id')

  if ((depois?.length ?? 0) === 0) {
    console.log('  ✅ TODOS os apartamentos têm amenitiz_room_id!')
  } else {
    console.log(`  ⚠️  ${depois!.length} ainda sem room_id:`)
    console.table(depois?.map(a => ({
      numero: a.numero,
      empreendimento: (a.empreendimentos as any)?.nome
    })))
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })

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

async function main() {
  // Buscar id do empreendimento BRISAS
  const { data: emp } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .ilike('nome', '%brisas%')

  console.log('\n=== Empreendimento BRISAS ===')
  console.table(emp)

  if (!emp || emp.length === 0) {
    console.log('Empreendimento BRISAS não encontrado.')
    return
  }

  const brisasId = emp[0].id

  // todos os apartamentos do BRISAS
  const { data: apts } = await supabase
    .from('apartamentos')
    .select('id, numero, amenitiz_room_id')
    .eq('empreendimento_id', brisasId)
    .order('numero')

  console.log('\n=== Apartamentos BRISAS no banco ===')
  console.table(apts)

  // verifica quais têm amenitiz_room_id nulo
  const semRoomId = apts?.filter(a => !a.amenitiz_room_id)
  console.log('\n=== Sem amenitiz_room_id ===')
  console.table(semRoomId)

  // quartos Amenitiz pendentes de mapeamento
  console.log('\n=== Room IDs pendentes de mapeamento ===')
  console.log('room_id: 64e4757c — "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago"')
  console.log('room_id: f0caa1ec — "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago 2"')
}

main().catch(console.error)

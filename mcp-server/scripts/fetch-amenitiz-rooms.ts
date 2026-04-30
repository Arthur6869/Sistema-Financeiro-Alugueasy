import * as dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import * as path from 'path'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const API_KEY  = process.env.AMENITIZ_ACCESS_TOKEN ?? ''
const BASE_URL = process.env.AMENITIZ_BASE_URL ?? ''
const HOTEL_UUID = process.env.AMENITIZ_HOTEL_UUID ?? ''
const BATCAVE_ID = process.env.AMENITIZ_BATCAVE_ID ?? ''

if (!API_KEY) {
  console.error('❌ AMENITIZ_ACCESS_TOKEN precisa estar no .env.local')
  process.exit(1)
}
if (!BASE_URL) {
  console.error('❌ AMENITIZ_BASE_URL precisa estar no .env.local')
  process.exit(1)
}
if (!HOTEL_UUID && !BATCAVE_ID) {
  console.error('❌ AMENITIZ_HOTEL_UUID ou AMENITIZ_BATCAVE_ID precisa estar no .env.local')
  process.exit(1)
}

const HEADERS = {
  Authorization: `Bearer ${API_KEY}`,
  Accept: 'application/json',
}

function getHotelIdCandidates(): string[] {
  const candidates: string[] = []
  if (HOTEL_UUID) candidates.push(HOTEL_UUID)
  if (BATCAVE_ID) candidates.push(BATCAVE_ID)
  return candidates
}

let cachedHotelId: string | null = null

async function fetchWithFallback(path: string): Promise<unknown | null> {
  const candidates = cachedHotelId
    ? [cachedHotelId, ...getHotelIdCandidates().filter(h => h !== cachedHotelId)]
    : getHotelIdCandidates()

  for (const hotelId of candidates) {
    const sep = path.includes('?') ? '&' : '?'
    const url = `${BASE_URL}${path}${sep}hotel_id=${hotelId}`
    process.stdout.write(`  GET ${url} ... `)
    let res: Response
    try {
      res = await fetch(url, { headers: HEADERS })
    } catch (e) {
      console.log(`ERRO DE REDE: ${e}`)
      continue
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.log(`HTTP ${res.status} — ${body.slice(0, 80)}`)
      continue
    }
    const data = await res.json()
    console.log(`OK`)
    cachedHotelId = hotelId
    return data
  }
  return null
}

async function fetchBookings(endpoint: 'checkin' | 'created', mes: number, ano: number) {
  const from = `${ano}-${String(mes).padStart(2, '0')}-01`
  const lastDay = new Date(ano, mes, 0).getDate()
  const to = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}`
  const data = await fetchWithFallback(`/bookings/${endpoint}?from=${from}&to=${to}`)
  if (!data) return []
  const arr = Array.isArray(data) ? data : (data as any).data ?? (data as any).bookings ?? []
  return arr as any[]
}

// Apartamentos SEM room_id identificados no banco (teste E2E 29/04/2026)
const SEM_ROOM_ID = [
  { numero: '1709', emp: 'FUSION' },
  { numero: '803',  emp: 'NOBILE' },
  { numero: 'B119', emp: 'BRISAS' },
  { numero: 'D137', emp: 'BRISAS' },
  { numero: 'D138', emp: 'BRISAS' },
  { numero: 'E020', emp: 'BRISAS' },
  { numero: '812',  emp: 'ATHOS' },
  { numero: '1209', emp: 'ATHOS' },
  { numero: '1101', emp: 'ATHOS' },
  { numero: '1016', emp: 'ATHOS' },
  { numero: '11',   emp: 'ATHOS' },
  { numero: '1304', emp: 'CULLINAN' },
  { numero: '220',  emp: 'VISION' },
  { numero: '106',  emp: 'RAMADA' },
  { numero: '606',  emp: 'RAMADA' },
  { numero: '1615A - 1615', emp: 'METROPOLITAN' },
  { numero: '1701 - 1701A', emp: 'METROPOLITAN' },
]

async function main() {
  console.log('🔍 Extraindo quartos únicos de reservas Amenitiz...\n')
  console.log(`BASE_URL:    ${BASE_URL}`)
  console.log(`Hotel UUID:  ${HOTEL_UUID ? HOTEL_UUID.slice(0, 8) + '...' : '(não configurado)'}`)
  console.log(`Batcave ID:  ${BATCAVE_ID || '(não configurado)'}`)
  console.log()

  // Coleta reservas dos últimos 3 meses para maximizar cobertura
  const now = new Date()
  const meses: Array<{ mes: number; ano: number }> = []
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    meses.push({ mes: d.getMonth() + 1, ano: d.getFullYear() })
  }

  const roomMap = new Map<string, { individual_room_id: string; individual_room_name: string; individual_room_number: number }>()

  for (const { mes, ano } of meses) {
    const label = `${String(mes).padStart(2, '0')}/${ano}`
    console.log(`📅 Buscando reservas de ${label}...`)
    const bookings = await fetchBookings('checkin', mes, ano)
    let count = 0
    for (const b of bookings) {
      for (const r of b.rooms ?? []) {
        const id = r.individual_room_id
        if (id && !roomMap.has(id)) {
          roomMap.set(id, {
            individual_room_id: id,
            individual_room_name: r.individual_room_name ?? '',
            individual_room_number: r.individual_room_number ?? 0,
          })
          count++
        }
      }
    }
    console.log(`   → ${bookings.length} reservas, ${count} quartos novos encontrados (total: ${roomMap.size})\n`)
  }

  if (roomMap.size === 0) {
    console.error('❌ Nenhum quarto encontrado. Verifique se há reservas nos últimos 4 meses.')
    process.exit(1)
  }

  const rooms = Array.from(roomMap.values()).sort((a, b) =>
    a.individual_room_name.localeCompare(b.individual_room_name)
  )

  console.log(`\nTotal de quartos únicos encontrados: ${rooms.length}`)
  console.log('='.repeat(80))

  console.log('\n📋 TODOS OS QUARTOS (para mapeamento manual):\n')
  rooms.forEach(r => {
    console.log(`  ${r.individual_room_id}  →  ${r.individual_room_name} (nº ${r.individual_room_number})`)
  })

  console.log('\n' + '='.repeat(80))
  console.log('\n🔗 SQL gerado (match automático com lista de pendentes):\n')

  for (const r of rooms) {
    const matched = SEM_ROOM_ID.find(a =>
      r.individual_room_name.toLowerCase().includes(a.numero.toLowerCase()) ||
      r.individual_room_name.toLowerCase().includes(a.emp.toLowerCase())
    )
    if (!matched) continue // Só mostra os que matcham com pendentes
    console.log(`-- ${r.individual_room_name}`)
    console.log(`UPDATE apartamentos SET amenitiz_room_id = '${r.individual_room_id}'`)
    console.log(`WHERE numero = '${matched.numero}'`)
    console.log(`  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%${matched.emp.toLowerCase()}%' LIMIT 1);`)
    console.log()
  }

  console.log('='.repeat(80))
  console.log('\n⚠️  Apartamentos pendentes SEM match automático:')
  const matched_nums = new Set<string>()
  for (const r of rooms) {
    for (const a of SEM_ROOM_ID) {
      if (r.individual_room_name.toLowerCase().includes(a.numero.toLowerCase()) ||
          r.individual_room_name.toLowerCase().includes(a.emp.toLowerCase())) {
        matched_nums.add(`${a.emp}::${a.numero}`)
      }
    }
  }
  const pendentes = SEM_ROOM_ID.filter(a => !matched_nums.has(`${a.emp}::${a.numero}`))
  if (pendentes.length === 0) {
    console.log('  ✅ Todos os 17 apartamentos pendentes foram matchados automaticamente!')
  } else {
    pendentes.forEach(a => console.log(`  ❌ ${a.emp} apt ${a.numero} — sem reserva nos últimos 4 meses`))
    console.log('\n  → Para estes, mapear manualmente usando a lista completa acima.')
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })

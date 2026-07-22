// Auditoria: compara reservas da API Amenitiz com amenitiz_reservas no Supabase,
// mês a mês, e lista as que estão FALTANDO no banco — em especial as que
// atravessam a virada do mês (check-in em um mês, noites no seguinte).
//
// Rodar da raiz do repo: npx tsx scripts/auditoria-viradas-mes.ts
// Somente leitura — não grava nada.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ApiBooking = {
  booking_id: string
  status: string
  checkin: string
  checkout: string
  total_amount_after_tax: string
  source: string
  booker?: { first_name?: string; last_name?: string }
  rooms?: { individual_room_name?: string }[]
}

async function fetchCheckinMes(mes: number, ano: number): Promise<ApiBooking[]> {
  const baseUrl = process.env.AMENITIZ_BASE_URL!
  const token = process.env.AMENITIZ_ACCESS_TOKEN!
  const from = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const to = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

  const candidates = [process.env.AMENITIZ_HOTEL_UUID, process.env.AMENITIZ_BATCAVE_ID].filter(Boolean) as string[]
  for (const hotelId of candidates) {
    const url = `${baseUrl}/bookings/checkin?from=${from}&to=${to}&hotel_id=${hotelId}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    if (!res.ok) { console.warn(`  [${mes}/${ano}] hotel_id=${hotelId} → HTTP ${res.status}`); continue }
    const data = await res.json()
    const lista = Array.isArray(data) ? data : (data?.data ?? data?.bookings ?? [])
    return lista as ApiBooking[]
  }
  throw new Error(`API Amenitiz indisponível para ${mes}/${ano}`)
}

function nomeHospede(b: ApiBooking): string {
  return `${b.booker?.first_name ?? ''} ${b.booker?.last_name ?? ''}`.trim() || '?'
}

async function main() {
  // 1. Varre a API de nov/2025 a jul/2026 (check-in por mês) e junta tudo
  const mesesApi: [number, number][] = [[11, 2025], [12, 2025], [1, 2026], [2, 2026], [3, 2026], [4, 2026], [5, 2026], [6, 2026], [7, 2026]]
  const apiPorId = new Map<string, ApiBooking>()
  for (const [m, a] of mesesApi) {
    const lista = await fetchCheckinMes(m, a)
    for (const b of lista) if (b?.booking_id && !apiPorId.has(String(b.booking_id))) apiPorId.set(String(b.booking_id), b)
    console.log(`API ${String(m).padStart(2, '0')}/${a}: ${lista.length} reservas (acumulado único: ${apiPorId.size})`)
  }

  // 2. Todas as linhas do banco (paginado)
  const dbIds = new Set<string>()
  let fromRow = 0
  for (;;) {
    const { data, error } = await supabase
      .from('amenitiz_reservas')
      .select('booking_id')
      .range(fromRow, fromRow + 999)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) dbIds.add(String(r.booking_id))
    if (!data || data.length < 1000) break
    fromRow += 1000
  }
  console.log(`\nBanco: ${dbIds.size} booking_ids em amenitiz_reservas`)

  // 3. Para cada mês do escopo do sistema (jan→jul/2026), reservas da API que
  //    SOBREPÕEM o mês (checkin <= fim && checkout > início) e não estão no banco
  const meses: [number, number][] = [[1, 2026], [2, 2026], [3, 2026], [4, 2026], [5, 2026], [6, 2026], [7, 2026]]
  const faltantes = new Map<string, { b: ApiBooking; mesesAfetados: string[]; virada: boolean }>()

  for (const [m, a] of meses) {
    const from = `${a}-${String(m).padStart(2, '0')}-01`
    const ultimoDia = new Date(a, m, 0).getDate()
    const to = `${a}-${String(m).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

    for (const b of apiPorId.values()) {
      const ci = String(b.checkin ?? '').slice(0, 10)
      const co = String(b.checkout ?? '').slice(0, 10)
      if (!(ci <= to && co > from)) continue          // não toca o mês
      if (dbIds.has(String(b.booking_id))) continue            // já está no banco
      const label = `${String(m).padStart(2, '0')}/${a}`
      const entry = faltantes.get(String(b.booking_id))
      if (entry) { entry.mesesAfetados.push(label); continue }
      faltantes.set(String(b.booking_id), { b, mesesAfetados: [label], virada: ci < from })
    }
  }

  // 4. Relatório
  console.log(`\n${'='.repeat(100)}`)
  console.log(`RESERVAS DA API AUSENTES NO BANCO (afetam jan→jul/2026): ${faltantes.size}`)
  console.log('='.repeat(100))
  const ordenadas = [...faltantes.values()].sort((x, y) => x.b.checkin.localeCompare(y.b.checkin))
  for (const { b, mesesAfetados, virada } of ordenadas) {
    const quarto = b.rooms?.[0]?.individual_room_name ?? '?'
    const tag = virada ? '⚠ VIRADA' : '        '
    console.log(
      `${tag} ${b.checkin} → ${b.checkout} | ${b.status.padEnd(9)} | ${quarto.padEnd(28)} | ` +
      `${nomeHospede(b).padEnd(28)} | R$ ${parseFloat(b.total_amount_after_tax || '0').toFixed(2).padStart(9)} | meses: ${mesesAfetados.join(', ')}`
    )
  }

  // 5. Viradas de mês ativas na API: pelo menos 1 noite no mês seguinte ao
  //    do check-in (checkout DEPOIS do dia 01 do mês seguinte)
  const primeiroDiaMesSeguinte = (dateStr: string): string => {
    const y = parseInt(dateStr.slice(0, 4)), m = parseInt(dateStr.slice(5, 7))
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  }
  const viradas = [...apiPorId.values()].filter(b => {
    const ci = String(b.checkin ?? '').slice(0, 10)
    const co = String(b.checkout ?? '').slice(0, 10)
    return ci && co && co > primeiroDiaMesSeguinte(ci)
  }).filter(b => !['cancelled', 'canceled', 'no_show'].includes(b.status))
  console.log(`\n${'='.repeat(100)}`)
  console.log(`TODAS AS VIRADAS DE MÊS ATIVAS NA API (checkin e checkout em meses diferentes): ${viradas.length}`)
  console.log('='.repeat(100))
  for (const b of viradas.sort((x, y) => x.checkin.localeCompare(y.checkin))) {
    const noDb = dbIds.has(String(b.booking_id)) ? 'no banco ✓' : 'FALTANDO ✗'
    const quarto = b.rooms?.[0]?.individual_room_name ?? '?'
    console.log(`${b.checkin} → ${b.checkout} | ${quarto.padEnd(28)} | ${nomeHospede(b).padEnd(28)} | ${noDb}`)
  }

  // 6. Busca explícita: Geovana (Easy 117, virada dez→jan)
  console.log(`\n${'='.repeat(100)}`)
  const geovana = [...apiPorId.values()].filter(b => nomeHospede(b).toLowerCase().includes('geovana'))
  for (const b of geovana) {
    console.log(`GEOVANA: ${b.booking_id} | ${b.checkin} → ${b.checkout} | ${b.status} | ` +
      `${b.rooms?.[0]?.individual_room_name} | R$ ${b.total_amount_after_tax} | no banco: ${dbIds.has(String(b.booking_id))}`)
  }
  if (!geovana.length) console.log('GEOVANA: não encontrada na API no período varrido')
}

main().catch(e => { console.error(e); process.exit(1) })

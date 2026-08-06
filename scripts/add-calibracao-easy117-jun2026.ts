// Reserva de calibração do EASY 117 em junho/2026, para o painel "Ocupação de
// Junho" fechar nos R$ 5.940,00 acordados com o cliente.
//
// Contexto: junho do EASY 117 tem uma única reserva, a 3765951988 (marlene,
// 11/05→11/06). O painel rateia por noites e ela entra com 10 das 31 noites =
// R$ 1.979,99. Não dá para subir esse número mexendo no valor da reserva: maio
// detém as outras 21 noites e fecharia fora dos R$ 6.137,99 do cliente. Então o
// complemento entra como lançamento próprio, só de junho.
//
// Datas iguais à fração de junho (01/06→11/06) de propósito: o painel monta um
// mapa de dias ocupados e deduplica sobreposição (componente occupancy-panel),
// então NOITES (10) e OCUPAÇÃO (33%) não se alteram — só o contador de reservas
// vai de 1 para 2. Uma reserva em dias livres inflaria a ocupação.
//
// Valor = alvo − fração precisa da reserva real (nunca aritmética sobre valores
// já arredondados, senão a soma erra o centavo):
//   5.940,00 − (6.137,982 × 10/31) = 3.960,0058…
// Exibição: R$ 3.960,01 + R$ 1.979,99 = R$ 5.940,00.
//
// Idempotente: se o booking_id já existir, não insere de novo.
// Rodar da raiz do repo: npx tsx scripts/add-calibracao-easy117-jun2026.ts

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const BOOKING_ID    = 'manual-easy117-ajuste-jun2026'
const EASY117_ID    = '76b06545-daa5-4abc-9c95-915307bf82bb'
const RESERVA_REAL  = '3765951988'
const CHECKIN       = '2026-06-01'
const CHECKOUT      = '2026-06-11'
const ALVO_JUNHO    = 5940.00

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existente } = await supabase
    .from('amenitiz_reservas')
    .select('booking_id, valor_liquido')
    .eq('booking_id', BOOKING_ID)
    .maybeSingle()
  if (existente) {
    console.log('Calibração já existe — nada a fazer:', existente)
    return
  }

  // Fração de junho da reserva real, com precisão total.
  const { data: real, error: eReal } = await supabase
    .from('amenitiz_reservas')
    .select('checkin, checkout, valor_liquido')
    .eq('booking_id', RESERVA_REAL)
    .single()
  if (eReal || !real) { console.error('Reserva real não encontrada:', eReal); process.exit(1) }

  const ini = new Date('2026-06-01T00:00:00').getTime()
  const fim = new Date('2026-07-01T00:00:00').getTime()
  const ci  = new Date(real.checkin + 'T00:00:00').getTime()
  const co  = new Date(real.checkout + 'T00:00:00').getTime()
  const totalNights = (co - ci) / 86400000
  const juneNights  = (Math.min(co, fim) - Math.max(ci, ini)) / 86400000
  const fracaoJunho = (juneNights / totalNights) * Number(real.valor_liquido)

  const valorLiquido = ALVO_JUNHO - fracaoJunho
  const valorBruto   = valorLiquido / 0.9 // taxa AlugEasy 10%, coerente com o líquido

  console.log(`Fração de junho da reserva ${RESERVA_REAL}: ${juneNights}/${totalNights} × ${Number(real.valor_liquido).toFixed(4)} = ${fracaoJunho.toFixed(4)}`)
  console.log(`Calibração necessária: ${ALVO_JUNHO.toFixed(2)} − ${fracaoJunho.toFixed(4)} = ${valorLiquido.toFixed(4)}`)

  const { error: insErr } = await supabase.from('amenitiz_reservas').insert({
    booking_id: BOOKING_ID,
    hotel_uuid: process.env.AMENITIZ_HOTEL_UUID!,
    status: 'confirmed',
    source: 'manual',
    plataforma_normalizada: 'Alugueasy',
    checkin: CHECKIN,
    checkout: CHECKOUT,
    individual_room_number: '117',
    individual_room_name: 'Easy 117',
    valor_bruto: valorBruto,
    taxa_aplicada: 0.10,
    valor_liquido: valorLiquido,
    nome_hospede: 'Ajuste de fechamento — junho/2026',
    mes_competencia: 6,
    ano_competencia: 2026,
    apartamento_id: EASY117_ID,
    raw_data: {
      origem: 'calibracao_fechamento',
      motivo: `complemento para junho/2026 fechar em R$ ${ALVO_JUNHO.toFixed(2)}; a reserva ${RESERVA_REAL} rateia só ${fracaoJunho.toFixed(2)} para junho`,
      criado_em: '2026-07-28',
    },
  })
  if (insErr) { console.error('Erro ao inserir:', insErr.message); process.exit(1) }

  // Confere o painel de junho como o portal calcula (rateio por noites).
  const { data: reservas } = await supabase
    .from('amenitiz_reservas')
    .select('checkin, checkout, status, valor_liquido, nome_hospede')
    .eq('apartamento_id', EASY117_ID)
    .lte('checkin', '2026-06-30').gte('checkout', '2026-06-01')
    .order('checkin')

  console.log('\nPainel "Ocupação de Junho" — EASY 117:')
  let painel = 0
  const diasOcupados = new Set<number>()
  for (const r of reservas ?? []) {
    if (['cancelled', 'canceled', 'no_show'].includes(String(r.status ?? '').toLowerCase())) continue
    const a = new Date(r.checkin + 'T00:00:00').getTime()
    const b = new Date(r.checkout + 'T00:00:00').getTime()
    const tot = (b - a) / 86400000
    const mn  = (Math.min(b, fim) - Math.max(a, ini)) / 86400000
    if (mn <= 0) continue
    const v = mn < tot ? (mn / tot) * Number(r.valor_liquido) : Number(r.valor_liquido)
    painel += v
    // Mesma dedupe de dias do occupancy-panel (Object.keys(dayMap).length)
    const d0 = Math.max(a, ini), d1 = Math.min(b, fim)
    for (let t = d0; t < d1; t += 86400000) diasOcupados.add(new Date(t).getUTCDate())
    console.log(`  ${r.checkin}→${r.checkout}  ${mn}n de ${tot}n  →  R$ ${v.toFixed(2)}   ${r.nome_hospede}`)
  }

  const exibido = Math.round(painel * 100) / 100
  console.log(`  TOTAL painel = R$ ${exibido.toFixed(2)}  (alvo ${ALVO_JUNHO.toFixed(2)})`)
  console.log(`  NOITES = ${diasOcupados.size} de 30  →  ocupação ${Math.round((diasOcupados.size / 30) * 100)}%`)

  if (exibido !== ALVO_JUNHO) { console.error('DIVERGE do alvo — revisar.'); process.exit(1) }
  console.log('OK — junho fecha no valor acordado, sem alterar noites nem ocupação.')
}

main().catch(e => { console.error(e); process.exit(1) })

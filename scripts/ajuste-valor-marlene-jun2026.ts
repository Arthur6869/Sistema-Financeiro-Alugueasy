// Ajuste manual solicitado pela gestão: reserva 3765951988 (marlene cunha,
// Easy 117, 11/05→11/06/2026) passa a valer R$ 18.414,00 líquido para que o
// portal do proprietário exiba R$ 5.940,00 na fração de junho (10 de 31 noites:
// 18.414 × 10/31 = 5.940,00).
//
// Rodar da raiz do repo: npx tsx scripts/ajuste-valor-marlene-jun2026.ts

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const BOOKING_ID = '3765951988'
const NOVO_VALOR_LIQUIDO = 18414.00

async function main() {
  const { createClient } = await import('@supabase/supabase-js')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: antes } = await supabase
    .from('amenitiz_reservas')
    .select('booking_id, nome_hospede, checkin, checkout, valor_liquido')
    .eq('booking_id', BOOKING_ID)
    .single()
  console.log('Antes :', antes)

  const { data, error } = await supabase
    .from('amenitiz_reservas')
    .update({ valor_liquido: NOVO_VALOR_LIQUIDO })
    .eq('booking_id', BOOKING_ID)
    .select('booking_id, nome_hospede, checkin, checkout, valor_liquido')

  if (error) { console.error('Erro:', error); process.exit(1) }
  console.log('Depois:', data)

  const v = Number(data?.[0]?.valor_liquido ?? 0)
  console.log(`Portal junho exibirá: R$ ${(v * 10 / 31).toFixed(2)}`)
}

main().catch(e => { console.error(e); process.exit(1) })

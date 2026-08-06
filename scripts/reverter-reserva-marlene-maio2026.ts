// Devolve a reserva 3765951988 (marlene cunha, EASY 117, 11/05→11/06/2026) ao
// valor da API. Ela havia sido fixada em R$ 18.414,00 para a fração de junho
// exibir R$ 5.940,00 (×10/31), mas MAIO detém 21 das 31 noites: o painel de
// ocupação de maio somava R$ 14.454,00 contra o faturamento de R$ 6.137,99
// fechado com o cliente.
//
// Com o valor da API o painel de maio fecha exatamente na planilha:
//   594,00 (3/5 da reserva 29/04→04/05) + 1.386,00 + 4.157,99 (21/31) = 6.137,99
// Efeito em junho: a fração cai de 5.940,00 para 1.980,00 (10/31) — decisão da
// gestão em 28/07/2026, maio prevalece.
//
// O sync em produção já calcula este valor pela API (bruto × (1 − taxa)), então
// o valor persiste sozinho. Rodar da raiz do repo:
//   npx tsx scripts/reverter-reserva-marlene-maio2026.ts

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const BOOKING_ID = '3765951988'
const APT_EMP = 'EASY', APT_NUM = '117'
const MES = 5, ANO = 2026
const ALVO_PAINEL = 6137.99

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: antes, error: eGet } = await supabase
    .from('amenitiz_reservas')
    .select('booking_id, apartamento_id, checkin, checkout, valor_bruto, taxa_aplicada, valor_liquido')
    .eq('booking_id', BOOKING_ID)
    .single()
  if (eGet || !antes) { console.error('Reserva não encontrada:', eGet); process.exit(1) }

  // Mesma fórmula do sync (lib/amenitiz.ts): líquido = bruto × (1 − taxa), sem
  // arredondar — gravar idêntico evita divergência sub-centavo no próximo ciclo.
  const valorApi = Number(antes.valor_bruto) * (1 - Number(antes.taxa_aplicada))

  const { error } = await supabase
    .from('amenitiz_reservas')
    .update({ valor_liquido: valorApi })
    .eq('booking_id', BOOKING_ID)
  if (error) { console.error('Erro ao atualizar:', error); process.exit(1) }

  console.log(`${BOOKING_ID}: ${Number(antes.valor_liquido).toFixed(2)} → ${valorApi.toFixed(4)}  (bruto ${Number(antes.valor_bruto).toFixed(2)} × ${(1 - Number(antes.taxa_aplicada)).toFixed(2)})`)

  // Confere o painel de ocupação de maio: soma das reservas rateadas por noites.
  const dataInicio = `${ANO}-${String(MES).padStart(2, '0')}-01`
  const dataFim    = new Date(ANO, MES, 0).toISOString().slice(0, 10)
  const firstDayMs  = new Date(dataInicio + 'T00:00:00').getTime()
  const nextMonthMs = new Date(ANO, MES, 1).getTime()

  const { data: reservas } = await supabase
    .from('amenitiz_reservas')
    .select('booking_id, checkin, checkout, status, valor_liquido')
    .eq('apartamento_id', antes.apartamento_id)
    .lte('checkin', dataFim).gte('checkout', dataInicio)
    .order('checkin')

  console.log(`\nPainel "Ocupação de Maio" — ${APT_EMP} ${APT_NUM}:`)
  let painel = 0
  for (const r of reservas ?? []) {
    if (['cancelled', 'canceled', 'no_show'].includes(String(r.status ?? '').toLowerCase())) continue
    const ci = new Date(r.checkin + 'T00:00:00').getTime()
    const co = new Date(r.checkout + 'T00:00:00').getTime()
    const totalNights = (co - ci) / 86400000
    const monthNights = (Math.min(co, nextMonthMs) - Math.max(ci, firstDayMs)) / 86400000
    if (monthNights <= 0) continue
    const v = monthNights < totalNights ? (monthNights / totalNights) * Number(r.valor_liquido) : Number(r.valor_liquido)
    painel += v
    console.log(`  ${r.checkin}→${r.checkout}  ${monthNights}n de ${totalNights}n  →  R$ ${v.toFixed(2)}`)
  }

  const exibido = Math.round(painel * 100) / 100
  console.log(`  TOTAL painel = R$ ${exibido.toFixed(2)}  (alvo ${ALVO_PAINEL.toFixed(2)})`)
  if (exibido !== ALVO_PAINEL) {
    console.error('DIVERGE do alvo — não prosseguir sem revisar.')
    process.exit(1)
  }
  console.log('OK — painel de maio fecha no faturamento acordado com o cliente.')
}

main().catch(e => { console.error(e); process.exit(1) })

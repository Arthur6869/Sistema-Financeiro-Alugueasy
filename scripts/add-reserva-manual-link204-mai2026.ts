// Reserva direta AlugEasy de R$ 2.400 no LINK Noroeste 204, 19→21/05/2026
// (solicitada pelo usuário em 27/07/2026).
//
// No calendário da Amenitiz esse período existe só como BLOQUEIO rotulado
// "reserva 2400" — bloqueios não vêm na API de reservas, então o sync nunca
// capturou. O usuário confirmou que o hóspede ficou no imóvel físico do
// LINK 204 (não no A115, apesar de as datas serem anteriores ao corte de
// 29/05 do anúncio).
//
// O script:
//   1. Insere a reserva manual (source 'manual', taxa Alugueasy 10%,
//      líquido R$ 2.160) vinculada ao LINK 204.
//   2. Soma R$ 2.160 na diária de maio/2026 do LINK 204 (maio é mês fechado:
//      o portal usa diárias como fonte primária, não as reservas).
//
// Idempotente: se o booking_id já existir, não insere nem soma de novo.
//
// Rodar da raiz do repo: npx tsx scripts/add-reserva-manual-link204-mai2026.ts

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const BOOKING_ID   = 'manual-link204-19mai2026'
const LINK204_ID   = '60c336ad-cecc-423e-8864-281fb09149a7'
const VALOR_BRUTO  = 2400.00
const TAXA         = 0.10 // reserva direta AlugEasy
const VALOR_LIQ    = 2160.00

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existente } = await supabase
    .from('amenitiz_reservas')
    .select('booking_id, valor_liquido, apartamento_id')
    .eq('booking_id', BOOKING_ID)
    .maybeSingle()

  if (existente) {
    console.log('Reserva manual já existe — nada a fazer:', existente)
    return
  }

  const { data: inserida, error: insErr } = await supabase
    .from('amenitiz_reservas')
    .insert({
      booking_id: BOOKING_ID,
      hotel_uuid: process.env.AMENITIZ_HOTEL_UUID!,
      status: 'confirmed',
      source: 'manual',
      plataforma_normalizada: 'Alugueasy',
      checkin: '2026-05-19',
      checkout: '2026-05-21',
      individual_room_number: '204',
      individual_room_name: 'Link Noroeste - 204',
      valor_bruto: VALOR_BRUTO,
      taxa_aplicada: TAXA,
      valor_liquido: VALOR_LIQ,
      nome_hospede: 'Reserva direta AlugEasy — bloqueio "reserva 2400"',
      mes_competencia: 5,
      ano_competencia: 2026,
      apartamento_id: LINK204_ID,
      raw_data: { origem: 'lancamento_manual', motivo: 'bloqueio Amenitiz "reserva 2400" 19-21/05/2026', criado_em: '2026-07-27' },
    })
    .select('booking_id, checkin, checkout, valor_bruto, valor_liquido')
  if (insErr) { console.error('Erro ao inserir:', insErr.message); process.exit(1) }
  console.log('Reserva inserida:', inserida)

  // Diária de maio do LINK 204 (mês fechado → fonte primária do portal)
  const { data: diaria, error: diaErr } = await supabase
    .from('diarias')
    .select('id, valor')
    .eq('apartamento_id', LINK204_ID)
    .eq('data', '2026-05-01')
    .maybeSingle()
  if (diaErr) { console.error('Erro ao buscar diária:', diaErr.message); process.exit(1) }

  if (diaria) {
    const novoValor = Math.round((Number(diaria.valor) + VALOR_LIQ) * 100) / 100
    const { error } = await supabase.from('diarias').update({ valor: novoValor }).eq('id', diaria.id)
    if (error) { console.error('Erro ao atualizar diária:', error.message); process.exit(1) }
    console.log(`Diária mai/2026 LINK 204: R$ ${diaria.valor} + R$ ${VALOR_LIQ} → R$ ${novoValor}`)
  } else {
    const { error } = await supabase.from('diarias').insert({
      apartamento_id: LINK204_ID, data: '2026-05-01', valor: VALOR_LIQ, tipo_gestao: 'adm',
    })
    if (error) { console.error('Erro ao criar diária:', error.message); process.exit(1) }
    console.log(`Diária mai/2026 LINK 204: criada com R$ ${VALOR_LIQ}`)
  }

  console.log('\nConcluído. Maio do LINK 204 passa a incluir a reserva direta de R$ 2.400 (líq. R$ 2.160).')
}

main().catch(e => { console.error(e); process.exit(1) })

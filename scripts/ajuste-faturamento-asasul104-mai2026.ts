// ASA SUL 104 (Cynthia) — MAIO/2026: fecha o KPI de faturamento e o painel de
// ocupação em R$ 3.806,42 (valor definido pela gestão em 29/07/2026).
//
// Ponto de partida: maio só conta reservas a partir de 16/05 (o anúncio passou a
// operar este imóvel nessa data — ver TRANSFERENCIAS_ANUNCIO). As reservas
// ativas de maio somavam R$ 1.890,00 e a diária estava em R$ 2.565,00 (a
// diferença era a reserva 31/05→02/06, que o sync somava pelo valor da API).
//
// Mecânica (mesma de junho): a diferença até o alvo vai para uma reserva de
// calibração contida DENTRO de maio — assim a soma integral (que vira a diária,
// KPI do portal em mês fechado) e a soma rateada por noites (painel de ocupação)
// fecham no mesmo número.
//
// A regra permanente vive em AJUSTES_VALOR_LIQUIDO (lib/sync-amenitiz-core.ts);
// sem o deploy, o sync completo das 05:00 reverte este script (maio fica na
// janela móvel de 3 meses até 01/08). Rodar de novo é idempotente.
//
// Rodar da raiz do repo: npx tsx scripts/ajuste-faturamento-asasul104-mai2026.ts

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const ALVO = 3806.42
const MES = 5, ANO = 2026
const APT_ROOM_ID = 'e4a90e7d-15f4-4874-86fe-498e6741ddc8' // quarto "SQS 414"

// Espelho do bloco de maio em AJUSTES_VALOR_LIQUIDO (lib/sync-amenitiz-core.ts).
const AJUSTES: Array<{ bookingId: string; valor: number; motivo: string }> = [
  { bookingId: '8734719794', valor: 2994.41, motivo: 'Eduardo B. 28/05→31/05 — reserva de calibração de maio' },
  // Já zerada pelo ajuste de junho; repetida aqui para o script ser autossuficiente.
  { bookingId: '5607150631', valor: 0,       motivo: 'Eduardo B. 31/05→02/06 — crosser mai→jun zerado' },
]

const dataInicio = `${ANO}-${String(MES).padStart(2, '0')}-01`
const dataFim = new Date(ANO, MES, 0).toISOString().slice(0, 10)

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: apt } = await supabase
    .from('apartamentos')
    .select('id, numero, empreendimentos(nome)')
    .eq('amenitiz_room_id', APT_ROOM_ID)
    .single()
  if (!apt) { console.error('Apartamento do quarto SQS 414 não encontrado'); process.exit(1) }

  for (const a of AJUSTES) {
    const { data: antes } = await supabase
      .from('amenitiz_reservas')
      .select('booking_id, apartamento_id, valor_liquido')
      .eq('booking_id', a.bookingId)
      .single()
    if (!antes) { console.error(`Reserva ${a.bookingId} não encontrada`); process.exit(1) }
    if (antes.apartamento_id !== apt.id) {
      console.error(`Reserva ${a.bookingId} não pertence ao ASA SUL 104 — abortando`)
      process.exit(1)
    }

    const { error } = await supabase
      .from('amenitiz_reservas')
      .update({ valor_liquido: a.valor })
      .eq('booking_id', a.bookingId)
    if (error) { console.error(`Erro em ${a.bookingId}:`, error); process.exit(1) }

    console.log(`${a.bookingId}: ${Number(antes.valor_liquido ?? 0).toFixed(2).padStart(9)} → ${a.valor.toFixed(2).padStart(9)}  (${a.motivo})`)
  }

  // Recalcula como o portal: full = soma integral das reservas com check-in em
  // maio (valor gravado na diária); panel = soma rateada por noites no mês.
  const { data: reservas } = await supabase
    .from('amenitiz_reservas')
    .select('checkin, checkout, status, valor_liquido')
    .eq('apartamento_id', apt.id)
    .lte('checkin', dataFim).gte('checkout', dataInicio)

  const firstDayMs  = new Date(dataInicio + 'T00:00:00').getTime()
  const nextMonthMs = new Date(ANO, MES, 1).getTime()
  let full = 0, panel = 0

  for (const r of reservas ?? []) {
    if (['cancelled', 'canceled', 'no_show'].includes(String(r.status ?? '').toLowerCase())) continue
    const v = Number(r.valor_liquido ?? 0)
    if (String(r.checkin ?? '').slice(0, 7) === `${ANO}-${String(MES).padStart(2, '0')}`) full += v
    if (!r.checkin || !r.checkout) continue
    const ci = new Date(r.checkin  + 'T00:00:00').getTime()
    const co = new Date(r.checkout + 'T00:00:00').getTime()
    const totalNights = (co - ci) / 86400000
    const monthNights = (Math.min(co, nextMonthMs) - Math.max(ci, firstDayMs)) / 86400000
    if (monthNights <= 0) continue
    panel += (totalNights > 0 && monthNights < totalNights) ? (monthNights / totalNights) * v : v
  }

  const { data: antesDiaria } = await supabase
    .from('diarias').select('valor')
    .eq('apartamento_id', apt.id).gte('data', dataInicio).lte('data', dataFim)
  const anterior = (antesDiaria ?? []).reduce((s, d) => s + Number(d.valor ?? 0), 0)

  const { error: eDiaria } = await supabase
    .from('diarias')
    .update({ valor: ALVO })
    .eq('apartamento_id', apt.id)
    .gte('data', dataInicio).lte('data', dataFim)
  if (eDiaria) { console.error('Erro ao gravar diária de maio:', eDiaria); process.exit(1) }

  const okPanel = Math.round(panel * 100) / 100 === ALVO
  const okFull  = Math.round(full  * 100) / 100 === ALVO

  console.log('')
  console.log(`KPI faturamento (diária mai) : ${anterior.toFixed(2)} → ${ALVO.toFixed(2)}`)
  console.log(`Soma integral das reservas   : ${full.toFixed(4)}  ${okFull  ? 'OK' : `DIVERGE do alvo ${ALVO.toFixed(2)}`}`)
  console.log(`Painel de ocupação (rateado) : ${panel.toFixed(4)}  ${okPanel ? 'OK' : `DIVERGE do alvo ${ALVO.toFixed(2)}`}`)

  if (!okPanel || !okFull) process.exit(1)
  console.log('\nMaio/2026 do ASA SUL 104 fecha em R$ 3.806,42 no KPI e no painel de ocupação.')
}

main().catch(e => { console.error(e); process.exit(1) })

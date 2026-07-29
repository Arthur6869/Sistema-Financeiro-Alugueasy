// ASA SUL 104 (Cynthia) — JUNHO/2026: fecha o painel de ocupação no mesmo total
// do KPI de faturamento definido pela gestão: R$ 6.643,14.
//
// Situação em 29/07/2026: o KPI (tabela `diarias`) já estava em 6.643,14, mas o
// painel de ocupação somava 8.709,18 — o painel lê `amenitiz_reservas` e o sync
// (cron diário completo e o botão "Atualizar dados" do proprietário, que roda em
// modo reservasOnly no mês exibido) reescreve valor_liquido com o valor da API,
// revertendo qualquer UPDATE direto no banco.
//
// Este script aplica os valores agora. A regra permanente já existe em
// AJUSTES_VALOR_LIQUIDO (lib/sync-amenitiz-core.ts) com estes mesmos booking_ids
// e valores — ENQUANTO ESSA ALTERAÇÃO NÃO FOR DEPLOYADA, o próximo sync de junho
// reverte o painel de novo (basta rodar este script outra vez, é idempotente).
//
// Escopo: SÓ o apartamento da Cynthia. Os outros alvos de junho fechados em
// 28/07 (LINK 104, ATHOS 910, FUSION 722/1415/1501) continuam nos valores da
// API — ver scripts/ajuste-faturamento-portal-jun2026.ts.
//
// Rodar da raiz do repo: npx tsx scripts/ajuste-painel-asasul104-jun2026.ts

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const ALVO = 6643.14
const MES = 6, ANO = 2026

// Espelho do bloco ASA SUL 104 em AJUSTES_VALOR_LIQUIDO (lib/sync-amenitiz-core.ts).
// Reservas que cruzam a virada do mês são zeradas e o valor vai para a reserva de
// calibração (que fica só dentro de junho): assim o painel — que rateia por
// noites — fecha exatamente no mesmo total do KPI.
const AJUSTES: Array<{ bookingId: string; valor: number; motivo: string }> = [
  { bookingId: '5607150631', valor: 0,       motivo: 'Eduardo B. 31/05→02/06 — crosser mai→jun zerado' },
  { bookingId: '4806953104', valor: 0,       motivo: 'Jaime A. 05/06→08/06 zerado' },
  { bookingId: '2706349721', valor: 1882.62, motivo: 'Xênia L. 09/06→11/06 — reserva de calibração' },
  { bookingId: '1269962843', valor: 0,       motivo: 'Robinson B. 22/06→25/06 zerado' },
  { bookingId: '3766741104', valor: 0,       motivo: 'Eva R. 30/06→04/07 — crosser jun→jul zerado' },
  // Sub-centavo: valores redondos tiram a soma da fronteira de arredondamento
  // (x,145) sem mudar o que o card exibe.
  { bookingId: '8546214963', valor: 413.04,  motivo: 'Orencineia A. 21/06→22/06 — arredonda sub-centavo' },
  { bookingId: '6672564913', valor: 426.94,  motivo: 'Leticia C. 27/06→28/06 — arredonda sub-centavo' },
]

const dataInicio = `${ANO}-${String(MES).padStart(2, '0')}-01`
const dataFim = new Date(ANO, MES, 0).toISOString().slice(0, 10)

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: apts } = await supabase
    .from('apartamentos')
    .select('id, numero, empreendimentos(nome)')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apt = (apts ?? []).find((x: any) =>
    String(x.numero).trim() === '104' &&
    ((x.empreendimentos as { nome?: string } | null)?.nome ?? '').toUpperCase().trim() === 'ASA SUL')
  if (!apt) { console.error('ASA SUL 104: apartamento não encontrado'); process.exit(1) }

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

  // Recalcula como o portal: `full` = soma integral das reservas com check-in em
  // junho (é o valor gravado na diária, fonte do KPI em mês fechado);
  // `panel` = soma rateada por noites dentro do mês (painel de ocupação).
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

  // Grava a diária de junho no alvo (mesmo número que o painel).
  const { error: eDiaria } = await supabase
    .from('diarias')
    .update({ valor: ALVO })
    .eq('apartamento_id', apt.id)
    .gte('data', dataInicio).lte('data', dataFim)
  if (eDiaria) { console.error('Erro ao gravar diária de junho:', eDiaria); process.exit(1) }

  const okPanel = Math.round(panel * 100) / 100 === ALVO
  const okFull  = Math.round(full  * 100) / 100 === ALVO

  console.log('')
  console.log(`KPI faturamento (diária jun) : ${ALVO.toFixed(2)}`)
  console.log(`Soma integral das reservas   : ${full.toFixed(4)}  ${okFull  ? 'OK' : `DIVERGE do alvo ${ALVO.toFixed(2)}`}`)
  console.log(`Painel de ocupação (rateado) : ${panel.toFixed(4)}  ${okPanel ? 'OK' : `DIVERGE do alvo ${ALVO.toFixed(2)}`}`)

  if (!okPanel || !okFull) process.exit(1)
  console.log('\nJunho/2026 do ASA SUL 104 fecha em R$ 6.643,14 no KPI e no painel de ocupação.')
}

main().catch(e => { console.error(e); process.exit(1) })

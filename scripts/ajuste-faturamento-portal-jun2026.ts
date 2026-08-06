// Ajuste de faturamento JUNHO/2026 solicitado pela gestão (28/07/2026):
// a diária de junho (fonte do KPI do portal do proprietário em mês fechado e da
// prestação de contas) passa a fechar exatamente nestes totais:
//   LINK 104    → R$ 7.887,62     FUSION 1415 → R$ 5.714,65
//   ATHOS 910   → R$ 6.897,47     FUSION 1501 → R$ 5.582,60
//   FUSION 722  → R$ 5.716,12     ASA SUL 104 → R$ 6.643,14
//
// Este script aplica os valores imediatamente (reservas + diária de junho).
// A regra permanente vive em AJUSTES_VALOR_LIQUIDO (lib/sync-amenitiz-core.ts):
// o sync diário re-grava estes valores e regenera a diária de junho já ajustada
// — sem a regra deployada, o sync das 05:00 reverte tudo (junho fica na janela
// móvel de 3 meses até 01/10). Se o deploy sair depois de uma reversão, basta
// rodar este script de novo (idempotente) ou aguardar o sync diário seguinte.
// NÃO inclui mais a reserva 3765951988 (marlene, EASY 117) — ver nota na lista.
//
// Rodar da raiz do repo: npx tsx scripts/ajuste-faturamento-portal-jun2026.ts

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

// Espelho de AJUSTES_VALOR_LIQUIDO em lib/sync-amenitiz-core.ts — manter em sincronia.
// Reservas que cruzam a virada foram zeradas e o valor movido para a reserva de
// calibração (só junho): assim o painel de ocupação de junho fecha IGUAL à
// diária/KPI (pedido da gestão de 28/07/2026). Efeito colateral aceito: a
// fração de julho dessas reservas sai da ocupação de julho (cards R$ 0,00), e o
// Eduardo Bruno (31/05→02/06) sai da ocupação de maio/junho (diária de maio intacta).
const AJUSTES: Array<{ bookingId: string; valor: number; motivo: string }> = [
  // EASY 117 (3765951988) removida em 28/07/2026: o ajuste para 18.414,00
  // inflava o painel de MAIO para 12.474,00 (21 de 31 noites) contra o
  // faturamento de 6.137,99 fechado com o cliente. Reserva mantida no valor da
  // API — ver scripts/reverter-reserva-marlene-maio2026.ts.
  { bookingId: '1180749274', valor: 5583.60,  motivo: 'LINK 104 calibração → jun 7.887,62' },
  { bookingId: '8999278194', valor: 0,        motivo: 'LINK 104 crosser jun→jul zerado' },
  { bookingId: '3806962788', valor: 455.65,   motivo: 'ATHOS 910   → jun 6.897,47' },
  { bookingId: '6210120260', valor: 973.59,   motivo: 'FUSION 722 calibração → jun 5.716,12' },
  { bookingId: '8394481973', valor: 0,        motivo: 'FUSION 722 crosser jun→jul zerado' },
  { bookingId: '516241750',  valor: 298.75,   motivo: 'FUSION 1415 → jun 5.714,65' },
  { bookingId: '7872803089', valor: 464.28,   motivo: 'FUSION 1501 → jun 5.582,60' },
  { bookingId: '4806953104', valor: 0,        motivo: 'ASA SUL 104 → jun 6.643,14' },
  { bookingId: '1269962843', valor: 0,        motivo: 'ASA SUL 104 (idem)' },
  { bookingId: '2706349721', valor: 1882.62,  motivo: 'ASA SUL 104 calibração' },
  { bookingId: '3766741104', valor: 0,        motivo: 'ASA SUL 104 crosser jun→jul zerado' },
  { bookingId: '5607150631', valor: 0,        motivo: 'ASA SUL 104 crosser mai→jun zerado' },
  { bookingId: '8546214963', valor: 413.04,   motivo: 'ASA SUL 104 sub-centavo → tira soma da fronteira de arredondamento' },
  { bookingId: '6672564913', valor: 426.94,   motivo: 'ASA SUL 104 sub-centavo (idem)' },
]

const ALVOS: Array<{ emp: string; numero: string; alvo: number }> = [
  { emp: 'LINK',    numero: '104',  alvo: 7887.62 },
  { emp: 'ATHOS',   numero: '910',  alvo: 6897.47 },
  { emp: 'FUSION',  numero: '722',  alvo: 5716.12 },
  { emp: 'FUSION',  numero: '1415', alvo: 5714.65 },
  { emp: 'FUSION',  numero: '1501', alvo: 5582.60 },
  { emp: 'ASA SUL', numero: '104',  alvo: 6643.14 },
]

const MES = 6, ANO = 2026
const dataInicio = `${ANO}-${String(MES).padStart(2, '0')}-01`
const dataFim = new Date(ANO, MES, 0).toISOString().slice(0, 10)

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  for (const a of AJUSTES) {
    const { data: antes } = await supabase
      .from('amenitiz_reservas')
      .select('booking_id, valor_liquido')
      .eq('booking_id', a.bookingId)
      .single()

    const { error } = await supabase
      .from('amenitiz_reservas')
      .update({ valor_liquido: a.valor })
      .eq('booking_id', a.bookingId)
    if (error) { console.error(`Erro em ${a.bookingId}:`, error); process.exit(1) }

    console.log(`${a.bookingId}: ${Number(antes?.valor_liquido ?? 0).toFixed(2)} → ${a.valor.toFixed(2)}  (${a.motivo})`)
  }

  // Diária de junho: recalcula como o sync (soma integral das reservas com
  // check-in em junho, exclui canceladas) e grava — o KPI reflete na hora,
  // sem esperar o sync diário das 05:00.
  const { data: apts } = await supabase
    .from('apartamentos')
    .select('id, numero, empreendimentos(nome)')

  const firstDayMs  = new Date(dataInicio + 'T00:00:00').getTime()
  const nextMonthMs = new Date(ANO, MES, 1).getTime()
  let tudoOk = true
  console.log('')

  for (const alvo of ALVOS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apt = (apts ?? []).find((x: any) =>
      String(x.numero).trim().toUpperCase() === alvo.numero &&
      ((x.empreendimentos as { nome?: string } | null)?.nome ?? '').toUpperCase().trim() === alvo.emp)
    if (!apt) { console.log(`${alvo.emp} ${alvo.numero}: apartamento não encontrado`); tudoOk = false; continue }

    const { data: reservas } = await supabase
      .from('amenitiz_reservas')
      .select('checkin, checkout, status, valor_liquido')
      .eq('apartamento_id', apt.id)
      .lte('checkin', dataFim)
      .gte('checkout', dataInicio)

    let full = 0   // soma integral check-in junho → valor da diária
    let panel = 0  // soma prorated → painel ocupação do mês
    for (const r of reservas ?? []) {
      if (['cancelled', 'canceled', 'no_show'].includes(String(r.status ?? '').toLowerCase())) continue
      const v = Number(r.valor_liquido ?? 0)
      if (String(r.checkin ?? '').slice(0, 7) === `${ANO}-${String(MES).padStart(2, '0')}`) full += v
      if (r.checkin && r.checkout) {
        const ci = new Date(r.checkin + 'T00:00:00').getTime()
        const co = new Date(r.checkout + 'T00:00:00').getTime()
        const totalNights = (co - ci) / 86400000
        const monthNights = (Math.min(co, nextMonthMs) - Math.max(ci, firstDayMs)) / 86400000
        if (monthNights <= 0) continue
        panel += (totalNights > 0 && monthNights < totalNights) ? (monthNights / totalNights) * v : v
      }
    }

    // Compara o valor ARREDONDADO (é o que a diária grava e o portal exibe);
    // a soma crua carrega resíduos sub-centavo dos valores da API. O painel de
    // ocupação também precisa fechar no alvo (igualado a pedido da gestão).
    const okFull = Math.round(full * 100) / 100 === alvo.alvo
      && Math.round(panel * 100) / 100 === alvo.alvo
    if (!okFull) tudoOk = false

    const { error: eDiaria } = await supabase
      .from('diarias')
      .update({ valor: Math.round(full * 100) / 100 })
      .eq('apartamento_id', apt.id)
      .gte('data', dataInicio).lte('data', dataFim)
    if (eDiaria) { console.error(`Erro diária ${alvo.emp} ${alvo.numero}:`, eDiaria); process.exit(1) }

    console.log(`${okFull ? 'OK ' : 'DIVERGE'} ${alvo.emp} ${alvo.numero}: diária jun = ${full.toFixed(2)} (alvo ${alvo.alvo.toFixed(2)}) | painel ocupação = ${panel.toFixed(2)}`)
  }

  if (!tudoOk) process.exit(1)
  console.log('\nDiárias de junho/2026 (KPI do portal/prestação) fecham nos valores definidos pela gestão.')
}

main().catch(e => { console.error(e); process.exit(1) })

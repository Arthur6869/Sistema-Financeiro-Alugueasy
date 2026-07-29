// ASA SUL 104 ("Asa Sul 415 - 104", quarto "SQS 414" / room e4a90e7d):
// o anúncio só passou a operar este imóvel em 16/05/2026. Até 12/03/2026 as
// reservas do mesmo anúncio eram do "Park Sul Essence - 204" (aba Cobranças das
// reservas antigas; confirmado pelo usuário em 29/07/2026). Entre 12/03 e 16/05
// o anúncio não teve reserva nenhuma.
//
// Este script desfaz a atribuição antiga no banco:
//   1. reservas com check-in < 16/05/2026 ficam com apartamento_id = NULL
//      (saem do portal da proprietária; as linhas continuam no banco com todos
//      os dados, então dá para reatribuí-las se o ESSENCE 204 for cadastrado);
//   2. as diárias de jan/fev/mar 2026 do apartamento são apagadas — elas somavam
//      faturamento do imóvel antigo no KPI e no gráfico de evolução.
//
// A regra permanente vive em TRANSFERENCIAS_ANUNCIO (lib/sync-amenitiz-core.ts):
// sem ela o sync volta a atribuir as reservas antigas a este apartamento. As
// diárias de jan/fev/mar NÃO voltam sozinhas (a janela do sync cobre só o mês
// corrente + 2 anteriores), mas as reservas voltam.
//
// Rodar da raiz do repo: npx tsx scripts/transferencia-asasul104-16mai2026.ts

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const INICIO_NOVO_IMOVEL = '2026-05-16'
const ROOM_ID = 'e4a90e7d-15f4-4874-86fe-498e6741ddc8'

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: apt } = await supabase
    .from('apartamentos')
    .select('id, numero, amenitiz_room_id, empreendimentos(nome)')
    .eq('amenitiz_room_id', ROOM_ID)
    .single()

  if (!apt) { console.error(`Nenhum apartamento com amenitiz_room_id ${ROOM_ID}`); process.exit(1) }
  const empNome = (apt.empreendimentos as { nome?: string } | null)?.nome ?? '?'
  console.log(`Apartamento do quarto SQS 414: ${empNome} ${apt.numero} (${apt.id})\n`)

  // 1. Reservas anteriores à troca → apartamento_id NULL
  const { data: antigas } = await supabase
    .from('amenitiz_reservas')
    .select('booking_id, checkin, checkout, status, valor_liquido')
    .eq('apartamento_id', apt.id)
    .lt('checkin', INICIO_NOVO_IMOVEL)
    .order('checkin')

  const ativas = (antigas ?? []).filter(r => !['cancelled', 'canceled', 'no_show'].includes(String(r.status ?? '').toLowerCase()))
  const somaAtivas = ativas.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)
  console.log(`Reservas com check-in antes de ${INICIO_NOVO_IMOVEL}: ${(antigas ?? []).length} (${ativas.length} ativas, R$ ${somaAtivas.toFixed(2)})`)
  if ((antigas ?? []).length > 0) {
    console.log(`  primeira: ${antigas![0].checkin}  |  última: ${antigas![antigas!.length - 1].checkin}`)
    const { error } = await supabase
      .from('amenitiz_reservas')
      .update({ apartamento_id: null })
      .eq('apartamento_id', apt.id)
      .lt('checkin', INICIO_NOVO_IMOVEL)
    if (error) { console.error('Erro ao desvincular reservas:', error); process.exit(1) }
    console.log('  → apartamento_id = NULL aplicado')
  }

  // 2. Diárias dos meses anteriores à troca (jan/fev/mar 2026)
  const primeiroMesNovo = INICIO_NOVO_IMOVEL.slice(0, 8) + '01'
  const { data: diariasAntigas } = await supabase
    .from('diarias')
    .select('data, valor')
    .eq('apartamento_id', apt.id)
    .lt('data', primeiroMesNovo)
    .order('data')

  console.log(`\nDiárias anteriores a ${primeiroMesNovo}: ${(diariasAntigas ?? []).length}`)
  for (const d of diariasAntigas ?? []) console.log(`  ${d.data} = R$ ${Number(d.valor).toFixed(2)}  → apagada`)
  if ((diariasAntigas ?? []).length > 0) {
    const { error } = await supabase
      .from('diarias')
      .delete()
      .eq('apartamento_id', apt.id)
      .lt('data', primeiroMesNovo)
    if (error) { console.error('Erro ao apagar diárias antigas:', error); process.exit(1) }
  }

  // 3. Conferência: o que sobra por mês no portal da proprietária
  const { data: diarias } = await supabase
    .from('diarias').select('data, valor').eq('apartamento_id', apt.id).order('data')
  const { data: restantes } = await supabase
    .from('amenitiz_reservas').select('checkin, status, valor_liquido')
    .eq('apartamento_id', apt.id).order('checkin')

  const ativasRestantes = (restantes ?? []).filter(r => !['cancelled', 'canceled', 'no_show'].includes(String(r.status ?? '').toLowerCase()))
  console.log(`\nReservas que restam no apartamento: ${(restantes ?? []).length} (primeiro check-in: ${restantes?.[0]?.checkin ?? '—'})`)

  console.log('\nKPI de faturamento por mês (tabela diarias):')
  for (const d of diarias ?? []) {
    const mesRef = String(d.data).slice(0, 7)
    const soma = ativasRestantes
      .filter(r => String(r.checkin ?? '').slice(0, 7) === mesRef)
      .reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)
    console.log(`  ${mesRef} = R$ ${Number(d.valor).toFixed(2).padStart(9)}   (soma das reservas do mês: R$ ${soma.toFixed(2)})`)
  }

  if ((restantes ?? []).some(r => String(r.checkin ?? '') < INICIO_NOVO_IMOVEL)) {
    console.error('\nAinda há reserva anterior à troca vinculada ao apartamento — verificar.')
    process.exit(1)
  }
  console.log(`\nOK: o apartamento só conta reservas a partir de ${INICIO_NOVO_IMOVEL}.`)
}

main().catch(e => { console.error(e); process.exit(1) })

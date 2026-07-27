// Correção LINK Noroeste 204 × BRISAS A115 (solicitada pelo usuário em 27/07/2026).
//
// O anúncio "Link Noroeste - 204" na Amenitiz era, até 28/05/2026, o imóvel
// BRISAS A115 (a aba Cobranças das reservas antigas mostra "Brisas do Lago
// A115"). O LINK 204 começou a operar em 29/05/2026 (primeiro check-in —
// já registrado em TRANSFERENCIAS_ANUNCIO desde 07/07, mas com imóvel antigo
// desconhecido: reservas antigas ficaram com FK nula ou, via migration 025,
// atribuídas ao LINK 204).
//
// O script:
//   1. (audit)  Lista reservas com check-in < 2026-05-29 atribuídas ao
//               LINK 204 OU sem vínculo com nome de quarto "…Noroeste - 204",
//               e o estado das diárias de ambos os imóveis em jan–mai/2026.
//   2. (--apply) Move essas reservas para BRISAS A115, recalculando
//               valor_liquido/taxa_aplicada (Booking: 13% LINK → 16% BRISAS).
//
// Rodar da raiz do repo:
//   npx tsx scripts/fix-link204-brisas-a115.ts           # auditoria (read-only)
//   npx tsx scripts/fix-link204-brisas-a115.ts --apply   # aplica a correção

import { readFileSync } from 'node:fs'
import { calcularValorLiquido } from '../lib/amenitiz'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const CORTE = '2026-05-29' // primeiro check-in do LINK 204
const APPLY = process.argv.includes('--apply')

type Reserva = {
  booking_id: string
  individual_room_name: string | null
  checkin: string | null
  checkout: string | null
  status: string | null
  source: string | null
  plataforma_normalizada: string | null
  valor_bruto: number
  taxa_aplicada: number | null
  valor_liquido: number | null
  mes_competencia: number | null
  ano_competencia: number | null
  nome_hospede: string | null
  apartamento_id: string | null
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. Resolver os dois apartamentos
  const { data: apts, error: aptErr } = await supabase
    .from('apartamentos')
    .select('id, numero, tipo_gestao, amenitiz_room_id, empreendimentos(nome)')
    .in('numero', ['204', 'A115'])
  if (aptErr) throw aptErr

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byKey = (emp: string, num: string) => (apts ?? []).find((a: any) =>
    ((a.empreendimentos?.nome ?? '').toUpperCase().includes(emp)) && a.numero === num)

  const link204 = byKey('LINK', '204')
  const a115    = byKey('BRISAS', 'A115')
  console.log('LINK 204 :', link204?.id, '| tipo_gestao:', link204?.tipo_gestao)
  console.log('A115     :', a115?.id, '| tipo_gestao:', a115?.tipo_gestao)
  if (!link204 || !a115) throw new Error('Apartamento LINK 204 ou BRISAS A115 não encontrado')

  const CAMPOS = 'booking_id, individual_room_name, checkin, checkout, status, source, plataforma_normalizada, valor_bruto, taxa_aplicada, valor_liquido, mes_competencia, ano_competencia, nome_hospede, apartamento_id'

  // 2a. Reservas atribuídas ao LINK 204 com check-in antes do corte.
  // Exclui lançamentos manuais (booking_id 'manual%'): o usuário confirmou em
  // 27/07 que a reserva direta de 19–21/05 ficou no imóvel físico do LINK 204.
  const { data: comFk, error: e1 } = await supabase
    .from('amenitiz_reservas').select(CAMPOS)
    .eq('apartamento_id', link204.id)
    .not('booking_id', 'ilike', 'manual%')
    .lt('checkin', CORTE)
  if (e1) throw e1

  // 2b. Reservas SEM vínculo (FK nula pela regra antiga de transferência) com
  //     nome de quarto do anúncio, antes do corte
  const { data: semFk, error: e2 } = await supabase
    .from('amenitiz_reservas').select(CAMPOS)
    .is('apartamento_id', null)
    .ilike('individual_room_name', '%noroeste - 204%')
    .lt('checkin', CORTE)
  if (e2) throw e2

  const vistos = new Set<string>()
  const reservas: Reserva[] = []
  for (const r of [...(comFk ?? []), ...(semFk ?? [])] as Reserva[]) {
    if (vistos.has(r.booking_id)) continue
    vistos.add(r.booking_id)
    reservas.push(r)
  }
  reservas.sort((x, y) => String(x.checkin).localeCompare(String(y.checkin)))

  console.log(`\n── Reservas a mover (check-in < ${CORTE}): ${reservas.length}`
    + `  (${comFk?.length ?? 0} no LINK 204, ${semFk?.length ?? 0} sem vínculo)`)

  const porMes: Record<string, { qtd: number; liqAtual: number; liqNovo: number }> = {}
  const cancelada = (s: string | null) => ['cancelled', 'canceled', 'no_show'].includes(String(s ?? '').toLowerCase())

  for (const r of reservas) {
    const novo = calcularValorLiquido(Number(r.valor_bruto) || 0, r.source ?? '', 'BRISAS', 'A115')
    const k = `${r.ano_competencia}-${String(r.mes_competencia).padStart(2, '0')}`
    porMes[k] ??= { qtd: 0, liqAtual: 0, liqNovo: 0 }
    if (!cancelada(r.status)) {
      porMes[k].qtd++
      porMes[k].liqAtual += Number(r.valor_liquido) || 0
      porMes[k].liqNovo  += novo.valorLiquido
    }
    console.log(
      `  ${r.checkin} → ${r.checkout}  ${String(r.plataforma_normalizada ?? r.source).padEnd(9)}`
      + ` ${String(r.status).padEnd(10)} FK ${r.apartamento_id ? 'LINK204' : 'null   '}`
      + ` bruto ${String(r.valor_bruto).padStart(9)}`
      + ` líq ${String(r.valor_liquido).padStart(9)} → ${novo.valorLiquido.toFixed(2).padStart(9)}`
      + ` (taxa ${r.taxa_aplicada} → ${novo.taxaAplicada})  ${r.nome_hospede ?? ''}`
    )
  }

  console.log('\n── Resumo por competência (só ativas):')
  for (const [k, v] of Object.entries(porMes).sort()) {
    console.log(`  ${k}: ${v.qtd} reservas | líq atual R$ ${v.liqAtual.toFixed(2)} | líq novo (16%) R$ ${v.liqNovo.toFixed(2)}`)
  }

  // 3. Estado atual das diárias jan–mai/2026 dos dois apartamentos
  const { data: diarias } = await supabase
    .from('diarias')
    .select('id, apartamento_id, data, valor, tipo_gestao')
    .in('apartamento_id', [link204.id, a115.id])
    .gte('data', '2025-12-01').lte('data', '2026-05-31')
    .order('data')
  console.log('\n── Diárias dez/2025–mai/2026:')
  for (const d of diarias ?? []) {
    const quem = d.apartamento_id === link204.id ? 'LINK 204' : 'A115    '
    console.log(`  ${quem} ${d.data}  R$ ${d.valor}  (${d.tipo_gestao})`)
  }

  // 4. Sanidade: reservas que o A115 já tem antes do corte
  const { count: a115Count } = await supabase
    .from('amenitiz_reservas')
    .select('*', { count: 'exact', head: true })
    .eq('apartamento_id', a115.id)
    .lt('checkin', CORTE)
  console.log(`\n── Reservas já no A115 com check-in antes do corte: ${a115Count}`)

  if (!APPLY) {
    console.log('\n(auditoria — nada foi alterado; rode com --apply para corrigir)')
    return
  }

  // ── APLICAÇÃO ─────────────────────────────────────────────────────────────
  console.log('\n════ APLICANDO CORREÇÃO ════')

  for (const r of reservas) {
    const novo = calcularValorLiquido(Number(r.valor_bruto) || 0, r.source ?? '', 'BRISAS', 'A115')
    const { error } = await supabase
      .from('amenitiz_reservas')
      .update({
        apartamento_id: a115.id,
        valor_liquido: Math.round(novo.valorLiquido * 100) / 100,
        taxa_aplicada: novo.taxaAplicada,
      })
      .eq('booking_id', r.booking_id)
    if (error) { console.error(`Erro em ${r.booking_id}:`, error.message); process.exit(1) }
  }
  console.log(`Reservas movidas para A115: ${reservas.length}`)

  // Verificação pós-aplicação
  const { count: restantes } = await supabase
    .from('amenitiz_reservas')
    .select('*', { count: 'exact', head: true })
    .eq('apartamento_id', link204.id)
    .lt('checkin', CORTE)
  const { count: noA115 } = await supabase
    .from('amenitiz_reservas')
    .select('*', { count: 'exact', head: true })
    .eq('apartamento_id', a115.id)
    .lt('checkin', CORTE)
  console.log(`Verificação: LINK 204 antes do corte = ${restantes} | A115 antes do corte = ${noA115}`)

  console.log('\nConcluído. O portal do LINK 204 passa a mostrar reservas só a partir de 29/05/2026.')
}

main().catch(e => { console.error(e); process.exit(1) })

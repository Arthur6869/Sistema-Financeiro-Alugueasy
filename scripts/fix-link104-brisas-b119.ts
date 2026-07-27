// Correção LINK Noroeste 104 × BRISAS B119 (solicitada pelo usuário em 27/07/2026).
//
// O anúncio "LINK Noroeste - 104" na Amenitiz era, até 02/05/2026, o imóvel
// BRISAS B119 (a aba Cobranças das reservas antigas mostra "Brisas do Lago -
// B119"). O LINK 104 começou a operar em 03/05/2026 (primeiro check-in).
// Como a API da Amenitiz devolve o nome ATUAL do quarto, os syncs atribuíram
// reservas de jan–abr ao LINK 104 indevidamente.
//
// O script:
//   1. (audit)  Lista reservas com check-in < 2026-05-03 atribuídas ao LINK 104
//               e o estado das diárias de ambos os imóveis em jan–mai/2026.
//   2. (--apply) Move essas reservas para BRISAS B119, recalculando
//               valor_liquido/taxa_aplicada (Booking: 13% LINK → 16% BRISAS).
//
// DIÁRIAS NÃO SÃO ALTERADAS: a auditoria de 27/07/2026 mostrou que o B119 já
// tem diárias fev–abr/2026 geradas com estas reservas a 16% (mar e abr batem
// centavo a centavo) e o LINK 104 não tem diárias antes de mai/2026 — somar
// aqui contaria em dobro.
//
// Rodar da raiz do repo:
//   npx tsx scripts/fix-link104-brisas-b119.ts           # auditoria (read-only)
//   npx tsx scripts/fix-link104-brisas-b119.ts --apply   # aplica a correção

import { readFileSync } from 'node:fs'
import { calcularValorLiquido } from '../lib/amenitiz'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const CORTE = '2026-05-03' // primeiro check-in do LINK 104
const APPLY = process.argv.includes('--apply')

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
    .in('numero', ['104', 'B119'])
  if (aptErr) throw aptErr

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byKey = (emp: string, num: string) => (apts ?? []).find((a: any) =>
    ((a.empreendimentos?.nome ?? '').toUpperCase().includes(emp)) && a.numero === num)

  const link104 = byKey('LINK', '104')
  const b119    = byKey('BRISAS', 'B119')
  console.log('LINK 104 :', link104?.id, '| tipo_gestao:', link104?.tipo_gestao)
  console.log('B119     :', b119?.id, '| tipo_gestao:', b119?.tipo_gestao)
  if (!link104 || !b119) throw new Error('Apartamento LINK 104 ou BRISAS B119 não encontrado')

  // 2. Reservas atribuídas ao LINK 104 com check-in antes do corte
  const { data: reservas, error: resErr } = await supabase
    .from('amenitiz_reservas')
    .select('booking_id, individual_room_name, individual_room_number, checkin, checkout, status, source, plataforma_normalizada, valor_bruto, taxa_aplicada, valor_liquido, mes_competencia, ano_competencia, nome_hospede')
    .eq('apartamento_id', link104.id)
    .lt('checkin', CORTE)
    .order('checkin')
  if (resErr) throw resErr

  console.log(`\n── Reservas no LINK 104 com check-in < ${CORTE}: ${reservas?.length ?? 0}`)
  const porMes: Record<string, { qtd: number; liqAtual: number; liqNovo: number }> = {}
  const cancelada = (s: string | null) => ['cancelled', 'canceled', 'no_show'].includes(String(s ?? '').toLowerCase())

  for (const r of reservas ?? []) {
    const novo = calcularValorLiquido(Number(r.valor_bruto) || 0, r.source ?? '', 'BRISAS', 'B119')
    const k = `${r.ano_competencia}-${String(r.mes_competencia).padStart(2, '0')}`
    porMes[k] ??= { qtd: 0, liqAtual: 0, liqNovo: 0 }
    if (!cancelada(r.status)) {
      porMes[k].qtd++
      porMes[k].liqAtual += Number(r.valor_liquido) || 0
      porMes[k].liqNovo  += novo.valorLiquido
    }
    console.log(
      `  ${r.checkin} → ${r.checkout}  ${String(r.plataforma_normalizada ?? r.source).padEnd(9)}`
      + ` ${String(r.status).padEnd(10)} bruto ${String(r.valor_bruto).padStart(9)}`
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
    .in('apartamento_id', [link104.id, b119.id])
    .gte('data', '2026-01-01').lte('data', '2026-05-31')
    .order('data')
  console.log('\n── Diárias jan–mai/2026:')
  for (const d of diarias ?? []) {
    const quem = d.apartamento_id === link104.id ? 'LINK 104' : 'B119    '
    console.log(`  ${quem} ${d.data}  R$ ${d.valor}  (${d.tipo_gestao})`)
  }

  // 4. Reservas que o B119 já tem no período (sanidade — não deve haver sobreposição)
  const { count: b119Count } = await supabase
    .from('amenitiz_reservas')
    .select('*', { count: 'exact', head: true })
    .eq('apartamento_id', b119.id)
    .lt('checkin', CORTE)
    .gte('checkin', '2026-01-01')
  console.log(`\n── Reservas já no B119 com check-in em 2026 antes do corte: ${b119Count}`)

  if (!APPLY) {
    console.log('\n(auditoria — nada foi alterado; rode com --apply para corrigir)')
    return
  }

  // ── APLICAÇÃO ─────────────────────────────────────────────────────────────
  console.log('\n════ APLICANDO CORREÇÃO ════')

  // 5. Mover reservas uma a uma (valores recalculados individualmente)
  for (const r of reservas ?? []) {
    const novo = calcularValorLiquido(Number(r.valor_bruto) || 0, r.source ?? '', 'BRISAS', 'B119')
    const { error } = await supabase
      .from('amenitiz_reservas')
      .update({
        apartamento_id: b119.id,
        valor_liquido: Math.round(novo.valorLiquido * 100) / 100,
        taxa_aplicada: novo.taxaAplicada,
      })
      .eq('booking_id', r.booking_id)
    if (error) { console.error(`Erro em ${r.booking_id}:`, error.message); process.exit(1) }
  }
  console.log(`Reservas movidas para B119: ${reservas?.length ?? 0}`)

  // 6. Verificação pós-aplicação
  const { count: restantes } = await supabase
    .from('amenitiz_reservas')
    .select('*', { count: 'exact', head: true })
    .eq('apartamento_id', link104.id)
    .lt('checkin', CORTE)
  const { count: noB119 } = await supabase
    .from('amenitiz_reservas')
    .select('*', { count: 'exact', head: true })
    .eq('apartamento_id', b119.id)
    .lt('checkin', CORTE)
  console.log(`Verificação: LINK 104 antes do corte = ${restantes} | B119 antes do corte = ${noB119}`)

  console.log('\nConcluído. O portal do LINK 104 passa a mostrar reservas só a partir de 03/05/2026.')
}

main().catch(e => { console.error(e); process.exit(1) })

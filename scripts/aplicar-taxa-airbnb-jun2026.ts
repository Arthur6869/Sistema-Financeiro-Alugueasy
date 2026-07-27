// Taxa Airbnb 18,21% a partir de junho/2026 (definida pelo usuário em 27/07/2026).
//
// Até mai/2026 o Airbnb era tratado como 0% (valor da API considerado já
// líquido) — essas competências NÃO são alteradas. A partir de jun/2026 a
// taxa é 18,21% para todos os empreendimentos (lib/amenitiz.ts).
//
// O script recalcula as reservas Airbnb já gravadas com competência
// jun/2026 em diante (valor_liquido = bruto × 0,8179; taxa 0,1821) e ajusta
// as diárias de JUNHO pelo delta por apartamento (junho é mês fechado — o
// portal usa diárias como fonte primária). As diárias de julho NÃO são
// ajustadas: o full sync diário de 05:00 as regenera com o código novo, e o
// portal do mês corrente usa as reservas ao vivo (preferirReservas).
//
// Idempotente: só toca linhas com taxa_aplicada = 0. Rodar de novo após o
// deploy é seguro (e recomendado — o cron de 5 min com o código antigo pode
// reverter linhas de jun/jul que cruzam meses até o deploy concluir).
//
// Rodar da raiz do repo:
//   npx tsx scripts/aplicar-taxa-airbnb-jun2026.ts           # auditoria
//   npx tsx scripts/aplicar-taxa-airbnb-jun2026.ts --apply   # aplica

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const TAXA = 0.1821
const APPLY = process.argv.includes('--apply')

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Reservas Airbnb de competência jun/2026 em diante ainda a 0%
  const { data: reservas, error } = await supabase
    .from('amenitiz_reservas')
    .select('booking_id, apartamento_id, checkin, checkout, status, valor_bruto, taxa_aplicada, valor_liquido, mes_competencia, ano_competencia, nome_hospede')
    .eq('plataforma_normalizada', 'Airbnb')
    .eq('taxa_aplicada', 0)
    .gte('checkin', '2026-06-01')
    .order('checkin')
  if (error) throw error

  const cancelada = (s: string | null) => ['cancelled', 'canceled', 'no_show'].includes(String(s ?? '').toLowerCase())

  console.log(`── Reservas Airbnb (checkin >= 2026-06-01) com taxa 0%: ${reservas?.length ?? 0}`)

  // Delta de junho por apartamento (só ativas com FK — diárias são por FK)
  const deltaJunhoPorApt: Record<string, number> = {}
  const resumo: Record<string, { qtd: number; bruto: number; liqNovo: number }> = {}

  for (const r of reservas ?? []) {
    const bruto = Number(r.valor_bruto) || 0
    const liqNovo = Math.round(bruto * (1 - TAXA) * 100) / 100
    const k = `${r.ano_competencia}-${String(r.mes_competencia).padStart(2, '0')}`
    resumo[k] ??= { qtd: 0, bruto: 0, liqNovo: 0 }
    if (!cancelada(r.status)) {
      resumo[k].qtd++
      resumo[k].bruto += bruto
      resumo[k].liqNovo += liqNovo
      if (r.mes_competencia === 6 && r.ano_competencia === 2026 && r.apartamento_id) {
        deltaJunhoPorApt[r.apartamento_id] = (deltaJunhoPorApt[r.apartamento_id] ?? 0) + (bruto - liqNovo)
      }
    }
  }

  console.log('\n── Resumo por competência (só ativas):')
  for (const [k, v] of Object.entries(resumo).sort()) {
    console.log(`  ${k}: ${v.qtd} reservas | bruto R$ ${v.bruto.toFixed(2)} | líq novo R$ ${v.liqNovo.toFixed(2)} | desconto R$ ${(v.bruto - v.liqNovo).toFixed(2)}`)
  }

  const aptIds = Object.keys(deltaJunhoPorApt)
  console.log(`\n── Diárias de jun/2026 a ajustar: ${aptIds.length} apartamentos`)
  let diarias: { id: string; apartamento_id: string; valor: number }[] = []
  if (aptIds.length > 0) {
    const { data } = await supabase
      .from('diarias')
      .select('id, apartamento_id, valor')
      .in('apartamento_id', aptIds)
      .eq('data', '2026-06-01')
    diarias = (data ?? []) as typeof diarias
    for (const aptId of aptIds) {
      const d = diarias.find(x => x.apartamento_id === aptId)
      const delta = Math.round(deltaJunhoPorApt[aptId] * 100) / 100
      console.log(`  apt ${aptId.slice(0, 8)}: diária ${d ? `R$ ${d.valor} → R$ ${(Number(d.valor) - delta).toFixed(2)}` : 'INEXISTENTE'} (−R$ ${delta.toFixed(2)})`)
    }
  }

  if (!APPLY) {
    console.log('\n(auditoria — nada foi alterado; rode com --apply para aplicar)')
    return
  }

  console.log('\n════ APLICANDO ════')

  for (const r of reservas ?? []) {
    const bruto = Number(r.valor_bruto) || 0
    const { error: upErr } = await supabase
      .from('amenitiz_reservas')
      .update({ taxa_aplicada: TAXA, valor_liquido: Math.round(bruto * (1 - TAXA) * 100) / 100 })
      .eq('booking_id', r.booking_id)
      .eq('taxa_aplicada', 0) // guarda extra de idempotência
    if (upErr) { console.error(`Erro em ${r.booking_id}:`, upErr.message); process.exit(1) }
  }
  console.log(`Reservas recalculadas: ${reservas?.length ?? 0}`)

  for (const aptId of aptIds) {
    const d = diarias.find(x => x.apartamento_id === aptId)
    if (!d) { console.log(`  apt ${aptId.slice(0, 8)}: sem diária de junho — nada a ajustar`); continue }
    const delta = Math.round(deltaJunhoPorApt[aptId] * 100) / 100
    const novo = Math.round((Number(d.valor) - delta) * 100) / 100
    const { error: diaErr } = await supabase.from('diarias').update({ valor: novo }).eq('id', d.id)
    if (diaErr) { console.error(`Erro diária apt ${aptId}:`, diaErr.message); process.exit(1) }
    console.log(`  apt ${aptId.slice(0, 8)}: diária jun R$ ${d.valor} → R$ ${novo}`)
  }

  console.log('\nConcluído.')
}

main().catch(e => { console.error(e); process.exit(1) })

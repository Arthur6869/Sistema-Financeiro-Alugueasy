import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const MES = 1, ANO = 2026

  // 1. Total da amenitiz_reservas (fonte do dashboard)
  const { data: reservas } = await supabase
    .from('amenitiz_reservas')
    .select('valor_liquido, valor_bruto, plataforma, individual_room_number, nome_hospede, checkin, checkout')
    .eq('mes_competencia', MES)
    .eq('ano_competencia', ANO)
    .order('checkin')

  const totalAmenitiz = (reservas ?? []).reduce((a, r) => a + (r.valor_liquido ?? 0), 0)
  console.log(`\n=== AMENITIZ_RESERVAS jan/2026 ===`)
  console.log(`Total reservas: ${reservas?.length ?? 0}`)
  console.log(`Faturamento líquido: R$ ${totalAmenitiz.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)

  // 2. Breakdown por plataforma
  const por_plat: Record<string, { bruto: number; liquido: number; qtd: number }> = {}
  for (const r of reservas ?? []) {
    const p = r.plataforma ?? 'desconhecido'
    if (!por_plat[p]) por_plat[p] = { bruto: 0, liquido: 0, qtd: 0 }
    por_plat[p].bruto += r.valor_bruto ?? 0
    por_plat[p].liquido += r.valor_liquido ?? 0
    por_plat[p].qtd++
  }
  console.log('\nPor plataforma:')
  for (const [p, v] of Object.entries(por_plat).sort(([, a], [, b]) => b.liquido - a.liquido)) {
    console.log(`  ${p}: ${v.qtd} reservas | bruto R$ ${v.bruto.toFixed(2)} | líquido R$ ${v.liquido.toFixed(2)}`)
  }

  // 3. Breakdown por quarto (individual_room_number)
  const por_quarto: Record<string, number> = {}
  for (const r of reservas ?? []) {
    const q = String(r.individual_room_number ?? 'sem_quarto')
    por_quarto[q] = (por_quarto[q] ?? 0) + (r.valor_liquido ?? 0)
  }
  console.log('\nPor quarto (todos, ordenados por valor DESC):')
  Object.entries(por_quarto)
    .sort(([, a], [, b]) => b - a)
    .forEach(([q, v]) => console.log(`  Quarto ${String(q).padEnd(12)} R$ ${v.toFixed(2)}`))

  // 4. Apartamentos no banco com seus room_ids
  const { data: apts } = await supabase
    .from('apartamentos')
    .select('id, numero, tipo_gestao, amenitiz_room_id, empreendimentos(nome)')
    .order('empreendimento_id')

  const quartos_no_banco = new Set(apts?.map(a => String(a.amenitiz_room_id)).filter(Boolean) ?? [])
  const quartos_na_amenitiz = new Set(Object.keys(por_quarto))

  const quartos_sem_apt = [...quartos_na_amenitiz].filter(q => !quartos_no_banco.has(q))
  const valor_perdido = quartos_sem_apt.reduce((a, q) => a + (por_quarto[q] ?? 0), 0)

  console.log(`\n=== QUARTOS DA AMENITIZ SEM APARTAMENTO MAPEADO ===`)
  console.log(`Quartos na Amenitiz: ${quartos_na_amenitiz.size}`)
  console.log(`Quartos mapeados no banco: ${quartos_no_banco.size}`)
  console.log(`Quartos SEM mapeamento: ${quartos_sem_apt.length}`)
  console.log(`Valor perdido por falta de mapeamento: R$ ${valor_perdido.toFixed(2)}`)
  if (quartos_sem_apt.length > 0) {
    console.log('\nQuartos sem mapeamento:')
    quartos_sem_apt
      .sort((a, b) => (por_quarto[b] ?? 0) - (por_quarto[a] ?? 0))
      .forEach(q => console.log(`  room ${String(q).padEnd(12)} R$ ${(por_quarto[q] ?? 0).toFixed(2)}`))
  }

  // 5. Apartamentos no banco SEM room_id (invisíveis ao sync)
  const sem_room = apts?.filter(a => !a.amenitiz_room_id) ?? []
  console.log(`\n=== APARTAMENTOS NO BANCO SEM amenitiz_room_id ===`)
  console.log(`Total sem room_id: ${sem_room.length}`)
  sem_room.forEach(a => {
    const emp = (a.empreendimentos as any)?.nome ?? '?'
    console.log(`  ${emp.padEnd(16)} apt ${String(a.numero).padEnd(8)} tipo=${a.tipo_gestao}`)
  })

  // 6. Total da tabela diarias (importação das planilhas)
  const { data: diarias } = await supabase
    .from('diarias')
    .select('valor, tipo_gestao, apartamentos(numero, empreendimentos(nome))')
    .gte('data', `${ANO}-${String(MES).padStart(2, '0')}-01`)
    .lte('data', `${ANO}-${String(MES).padStart(2, '0')}-31`)

  const totalDiarias = (diarias ?? []).reduce((a, r) => a + (r.valor ?? 0), 0)
  console.log(`\n=== TABELA DIARIAS jan/2026 ===`)
  console.log(`Total registros: ${diarias?.length ?? 0}`)
  console.log(`Total valor: R$ ${totalDiarias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)

  const por_emp_diarias: Record<string, { adm: number; sub: number }> = {}
  for (const r of diarias ?? []) {
    const raw = r.apartamentos as unknown
    const apt = Array.isArray(raw) ? (raw[0] as any) : (raw as any)
    const emp = apt?.empreendimentos?.nome ?? '?'
    if (!por_emp_diarias[emp]) por_emp_diarias[emp] = { adm: 0, sub: 0 }
    if (r.tipo_gestao === 'adm') por_emp_diarias[emp].adm += r.valor ?? 0
    else por_emp_diarias[emp].sub += r.valor ?? 0
  }

  const PLANILHA: Record<string, { adm: number; sub: number }> = {
    'ESSENCE':      { adm: 53664.02, sub: 11145.01 },
    'EASY':         { adm: 10846.41, sub: 0 },
    'CULLINAN':     { adm: 3905.32,  sub: 27627.93 },
    'ATHOS':        { adm: 6107.60,  sub: 22296.86 },
    'NOBILE':       { adm: 2417.61,  sub: 4645.16 },
    'FUSION':       { adm: 13995.07, sub: 2901.46 },
    'MERCURE':      { adm: 9228.07,  sub: 27361.48 },
    'METROPOLITAN': { adm: 29140.77, sub: 7836.72 },
    'BRISAS':       { adm: 20088.83, sub: 26075.28 },
  }

  console.log('\n=== COMPARAÇÃO BANCO vs PLANILHA (tabela diarias) ===')
  console.log(`${'Emp'.padEnd(16)} ${'Banco ADM'.padStart(12)} ${'Plan ADM'.padStart(12)} ${'Banco SUB'.padStart(12)} ${'Plan SUB'.padStart(12)} Status`)
  console.log('─'.repeat(75))
  let totalBancoAdm = 0, totalBancoSub = 0, totalPlanAdm = 0, totalPlanSub = 0
  for (const [emp, plan] of Object.entries(PLANILHA)) {
    const b = por_emp_diarias[emp] ?? { adm: 0, sub: 0 }
    const diffA = b.adm - plan.adm
    const diffS = b.sub - plan.sub
    const ok = Math.abs(diffA) < 1 && Math.abs(diffS) < 1
    totalBancoAdm += b.adm; totalBancoSub += b.sub
    totalPlanAdm += plan.adm; totalPlanSub += plan.sub
    console.log(
      `${emp.padEnd(16)} ${b.adm.toFixed(0).padStart(12)} ${plan.adm.toFixed(0).padStart(12)} ${b.sub.toFixed(0).padStart(12)} ${plan.sub.toFixed(0).padStart(12)} ${ok ? '✅' : `❌ dA:${diffA.toFixed(0)} dS:${diffS.toFixed(0)}`}`
    )
  }
  console.log('─'.repeat(75))
  console.log(
    `${'TOTAL'.padEnd(16)} ${totalBancoAdm.toFixed(0).padStart(12)} ${totalPlanAdm.toFixed(0).padStart(12)} ${totalBancoSub.toFixed(0).padStart(12)} ${totalPlanSub.toFixed(0).padStart(12)}`
  )

  // 7. Histórico de importações
  const { data: importacoes } = await supabase
    .from('importacoes')
    .select('tipo, mes, ano, nome_arquivo, status, observacao, created_at')
    .eq('mes', MES).eq('ano', ANO)
    .order('created_at', { ascending: false })

  console.log(`\n=== HISTÓRICO IMPORTAÇÕES JAN/2026 ===`)
  for (const i of importacoes ?? []) {
    console.log(`  ${i.tipo.padEnd(14)} ${i.status.padEnd(12)} ${i.nome_arquivo ?? ''} ${i.observacao ? '⚠️  ' + i.observacao : ''}`)
  }

  console.log(`\n=== RESUMO FINAL ===`)
  console.log(`Amenitiz (sync):      R$ ${totalAmenitiz.toFixed(2).padStart(12)}`)
  console.log(`Diarias banco (xlsx): R$ ${totalDiarias.toFixed(2).padStart(12)}`)
  console.log(`Planilha esperado:    R$ ${(279283.60).toFixed(2).padStart(12)}`)
  console.log(`Diff Amenitiz→Plan:   R$ ${(279283.60 - totalAmenitiz).toFixed(2).padStart(12)}`)
  console.log(`Diff Diarias→Plan:    R$ ${(279283.60 - totalDiarias).toFixed(2).padStart(12)}`)
  console.log(`Valor não mapeado:    R$ ${valor_perdido.toFixed(2).padStart(12)}`)
}

main().catch(console.error)

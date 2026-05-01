import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 1. total atual no banco para jan/2026
  const { data: custos, error } = await supabase
    .from('custos')
    .select('valor, tipo_gestao, apartamento_id, categoria, apartamentos(numero, empreendimentos(nome))')
    .eq('mes', 1)
    .eq('ano', 2026)

  if (error) { console.error('Erro Supabase:', error.message); process.exit(1) }

  const totalBanco = custos?.reduce((a, r) => a + (r.valor ?? 0), 0) ?? 0
  console.log(`\nTotal no banco jan/2026: R$ ${totalBanco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
  console.log(`Total correto planilha:  R$ 205.775,01`)
  console.log(`Diferença:               R$ ${(205775.01 - totalBanco).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
  console.log(`\nTotal de registros no banco: ${custos?.length ?? 0}`)

  // 2. breakdown por empreendimento e tipo_gestao
  const por_emp: Record<string, { adm: number; sub: number }> = {}
  for (const r of custos ?? []) {
    const emp = (r.apartamentos as any)?.empreendimentos?.nome ?? '?'
    if (!por_emp[emp]) por_emp[emp] = { adm: 0, sub: 0 }
    if (r.tipo_gestao === 'adm') por_emp[emp].adm += r.valor ?? 0
    else por_emp[emp].sub += r.valor ?? 0
  }

  console.log('\n=== BREAKDOWN POR EMPREENDIMENTO (banco) vs PLANILHA ===')
  const esperado: Record<string, { adm: number; sub: number }> = {
    'ESSENCE':      { adm: 17050.57, sub: 13973.66 },
    'EASY':         { adm: 6388.28,  sub: 360.00 },
    'CULLINAN':     { adm: 2338.62,  sub: 35623.66 },
    'ATHOS':        { adm: 2319.57,  sub: 28944.65 },
    'NOBILE':       { adm: 1147.35,  sub: 4186.33 },
    'FUSION':       { adm: 5618.32,  sub: 4086.33 },
    'MERCURE':      { adm: 7124.68,  sub: 29975.01 },
    'METROPOLITAN': { adm: 11954.73, sub: 3998.31 },
    'BRISAS':       { adm: 8640.15,  sub: 22044.79 },
  }

  const header = `${'Empreendimento'.padEnd(16)} ${'Banco ADM'.padStart(12)} ${'Planilha ADM'.padStart(12)} ${'Banco SUB'.padStart(12)} ${'Planilha SUB'.padStart(12)} ${'Diff ADM'.padStart(10)} ${'Diff SUB'.padStart(10)}`
  console.log(header)
  console.log('-'.repeat(90))
  let totalDiff = 0
  for (const [emp, esp] of Object.entries(esperado)) {
    const b = por_emp[emp] ?? { adm: 0, sub: 0 }
    const diffAdm = b.adm - esp.adm
    const diffSub = b.sub - esp.sub
    totalDiff += diffAdm + diffSub
    const flag = Math.abs(diffAdm) > 1 || Math.abs(diffSub) > 1 ? ' ⚠️' : ''
    console.log(
      `${emp.padEnd(16)} ${b.adm.toFixed(2).padStart(12)} ${esp.adm.toFixed(2).padStart(12)} ${b.sub.toFixed(2).padStart(12)} ${esp.sub.toFixed(2).padStart(12)} ${diffAdm.toFixed(2).padStart(10)} ${diffSub.toFixed(2).padStart(10)}${flag}`
    )
  }

  // empreendimentos no banco que não estão na tabela esperada
  for (const [emp, vals] of Object.entries(por_emp)) {
    if (!esperado[emp]) {
      console.log(`${emp.padEnd(16)} ${vals.adm.toFixed(2).padStart(12)} ${'(não esperado)'.padStart(12)} ${vals.sub.toFixed(2).padStart(12)} ${'(não esperado)'.padStart(12)}  ⚠️ NÃO MAPEADO`)
    }
  }

  console.log('-'.repeat(90))
  console.log(`Diferença total (banco - planilha): R$ ${totalDiff.toFixed(2)}`)

  // 3. verificar duplicatas
  console.log('\n=== VERIFICAR DUPLICATAS ===')
  const chaves: Record<string, number> = {}
  for (const r of custos ?? []) {
    const k = `${r.apartamento_id}:${r.categoria}`
    chaves[k] = (chaves[k] ?? 0) + 1
  }
  const dups = Object.entries(chaves).filter(([, v]) => v > 1)
  if (dups.length > 0) {
    console.log(`ENCONTRADAS ${dups.length} chaves duplicadas!`)
    dups.slice(0, 20).forEach(([k, v]) => console.log(`  ${k} → ${v}x`))
  } else {
    console.log('Nenhuma duplicata encontrada.')
  }

  // 4. registros com apartamento sem empreendimento mapeado
  console.log('\n=== REGISTROS SEM EMPREENDIMENTO IDENTIFICADO ===')
  const semEmp = custos?.filter(r => !(r.apartamentos as any)?.empreendimentos?.nome) ?? []
  if (semEmp.length > 0) {
    console.log(`${semEmp.length} registros sem empreendimento:`)
    semEmp.slice(0, 10).forEach(r =>
      console.log(`  apartamento_id=${r.apartamento_id} valor=${r.valor} tipo=${r.tipo_gestao} cat=${r.categoria}`)
    )
  } else {
    console.log('Todos os registros têm empreendimento identificado.')
  }
}

main().catch(console.error)

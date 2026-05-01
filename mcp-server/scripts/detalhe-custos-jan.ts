import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const { data, error } = await supabase
    .from('custos')
    .select('id, apartamento_id, mes, ano, categoria, valor, tipo_gestao, apartamentos(numero, empreendimento_id, empreendimentos(id, nome))')
    .eq('mes', 1)
    .eq('ano', 2026)
    .order('tipo_gestao')

  if (error) { console.error(error.message); process.exit(1) }

  console.log(`\n=== ${data?.length ?? 0} REGISTROS JAN/2026 ===\n`)
  console.log(`${'ID'.padEnd(38)} ${'Apt ID'.padEnd(38)} ${'Apt#'.padStart(5)} ${'Tipo'.padStart(5)} ${'Valor'.padStart(12)} ${'Cat'.padEnd(25)} Empreendimento`)
  console.log('-'.repeat(145))
  for (const r of data ?? []) {
    const apt = r.apartamentos as any
    const emp = apt?.empreendimentos?.nome ?? '?'
    const empId = apt?.empreendimento_id ?? '?'
    console.log(`${r.id.padEnd(38)} ${r.apartamento_id.padEnd(38)} ${String(apt?.numero ?? '?').padStart(5)} ${r.tipo_gestao.padStart(5)} ${r.valor.toFixed(2).padStart(12)} ${(r.categoria ?? '').padEnd(25)} ${emp}`)
  }

  // também listar empreendimentos com seus IDs e os apartamentos que têm custos
  console.log('\n=== EMPREENDIMENTOS NO BANCO (com apartamentos que têm custos ADM) ===')
  const { data: emps } = await supabase
    .from('empreendimentos')
    .select('id, nome, apartamentos(id, numero)')
    .order('nome')
  for (const e of emps ?? []) {
    const apts = (e.apartamentos as any[]) ?? []
    console.log(`${e.nome.padEnd(20)} id=${e.id}  apts=[${apts.map((a: any) => `${a.numero}(${a.id.slice(0,8)})`).join(', ')}]`)
  }
}

main().catch(console.error)

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('=== TESTE END-TO-END — PORTAL DO PROPRIETÁRIO ===\n')

  // 1. Proprietários cadastrados
  const { data: props } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'proprietario')

  console.log(`✅ Proprietários cadastrados: ${props?.length ?? 0}`)
  props?.forEach(p => console.log(`   → ${p.full_name} (${p.id.slice(0, 8)}...)`))

  // 2. Vínculos ativos
  const { data: vinculos } = await supabase
    .from('proprietario_apartamentos')
    .select('proprietario_id, ativo, apartamentos(numero, empreendimentos(nome))')
    .eq('ativo', true)

  console.log(`\n✅ Vínculos ativos: ${vinculos?.length ?? 0}`)
  vinculos?.forEach(v => {
    const emp = (v.apartamentos as any)?.empreendimentos?.nome
    const num = (v.apartamentos as any)?.numero
    console.log(`   → Apt ${num} — ${emp}`)
  })

  // 3. Verificar se proprietário tem dados financeiros disponíveis
  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  console.log(`\n📊 Dados financeiros — ${mes}/${ano}:`)
  for (const v of vinculos ?? []) {
    const aptId = (v as any).apartamento_id ?? (v as any).apartamentos?.id
    const num = (v.apartamentos as any)?.numero

    const { data: fat } = await supabase
      .from('diarias')
      .select('valor')
      .eq('apartamento_id', aptId)
      .gte('data', dataInicio)
      .lte('data', dataFim)

    const { data: cus } = await supabase
      .from('custos')
      .select('valor')
      .eq('apartamento_id', aptId)
      .eq('mes', mes)
      .eq('ano', ano)

    const totalFat = (fat ?? []).reduce((a, r) => a + (r.valor ?? 0), 0)
    const totalCus = (cus ?? []).reduce((a, r) => a + (r.valor ?? 0), 0)
    const statusFat = totalFat > 0 ? '✅' : '⚠️  sem faturamento'
    const statusCus = totalCus > 0 ? '✅' : '⚠️  sem custos'
    console.log(`   Apt ${num} — fat: R$ ${totalFat.toFixed(2)} ${statusFat} | custos: R$ ${totalCus.toFixed(2)} ${statusCus}`)
  }

  // 4. Tabela acessível
  const { data: pol, error: polErr } = await supabase
    .from('proprietario_apartamentos')
    .select('id')
    .limit(1)

  console.log(`\n✅ Tabela proprietario_apartamentos acessível: ${polErr ? `❌ ${polErr.message}` : 'sim'}`)

  // 5. Distribuição de roles
  const { data: roles } = await supabase.from('profiles').select('role')
  const counts: Record<string, number> = {}
  roles?.forEach(r => { counts[r.role] = (counts[r.role] ?? 0) + 1 })
  console.log('\n✅ Distribuição de roles:')
  Object.entries(counts).sort().forEach(([r, n]) => console.log(`   ${r}: ${n} usuário(s)`))

  // 6. Policies RLS existentes
  const { data: policies } = await supabase
    .from('pg_policies' as any)
    .select('policyname, tablename')
    .in('tablename', ['proprietario_apartamentos', 'custos', 'diarias', 'amenitiz_reservas'])
    .like('policyname', '%proprietario%')

  console.log(`\n✅ RLS policies do portal: ${(policies as any)?.length ?? 'n/a'}`)
  ;(policies as any)?.forEach((p: any) => console.log(`   → ${p.tablename}: ${p.policyname}`))

  console.log('\n=== TESTE CONCLUÍDO ===')
}

main().catch(console.error)

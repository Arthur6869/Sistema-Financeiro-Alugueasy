import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('Verificando custos jan/2026 antes da limpeza...')

  const { data: antes, error } = await supabase
    .from('custos')
    .select('apartamento_id, categoria, valor, tipo_gestao, apartamentos(numero, empreendimentos(nome))')
    .eq('mes', 1).eq('ano', 2026)

  if (error) { console.error('Erro Supabase:', error.message); process.exit(1) }

  const total = (antes ?? []).reduce((a, r) => a + (r.valor ?? 0), 0)
  console.log(`Registros atuais: ${antes?.length ?? 0}`)
  console.log(`Total atual: R$ ${total.toFixed(2)}`)
  console.log(`Categorias únicas: ${new Set((antes ?? []).map(r => r.categoria)).size}`)

  const porApt: Record<string, { total: number; cats: Set<string> }> = {}
  for (const r of antes ?? []) {
    const raw = r.apartamentos as unknown
    const apt = Array.isArray(raw) ? (raw[0] as any) : (raw as any)
    const key = `${apt?.empreendimentos?.nome ?? '?'} apt ${apt?.numero ?? '?'} (${r.tipo_gestao})`
    if (!porApt[key]) porApt[key] = { total: 0, cats: new Set() }
    porApt[key].total += r.valor ?? 0
    porApt[key].cats.add(r.categoria ?? '')
  }

  console.log('\nTop 10 apts com maior custo (suspeitos de serem âncoras com total do empreendimento):')
  Object.entries(porApt)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10)
    .forEach(([k, v]) => console.log(`  ${k}: R$ ${v.total.toFixed(2)} (${v.cats.size} categs: ${[...v.cats].slice(0, 3).join(', ')}${v.cats.size > 3 ? '...' : ''})`))

  console.log('\nCategoria mais frequente:')
  const catCount: Record<string, number> = {}
  for (const r of antes ?? []) catCount[r.categoria ?? ''] = (catCount[r.categoria ?? ''] ?? 0) + 1
  Object.entries(catCount).sort(([, a], [, b]) => b - a).slice(0, 5).forEach(([k, v]) => console.log(`  "${k}": ${v}x`))

  // Detectar âncoras: apt com custo > 20k provavelmente é total do empreendimento
  const ancoras = Object.entries(porApt).filter(([, v]) => v.total > 20000 && v.cats.size <= 2)
  if (ancoras.length > 0) {
    console.log('\n⚠️  ÂNCORAS DETECTADAS (apts com custo > R$ 20.000 e ≤ 2 categorias):')
    ancoras.forEach(([k, v]) => console.log(`  ${k}: R$ ${v.total.toFixed(2)}`))
    console.log('   Estes são provavelmente "Total Consolidado" do empreendimento inteiro.')
  }

  // DELETE todos os custos de jan/2026
  console.log('\nLimpando custos jan/2026...')
  const { error: delErr } = await supabase
    .from('custos')
    .delete()
    .eq('mes', 1)
    .eq('ano', 2026)

  if (delErr) {
    console.error('Erro ao limpar:', delErr.message)
    process.exit(1)
  }

  console.log('\n✅ Custos jan/2026 limpos com sucesso.')
  console.log('\nPróximos passos:')
  console.log('   1. Acesse /importar na aplicação')
  console.log('   2. Selecione Janeiro / 2026')
  console.log('   3. Importe custos_adm (planilha ADM)')
  console.log('   4. Importe custos_sub (planilha SUB)')
  console.log('   5. Execute: verificar_importacao_custos { mes: 1, ano: 2026, tipo_gestao: "ambos" }')
}

main().catch(err => {
  console.error('\n❌ ERRO:', err.message)
  process.exit(1)
})

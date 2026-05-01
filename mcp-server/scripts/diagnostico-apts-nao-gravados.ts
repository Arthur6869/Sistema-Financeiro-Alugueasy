import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 1. Custo atual no banco por apt
  const { data: custos, error: custosError } = await supabase
    .from('custos')
    .select('valor, tipo_gestao, apartamentos(numero, empreendimentos(nome))')
    .eq('mes', 1).eq('ano', 2026)

  if (custosError) {
    throw new Error(`Erro ao buscar custos: ${custosError.message}`)
  }

  const totalBanco = (custos ?? []).reduce((a, r) => a + (r.valor ?? 0), 0)
  console.log(`Total no banco agora: R$ ${totalBanco.toFixed(2)}`)
  console.log('Esperado:             R$ 205.775,01')
  console.log(`Faltando:             R$ ${(205775.01 - totalBanco).toFixed(2)}\n`)

  // 2. Breakdown por empreendimento
  const porEmp: Record<string, { adm: number; sub: number; apts: string[] }> = {}
  for (const r of custos ?? []) {
    const emp = (r.apartamentos as any)?.empreendimentos?.nome ?? '?'
    const apt = (r.apartamentos as any)?.numero ?? '?'
    if (!porEmp[emp]) porEmp[emp] = { adm: 0, sub: 0, apts: [] }
    porEmp[emp][r.tipo_gestao as 'adm' | 'sub'] += r.valor ?? 0
    if (!porEmp[emp].apts.includes(`${apt}(${r.tipo_gestao})`)) {
      porEmp[emp].apts.push(`${apt}(${r.tipo_gestao})`)
    }
  }

  const ESPERADO: Record<string, { adm: number; sub: number }> = {
    ESSENCE:      { adm: 17050.57, sub: 13973.66 },
    EASY:         { adm: 6388.28,  sub: 360.00 },
    CULLINAN:     { adm: 2338.62,  sub: 35623.66 },
    ATHOS:        { adm: 2319.57,  sub: 28944.65 },
    NOBILE:       { adm: 1147.35,  sub: 4186.33 },
    FUSION:       { adm: 5618.32,  sub: 4086.33 },
    MERCURE:      { adm: 7124.68,  sub: 29975.01 },
    METROPOLITAN: { adm: 11954.73, sub: 3998.31 },
    BRISAS:       { adm: 8640.15,  sub: 22044.79 },
  }

  console.log('=== DIVERGÊNCIAS POR EMPREENDIMENTO ===')
  for (const [emp, esp] of Object.entries(ESPERADO)) {
    const b = porEmp[emp] ?? { adm: 0, sub: 0, apts: [] }
    const diffA = esp.adm - b.adm
    const diffS = esp.sub - b.sub
    if (Math.abs(diffA) > 0.5 || Math.abs(diffS) > 0.5) {
      console.log(`\n⚠️  ${emp}:`)
      console.log(`   ADM banco: R$ ${b.adm.toFixed(2)} | esperado: R$ ${esp.adm.toFixed(2)} | diff: R$ ${diffA.toFixed(2)}`)
      console.log(`   SUB banco: R$ ${b.sub.toFixed(2)} | esperado: R$ ${esp.sub.toFixed(2)} | diff: R$ ${diffS.toFixed(2)}`)
      console.log(`   Apts com dados: ${b.apts.join(', ')}`)
    }
  }

  // 3. Todos os apartamentos no banco para cruzar
  const { data: todosApts, error: aptsError } = await supabase
    .from('apartamentos')
    .select('id, numero, tipo_gestao, empreendimentos(nome)')
    .order('empreendimento_id')

  if (aptsError) {
    throw new Error(`Erro ao buscar apartamentos: ${aptsError.message}`)
  }

  console.log('\n=== NÚMEROS DE APT NO BANCO (para cruzar com planilha) ===')
  const porEmpBanco: Record<string, string[]> = {}
  for (const a of todosApts ?? []) {
    const emp = (a.empreendimentos as any)?.nome ?? '?'
    if (!porEmpBanco[emp]) porEmpBanco[emp] = []
    porEmpBanco[emp].push(`${a.numero}(${a.tipo_gestao ?? '?'})`)
  }
  for (const [emp, apts] of Object.entries(porEmpBanco)) {
    console.log(`  ${emp}: ${apts.join(', ')}`)
  }
}

main().catch(console.error)

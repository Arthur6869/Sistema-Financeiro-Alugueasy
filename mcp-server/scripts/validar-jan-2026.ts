import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MES = 1
const ANO = 2026

const ESPERADO = {
  adm: {
    ESSENCE: 17050.57, EASY: 6388.28, CULLINAN: 2338.62,
    ATHOS: 2319.57, NOBILE: 1147.35, FUSION: 5618.32,
    MERCURE: 7124.68, METROPOLITAN: 11954.73, BRISAS: 8640.15
  },
  sub: {
    ESSENCE: 13973.66, EASY: 360.00, CULLINAN: 35623.66,
    ATHOS: 28944.65, NOBILE: 4186.33, FUSION: 4086.33,
    MERCURE: 29975.01, METROPOLITAN: 3998.31, BRISAS: 22044.79
  }
}

const TOTAL_ESPERADO = 205775.01

function fmt(n: number) {
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pad(s: string, n: number) {
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

function rpad(s: string, n: number) {
  return s.length >= n ? s : ' '.repeat(n - s.length) + s
}

async function main() {
  console.log('═'.repeat(70))
  console.log('VALIDAÇÃO COMPLETA — CUSTOS JAN/2026')
  console.log('═'.repeat(70))

  const { data: custos, error } = await supabase
    .from('custos')
    .select('valor, tipo_gestao, apartamentos(numero, empreendimentos(nome))')
    .eq('mes', MES).eq('ano', ANO)

  if (error) { console.error('Erro:', error.message); return }

  const banco: Record<string, Record<string, number>> = { adm: {}, sub: {} }
  for (const r of custos ?? []) {
    const tg = r.tipo_gestao as 'adm' | 'sub'
    const raw = r.apartamentos as unknown
    const apt = Array.isArray(raw) ? (raw[0] as any) : (raw as any)
    const emp = (apt?.empreendimentos?.nome ?? '?').toUpperCase()
    banco[tg][emp] = (banco[tg][emp] ?? 0) + (r.valor ?? 0)
  }

  let todosOk = true

  for (const tg of ['adm', 'sub'] as const) {
    const esp = ESPERADO[tg]
    console.log(`\n── ${tg.toUpperCase()} ──`)
    console.log(`${pad('Empreendimento', 16)} ${rpad('Banco', 14)} ${rpad('Planilha', 14)} ${rpad('Diff', 12)} Status`)
    console.log('─'.repeat(65))

    let totalBanco = 0
    let totalEsp = 0

    for (const [emp, esperado] of Object.entries(esp)) {
      const real = banco[tg][emp] ?? 0
      const diff = real - esperado
      const ok = Math.abs(diff) < 0.02
      if (!ok) todosOk = false
      totalBanco += real
      totalEsp += esperado
      console.log(
        `${pad(emp, 16)} ${rpad(fmt(real), 14)} ${rpad(fmt(esperado), 14)} ${rpad(fmt(diff), 12)} ${ok ? '✅' : '❌'}`
      )
    }

    const diffTotal = totalBanco - totalEsp
    const totalOk = Math.abs(diffTotal) < 0.05
    if (!totalOk) todosOk = false
    console.log('─'.repeat(65))
    console.log(
      `${pad('TOTAL', 16)} ${rpad(fmt(totalBanco), 14)} ${rpad(fmt(totalEsp), 14)} ${rpad(fmt(diffTotal), 12)} ${totalOk ? '✅' : '❌'}`
    )
  }

  const totalAdm = Object.values(banco.adm).reduce((a, b) => a + b, 0)
  const totalSub = Object.values(banco.sub).reduce((a, b) => a + b, 0)
  const totalGeral = totalAdm + totalSub
  const diffGeral = totalGeral - TOTAL_ESPERADO
  const geralOk = Math.abs(diffGeral) < 0.10

  console.log('\n' + '═'.repeat(70))
  console.log(`TOTAL GERAL BANCO:    ${fmt(totalGeral)}`)
  console.log(`TOTAL GERAL PLANILHA: ${fmt(TOTAL_ESPERADO)}`)
  console.log(`DIFERENÇA:            ${fmt(diffGeral)}`)
  console.log(`\nRESULTADO: ${todosOk && geralOk ? '✅ DADOS CORRETOS — jan/2026 validado' : '❌ DIVERGÊNCIAS ENCONTRADAS — verificar'}`)
  console.log('═'.repeat(70))

  const { data: fat } = await supabase
    .from('amenitiz_reservas')
    .select('valor_liquido')
    .eq('mes_competencia', MES).eq('ano_competencia', ANO)

  const faturamento = (fat ?? []).reduce((a, r) => a + (r.valor_liquido ?? 0), 0)
  const lucro = faturamento - totalGeral
  const margem = faturamento > 0 ? (lucro / faturamento * 100) : 0

  console.log('\n── KPIs FINAIS JAN/2026 ──')
  console.log(`Faturamento: ${fmt(faturamento)}`)
  console.log(`Custos:      ${fmt(totalGeral)}`)
  console.log(`Lucro:       ${fmt(lucro)}`)
  console.log(`Margem:      ${margem.toFixed(1)}%`)
  console.log(`\nDashboard deveria mostrar:`)
  console.log(`  Custos Totais: ${fmt(totalGeral)}  (antes da correção: R$ 187.974,81)`)
}

main().catch(console.error)

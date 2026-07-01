/**
 * Sincroniza custos de maio/2026 com planilhas COFERENCIA DE CUSTOS ADM e SUB.
 * Uso: npx tsx scripts/sync-custos-maio.ts [--dry-run]
 */
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { normalize } from '../lib/xlsx-parser'
import { parseConferenciaCustos } from './parse-conferencia-custos'

const MES = 5
const ANO = 2026
const DRY_RUN = process.argv.includes('--dry-run')

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
}

function custoKey(aptId: string, cat: string) {
  return `${aptId}::${cat.trim().toLowerCase()}`
}

async function main() {
  loadEnv()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: allEmpreendimentos } = await supabase.from('empreendimentos').select('id, nome')
  const { data: allApartamentos } = await supabase
    .from('apartamentos')
    .select('id, numero, empreendimento_id, tipo_gestao')
    .order('empreendimento_id')

  if (!allEmpreendimentos || !allApartamentos) throw new Error('Erro ao carregar mapas')

  const empMap: Record<string, string> = {}
  allEmpreendimentos.forEach(e => { empMap[e.nome.toUpperCase()] = e.id })

  const aptMap: Record<string, string> = {}
  allApartamentos.forEach(a => {
    aptMap[`${a.empreendimento_id}::${normalize(a.numero)}`] = a.id
  })

  const empNames: Record<string, string> = {}
  allEmpreendimentos.forEach(e => { empNames[e.id] = e.nome })

  const aptById: Record<string, { numero: string; emp: string }> = {}
  for (const a of allApartamentos) {
    const emp = allEmpreendimentos.find(e => e.id === a.empreendimento_id)
    aptById[a.id] = { numero: a.numero, emp: emp?.nome ?? '?' }
  }

  const files = [
    { path: 'c:/Users/arthu/Downloads/COFERENCIA DE CUSTOS - ADM - MAIO (1).xlsx', tipo_gestao: 'adm' as const },
    { path: 'c:/Users/arthu/Downloads/COFERENCIA DE CUSTOS - SUB - MAIO.xlsx', tipo_gestao: 'sub' as const },
  ]

  const planilhaAll: Array<{
    apartamento_id: string
    categoria: string
    valor: number
    tipo_gestao: 'adm' | 'sub'
    empreendimento: string
    numero: string
  }> = []

  for (const { path: filePath, tipo_gestao } of files) {
    const buffer = fs.readFileSync(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })
    let parsed = parseConferenciaCustos(workbook, empMap, aptMap, empNames)

    // ADM: aba RESULTADO não inclui BRISAS no total de fechamento (R$ 42.834,27)
    if (tipo_gestao === 'adm') {
      parsed = parsed.filter(p => p.empreendimento.toUpperCase() !== 'BRISAS')
    }

    const total = parsed.reduce((s, r) => s + r.valor, 0)
    console.log(`\n=== ${tipo_gestao.toUpperCase()} — planilha: ${parsed.length} linhas, R$ ${total.toFixed(2)} ===`)
    for (const row of parsed) {
      planilhaAll.push({ ...row, tipo_gestao })
    }
  }

  const totalPlanilha = planilhaAll.reduce((s, r) => s + r.valor, 0)
  console.log(`\nTotal combinado planilhas: R$ ${totalPlanilha.toFixed(2)}`)

  const { data: dbCustos } = await supabase
    .from('custos')
    .select('id, apartamento_id, categoria, valor, tipo_gestao')
    .eq('mes', MES)
    .eq('ano', ANO)

  const dbByKey = new Map<string, { id: string; valor: number }>()
  const dbByApt = new Map<string, number>()
  for (const c of dbCustos ?? []) {
    const key = `${c.apartamento_id}::${c.tipo_gestao}::${c.categoria.trim().toLowerCase()}`
    dbByKey.set(key, { id: c.id, valor: Number(c.valor) })
    const aptKey = `${c.apartamento_id}::${c.tipo_gestao}`
    dbByApt.set(aptKey, (dbByApt.get(aptKey) ?? 0) + Number(c.valor))
  }

  const planByKey = new Map<string, typeof planilhaAll[0]>()
  const planByApt = new Map<string, number>()
  for (const p of planilhaAll) {
    const key = `${p.apartamento_id}::${p.tipo_gestao}::${p.categoria.trim().toLowerCase()}`
    planByKey.set(key, p)
    const aptKey = `${p.apartamento_id}::${p.tipo_gestao}`
    planByApt.set(aptKey, (planByApt.get(aptKey) ?? 0) + p.valor)
  }

  const dbTotal = (dbCustos ?? []).reduce((s, c) => s + Number(c.valor), 0)
  console.log(`Total banco atual: R$ ${dbTotal.toFixed(2)}`)

  let ok = 0, divergentes = 0, inserir = 0, remover = 0
  const aptsParaResync = new Set<string>()

  for (const [key, p] of planByKey) {
    const db = dbByKey.get(key)
    const info = aptById[p.apartamento_id]
    const label = `${info?.emp} ${info?.numero} (${p.tipo_gestao}) — ${p.categoria}`
    if (!db) {
      inserir++
      aptsParaResync.add(`${p.apartamento_id}::${p.tipo_gestao}`)
      console.log(`+ FALTA ${label}: R$ ${p.valor.toFixed(2)}`)
    } else if (Math.abs(db.valor - p.valor) > 0.01) {
      divergentes++
      aptsParaResync.add(`${p.apartamento_id}::${p.tipo_gestao}`)
      console.log(`~ DIVERGE ${label}: banco R$ ${db.valor.toFixed(2)} → planilha R$ ${p.valor.toFixed(2)}`)
    } else {
      ok++
    }
  }

  for (const c of dbCustos ?? []) {
    const key = `${c.apartamento_id}::${c.tipo_gestao}::${c.categoria.trim().toLowerCase()}`
    if (!planByKey.has(key)) {
      remover++
      aptsParaResync.add(`${c.apartamento_id}::${c.tipo_gestao}`)
      const info = aptById[c.apartamento_id]
      console.log(`- EXTRA ${info?.emp} ${info?.numero} (${c.tipo_gestao}) — ${c.categoria}: R$ ${Number(c.valor).toFixed(2)}`)
    }
  }

  // Divergências por total do apt (mesmo se categorias batem parcialmente)
  for (const [aptKey, planTotal] of planByApt) {
    const dbTotalApt = dbByApt.get(aptKey) ?? 0
    if (Math.abs(planTotal - dbTotalApt) > 0.01) {
      aptsParaResync.add(aptKey)
    }
  }

  console.log(`\nResumo: ${ok} categorias ok, ${divergentes} divergentes, ${inserir} faltando, ${remover} extras`)
  console.log(`Apartamentos a resincronizar: ${aptsParaResync.size}`)

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Nenhuma alteração aplicada.')
    return
  }

  // Resync completo do mês por tipo_gestao (delete all + insert)
  for (const tipo_gestao of ['adm', 'sub'] as const) {
    const records = planilhaAll.filter(p => p.tipo_gestao === tipo_gestao)

    await supabase.from('custos').delete()
      .eq('mes', MES).eq('ano', ANO).eq('tipo_gestao', tipo_gestao)

    if (records.length > 0) {
      const { error } = await supabase.from('custos').insert(
        records.map(r => ({
          apartamento_id: r.apartamento_id,
          categoria: r.categoria,
          valor: r.valor,
          mes: MES,
          ano: ANO,
          tipo_gestao,
          origem: 'importacao',
        }))
      )
      if (error) throw new Error(`Erro ao inserir ${tipo_gestao}: ${error.message}`)
    }
    console.log(`✓ ${tipo_gestao.toUpperCase()}: ${records.length} linhas gravadas`)
  }

  const { data: final } = await supabase
    .from('custos')
    .select('tipo_gestao, valor')
    .eq('mes', MES).eq('ano', ANO)

  const totals: Record<string, number> = { adm: 0, sub: 0 }
  for (const c of final ?? []) totals[c.tipo_gestao] += Number(c.valor)

  console.log(`\nVerificação final:`)
  console.log(`  ADM: R$ ${totals.adm.toFixed(2)}`)
  console.log(`  SUB: R$ ${totals.sub.toFixed(2)}`)
  console.log(`  TOTAL: R$ ${(totals.adm + totals.sub).toFixed(2)} (planilha: R$ ${totalPlanilha.toFixed(2)})`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

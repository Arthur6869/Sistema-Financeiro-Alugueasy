/**
 * Sincroniza diárias de maio/2026 com as planilhas de conferência ADM e SUB.
 * Uso: npx tsx scripts/sync-diarias-maio.ts [--dry-run]
 */
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { normalize } from '../lib/xlsx-parser'
import { parseConferenciaDiarias } from './parse-conferencia-diarias'

const MES = 5
const ANO = 2026
const DRY_RUN = process.argv.includes('--dry-run')

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) throw new Error('.env.local não encontrado')
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
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

  const firstAptByEmp: Record<string, string> = {}
  allApartamentos.forEach(a => {
    if (!firstAptByEmp[a.empreendimento_id]) firstAptByEmp[a.empreendimento_id] = a.id
  })

  const empNames: Record<string, string> = {}
  allEmpreendimentos.forEach(e => { empNames[e.id] = e.nome })

  const aptById: Record<string, { numero: string; emp: string; tipo_gestao: string }> = {}
  for (const a of allApartamentos) {
    const emp = allEmpreendimentos.find(e => e.id === a.empreendimento_id)
    aptById[a.id] = { numero: a.numero, emp: emp?.nome ?? '?', tipo_gestao: a.tipo_gestao ?? '?' }
  }

  const files = [
    {
      path: 'c:/Users/arthu/Downloads/COFERENCIA DE DIARIAS - ADM - MAIO.xlsx',
      tipo_gestao: 'adm' as const,
    },
    {
      path: 'c:/Users/arthu/Downloads/_COFERENCIA DE DIARIAS - SUB - MAIO.xlsx',
      tipo_gestao: 'sub' as const,
    },
  ]

  const dataRef = `${ANO}-${String(MES).padStart(2, '0')}-01`
  const dataFim = new Date(ANO, MES, 0).toISOString().slice(0, 10)

  // Diárias atuais no banco
  const { data: dbAtual } = await supabase
    .from('diarias')
    .select('id, apartamento_id, valor, tipo_gestao')
    .gte('data', dataRef)
    .lte('data', dataFim)

  const dbMap = new Map<string, { id: string; valor: number }>()
  for (const d of dbAtual ?? []) {
    dbMap.set(`${d.apartamento_id}::${d.tipo_gestao}`, { id: d.id, valor: Number(d.valor) })
  }

  const planilhaRecords: Array<{
    apartamento_id: string
    valor: number
    tipo_gestao: 'adm' | 'sub'
  }> = []

  for (const { path: filePath, tipo_gestao } of files) {
    const buffer = fs.readFileSync(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })
    const parsed = parseConferenciaDiarias(workbook, empMap, aptMap, empNames)
    const total = parsed.reduce((s, r) => s + r.valor, 0)
    console.log(`\n=== ${tipo_gestao.toUpperCase()} — total planilha: R$ ${total.toFixed(2)} (${parsed.length} apts) ===`)
    for (const row of parsed) {
      planilhaRecords.push({
        apartamento_id: row.apartamento_id,
        valor: row.valor,
        tipo_gestao,
      })
    }
  }

  const planilhaKeys = new Set(planilhaRecords.map(r => `${r.apartamento_id}::${r.tipo_gestao}`))
  const totalPlanilha = planilhaRecords.reduce((s, r) => s + r.valor, 0)
  console.log(`\nTotal combinado planilhas: R$ ${totalPlanilha.toFixed(2)}`)

  const toInsert: typeof planilhaRecords = []
  const toUpdate: Array<{ id: string; valor: number; label: string }> = []
  const ok: string[] = []

  for (const rec of planilhaRecords) {
    const key = `${rec.apartamento_id}::${rec.tipo_gestao}`
    const info = aptById[rec.apartamento_id]
    const label = `${info?.emp} ${info?.numero} (${rec.tipo_gestao})`
    const existing = dbMap.get(key)

    if (!existing) {
      toInsert.push(rec)
      console.log(`+ INSERIR ${label}: R$ ${rec.valor.toFixed(2)}`)
    } else if (Math.abs(existing.valor - rec.valor) > 0.01) {
      toUpdate.push({ id: existing.id, valor: rec.valor, label })
      console.log(`~ ATUALIZAR ${label}: R$ ${existing.valor.toFixed(2)} → R$ ${rec.valor.toFixed(2)}`)
    } else {
      ok.push(label)
    }
  }

  const toDelete: Array<{ id: string; label: string; valor: number }> = []
  for (const d of dbAtual ?? []) {
    const key = `${d.apartamento_id}::${d.tipo_gestao}`
    if (!planilhaKeys.has(key)) {
      const info = aptById[d.apartamento_id]
      toDelete.push({
        id: d.id,
        label: `${info?.emp} ${info?.numero} (${d.tipo_gestao})`,
        valor: Number(d.valor),
      })
      console.log(`- REMOVER ${info?.emp} ${info?.numero} (${d.tipo_gestao}): R$ ${Number(d.valor).toFixed(2)}`)
    }
  }

  console.log(`\nResumo: ${ok.length} ok, ${toUpdate.length} atualizar, ${toInsert.length} inserir, ${toDelete.length} remover`)

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Nenhuma alteração aplicada.')
    return
  }

  // Estratégia: delete por tipo_gestao + insert completo (igual import route)
  for (const tipo_gestao of ['adm', 'sub'] as const) {
    const records = planilhaRecords.filter(r => r.tipo_gestao === tipo_gestao)
    if (records.length === 0) continue

    const { error: delErr } = await supabase
      .from('diarias')
      .delete()
      .gte('data', dataRef)
      .lte('data', dataFim)
      .eq('tipo_gestao', tipo_gestao)

    if (delErr) throw new Error(`Erro ao deletar ${tipo_gestao}: ${delErr.message}`)

    const { error: insErr } = await supabase.from('diarias').insert(
      records.map(r => ({
        apartamento_id: r.apartamento_id,
        valor: r.valor,
        data: dataRef,
        tipo_gestao,
      }))
    )

    if (insErr) throw new Error(`Erro ao inserir ${tipo_gestao}: ${insErr.message}`)
    console.log(`✓ ${tipo_gestao.toUpperCase()}: ${records.length} registros gravados`)
  }

  // Verificação final
  const { data: final } = await supabase
    .from('diarias')
    .select('tipo_gestao, valor')
    .gte('data', dataRef)
    .lte('data', dataFim)

  const totals: Record<string, number> = { adm: 0, sub: 0 }
  for (const d of final ?? []) totals[d.tipo_gestao] += Number(d.valor)

  console.log(`\nVerificação final:`)
  console.log(`  ADM: R$ ${totals.adm.toFixed(2)} (esperado ~138067.25)`)
  console.log(`  SUB: R$ ${totals.sub.toFixed(2)} (esperado ~294378.23)`)
  console.log(`  TOTAL: R$ ${(totals.adm + totals.sub).toFixed(2)} (esperado 432445.48)`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

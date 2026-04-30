import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const sqlPath = path.resolve('../supabase/migrations/010_fix_custos_jan2026.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')

  console.log('Aplicando migration 010_fix_custos_jan2026.sql...\n')

  // Supabase JS client não executa SQL raw diretamente — usa rpc ou rest
  // Precisamos usar o endpoint REST do Supabase para executar SQL
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'apikey': key,
    },
    body: JSON.stringify({ sql }),
  })

  if (!res.ok) {
    // exec_sql não é uma função padrão — tenta via pg endpoint
    console.log('RPC exec_sql não disponível, usando abordagem por statements individuais...\n')
    await applyStatements(sql)
    return
  }

  const data = await res.json()
  console.log('Resultado:', JSON.stringify(data, null, 2))
}

async function applyStatements(sql: string) {
  // Remove comentários de linha e divide por ponto-e-vírgula
  const clean = sql
    .split('\n')
    .filter(l => !l.trim().startsWith('--'))
    .join('\n')

  // Executa as operações individualmente via Supabase JS
  // UPDATE MERCURE
  const { error: e1 } = await supabase
    .from('custos')
    .update({ valor: 7124.68 })
    .eq('id', '5cc8fcff-f2a9-4c54-91bf-9d584e706dbc')
  if (e1) throw new Error(`UPDATE MERCURE: ${e1.message}`)
  console.log('✅ 1/7 UPDATE MERCURE ADM: 7400.99 → 7124.68')

  // INSERTs
  const inserts = [
    { apartamento_id: '59e4b3a2-be6c-4ce6-9c38-96980ce0fc80', mes: 1, ano: 2026, categoria: 'Total Consolidado', valor: 2338.62, tipo_gestao: 'adm', label: 'CULLINAN ADM' },
    { apartamento_id: 'd738c758-1f4b-4a65-9eaa-1cce3e716793', mes: 1, ano: 2026, categoria: 'Total Consolidado', valor: 2319.57, tipo_gestao: 'adm', label: 'ATHOS ADM' },
    { apartamento_id: '9f1a7d90-2d7f-42f6-b0d1-3bc31b106307', mes: 1, ano: 2026, categoria: 'Total Consolidado', valor: 1147.35, tipo_gestao: 'adm', label: 'NOBILE ADM' },
    { apartamento_id: '7e80e95d-3b42-42b5-9b73-faaa794604e8', mes: 1, ano: 2026, categoria: 'Total Consolidado', valor: 4186.33, tipo_gestao: 'sub', label: 'NOBILE SUB' },
    { apartamento_id: '4a44155b-e04d-4d31-8b9c-8189d2f7a712', mes: 1, ano: 2026, categoria: 'Total Consolidado', valor: 4086.33, tipo_gestao: 'sub', label: 'FUSION SUB' },
    { apartamento_id: '6a0fabc4-67e1-458b-a676-bebff341e6e5', mes: 1, ano: 2026, categoria: 'Total Consolidado', valor: 3998.31, tipo_gestao: 'sub', label: 'METROPOLITAN SUB' },
  ]

  for (let i = 0; i < inserts.length; i++) {
    const { label, ...row } = inserts[i]
    const { error } = await supabase.from('custos').insert(row)
    if (error) throw new Error(`INSERT ${label}: ${error.message}`)
    console.log(`✅ ${i + 2}/7 INSERT ${label}: R$ ${row.valor}`)
  }

  // Verificação final
  const { data: check, error: eCheck } = await supabase
    .from('custos')
    .select('valor')
    .eq('mes', 1)
    .eq('ano', 2026)
  if (eCheck) throw new Error(`Verificação: ${eCheck.message}`)

  const total = (check ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
  const diff = Math.abs(total - 205775.01)

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Total jan/2026: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
  console.log(`Esperado:       R$ 205.775,01`)
  console.log(`Diferença:      R$ ${diff.toFixed(2)}`)

  if (diff > 0.02) {
    throw new Error(`❌ TOTAL INCORRETO após migração! Esperado 205775.01, obtido ${total.toFixed(2)}`)
  }
  console.log(`✅ MIGRAÇÃO APLICADA COM SUCESSO — total correto`)
  console.log(`   ${check?.length} registros para jan/2026`)
}

main().catch(err => {
  console.error('\n❌ ERRO:', err.message)
  process.exit(1)
})

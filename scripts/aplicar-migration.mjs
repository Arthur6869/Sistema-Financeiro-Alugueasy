// Aplica SQL no projeto Supabase via Management API.
//
//   node scripts/aplicar-migration.mjs --check          -> inventário read-only (não muda nada)
//   node scripts/aplicar-migration.mjs supabase/migrations/036_*.sql
//   node scripts/aplicar-migration.mjs --verify         -> verificação pós-aplicação
//
// O token sai de SUPABASE_ACCESS_TOKEN no .env.local e nunca é impresso.
import { readFileSync } from 'node:fs'

const ENV = new URL('../.env.local', import.meta.url)
for (const line of readFileSync(ENV, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const PROJECT = 'rlkmljeatapayiroggrp'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN ausente no .env.local'); process.exit(1) }

async function sql(query, rotulo) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const texto = await res.text()
  if (!res.ok) {
    console.error(`\n### FALHOU: ${rotulo} (HTTP ${res.status})`)
    console.error(texto.slice(0, 2000))
    process.exit(1)
  }
  try { return JSON.parse(texto) } catch { return texto }
}

function tabela(linhas) {
  if (!Array.isArray(linhas) || linhas.length === 0) return '  (0 linhas)'
  const cols = Object.keys(linhas[0])
  const larg = cols.map(c => Math.max(c.length, ...linhas.map(l => String(l[c] ?? '').length)))
  const linha = (vals) => '  ' + vals.map((v, i) => String(v ?? '').padEnd(larg[i])).join('  ')
  return [linha(cols), linha(larg.map(w => '-'.repeat(w))), ...linhas.map(l => linha(cols.map(c => l[c])))].join('\n')
}

const arg = process.argv[2]

if (arg === '--check' || arg === '--verify') {
  const titulo = arg === '--check' ? 'ESTADO ANTES' : 'VERIFICAÇÃO DEPOIS'
  console.log('='.repeat(78))
  console.log(titulo)
  console.log('='.repeat(78))

  console.log('\n1. Contas e papéis')
  console.log(tabela(await sql(`
    SELECT p.role, p.full_name, u.email, u.created_at::date AS criado,
           coalesce(u.last_sign_in_at::date::text,'nunca') AS ultimo_login, p.ativo
    FROM public.profiles p JOIN auth.users u ON u.id = p.id
    ORDER BY u.created_at DESC`, 'contas')))

  console.log('\n2. Contas de Auth sem profile (esperado: 0 linhas)')
  console.log(tabela(await sql(`
    SELECT u.email, u.created_at::date AS criado
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL`, 'orfaos')))

  console.log('\n3. Policies permissivas abertas em tabelas financeiras')
  console.log('   (USING(true) ou auth.role()=authenticated — cada uma dessas vaza leitura)')
  console.log(tabela(await sql(`
    SELECT c.relname AS tabela, pol.polname AS policy,
           CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END AS cmd,
           pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
    FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND pol.polpermissive AND pol.polcmd IN ('r','*')
      AND pg_get_expr(pol.polqual, pol.polrelid) IN ('true','(auth.role() = ''authenticated''::text)')
    ORDER BY c.relname, pol.polname`, 'policies_abertas')))

  console.log('\n4. Funções executáveis pela chave anônima (esperado depois da 037: 0)')
  console.log(tabela(await sql(`
    SELECT p.proname AS funcao
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND has_function_privilege('anon', p.oid, 'EXECUTE')
    ORDER BY p.proname`, 'rpc_anon')))

  console.log('\n5. TESTE FUNCIONAL — o que UM proprietário realmente enxerga')
  const prop = await sql(`
    SELECT p.id::text AS id, p.full_name
    FROM public.profiles p WHERE p.role='proprietario' AND coalesce(p.ativo,true)
    ORDER BY p.full_name LIMIT 1`, 'proprietario_teste')
  if (!Array.isArray(prop) || prop.length === 0) {
    console.log('  (nenhum proprietário ativo para testar)')
  } else {
    const { id, full_name } = prop[0]
    console.log(`  simulando sessão de: ${full_name}`)
    const r = await sql(`
      SET LOCAL ROLE authenticated;
      SET LOCAL request.jwt.claims TO '{"sub":"${id}","role":"authenticated"}';
      SELECT 'apartamentos' AS tabela, count(*) AS visivel FROM apartamentos
      UNION ALL SELECT 'empreendimentos', count(*) FROM empreendimentos
      UNION ALL SELECT 'diarias',         count(*) FROM diarias
      UNION ALL SELECT 'custos',          count(*) FROM custos
      UNION ALL SELECT 'importacoes',     count(*) FROM importacoes
      UNION ALL SELECT 'amenitiz_reservas', count(*) FROM amenitiz_reservas
      UNION ALL SELECT 'custos_op_variaveis', count(*) FROM custos_operacionais_variaveis
      UNION ALL SELECT 'categorias_repassaveis', count(*) FROM categorias_repassaveis
      UNION ALL SELECT 'profiles',        count(*) FROM profiles
      ORDER BY 1`, 'visao_proprietario')
    console.log(tabela(r))
  }

  console.log('\n6. TOTAIS REAIS (para comparar com o item 5)')
  console.log(tabela(await sql(`
      SELECT 'apartamentos' AS tabela, count(*) AS total FROM apartamentos
      UNION ALL SELECT 'empreendimentos', count(*) FROM empreendimentos
      UNION ALL SELECT 'diarias',         count(*) FROM diarias
      UNION ALL SELECT 'custos',          count(*) FROM custos
      UNION ALL SELECT 'importacoes',     count(*) FROM importacoes
      UNION ALL SELECT 'amenitiz_reservas', count(*) FROM amenitiz_reservas
      UNION ALL SELECT 'custos_op_variaveis', count(*) FROM custos_operacionais_variaveis
      UNION ALL SELECT 'categorias_repassaveis', count(*) FROM categorias_repassaveis
      UNION ALL SELECT 'profiles',        count(*) FROM profiles
      ORDER BY 1`, 'totais')))

  process.exit(0)
}

if (!arg) { console.error('uso: node scripts/aplicar-migration.mjs <arquivo.sql> | --check | --verify'); process.exit(1) }

const caminho = new URL('../' + arg.replace(/\\/g, '/'), import.meta.url)
const conteudo = readFileSync(caminho, 'utf8')
console.log(`Aplicando ${arg} (${conteudo.length} chars)...`)
const resultado = await sql(conteudo, arg)
console.log('OK.')
if (Array.isArray(resultado) && resultado.length) console.log(tabela(resultado))

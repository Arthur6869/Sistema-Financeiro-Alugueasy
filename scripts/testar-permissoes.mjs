// Teste de regressão das permissões após as migrations 036/037.
// Simula sessões reais (SET LOCAL ROLE + request.jwt.claims) e mede leitura e
// escrita de cada papel. Toda escrita roda dentro de uma transação com ROLLBACK.
//
// A escrita é medida por LINHAS AFETADAS (via CTE ... RETURNING), não por
// "deu erro ou não": a RLS não levanta erro ao bloquear UPDATE/DELETE — ela
// simplesmente não casa a linha, e o comando volta com 0 linhas e sucesso.
import { readFileSync } from 'node:fs'

const ENV = new URL('../.env.local', import.meta.url)
for (const line of readFileSync(ENV, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const PROJECT = 'rlkmljeatapayiroggrp'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const texto = await res.text()
  if (!res.ok) {
    let msg = texto
    try { msg = JSON.parse(texto).message ?? texto } catch { /* texto cru */ }
    return { erro: String(msg).replace(/\s+/g, ' ').slice(0, 110) }
  }
  try { return JSON.parse(texto) } catch { return texto }
}

const papeis = await sql(`
  SELECT p.id::text AS id, p.role, p.full_name
  FROM public.profiles p WHERE p.role IN ('analista','admin','proprietario')
  ORDER BY CASE p.role WHEN 'analista' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, p.full_name`)

const analista = papeis.find(p => p.role === 'analista')
const admin = papeis.find(p => p.role === 'admin')
const prop = papeis.find(p => p.role === 'proprietario')

const sessao = (id) => `SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims TO '{"sub":"${id}","role":"authenticated"}';`

console.log('='.repeat(74))
console.log('ESCRITA — linhas realmente afetadas (transação sempre revertida)')
console.log('='.repeat(74))
console.log('Esperado: analista escreve; admin é somente leitura; proprietário não escreve.\n')

const apt = (await sql(`SELECT id::text FROM apartamentos LIMIT 1`))?.[0]?.id

const OPERACOES = [
  ['UPDATE custos', `WITH x AS (UPDATE custos SET observacao = observacao
      WHERE id IN (SELECT id FROM custos LIMIT 1) RETURNING 1) SELECT count(*)::int AS n FROM x`],
  ['DELETE diarias', `WITH x AS (DELETE FROM diarias
      WHERE id IN (SELECT id FROM diarias LIMIT 1) RETURNING 1) SELECT count(*)::int AS n FROM x`],
  ['INSERT custos', `WITH x AS (INSERT INTO custos (apartamento_id, mes, ano, categoria, valor, tipo_gestao, origem)
      VALUES ('${apt}', 1, 2099, 'TESTE_REGRESSAO', 1, 'adm', 'manual') RETURNING 1) SELECT count(*)::int AS n FROM x`],
  ['UPDATE apartamentos', `WITH x AS (UPDATE apartamentos SET numero = numero
      WHERE id IN (SELECT id FROM apartamentos LIMIT 1) RETURNING 1) SELECT count(*)::int AS n FROM x`],
  ['DELETE amenitiz_reservas', `WITH x AS (DELETE FROM amenitiz_reservas
      WHERE id IN (SELECT id FROM amenitiz_reservas LIMIT 1) RETURNING 1) SELECT count(*)::int AS n FROM x`],
]

for (const p of [analista, admin, prop]) {
  if (!p) continue
  console.log(`${p.role.toUpperCase()} — ${p.full_name}`)
  for (const [rotulo, comando] of OPERACOES) {
    const r = await sql(`BEGIN; ${sessao(p.id)} ${comando};`)
    await sql('ROLLBACK;')
    if (r.erro) {
      const negado = /row-level security|permission denied|violates row-level/i.test(r.erro)
      console.log(`  ${rotulo.padEnd(26)} ${negado ? 'NEGADO pela RLS' : 'erro: ' + r.erro}`)
    } else {
      const n = r?.[0]?.n ?? 0
      console.log(`  ${rotulo.padEnd(26)} ${n > 0 ? `ESCREVEU (${n} linha)` : 'bloqueado (0 linhas)'}`)
    }
  }
  console.log('')
}

console.log('='.repeat(74))
console.log('PROPRIETÁRIO SUSPENSO (ativo = false) — simulação revertida')
console.log('='.repeat(74))
if (prop) {
  const r = await sql(`BEGIN;
    UPDATE public.profiles SET ativo = false WHERE id = '${prop.id}';
    ${sessao(prop.id)}
    SELECT 'apartamentos' AS tabela, count(*)::int AS n FROM apartamentos
    UNION ALL SELECT 'diarias', count(*)::int FROM diarias
    UNION ALL SELECT 'custos', count(*)::int FROM custos
    UNION ALL SELECT 'amenitiz_reservas', count(*)::int FROM amenitiz_reservas
    UNION ALL SELECT 'empreendimentos', count(*)::int FROM empreendimentos
    ORDER BY 1;`)
  await sql('ROLLBACK;')
  if (r.erro) console.log('  ERRO: ' + r.erro)
  else for (const l of r) console.log(`  ${l.tabela.padEnd(24)} ${l.n} ${l.n === 0 ? '(bloqueado OK)' : '*** AINDA ENXERGA ***'}`)
  const conf = await sql(`SELECT ativo FROM public.profiles WHERE id = '${prop.id}'`)
  console.log(`  -> ativo em produção segue: ${conf?.[0]?.ativo}`)
}

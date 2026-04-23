#!/usr/bin/env node
/**
 * migrate.js — Aplica migrations pendentes no Supabase
 *
 * USO:
 *   node migrate.js                    → mostra SQL da migration mais recente
 *   node migrate.js --apply DB_PASS    → aplica via psql (requer psql instalado)
 *
 * Para aplicar sem psql:
 *   1. Abra https://app.supabase.com/project/rlkmljeatapayiroggrp/sql/new
 *   2. Cole o SQL impresso no console
 */

const fs   = require('fs')
const path = require('path')

const MIGRATIONS_DIR = path.join(__dirname, 'supabase', 'migrations')
const PROJECT_REF    = 'rlkmljeatapayiroggrp'
const DB_HOST        = `db.${PROJECT_REF}.supabase.co`

// ─── Carrega migrations em ordem ─────────────────────────────────────────────
const files = fs.readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort()

const args   = process.argv.slice(2)
const apply  = args[0] === '--apply'
const dbPass = apply ? args[1] : null

if (!apply) {
  // Modo padrão: imprimir SQL da última migration pendente
  const lastFile = files[files.length - 1]
  const sql      = fs.readFileSync(path.join(MIGRATIONS_DIR, lastFile), 'utf-8')

  console.log(`\n${'='.repeat(72)}`)
  console.log(`  Migration: ${lastFile}`)
  console.log(`${'='.repeat(72)}`)
  console.log('\n📋 COMO APLICAR:')
  console.log(`  1. Abra: https://app.supabase.com/project/${PROJECT_REF}/sql/new`)
  console.log('  2. Cole o SQL abaixo e execute\n')
  console.log(`${'─'.repeat(72)}`)
  console.log(sql)
  console.log(`${'─'.repeat(72)}`)
  console.log('\n💡 Para aplicar automaticamente via psql:')
  console.log(`   node migrate.js --apply SUA_SENHA_DO_BANCO\n`)
  process.exit(0)
}

// ─── Modo aplicação via psql ──────────────────────────────────────────────────
if (!dbPass) {
  console.error('❌ Forneça a senha do banco: node migrate.js --apply SENHA')
  console.error('   Encontre em: app.supabase.com → Project Settings → Database → Connection string')
  process.exit(1)
}

const { execSync } = require('child_process')
const lastFile = files[files.length - 1]
const sqlFile  = path.join(MIGRATIONS_DIR, lastFile)

console.log(`\n⏳ Aplicando ${lastFile} em ${DB_HOST}...\n`)

try {
  const cmd = [
    `psql`,
    `"postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(dbPass)}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"`,
    `-f "${sqlFile}"`,
    `--single-transaction`,
  ].join(' ')

  const out = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
  console.log(out)
  console.log(`\n✅ Migration ${lastFile} aplicada com sucesso!`)
} catch (err) {
  console.error('❌ Erro ao aplicar migration:\n', err.stderr || err.message)
  console.error('\n💡 Alternativa: aplique manualmente via SQL Editor:')
  console.error(`   https://app.supabase.com/project/${PROJECT_REF}/sql/new`)
  process.exit(1)
}

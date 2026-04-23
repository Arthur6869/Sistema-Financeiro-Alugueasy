#!/usr/bin/env node

/**
 * Script para executar migration no Supabase PostgreSQL
 * Uso: node scripts/execute-migration.js <PASSWORD>
 * 
 * Se não passar PASSWORD, será solicitado interativamente
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Lê .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const passwordArg = process.argv[2];

const MIGRATION_SQL = `-- Adicionar configurações de repasse em apartamentos
ALTER TABLE apartamentos
  ADD COLUMN IF NOT EXISTS taxa_repasse numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tipo_repasse text
    CHECK (tipo_repasse IN ('lucro', 'faturamento'))
    DEFAULT 'lucro',
  ADD COLUMN IF NOT EXISTS nome_proprietario text,
  ADD COLUMN IF NOT EXISTS modelo_contrato text
    CHECK (modelo_contrato IN ('administracao', 'sublocacao'))
    DEFAULT 'administracao';

COMMENT ON COLUMN apartamentos.taxa_repasse IS
  'Percentual de repasse ao proprietário ex: 15 para 15%';
COMMENT ON COLUMN apartamentos.tipo_repasse IS
  'Base de cálculo: lucro ou faturamento';
COMMENT ON COLUMN apartamentos.nome_proprietario IS
  'Nome completo do proprietário para o PDF';
COMMENT ON COLUMN apartamentos.modelo_contrato IS
  'administracao ou sublocacao';`;

function getConnectionString(password) {
  // URL do Supabase é assim: https://rlkmljeatapayiroggrp.supabase.co
  // Connection string PostgreSQL é: postgresql://postgres:PASSWORD@rlkmljeatapayiroggrp.db.supabase.co:5432/postgres
  const projectId = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  return `postgresql://postgres:${password}@${projectId}.db.supabase.co:5432/postgres`;
}

async function executeMigration(password) {
  try {
    // Tenta importar a biblioteca postgres
    const postgresModule = require('postgres');
    
    const connectionString = getConnectionString(password);
    const sql = postgresModule(connectionString);

    console.log('🔄 Conectando ao Supabase PostgreSQL...');
    
    // Testa a conexão
    await sql`SELECT 1`;
    console.log('✅ Conectado com sucesso!\n');

    console.log('📝 Executando migration...\n');
    
    // Executa cada comando da migration
    await sql.unsafe(MIGRATION_SQL);
    
    console.log('\n✅ Migration executada com sucesso!');
    console.log('📋 As seguintes colunas foram adicionadas à tabela "apartamentos":');
    console.log('   - taxa_repasse (numeric)');
    console.log('   - tipo_repasse (text: lucro|faturamento)');
    console.log('   - nome_proprietario (text)');
    console.log('   - modelo_contrato (text: administracao|sublocacao)');

    await sql.end();
    process.exit(0);
  } catch (error) {
    if (error.message.includes('Cannot find module')) {
      console.log('❌ Biblioteca "postgres" não encontrada\n');
      console.log('📦 Instale com:');
      console.log('   npm install postgres\n');
      process.exit(1);
    }

    if (error.message.includes('ECONNREFUSED') || error.message.includes('password authentication failed')) {
      console.log('❌ Erro de autenticação ou conexão recusada\n');
      console.log('⚠️  Verifique se a senha está correta\n');
      console.log('Para obter a senha:');
      console.log('1. Acesse https://app.supabase.com/project/rlkmljeatapayiroggrp');
      console.log('2. Vá em "Project Settings" → "Database"');
      console.log('3. Copie a senha do usuário "postgres"\n');
      process.exit(1);
    }

    console.log('❌ Erro:', error.message);
    process.exit(1);
  }
}

async function promptPassword() {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('🔐 Digite a senha do PostgreSQL (postgres user): ', answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🚀 Executando Migration - Sistema Financeiro AlugEasy\n');
  console.log(`📍 Projeto: rlkmljeatapayiroggrp`);
  console.log(`🌐 URL: ${supabaseUrl}\n`);

  let password = passwordArg;

  if (!password) {
    console.log('Para executar a migration, você precisa da senha do PostgreSQL.\n');
    console.log('Onde encontrar:');
    console.log('1. Acesse https://app.supabase.com/project/rlkmljeatapayiroggrp');
    console.log('2. Vá em "Project Settings" → "Database"');
    console.log('3. Na seção "Connection String", copie a senha\n');
    
    password = await promptPassword();
  }

  if (!password) {
    console.log('❌ Senha não fornecida');
    process.exit(1);
  }

  await executeMigration(password);
}

main().catch(error => {
  console.error('❌ Erro fatal:', error.message);
  process.exit(1);
});

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Client } = require('postgres');

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
const password = process.argv[2];

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

async function executeMigration() {
  if (!password) {
    console.error('❌ Senha não fornecida');
    process.exit(1);
  }

  const projectId = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
  const connectionString = `postgresql://postgres:${password}@${projectId}.db.supabase.co:5432/postgres`;

  console.log('🚀 Executando Migration - Sistema Financeiro AlugEasy\n');
  console.log(`📍 Projeto: ${projectId}`);
  console.log(`🌐 URL: ${supabaseUrl}\n`);

  try {
    console.log('🔄 Conectando ao Supabase PostgreSQL...');
    
    // Tenta usar pg em vez de postgres
    try {
      const pg = require('pg');
      const client = new pg.Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
      });

      await client.connect();
      console.log('✅ Conectado com sucesso!\n');

      console.log('📝 Executando migration...\n');
      
      await client.query(MIGRATION_SQL);
      
      await client.end();

      console.log('\n✅ Migration executada com sucesso!');
      console.log('📋 As seguintes colunas foram adicionadas à tabela "apartamentos":');
      console.log('   - taxa_repasse (numeric)');
      console.log('   - tipo_repasse (text: lucro|faturamento)');
      console.log('   - nome_proprietario (text)');
      console.log('   - modelo_contrato (text: administracao|sublocacao)');

      process.exit(0);
    } catch (pgError) {
      if (pgError.message.includes('Cannot find module')) {
        console.log('Tentando com biblioteca "postgres"...\n');
        
        const sql = require('postgres')(connectionString);
        await sql.unsafe(MIGRATION_SQL);
        await sql.end();

        console.log('\n✅ Migration executada com sucesso!');
        console.log('📋 As seguintes colunas foram adicionadas à tabela "apartamentos":');
        console.log('   - taxa_repasse (numeric)');
        console.log('   - tipo_repasse (text: lucro|faturamento)');
        console.log('   - nome_proprietario (text)');
        console.log('   - modelo_contrato (text: administracao|sublocacao)');

        process.exit(0);
      }
      throw pgError;
    }
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.error('\n⚠️  Erro de conexão de rede');
      console.error('Verifique se sua internet está funcionando e se pode acessar supabase.co');
    } else if (error.message.includes('password authentication failed')) {
      console.error('\n⚠️  Senha incorreta');
      console.error('Verifique a senha do PostgreSQL em Project Settings > Database');
    } else if (error.message.includes('already exists')) {
      console.log('\n✅ Colunas já existem na tabela!');
      console.log('A migration pode ter sido executada anteriormente.');
      process.exit(0);
    }
    
    process.exit(1);
  }
}

executeMigration();

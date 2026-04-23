import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const MIGRATION_SQL = `
-- Adicionar configurações de repasse em apartamentos
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
  'administracao ou sublocacao';
`

export async function POST() {
  try {
    const supabase = await createClient()

    // Tenta executar a migration via rpc
    // Primeiro, verifica se está autenticado
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado. Execute como usuário logado.' },
        { status: 401 }
      )
    }

    // Tenta executar via RPC se existir
    // O Supabase pode não ter função RPC pré-criada, então tentamos direto
    const { error } = await supabase.rpc('exec_sql', {
      sql: MIGRATION_SQL
    }).single()

    if (error) {
      // Se RPC não existe, tenta abordagem alternativa
      console.log('RPC exec_sql não disponível, tentando abordagem alternativa...')
      throw new Error('execute_sql function not found')
    }

    return NextResponse.json(
      { success: true, message: 'Migration executada com sucesso!' },
      { status: 200 }
    )
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    // Se falhar, tenta via connection string direto
    if (errorMsg.includes('execute_sql') || errorMsg.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: 'RPC não configurado',
          message: 'A função RPC para execução de SQL não está disponível no seu Supabase.',
          instructions: `
FAÇA ISTO NO PAINEL DO SUPABASE:
1. Acesse https://app.supabase.com/project/rlkmljeatapayiroggrp
2. Vá em 'SQL Editor'
3. Cole este SQL:

${MIGRATION_SQL}

4. Clique em 'Run'

OU, se preferir automatizar:
1. Envie a senha do postgres (em Project Settings > Database > Connection String)
2. Vou criar um script automático para você
          `.trim()
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    )
  }
}

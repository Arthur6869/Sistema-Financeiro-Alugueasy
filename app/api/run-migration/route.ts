import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // Cria cliente sem autenticação (usando chave pública)
    const supabase = createClient(supabaseUrl, supabaseKey)

    // SQL da migration
    const sql = `
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

    // Tenta executar via RPC
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: sql
    })

    if (error) {
      // Se a função RPC não existe, retorna instruções
      if (error.message.includes('does not exist') || error.message.includes('function')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Função RPC não configurada no seu Supabase',
            message: 'Você precisa executar a migration manualmente no painel do Supabase',
            sql: sql
          },
          { status: 400 }
        )
      }
      throw error
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Migration executada com sucesso!',
        data: data
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: errorMsg
      },
      { status: 500 }
    )
  }
}

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('Aplicando migration 011_importacoes_observacao.sql...\n')

  // Verificar se coluna já existe
  const { data: cols } = await supabase
    .rpc('exec_sql' as any, {
      sql: `SELECT column_name FROM information_schema.columns WHERE table_name='importacoes' AND column_name='observacao'`
    })
    .maybeSingle()

  // Tentar ALTER TABLE via upsert de schema — não suportado no JS client
  // Usar fetch direto para o endpoint de SQL do Supabase
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const sql = `
    ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS observacao text;
    COMMENT ON COLUMN public.importacoes.observacao IS 'Warnings ou alertas da importação. Ex: abas/empreendimentos não encontrados no banco.';
  `

  // Tenta via pg REST endpoint
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
    const body = await res.text()
    console.log(`exec_sql não disponível (${res.status}): ${body}`)
    console.log('\n⚠️  Execute manualmente no Supabase SQL Editor:')
    console.log('─'.repeat(60))
    console.log(sql.trim())
    console.log('─'.repeat(60))
    console.log('\nOu via Supabase CLI:')
    console.log('  supabase db push --db-url <URL>')
    return
  }

  console.log('✅ Migration 011 aplicada com sucesso.')

  // Verificação
  const { data: check, error } = await supabase
    .from('importacoes')
    .select('observacao')
    .limit(1)
  if (error && error.message.includes('observacao')) {
    console.error('❌ Coluna observacao ainda não existe:', error.message)
    process.exit(1)
  }
  console.log('✅ Coluna observacao acessível na tabela importacoes.')
}

main().catch(err => {
  console.error('\n❌ ERRO:', err.message)
  process.exit(1)
})

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('Aplicando migration 011...\n')

  // Verificar se a coluna já existe tentando selecioná-la
  const { error: checkErr } = await supabase
    .from('importacoes')
    .select('observacao')
    .limit(1)

  if (!checkErr) {
    console.log('✅ Coluna observacao já existe em importacoes — migration 011 já aplicada.')

    // Mostrar estado atual
    const { data: importacoes } = await supabase
      .from('importacoes')
      .select('id, tipo, mes, ano, status, observacao')
      .eq('mes', 1).eq('ano', 2026)
      .order('created_at', { ascending: false })
      .limit(10)

    console.log('\nÚltimas importações de jan/2026:')
    console.table(importacoes?.map(r => ({
      tipo: r.tipo,
      status: r.status,
      observacao: r.observacao ?? '(vazio)'
    })))
    return
  }

  console.log('ℹ️  Coluna observacao não existe ainda.')

  // Tentar via rpc se existir
  const { error: rpcErr } = await (supabase as any).rpc('exec_sql', {
    sql: `ALTER TABLE public.importacoes ADD COLUMN IF NOT EXISTS observacao text;
          COMMENT ON COLUMN public.importacoes.observacao IS 'Warnings ou alertas da importação.'`
  })

  if (rpcErr) {
    console.log('ℹ️  RPC exec_sql não disponível.\n')
    console.log('Execute manualmente no Supabase SQL Editor:')
    console.log('─'.repeat(60))
    console.log('ALTER TABLE public.importacoes')
    console.log('  ADD COLUMN IF NOT EXISTS observacao text;')
    console.log()
    console.log("COMMENT ON COLUMN public.importacoes.observacao IS")
    console.log("  'Warnings ou alertas da importação.';")
    console.log('─'.repeat(60))
    console.log('\nURL: https://supabase.com/dashboard/project/rlkmljeatapayiroggrp/sql/new')
  } else {
    console.log('✅ Migration 011 aplicada com sucesso via RPC.')

    const { data: importacoes } = await supabase
      .from('importacoes')
      .select('id, tipo, mes, ano, status, observacao')
      .eq('mes', 1).eq('ano', 2026)
      .order('created_at', { ascending: false })
      .limit(10)

    console.log('\nÚltimas importações de jan/2026:')
    console.table(importacoes?.map(r => ({
      tipo: r.tipo,
      status: r.status,
      observacao: r.observacao ?? '(vazio)'
    })))
  }
}

main().catch(console.error)

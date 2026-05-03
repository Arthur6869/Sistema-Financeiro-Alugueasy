import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('Aplicando migration 017 — limpando UUID incorreto do apt 908 ATHOS\n')

  // Buscar empreendimento_id do ATHOS
  const { data: emp } = await supabase
    .from('empreendimentos')
    .select('id, nome')
    .ilike('nome', '%athos%')
    .single()

  if (!emp) {
    console.error('Empreendimento ATHOS não encontrado!')
    process.exit(1)
  }
  console.log(`Empreendimento: ${emp.nome} (id: ${emp.id})`)

  // Verificar estado antes
  const { data: antes } = await supabase
    .from('apartamentos')
    .select('numero, amenitiz_room_id')
    .eq('numero', '908')
    .eq('empreendimento_id', emp.id)
    .single()

  console.log('\nEstado ANTES da migration:')
  console.log('  apt 908 amenitiz_room_id:', (antes as any)?.amenitiz_room_id ?? 'NULL')

  if (!(antes as any)?.amenitiz_room_id) {
    console.log('\n✅ apt 908 já está com amenitiz_room_id = NULL — migration já foi aplicada')
    return
  }

  if ((antes as any)?.amenitiz_room_id !== '806d43eb-f08d-45e2-9e09-21ca1a4f4878') {
    console.log(`\n⚠️  UUID atual (${(antes as any)?.amenitiz_room_id}) não é o esperado (806d43eb...)`)
    console.log('Aplicando mesmo assim para garantir consistência com a migration 017...')
  }

  // Limpar UUID incorreto do 908
  const { error } = await supabase
    .from('apartamentos')
    .update({ amenitiz_room_id: null })
    .eq('numero', '908')
    .eq('empreendimento_id', emp.id)

  if (error) {
    console.error('\n❌ Erro ao aplicar migration 017:', error.message)
    console.log('\nAlternativa — execute no Supabase SQL Editor:')
    console.log('─'.repeat(60))
    console.log(`UPDATE apartamentos
SET amenitiz_room_id = NULL
WHERE numero = '908'
  AND empreendimento_id = (
    SELECT id FROM empreendimentos
    WHERE upper(nome) = 'ATHOS'
  );`)
    console.log('─'.repeat(60))
    process.exit(1)
  }

  // Verificar estado depois
  const { data: depois } = await supabase
    .from('apartamentos')
    .select('numero, amenitiz_room_id')
    .eq('numero', '908')
    .eq('empreendimento_id', emp.id)
    .single()

  console.log('\nEstado DEPOIS da migration:')
  console.log('  apt 908 amenitiz_room_id:', (depois as any)?.amenitiz_room_id ?? 'NULL')

  console.log('\n✅ Migration 017 aplicada com sucesso — UUID colisão eliminada')
  console.log('\nPróximos passos:')
  console.log('1. Acesse painel Amenitiz → Configurações → Quartos')
  console.log('2. Localize "AB 908" ou "Athos Bulcão 908"')
  console.log('3. Copie o individual_room_id (UUID completo)')
  console.log('4. Use a tool MCP: set_amenitiz_room_id')
  console.log('   { numero: "908", empreendimento: "ATHOS", amenitiz_room_id: "UUID-CORRETO", confirmar: true }')
  console.log('5. Re-rode: sync_amenitiz { mes: 1, ano: 2026 }')
}

main().catch(console.error)

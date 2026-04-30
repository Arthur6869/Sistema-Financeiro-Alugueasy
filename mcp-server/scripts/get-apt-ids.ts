import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '../.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Precisamos dos IDs completos dos apartamentos para usar nos INSERTs
const needed = [
  { emp: 'CULLINAN',     numero: '1304' },
  { emp: 'ATHOS',        numero: '3' },
  { emp: 'NOBILE',       numero: '803' },
  { emp: 'NOBILE',       numero: '19' },
  { emp: 'FUSION',       numero: '412' },
  { emp: 'METROPOLITAN', numero: '1701' },
]

async function main() {
  for (const { emp, numero } of needed) {
    const { data, error } = await supabase
      .from('apartamentos')
      .select('id, numero, empreendimentos(nome)')
      .eq('numero', numero)
      .filter('empreendimentos.nome', 'ilike', `%${emp}%`)
      .limit(5)

    if (error) { console.error(error.message); continue }

    // filtra pelo empreendimento correto
    const match = (data ?? []).find(a => {
      const nome = (a.empreendimentos as any)?.nome ?? ''
      return nome.toUpperCase().includes(emp)
    })

    if (match) {
      console.log(`-- apt ${numero} (${emp}): '${match.id}'  -- ${(match.empreendimentos as any)?.nome}`)
    } else {
      console.log(`-- ⚠️  NÃO ENCONTRADO: apt ${numero} em ${emp}`)
      console.log(`   Resultados: ${JSON.stringify(data?.map(a => ({ id: a.id, numero: a.numero, emp: (a.empreendimentos as any)?.nome })))}`)
    }
  }
}

main().catch(console.error)

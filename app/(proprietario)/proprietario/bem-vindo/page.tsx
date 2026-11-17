import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BoasVindas } from '@/components/proprietario/boas-vindas'

async function getNomeProprietario(): Promise<{ nome: string; email: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login-proprietario')
  }

  const email = user.email ?? null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const nomeCandidato =
    profile?.nome ||
    profile?.full_name ||
    profile?.name ||
    (email ? email.split('@')[0] : null) ||
    'Proprietário'

  const nomeFormatado = nomeCandidato
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((palavra: string) => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ')

  return { nome: nomeFormatado, email }
}

/** Primeiro acesso ao portal: boas-vindas, o que ele oferece e a ALU. */
export default async function BemVindoPage() {
  const { nome } = await getNomeProprietario()
  return <BoasVindas nome={nome} />
}

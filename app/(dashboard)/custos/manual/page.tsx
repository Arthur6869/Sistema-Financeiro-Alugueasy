import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ManualCostsPageClient } from '@/components/custos/manual-costs-page-client'

export default async function CustosManualPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const now = new Date()
  const mes = params.mes ? Number(params.mes) : now.getMonth() + 1
  const ano = params.ano ? Number(params.ano) : now.getFullYear()

  const [{ data: profile }, { data: empreendimentos }, { data: apartamentos }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('empreendimentos').select('id, nome').order('nome'),
    supabase.from('apartamentos').select('id, numero, empreendimento_id, tipo_gestao').order('empreendimento_id'),
  ])

  return (
    <ManualCostsPageClient
      initialMes={mes}
      initialAno={ano}
      canWrite={profile?.role === 'analista'}
      empreendimentos={empreendimentos ?? []}
      apartamentos={apartamentos ?? []}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MESES } from '@/lib/constants'
import { Suspense } from 'react'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { CustosOperacionaisClient } from '@/components/custos-operacionais/custos-operacionais-client'

export default async function CustosOperacionaisPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const params = await searchParams
  const now = new Date()
  const mes = params.mes !== undefined ? parseInt(params.mes) : now.getMonth() + 1
  const ano = params.ano !== undefined ? parseInt(params.ano) : now.getFullYear()

  const { data: varData } = await supabase
    .from('custos_operacionais_variaveis')
    .select('diarias')
    .eq('mes', mes)
    .eq('ano', ano)
    .maybeSingle()

  const diariasIniciais = varData?.diarias ?? 0
  const anoMesLabel = `${MESES[mes - 1]} ${ano}`

  return (
    <div className="p-8 w-full">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custos Operacionais</h1>
          <p className="text-gray-500 text-sm mt-1">Despesas fixas e variáveis mensais — {anoMesLabel}</p>
        </div>
        <Suspense fallback={null}>
          <MonthYearFilter mes={mes} ano={ano} />
        </Suspense>
      </div>

      <CustosOperacionaisClient
        mes={mes}
        ano={ano}
        diariasIniciais={diariasIniciais}
        role={profile?.role ?? 'admin'}
      />
    </div>
  )
}

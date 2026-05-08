import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays } from 'lucide-react'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { Suspense } from 'react'
import { MESES } from '@/lib/constants'
import { DiariasPageClient } from '@/components/diarias/diarias-page-client'

export default async function DiariasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string; tipo?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const now = new Date()
  const mes = params.mes !== undefined ? parseInt(params.mes) : now.getMonth() + 1
  const ano = params.ano !== undefined ? parseInt(params.ano) : now.getFullYear()
  const tipoFiltro = ['adm', 'sub'].includes(params.tipo ?? '') ? params.tipo! : ''

  let query = supabase
    .from('diarias')
    .select('id, data, valor, tipo_gestao, apartamentos!inner(numero, empreendimento_id, empreendimentos!inner(nome))')
    .order('data', { ascending: false })

  if (mes > 0 && ano > 0) {
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)
    query = query.gte('data', dataInicio).lte('data', dataFim) as typeof query
  } else if (ano > 0) {
    query = query.gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`) as typeof query
  }

  if (tipoFiltro) {
    query = query.eq('tipo_gestao', tipoFiltro) as typeof query
  }

  const [{ data: diarias }, { data: profile }, { data: apartamentosRaw }] = await Promise.all([
    query,
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('apartamentos').select('id, numero, empreendimento_id, tipo_gestao, empreendimentos(nome)').order('numero'),
  ])

  const apartamentos = (apartamentosRaw ?? []).map((a: any) => ({
    id: a.id,
    numero: a.numero,
    empreendimento_id: a.empreendimento_id,
    tipo_gestao: a.tipo_gestao,
    empreendimento_nome: a.empreendimentos?.nome ?? '—',
  }))

  const total = (diarias ?? []).reduce((acc, d) => acc + ((d as any).valor || 0), 0)

  const periodoLabel =
    mes > 0 && ano > 0 ? `${MESES[mes - 1]} ${ano}` :
    mes > 0 ? `${MESES[mes - 1]} — todos os anos` :
    ano > 0 ? `Todos os meses de ${ano}` :
    'Todos os períodos'

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Diárias</h1>
          <p className="text-gray-500 text-sm mt-1">
            Receitas de {periodoLabel} — {(diarias ?? []).length} registro(s)
            {tipoFiltro && (
              <span className="ml-1 text-[#193660]">· {tipoFiltro.toUpperCase()}</span>
            )}
          </p>
        </div>
        <Suspense fallback={null}>
          <MonthYearFilter mes={mes} ano={ano} />
        </Suspense>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <CalendarDays size={18} />
            Registro de Diárias
          </CardTitle>
          {total > 0 && (
            <span className="text-sm font-bold text-gray-900">
              Total: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <DiariasPageClient
            initialDiarias={(diarias ?? []) as any}
            apartamentos={apartamentos}
            role={profile?.role ?? ''}
            mes={mes}
            ano={ano}
            initialTipo={tipoFiltro as 'adm' | 'sub' | ''}
          />
        </CardContent>
      </Card>
    </div>
  )
}

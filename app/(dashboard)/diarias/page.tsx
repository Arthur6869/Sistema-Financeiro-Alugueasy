import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { Suspense } from 'react'
import { MESES } from '@/lib/constants'
import Link from 'next/link'
import { DiariasPageClient } from '@/components/diarias/diarias-page-client'

const PAGE_SIZE = 50

export default async function DiariasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string; page?: string; tipo?: string; busca?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const now = new Date()
  const mes = params.mes !== undefined ? parseInt(params.mes) : now.getMonth() + 1
  const ano = params.ano !== undefined ? parseInt(params.ano) : now.getFullYear()
  const page = params.page ? Math.max(1, parseInt(params.page)) : 1
  const offset = (page - 1) * PAGE_SIZE
  const tipoFiltro = ['adm', 'sub'].includes(params.tipo ?? '') ? params.tipo! : ''
  const busca = params.busca?.trim() ?? ''

  let query = supabase
    .from('diarias')
    .select('id, data, valor, tipo_gestao, apartamentos!inner(numero, empreendimento_id, empreendimentos!inner(nome))', { count: 'exact' })
    .order('data', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

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

  if (busca) {
    query = query.ilike('apartamentos.empreendimentos.nome', `%${busca}%`) as typeof query
  }

  const [{ data: diarias, count }, { data: profile }, { data: apartamentosRaw }] = await Promise.all([
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

  const totalRegistros = count ?? 0
  const totalPages = Math.ceil(totalRegistros / PAGE_SIZE)

  // Total geral do período filtrado (sem paginação)
  let totalQuery = supabase
    .from('diarias')
    .select('valor, apartamentos!inner(empreendimentos!inner(nome))')
  if (mes > 0 && ano > 0) {
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)
    totalQuery = totalQuery.gte('data', dataInicio).lte('data', dataFim) as typeof totalQuery
  } else if (ano > 0) {
    totalQuery = totalQuery.gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`) as typeof totalQuery
  }
  if (tipoFiltro) totalQuery = totalQuery.eq('tipo_gestao', tipoFiltro) as typeof totalQuery
  if (busca) totalQuery = totalQuery.ilike('apartamentos.empreendimentos.nome', `%${busca}%`) as typeof totalQuery

  const { data: todasDiarias } = await totalQuery
  const total = todasDiarias?.reduce((acc, d) => acc + ((d as any).valor || 0), 0) ?? 0

  const periodoLabel =
    mes > 0 && ano > 0 ? `${MESES[mes - 1]} ${ano}` :
    mes > 0 ? `${MESES[mes - 1]} — todos os anos` :
    ano > 0 ? `Todos os meses de ${ano}` :
    'Todos os períodos'

  const baseUrl = new URLSearchParams()
  if (mes > 0) baseUrl.set('mes', String(mes))
  if (ano > 0) baseUrl.set('ano', String(ano))
  if (tipoFiltro) baseUrl.set('tipo', tipoFiltro)
  if (busca) baseUrl.set('busca', busca)

  const paginaAnteriorUrl = page > 1 ? `/diarias?${baseUrl.toString()}&page=${page - 1}` : null
  const proximaPaginaUrl = page < totalPages ? `/diarias?${baseUrl.toString()}&page=${page + 1}` : null

  const inicioRegistro = totalRegistros > 0 ? offset + 1 : 0
  const fimRegistro = Math.min(offset + PAGE_SIZE, totalRegistros)

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Diárias</h1>
          <p className="text-gray-500 text-sm mt-1">
            Receitas de {periodoLabel} — {totalRegistros} registro(s)
            {(tipoFiltro || busca) && (
              <span className="ml-1 text-[#193660]">
                {tipoFiltro ? `· ${tipoFiltro.toUpperCase()}` : ''}
                {busca ? ` · "${busca}"` : ''}
              </span>
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
            initialBusca={busca}
            initialTipo={tipoFiltro as 'adm' | 'sub' | ''}
          />

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                Exibindo {inicioRegistro}–{fimRegistro} de {totalRegistros} registros
              </span>
              <div className="flex items-center gap-2">
                {paginaAnteriorUrl ? (
                  <Link
                    href={paginaAnteriorUrl}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft size={14} /> Anterior
                  </Link>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-50 border border-gray-100 rounded-md cursor-not-allowed">
                    <ChevronLeft size={14} /> Anterior
                  </span>
                )}
                <span className="text-xs text-gray-500 font-medium px-2">
                  Página {page} de {totalPages}
                </span>
                {proximaPaginaUrl ? (
                  <Link
                    href={proximaPaginaUrl}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Próxima <ChevronRight size={14} />
                  </Link>
                ) : (
                  <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-50 border border-gray-100 rounded-md cursor-not-allowed">
                    Próxima <ChevronRight size={14} />
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Receipt } from 'lucide-react'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { Suspense } from 'react'
import { MESES } from '@/lib/constants'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CustosEditavelTabela } from '@/components/custos/custos-editavel-tabela'

export default async function CustosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const now = new Date()
  const mes = params.mes !== undefined ? parseInt(params.mes) : now.getMonth() + 1
  const ano = params.ano !== undefined ? parseInt(params.ano) : now.getFullYear()

  const [{ data: profile }, custosResult, categoriasResult] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),

    supabase
      .from('custos')
      .select(`
        id, categoria, valor, tipo_gestao, origem, observacao, mes, ano,
        apartamentos ( numero, empreendimentos ( nome ) )
      `)
      .eq('mes', mes)
      .eq('ano', ano)
      .order('created_at', { ascending: false }),

    supabase
      .from('custos')
      .select('categoria')
      .order('categoria'),
  ])

  const custos = custosResult.data ?? []
  const totalRegistros = custos.length
  const total = custos.reduce((acc, c) => acc + (c.valor || 0), 0)
  const categorias = [...new Set(
    (categoriasResult.data ?? []).map(r => r.categoria).filter(Boolean)
  )]

  const periodoLabel =
    mes > 0 && ano > 0 ? `${MESES[mes - 1]} ${ano}` :
    mes > 0 ? `${MESES[mes - 1]} — todos os anos` :
    ano > 0 ? `Todos os meses de ${ano}` :
    'Todos os períodos'

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Despesas de {periodoLabel} — {totalRegistros} lançamento(s)
          </p>
          <div className="mt-3">
            <Link href={`/custos/manual?mes=${mes}&ano=${ano}`}>
              <Button size="sm" className="bg-[#193660] hover:bg-[#193660]/90">
                Lançamento Manual
              </Button>
            </Link>
          </div>
        </div>
        <Suspense fallback={null}>
          <MonthYearFilter mes={mes} ano={ano} />
        </Suspense>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Receipt size={18} />
            Lançamentos de Custos
          </CardTitle>
          {total > 0 && (
            <span className="text-sm font-bold text-gray-900">
              Total: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </CardHeader>
        <CardContent>
          <CustosEditavelTabela
            custos={custos as any}
            role={profile?.role ?? 'admin'}
            categoriasSugeridas={categorias}
          />
        </CardContent>
      </Card>
    </div>
  )
}

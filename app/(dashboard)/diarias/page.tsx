import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CalendarDays } from 'lucide-react'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { Suspense } from 'react'
import { MESES } from '@/lib/constants'

export default async function DiariasPage({
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

  let query = supabase
    .from('diarias')
    .select('*, apartamentos(numero, empreendimentos(nome))')
    .order('data', { ascending: false })

  if (mes > 0 && ano > 0) {
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)
    query = query.gte('data', dataInicio).lte('data', dataFim) as typeof query
  } else if (ano > 0) {
    query = query.gte('data', `${ano}-01-01`).lte('data', `${ano}-12-31`) as typeof query
  }

  const { data: diarias } = await query

  const total = diarias?.reduce((acc, d) => acc + (d.valor || 0), 0) ?? 0

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
            Receitas de {periodoLabel} — {diarias?.length ?? 0} registro(s)
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
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100">
                <TableHead className="text-gray-500 font-medium">Data</TableHead>
                <TableHead className="text-gray-500 font-medium">Imóvel</TableHead>
                <TableHead className="text-gray-500 font-medium">Gestão</TableHead>
                <TableHead className="text-gray-500 font-medium text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diarias && diarias.length > 0 ? (
                diarias.map((diaria) => (
                  <TableRow key={diaria.id} className="border-gray-100 hover:bg-gray-50">
                    <TableCell className="text-gray-600 font-medium">
                      {new Date(diaria.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{diaria.apartamentos?.numero}</span>
                        <span className="text-xs text-gray-400">{(diaria.apartamentos?.empreendimentos as any)?.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={diaria.tipo_gestao === 'adm' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}>
                        {diaria.tipo_gestao.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900">
                      R$ {diaria.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400 py-12">
                    Nenhuma diária registrada para {periodoLabel}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

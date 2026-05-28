import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrendingUp, TrendingDown, FileDown, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { DesempenhoChart } from '@/components/charts/desempenho-chart'
import { MESES, formatCurrency } from '@/lib/constants'

export default async function RelatorioDesempenhoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const { mes: mesParam, ano: anoParam } = await searchParams
  const mes = mesParam ? parseInt(mesParam) : now.getMonth() + 1
  const ano = anoParam ? parseInt(anoParam) : now.getFullYear()

  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  const [
    { data: empreendimentosRaw },
    { data: apartamentosRaw },
    { data: diariasRaw },
    { data: custosRaw },
  ] = await Promise.all([
    supabase.from('empreendimentos').select('id, nome').order('nome'),
    supabase.from('apartamentos').select('id, numero, empreendimento_id'),
    supabase.from('diarias').select('apartamento_id, valor').gte('data', dataInicio).lte('data', dataFim),
    supabase.from('custos').select('apartamento_id, valor').eq('mes', mes).eq('ano', ano),
  ])

  const empreendimentos = empreendimentosRaw ?? []
  const apartamentos = apartamentosRaw ?? []
  const diarias = diariasRaw ?? []
  const custos = custosRaw ?? []

  // Somas por apartamento
  const fatPorApt: Record<string, number> = {}
  const custosPorApt: Record<string, number> = {}
  for (const d of diarias) {
    if (!d.apartamento_id) continue
    fatPorApt[d.apartamento_id] = (fatPorApt[d.apartamento_id] ?? 0) + Number(d.valor ?? 0)
  }
  for (const c of custos) {
    if (!c.apartamento_id) continue
    custosPorApt[c.apartamento_id] = (custosPorApt[c.apartamento_id] ?? 0) + Number(c.valor ?? 0)
  }

  // Agrupar por empreendimento
  const aptsPorEmp: Record<string, typeof apartamentos> = {}
  for (const apt of apartamentos) {
    if (!apt.empreendimento_id) continue
    if (!aptsPorEmp[apt.empreendimento_id]) aptsPorEmp[apt.empreendimento_id] = []
    aptsPorEmp[apt.empreendimento_id].push(apt)
  }

  type AptRow = {
    id: string
    numero: string
    empreendimentoId: string
    empreendimentoNome: string
    faturamento: number
    custos: number
    lucro: number
    margem: number
  }

  type EmpRow = {
    id: string
    nome: string
    totalApts: number
    aptsLucro: number
    aptsPrejuizo: number
    faturamento: number
    custos: number
    lucro: number
    margem: number
  }

  const todosApts: AptRow[] = []
  const empRows: EmpRow[] = []

  for (const emp of empreendimentos) {
    const aptsDoEmp = aptsPorEmp[emp.id] ?? []
    let ef = 0, ec = 0, al = 0, ap = 0

    for (const apt of aptsDoEmp) {
      const fat = fatPorApt[apt.id] ?? 0
      const cus = custosPorApt[apt.id] ?? 0
      const lucro = fat - cus
      const margem = fat > 0 ? (lucro / fat) * 100 : 0
      ef += fat; ec += cus
      lucro >= 0 ? al++ : ap++
      todosApts.push({
        id: apt.id,
        numero: String(apt.numero),
        empreendimentoId: emp.id,
        empreendimentoNome: emp.nome,
        faturamento: fat,
        custos: cus,
        lucro,
        margem,
      })
    }

    const el = ef - ec
    empRows.push({
      id: emp.id,
      nome: emp.nome,
      totalApts: aptsDoEmp.length,
      aptsLucro: al,
      aptsPrejuizo: ap,
      faturamento: ef,
      custos: ec,
      lucro: el,
      margem: ef > 0 ? (el / ef) * 100 : 0,
    })
  }

  const grandFat = empRows.reduce((s, e) => s + e.faturamento, 0)
  const grandCus = empRows.reduce((s, e) => s + e.custos, 0)
  const grandLucro = grandFat - grandCus
  const margemMedia = grandFat > 0 ? (grandLucro / grandFat) * 100 : 0

  const aptsLucro = todosApts.filter((a) => a.lucro >= 0).sort((a, b) => b.lucro - a.lucro)
  const aptsPrejuizo = todosApts.filter((a) => a.lucro < 0).sort((a, b) => a.lucro - b.lucro)

  const chartData = empRows
    .filter((e) => e.faturamento > 0 || e.custos > 0)
    .map((e) => ({
      nome: e.nome,
      nomeAbrev: e.nome.length > 12 ? e.nome.substring(0, 12) : e.nome,
      faturamento: e.faturamento,
      custos: e.custos,
      lucro: e.lucro,
    }))

  const pdfUrl = `/api/relatorio-desempenho-pdf?mes=${mes}&ano=${ano}`

  return (
    <div className="p-8 w-full">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={24} style={{ color: '#193660' }} />
            Relatório de Desempenho
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {empreendimentos.length} empreendimento(s) — {MESES[mes - 1]} {ano}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href={pdfUrl}>
            <Button variant="outline" className="flex items-center gap-2">
              <FileDown size={16} />
              Baixar Relatório PDF
            </Button>
          </Link>
          <Suspense fallback={null}>
            <MonthYearFilter mes={mes} ano={ano} />
          </Suspense>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border border-blue-100 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Faturamento Total</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(grandFat)}</p>
          </CardContent>
        </Card>
        <Card className="border border-red-100 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Custos Totais</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(grandCus)}</p>
          </CardContent>
        </Card>
        <Card className={`border shadow-sm ${grandLucro >= 0 ? 'border-green-100' : 'border-red-100'}`}>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Lucro Líquido</p>
            <p className={`text-xl font-bold ${grandLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(grandLucro)}
            </p>
          </CardContent>
        </Card>
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Margem Média</p>
            <p className={`text-xl font-bold ${margemMedia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {margemMedia.toFixed(1).replace('.', ',')}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card className="border border-gray-100 shadow-sm mb-8">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-800">
              Comparativo por Empreendimento — {MESES[mes - 1]} {ano}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DesempenhoChart data={chartData} periodo={`${MESES[mes - 1]} ${ano}`} />
          </CardContent>
        </Card>
      )}

      {/* Imóveis em Lucro */}
      {aptsLucro.length > 0 && (
        <Card className="border border-green-100 shadow-sm mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-green-700 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-600" />
              Imóveis em Lucro ({aptsLucro.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-green-100">
                  <TableHead className="text-gray-500 pl-6">Empreendimento</TableHead>
                  <TableHead className="text-gray-500">Unidade</TableHead>
                  <TableHead className="text-gray-500 text-right">Faturamento</TableHead>
                  <TableHead className="text-gray-500 text-right">Custos</TableHead>
                  <TableHead className="text-gray-500 text-right">Lucro</TableHead>
                  <TableHead className="text-gray-500 text-right">Margem</TableHead>
                  <TableHead className="text-gray-500 text-center pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aptsLucro.map((apt) => (
                  <TableRow key={apt.id} className="border-green-50 hover:bg-green-50/40">
                    <TableCell className="pl-6 text-gray-700 text-sm font-medium">{apt.empreendimentoNome}</TableCell>
                    <TableCell className="text-gray-700 text-sm">{apt.numero}</TableCell>
                    <TableCell className="text-right text-sm text-gray-700">{formatCurrency(apt.faturamento)}</TableCell>
                    <TableCell className="text-right text-sm text-red-500">{formatCurrency(apt.custos)}</TableCell>
                    <TableCell className="text-right text-sm font-bold text-green-600">{formatCurrency(apt.lucro)}</TableCell>
                    <TableCell className="text-right text-sm text-green-600">{apt.margem.toFixed(1).replace('.', ',')}%</TableCell>
                    <TableCell className="text-center pr-6">
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs" variant="outline">
                        <TrendingUp size={10} className="mr-1" />↑ Lucro
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Imóveis em Prejuízo */}
      {aptsPrejuizo.length > 0 && (
        <Card className="border border-red-100 shadow-sm mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-red-700 flex items-center gap-2">
              <TrendingDown size={18} className="text-red-600" />
              Imóveis em Prejuízo ({aptsPrejuizo.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-red-100">
                  <TableHead className="text-gray-500 pl-6">Empreendimento</TableHead>
                  <TableHead className="text-gray-500">Unidade</TableHead>
                  <TableHead className="text-gray-500 text-right">Faturamento</TableHead>
                  <TableHead className="text-gray-500 text-right">Custos</TableHead>
                  <TableHead className="text-gray-500 text-right">Prejuízo</TableHead>
                  <TableHead className="text-gray-500 text-right">Margem</TableHead>
                  <TableHead className="text-gray-500 text-center pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aptsPrejuizo.map((apt) => (
                  <TableRow key={apt.id} className="border-red-50 hover:bg-red-50/40">
                    <TableCell className="pl-6 text-gray-700 text-sm font-medium">{apt.empreendimentoNome}</TableCell>
                    <TableCell className="text-gray-700 text-sm">{apt.numero}</TableCell>
                    <TableCell className="text-right text-sm text-gray-700">{formatCurrency(apt.faturamento)}</TableCell>
                    <TableCell className="text-right text-sm text-red-500">{formatCurrency(apt.custos)}</TableCell>
                    <TableCell className="text-right text-sm font-bold text-red-600">{formatCurrency(apt.lucro)}</TableCell>
                    <TableCell className="text-right text-sm text-red-600">{apt.margem.toFixed(1).replace('.', ',')}%</TableCell>
                    <TableCell className="text-center pr-6">
                      <Badge className="bg-red-100 text-red-700 border-red-200 text-xs" variant="outline">
                        <TrendingDown size={10} className="mr-1" />↓ Prejuízo
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Resumo por Empreendimento */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800">Resumo por Empreendimento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100">
                <TableHead className="text-gray-500 pl-6">Empreendimento</TableHead>
                <TableHead className="text-gray-500 text-center">Total Apts</TableHead>
                <TableHead className="text-gray-500 text-center">Em Lucro</TableHead>
                <TableHead className="text-gray-500 text-center">Em Prejuízo</TableHead>
                <TableHead className="text-gray-500 text-right">Faturamento</TableHead>
                <TableHead className="text-gray-500 text-right">Custos</TableHead>
                <TableHead className="text-gray-500 text-right">Lucro Total</TableHead>
                <TableHead className="text-gray-500 text-center pr-6">Status Geral</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {empRows.map((emp) => (
                <TableRow key={emp.id} className="border-gray-100 hover:bg-gray-50">
                  <TableCell className="pl-6 font-semibold text-gray-800 text-sm">{emp.nome}</TableCell>
                  <TableCell className="text-center text-gray-600 text-sm">{emp.totalApts}</TableCell>
                  <TableCell className="text-center text-green-600 text-sm font-medium">{emp.aptsLucro}</TableCell>
                  <TableCell className="text-center text-sm font-medium" style={{ color: emp.aptsPrejuizo > 0 ? '#dc2626' : '#6b7280' }}>{emp.aptsPrejuizo}</TableCell>
                  <TableCell className="text-right text-sm text-gray-700">{formatCurrency(emp.faturamento)}</TableCell>
                  <TableCell className="text-right text-sm text-red-500">{formatCurrency(emp.custos)}</TableCell>
                  <TableCell className={`text-right text-sm font-bold ${emp.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(emp.lucro)}
                  </TableCell>
                  <TableCell className="text-center pr-6">
                    <Badge
                      className={`text-xs ${emp.lucro >= 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}
                      variant="outline"
                    >
                      {emp.lucro >= 0 ? <TrendingUp size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                      {emp.lucro >= 0 ? '✓ Lucro' : '✗ Prejuízo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

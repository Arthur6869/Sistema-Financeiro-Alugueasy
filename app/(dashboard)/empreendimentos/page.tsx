import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Building2, BedDouble, ArrowLeft, TrendingUp, TrendingDown, LayoutGrid, List } from 'lucide-react'
import Link from 'next/link'
import { MonthYearFilter } from '@/components/month-year-filter'
import { Suspense } from 'react'
import { MESES } from '@/lib/constants'

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

export default async function EmpreendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ emp?: string; apt?: string; mes?: string; ano?: string; view?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { emp: empId, apt: aptId, mes: mesParam, ano: anoParam, view } = await searchParams
  const now = new Date()
  const mes = mesParam ? parseInt(mesParam) : now.getMonth() + 1
  const ano = anoParam ? parseInt(anoParam) : now.getFullYear()
  const isListView = view === 'list'

  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  const [
    { data: empreendimentos },
    { data: diariasData },
    { data: custosData },
  ] = await Promise.all([
    supabase.from('empreendimentos').select('id, nome, apartamentos(id)').order('nome'),
    supabase.from('diarias').select('valor, apartamentos(empreendimento_id)').gte('data', dataInicio).lte('data', dataFim),
    supabase.from('custos').select('valor, apartamentos(empreendimento_id)').eq('mes', mes).eq('ano', ano),
  ])

  const finMap: Record<string, { fat: number; custos: number }> = {}
  diariasData?.forEach((d: any) => {
    const id = d.apartamentos?.empreendimento_id
    if (!id) return
    if (!finMap[id]) finMap[id] = { fat: 0, custos: 0 }
    finMap[id].fat += d.valor || 0
  })
  custosData?.forEach((c: any) => {
    const id = c.apartamentos?.empreendimento_id
    if (!id) return
    if (!finMap[id]) finMap[id] = { fat: 0, custos: 0 }
    finMap[id].custos += c.valor || 0
  })

  // ── DETALHE DO APARTAMENTO ───────────────────────────────────────
  if (empId && aptId) {
    const emp = empreendimentos?.find((e) => e.id === empId)
    if (!emp) redirect('/empreendimentos')

    const [{ data: apt }, { data: aptDiarias }, { data: aptCustos }] = await Promise.all([
      supabase.from('apartamentos').select('id, numero').eq('id', aptId).single(),
      supabase.from('diarias').select('data, valor, tipo_gestao').eq('apartamento_id', aptId).gte('data', dataInicio).lte('data', dataFim).order('data'),
      supabase.from('custos').select('categoria, valor, tipo_gestao').eq('apartamento_id', aptId).eq('mes', mes).eq('ano', ano).order('categoria'),
    ])

    const fat = aptDiarias?.reduce((a, d) => a + (d.valor || 0), 0) ?? 0
    const custos = aptCustos?.reduce((a, c) => a + (c.valor || 0), 0) ?? 0
    const lucro = fat - custos

    return (
      <div className="p-8 w-full">
        {/* Breadcrumb */}
        <div className="mb-2">
          <Link
            href={`/empreendimentos?emp=${empId}&mes=${mes}&ano=${ano}&view=${view ?? 'grid'}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-1"
          >
            <ArrowLeft size={14} />
            {emp.nome}
          </Link>
        </div>
        <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#19366015]">
              <BedDouble size={18} style={{ color: '#193660' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Apartamento {apt?.numero}</h1>
              <p className="text-gray-500 text-sm mt-0.5">{emp.nome} — {MESES[mes - 1]} {ano}</p>
            </div>
          </div>
          <Suspense fallback={null}>
            <MonthYearFilter mes={mes} ano={ano} />
          </Suspense>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Faturamento</p>
            <p className="text-xl font-bold text-gray-900">{fat > 0 ? fmt(fat) : <span className="text-gray-300">—</span>}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Custos</p>
            <p className="text-xl font-bold text-red-600">{custos > 0 ? fmt(custos) : <span className="text-gray-300">—</span>}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Lucro Líquido</p>
            <p className={`text-xl font-bold ${fat === 0 ? 'text-gray-300' : lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fat > 0 ? `${lucro >= 0 ? '+' : ''}${fmt(lucro)}` : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Diárias */}
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-800 flex items-center justify-between">
                <span>Diárias (Faturamento)</span>
                {fat > 0 && <span className="text-[#193660] font-bold">{fmt(fat)}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100">
                    <TableHead className="text-gray-500 pl-6">Data</TableHead>
                    <TableHead className="text-gray-500">Gestão</TableHead>
                    <TableHead className="text-gray-500 text-right pr-6">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aptDiarias && aptDiarias.length > 0 ? aptDiarias.map((d, i) => (
                    <TableRow key={i} className="border-gray-100 hover:bg-gray-50">
                      <TableCell className="pl-6 text-gray-700 text-sm">
                        {new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={d.tipo_gestao === 'adm' ? 'bg-blue-50 text-blue-700 text-xs' : 'bg-purple-50 text-purple-700 text-xs'}>
                          {d.tipo_gestao.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 font-medium text-gray-800">{fmt(d.valor)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-300 py-8 text-sm">Sem diárias em {MESES[mes - 1]}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Custos */}
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-800 flex items-center justify-between">
                <span>Custos</span>
                {custos > 0 && <span className="text-red-600 font-bold">{fmt(custos)}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100">
                    <TableHead className="text-gray-500 pl-6">Categoria</TableHead>
                    <TableHead className="text-gray-500">Gestão</TableHead>
                    <TableHead className="text-gray-500 text-right pr-6">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aptCustos && aptCustos.length > 0 ? aptCustos.map((c, i) => (
                    <TableRow key={i} className="border-gray-100 hover:bg-gray-50">
                      <TableCell className="pl-6 text-gray-700 text-sm font-medium">{c.categoria}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={c.tipo_gestao === 'adm' ? 'bg-blue-50 text-blue-700 text-xs' : 'bg-purple-50 text-purple-700 text-xs'}>
                          {c.tipo_gestao.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6 font-medium text-red-500">{fmt(c.valor)}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-300 py-8 text-sm">Sem custos em {MESES[mes - 1]}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── DETALHE DO EMPREENDIMENTO ─────────────────────────────────────
  if (empId) {
    const emp = empreendimentos?.find((e) => e.id === empId)
    if (!emp) redirect('/empreendimentos')

    const [
      { data: apartamentos },
      { data: aptDiarias },
      { data: aptCustos },
    ] = await Promise.all([
      supabase.from('apartamentos').select('id, numero, created_at').eq('empreendimento_id', empId).order('numero'),
      supabase.from('diarias').select('valor, apartamento_id, tipo_gestao').gte('data', dataInicio).lte('data', dataFim),
      supabase.from('custos').select('valor, apartamento_id, tipo_gestao').eq('mes', mes).eq('ano', ano),
    ])

    // Mapa financeiro por apartamento
    const aptFinMap: Record<string, { fat: number; custos: number; gestao: Set<string> }> = {}
    aptDiarias?.forEach((d) => {
      if (!aptFinMap[d.apartamento_id]) aptFinMap[d.apartamento_id] = { fat: 0, custos: 0, gestao: new Set() }
      aptFinMap[d.apartamento_id].fat += d.valor || 0
      if (d.tipo_gestao) aptFinMap[d.apartamento_id].gestao.add(d.tipo_gestao)
    })
    aptCustos?.forEach((c) => {
      if (!aptFinMap[c.apartamento_id]) aptFinMap[c.apartamento_id] = { fat: 0, custos: 0, gestao: new Set() }
      aptFinMap[c.apartamento_id].custos += c.valor || 0
      if (c.tipo_gestao) aptFinMap[c.apartamento_id].gestao.add(c.tipo_gestao)
    })

    const fin = finMap[empId] ?? { fat: 0, custos: 0 }
    const lucro = fin.fat - fin.custos
    const hasData = fin.fat > 0

    return (
      <div className="p-8 w-full">
        <div className="mb-8">
          <Link
            href={`/empreendimentos?mes=${mes}&ano=${ano}&view=${view ?? 'grid'}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-3"
          >
            <ArrowLeft size={14} />
            Todos os empreendimentos
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#193660' }}>
                <Building2 size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{emp.nome}</h1>
                <p className="text-gray-500 text-sm mt-0.5">
                  {apartamentos?.length ?? 0} apartamento(s) — {MESES[mes - 1]} {ano}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
                <Link
                  href={`/empreendimentos?emp=${empId}&mes=${mes}&ano=${ano}&view=grid`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    !isListView ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <LayoutGrid size={15} />
                  Cards
                </Link>
                <Link
                  href={`/empreendimentos?emp=${empId}&mes=${mes}&ano=${ano}&view=list`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    isListView ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <List size={15} />
                  Linhas
                </Link>
              </div>
              <Suspense fallback={null}>
                <MonthYearFilter mes={mes} ano={ano} />
              </Suspense>
            </div>
          </div>
        </div>

        {hasData && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Faturamento</p>
              <p className="text-xl font-bold text-gray-900">{fmt(fin.fat)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Custos</p>
              <p className="text-xl font-bold text-red-600">{fmt(fin.custos)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Lucro Líquido</p>
              <p className={`text-xl font-bold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {lucro >= 0 ? '+' : ''}{fmt(lucro)}
              </p>
            </div>
          </div>
        )}

        {apartamentos && apartamentos.length > 0 ? (
          isListView ? (
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-100">
                      <TableHead className="text-gray-500 font-medium pl-6">Apartamento</TableHead>
                      <TableHead className="text-gray-500 font-medium text-center">Gestão</TableHead>
                      <TableHead className="text-gray-500 font-medium text-right">Faturamento</TableHead>
                      <TableHead className="text-gray-500 font-medium text-right">Custos</TableHead>
                      <TableHead className="text-gray-500 font-medium text-right">Lucro</TableHead>
                      <TableHead className="text-gray-500 font-medium text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apartamentos.map((apt) => {
                      const af = aptFinMap[apt.id] ?? { fat: 0, custos: 0, gestao: new Set<string>() }
                      const al = af.fat - af.custos
                      const ah = af.fat > 0
                      return (
                        <TableRow key={apt.id} className="border-gray-100 hover:bg-gray-50 cursor-pointer">
                          <TableCell className="pl-6">
                            <Link href={`/empreendimentos?emp=${empId}&apt=${apt.id}&mes=${mes}&ano=${ano}&view=list`} className="flex items-center gap-3 group">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#19366015]">
                                <BedDouble size={14} style={{ color: '#193660' }} />
                              </div>
                              <span className="font-semibold text-gray-800 group-hover:text-[#193660] transition-colors">{apt.numero}</span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {ah ? Array.from(af.gestao).map((g) => (
                                <Badge key={g} variant="outline" className={g === 'adm' ? 'bg-blue-50 text-blue-700 border-blue-200 text-xs' : 'bg-purple-50 text-purple-700 border-purple-200 text-xs'}>
                                  {g.toUpperCase()}
                                </Badge>
                              )) : <span className="text-gray-300">—</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-gray-800 font-medium">
                            {ah ? fmt(af.fat) : <span className="text-gray-300">—</span>}
                          </TableCell>
                          <TableCell className="text-right text-red-500 font-medium">
                            {ah ? fmt(af.custos) : <span className="text-gray-300">—</span>}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${!ah ? '' : al >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {ah ? `${al >= 0 ? '+' : ''}${fmt(al)}` : <span className="text-gray-300">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {ah ? (
                              <Badge
                                className={`text-xs ${al >= 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}
                                variant="outline"
                              >
                                {al >= 0 ? <TrendingUp size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                                {al >= 0 ? 'Lucro' : 'Prejuízo'}
                              </Badge>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {apartamentos.map((apt) => {
              const af = aptFinMap[apt.id] ?? { fat: 0, custos: 0, gestao: new Set<string>() }
              const al = af.fat - af.custos
              const ah = af.fat > 0
              return (
                <Link key={apt.id} href={`/empreendimentos?emp=${empId}&apt=${apt.id}&mes=${mes}&ano=${ano}&view=grid`}>
                <div
                  className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-[#193660]/30 transition-all p-4 cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#19366015]">
                        <BedDouble size={14} style={{ color: '#193660' }} />
                      </div>
                      <span className="font-semibold text-gray-800 group-hover:text-[#193660] transition-colors">{apt.numero}</span>
                    </div>
                    {ah && (
                      <Badge
                        className={`text-xs ${al >= 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}
                        variant="outline"
                      >
                        {al >= 0 ? <TrendingUp size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                        {al >= 0 ? 'Lucro' : 'Prejuízo'}
                      </Badge>
                    )}
                  </div>
                  {ah ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1 mb-2">
                        {Array.from(af.gestao).map((g) => (
                          <Badge key={g} variant="outline" className={g === 'adm' ? 'bg-blue-50 text-blue-700 border-blue-200 text-xs' : 'bg-purple-50 text-purple-700 border-purple-200 text-xs'}>
                            {g.toUpperCase()}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Faturamento</span>
                        <span className="font-medium text-gray-800">{fmt(af.fat)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Custos</span>
                        <span className="font-medium text-red-500">{fmt(af.custos)}</span>
                      </div>
                      <div className="flex justify-between text-xs border-t border-gray-100 pt-1.5">
                        <span className="text-gray-500 font-medium">Lucro</span>
                        <span className={`font-bold ${al >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {al >= 0 ? '+' : ''}{fmt(al)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-300 italic">Sem dados para {MESES[mes - 1]}</p>
                  )}
                </div>
                </Link>
              )
            })}
          </div>
          )
        ) : (
          <Card className="border border-gray-100 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BedDouble className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Nenhum apartamento cadastrado</p>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // ── LISTA DE EMPREENDIMENTOS ──────────────────────────────────────
  const baseParams = `mes=${mes}&ano=${ano}`

  return (
    <div className="p-8 w-full">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empreendimentos</h1>
          <p className="text-gray-500 text-sm mt-1">
            {empreendimentos?.length ?? 0} empreendimento(s) — {MESES[mes - 1]} {ano}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle de visualização */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
            <Link
              href={`/empreendimentos?${baseParams}&view=grid`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                !isListView ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <LayoutGrid size={15} />
              Cards
            </Link>
            <Link
              href={`/empreendimentos?${baseParams}&view=list`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                isListView ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <List size={15} />
              Linhas
            </Link>
          </div>

          <Suspense fallback={null}>
            <MonthYearFilter mes={mes} ano={ano} />
          </Suspense>
        </div>
      </div>

      {empreendimentos && empreendimentos.length > 0 ? (
        isListView ? (
          // ── VISÃO EM LINHAS ───────────────────────────────────────
          <Card className="border border-gray-100 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100">
                    <TableHead className="text-gray-500 font-medium pl-6">Empreendimento</TableHead>
                    <TableHead className="text-gray-500 font-medium text-center">Aptos</TableHead>
                    <TableHead className="text-gray-500 font-medium text-right">Faturamento</TableHead>
                    <TableHead className="text-gray-500 font-medium text-right">Custos</TableHead>
                    <TableHead className="text-gray-500 font-medium text-right">Lucro</TableHead>
                    <TableHead className="text-gray-500 font-medium text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empreendimentos.map((emp) => {
                    const fin = finMap[emp.id] ?? { fat: 0, custos: 0 }
                    const lucro = fin.fat - fin.custos
                    const hasData = fin.fat > 0

                    return (
                      <TableRow
                        key={emp.id}
                        className="border-gray-100 hover:bg-gray-50 cursor-pointer"
                      >
                        <TableCell className="pl-6">
                          <Link href={`/empreendimentos?emp=${emp.id}&${baseParams}&view=list`} className="flex items-center gap-3 group">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#193660' }}>
                              <Building2 size={14} className="text-white" />
                            </div>
                            <span className="font-semibold text-gray-800 group-hover:text-[#193660] transition-colors">
                              {emp.nome}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-center text-gray-500 text-sm">
                          {(emp.apartamentos as any[])?.length ?? 0}
                        </TableCell>
                        <TableCell className="text-right text-gray-800 font-medium">
                          {hasData ? fmt(fin.fat) : <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className="text-right text-red-500 font-medium">
                          {hasData ? fmt(fin.custos) : <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className={`text-right font-bold ${!hasData ? '' : lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {hasData ? `${lucro >= 0 ? '+' : ''}${fmt(lucro)}` : <span className="text-gray-300">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          {hasData ? (
                            <Badge
                              className={`text-xs ${lucro >= 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}
                              variant="outline"
                            >
                              {lucro >= 0 ? <TrendingUp size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                              {lucro >= 0 ? 'Lucro' : 'Prejuízo'}
                            </Badge>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          // ── VISÃO EM CARDS ────────────────────────────────────────
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {empreendimentos.map((emp) => {
              const fin = finMap[emp.id] ?? { fat: 0, custos: 0 }
              const lucro = fin.fat - fin.custos
              const hasData = fin.fat > 0

              return (
                <Link key={emp.id} href={`/empreendimentos?emp=${emp.id}&${baseParams}&view=grid`}>
                  <Card className="border border-gray-100 shadow-sm hover:shadow-md hover:border-[#193660]/30 transition-all cursor-pointer group h-full">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#193660' }}>
                            <Building2 size={18} className="text-white" />
                          </div>
                          <CardTitle className="text-base font-semibold text-gray-800 group-hover:text-[#193660] transition-colors">
                            {emp.nome}
                          </CardTitle>
                        </div>
                        {hasData && (
                          <Badge
                            className={`text-xs shrink-0 ${lucro >= 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}
                            variant="outline"
                          >
                            {lucro >= 0 ? <TrendingUp size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                            {lucro >= 0 ? 'Lucro' : 'Prejuízo'}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <BedDouble size={13} />
                        <span>{(emp.apartamentos as any[])?.length ?? 0} apartamento(s)</span>
                      </div>
                      {hasData ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Faturamento</span>
                            <span className="font-medium text-gray-800">{fmt(fin.fat)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Custos</span>
                            <span className="font-medium text-red-500">{fmt(fin.custos)}</span>
                          </div>
                          <div className="flex justify-between text-sm border-t border-gray-100 pt-2 mt-1">
                            <span className="text-gray-500 font-medium">Lucro</span>
                            <span className={`font-bold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {lucro >= 0 ? '+' : ''}{fmt(lucro)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-gray-300 italic">Sem dados para {MESES[mes - 1]}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )
      ) : (
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhum empreendimento cadastrado</p>
            <p className="text-gray-400 text-sm mt-1">Importe uma planilha para popular os dados</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

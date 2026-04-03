import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Building2, BedDouble, ArrowLeft, TrendingUp, TrendingDown, LayoutGrid, List } from 'lucide-react'
import Link from 'next/link'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { CriarEmpreendimentoModal } from '@/components/modals/criar-empreendimento-modal'
import { CriarApartamentoModal } from '@/components/modals/criar-apartamento-modal'
import { DeleteButton } from '@/components/shared/delete-button'
import { EmpreendimentosListCharts } from '@/components/charts/empreendimentos-list-charts'
import { EmpreendimentoDetailCharts } from '@/components/charts/empreendimento-detail-charts'
import { ApartamentoCharts } from '@/components/charts/apartamento-charts'
import { Suspense } from 'react'
import { MESES } from '@/lib/constants'

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

type FinData = {
  fat: number; custos: number
  fatAdm: number; fatSub: number
  custosAdm: number; custosSub: number
  gestao: Set<string>
}

function emptyFin(): FinData {
  return { fat: 0, custos: 0, fatAdm: 0, fatSub: 0, custosAdm: 0, custosSub: 0, gestao: new Set() }
}

/** Mini-tabela ADM / SUB / Total */
function FinBreakdown({ f, size = 'sm', onlyTotal = false }: { f: FinData; size?: 'sm' | 'xs'; onlyTotal?: boolean }) {
  const lucroAdm = f.fatAdm - f.custosAdm
  const lucroSub = f.fatSub - f.custosSub
  const lucroTotal = f.fat - f.custos
  const hasAdm = f.fatAdm > 0 || f.custosAdm > 0
  const hasSub = f.fatSub > 0 || f.custosSub > 0
  const txt = size === 'xs' ? 'text-xs' : 'text-xs'

  return (
    <div className="w-full">
      {/* header row */}
      <div className={`grid grid-cols-4 gap-1 ${txt} text-gray-400 font-medium mb-1 pb-1 border-b border-gray-100`}>
        <span></span>
        <span className="text-right">Fat.</span>
        <span className="text-right">Custos</span>
        <span className="text-right">Lucro</span>
      </div>
      {/* Total */}
      <div className={`grid grid-cols-4 gap-1 ${txt} py-0.5`}>
        <span className="text-gray-500 font-semibold flex items-center gap-1">
          Total
          {!onlyTotal && hasAdm && !hasSub && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1 py-0">ADM</Badge>}
          {!onlyTotal && hasSub && !hasAdm && <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-1 py-0">SUB</Badge>}
        </span>
        <span className="text-right font-medium text-gray-800">{fmt(f.fat)}</span>
        <span className="text-right font-medium text-red-500">{fmt(f.custos)}</span>
        <span className={`text-right font-bold ${lucroTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {lucroTotal >= 0 ? '+' : ''}{fmt(lucroTotal)}
        </span>
      </div>
      {/* ADM e SUB — só mostra quando os dois coexistem (evita duplicar o Total) */}
      {!onlyTotal && hasAdm && hasSub && (
        <div className={`grid grid-cols-4 gap-1 ${txt} py-0.5`}>
          <span><Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] px-1 py-0">ADM</Badge></span>
          <span className="text-right text-gray-600">{fmt(f.fatAdm)}</span>
          <span className="text-right text-red-400">{fmt(f.custosAdm)}</span>
          <span className={`text-right font-medium ${lucroAdm >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {lucroAdm >= 0 ? '+' : ''}{fmt(lucroAdm)}
          </span>
        </div>
      )}
      {!onlyTotal && hasAdm && hasSub && (
        <div className={`grid grid-cols-4 gap-1 ${txt} py-0.5`}>
          <span><Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] px-1 py-0">SUB</Badge></span>
          <span className="text-right text-gray-600">{fmt(f.fatSub)}</span>
          <span className="text-right text-red-400">{fmt(f.custosSub)}</span>
          <span className={`text-right font-medium ${lucroSub >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {lucroSub >= 0 ? '+' : ''}{fmt(lucroSub)}
          </span>
        </div>
      )}
    </div>
  )
}

/** KPI cards grandes (3 colunas) com linha ADM/SUB abaixo */
function KpiSection({ f }: { f: FinData }) {
  const lucro = f.fat - f.custos
  const lucroAdm = f.fatAdm - f.custosAdm
  const lucroSub = f.fatSub - f.custosSub
  const hasAdm = f.fatAdm > 0 || f.custosAdm > 0
  const hasSub = f.fatSub > 0 || f.custosSub > 0

  return (
    <div className="mb-8 space-y-3">
      {/* Totais */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Faturamento Total</p>
          <p className="text-xl font-bold text-gray-900">{fmt(f.fat)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Custos Total</p>
          <p className="text-xl font-bold text-red-600">{fmt(f.custos)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Lucro Líquido Total</p>
          <p className={`text-xl font-bold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {lucro >= 0 ? '+' : ''}{fmt(lucro)}
          </p>
        </div>
      </div>

      {/* ADM + SUB */}
      {(hasAdm || hasSub) && (
        <div className="grid grid-cols-2 gap-4">
          {hasAdm && (
            <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">ADM</Badge>
                <span className="text-xs text-gray-400 uppercase tracking-wider">Gestão Direta</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase mb-0.5">Faturamento</p>
                  <p className="text-sm font-bold text-gray-800">{fmt(f.fatAdm)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase mb-0.5">Custos</p>
                  <p className="text-sm font-bold text-red-500">{fmt(f.custosAdm)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase mb-0.5">Lucro</p>
                  <p className={`text-sm font-bold ${lucroAdm >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {lucroAdm >= 0 ? '+' : ''}{fmt(lucroAdm)}
                  </p>
                </div>
              </div>
            </div>
          )}
          {hasSub && (
            <div className="bg-white rounded-xl border border-purple-100 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">SUB</Badge>
                <span className="text-xs text-gray-400 uppercase tracking-wider">Sublocação</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase mb-0.5">Faturamento</p>
                  <p className="text-sm font-bold text-gray-800">{fmt(f.fatSub)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase mb-0.5">Custos</p>
                  <p className="text-sm font-bold text-red-500">{fmt(f.custosSub)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase mb-0.5">Lucro</p>
                  <p className={`text-sm font-bold ${lucroSub >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {lucroSub >= 0 ? '+' : ''}{fmt(lucroSub)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

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

  const [{ data: empreendimentos }, { data: diariasData }, { data: custosData }] = await Promise.all([
    supabase.from('empreendimentos').select('id, nome, apartamentos(id)').order('nome'),
    supabase.from('diarias').select('valor, tipo_gestao, apartamentos(empreendimento_id)').gte('data', dataInicio).lte('data', dataFim),
    supabase.from('custos').select('valor, tipo_gestao, apartamentos(empreendimento_id)').eq('mes', mes).eq('ano', ano),
  ])

  // finMap: por empreendimento_id, com breakdown ADM/SUB
  const finMap: Record<string, FinData> = {}
  diariasData?.forEach((d: any) => {
    const id = d.apartamentos?.empreendimento_id
    if (!id) return
    if (!finMap[id]) finMap[id] = emptyFin()
    const v = d.valor || 0
    finMap[id].fat += v
    if (d.tipo_gestao === 'adm') finMap[id].fatAdm += v
    else if (d.tipo_gestao === 'sub') finMap[id].fatSub += v
    if (d.tipo_gestao) finMap[id].gestao.add(d.tipo_gestao)
  })
  custosData?.forEach((c: any) => {
    const id = c.apartamentos?.empreendimento_id
    if (!id) return
    if (!finMap[id]) finMap[id] = emptyFin()
    const v = c.valor || 0
    finMap[id].custos += v
    if (c.tipo_gestao === 'adm') finMap[id].custosAdm += v
    else if (c.tipo_gestao === 'sub') finMap[id].custosSub += v
    if (c.tipo_gestao) finMap[id].gestao.add(c.tipo_gestao)
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

    const af = emptyFin()
    aptDiarias?.forEach((d) => {
      const v = d.valor || 0; af.fat += v
      if (d.tipo_gestao === 'adm') af.fatAdm += v
      else if (d.tipo_gestao === 'sub') af.fatSub += v
      if (d.tipo_gestao) af.gestao.add(d.tipo_gestao)
    })
    aptCustos?.forEach((c) => {
      const v = c.valor || 0; af.custos += v
      if (c.tipo_gestao === 'adm') af.custosAdm += v
      else if (c.tipo_gestao === 'sub') af.custosSub += v
      if (c.tipo_gestao) af.gestao.add(c.tipo_gestao)
    })

    return (
      <div className="p-8 w-full">
        <div className="mb-2">
          <Link href={`/empreendimentos?emp=${empId}&mes=${mes}&ano=${ano}&view=${view ?? 'grid'}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-1">
            <ArrowLeft size={14} />{emp.nome}
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
          <Suspense fallback={null}><MonthYearFilter mes={mes} ano={ano} /></Suspense>
        </div>

        {af.fat > 0 || af.custos > 0 ? <KpiSection f={af} /> : null}

        <ApartamentoCharts
          diarias={(aptDiarias ?? []).map((d) => ({
            data: new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            valor: d.valor || 0,
          }))}
          custos={(aptCustos ?? []).map((c) => ({ categoria: c.categoria, valor: c.valor || 0 }))}
          periodo={`${MESES[mes - 1]} ${ano}`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-800 flex items-center justify-between">
                <span>Diárias (Faturamento)</span>
                {af.fat > 0 && <span className="text-[#193660] font-bold">{fmt(af.fat)}</span>}
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
                    <TableRow><TableCell colSpan={3} className="text-center text-gray-300 py-8 text-sm">Sem diárias em {MESES[mes - 1]}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border border-gray-100 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-800 flex items-center justify-between">
                <span>Custos</span>
                {af.custos > 0 && <span className="text-red-600 font-bold">{fmt(af.custos)}</span>}
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
                    <TableRow><TableCell colSpan={3} className="text-center text-gray-300 py-8 text-sm">Sem custos em {MESES[mes - 1]}</TableCell></TableRow>
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

    const [{ data: apartamentos }, { data: aptDiarias }, { data: aptCustos }] = await Promise.all([
      supabase.from('apartamentos').select('id, numero, created_at').eq('empreendimento_id', empId).order('numero'),
      supabase.from('diarias').select('valor, apartamento_id, tipo_gestao').gte('data', dataInicio).lte('data', dataFim),
      supabase.from('custos').select('valor, apartamento_id, tipo_gestao').eq('mes', mes).eq('ano', ano),
    ])

    const aptFinMap: Record<string, FinData> = {}
    aptDiarias?.forEach((d) => {
      if (!aptFinMap[d.apartamento_id]) aptFinMap[d.apartamento_id] = emptyFin()
      const v = d.valor || 0; aptFinMap[d.apartamento_id].fat += v
      if (d.tipo_gestao === 'adm') aptFinMap[d.apartamento_id].fatAdm += v
      else if (d.tipo_gestao === 'sub') aptFinMap[d.apartamento_id].fatSub += v
      if (d.tipo_gestao) aptFinMap[d.apartamento_id].gestao.add(d.tipo_gestao)
    })
    aptCustos?.forEach((c) => {
      if (!aptFinMap[c.apartamento_id]) aptFinMap[c.apartamento_id] = emptyFin()
      const v = c.valor || 0; aptFinMap[c.apartamento_id].custos += v
      if (c.tipo_gestao === 'adm') aptFinMap[c.apartamento_id].custosAdm += v
      else if (c.tipo_gestao === 'sub') aptFinMap[c.apartamento_id].custosSub += v
      if (c.tipo_gestao) aptFinMap[c.apartamento_id].gestao.add(c.tipo_gestao)
    })

    const fin = finMap[empId] ?? emptyFin()
    const hasData = fin.fat > 0 || fin.custos > 0

    return (
      <div className="p-8 w-full">
        <div className="mb-8">
          <Link href={`/empreendimentos?mes=${mes}&ano=${ano}&view=${view ?? 'grid'}`}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-3">
            <ArrowLeft size={14} />Todos os empreendimentos
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#193660' }}>
                <Building2 size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{emp.nome}</h1>
                <p className="text-gray-500 text-sm mt-0.5">{apartamentos?.length ?? 0} apartamento(s) — {MESES[mes - 1]} {ano}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <CriarApartamentoModal empreendimentoId={empId} empreendimentoNome={emp.nome} />
              <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
                <Link href={`/empreendimentos?emp=${empId}&mes=${mes}&ano=${ano}&view=grid`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${!isListView ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  <LayoutGrid size={15} />Cards
                </Link>
                <Link href={`/empreendimentos?emp=${empId}&mes=${mes}&ano=${ano}&view=list`}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${isListView ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                  <List size={15} />Linhas
                </Link>
              </div>
              <Suspense fallback={null}><MonthYearFilter mes={mes} ano={ano} /></Suspense>
            </div>
          </div>
        </div>

        {hasData && <KpiSection f={fin} />}

        {hasData && apartamentos && apartamentos.length > 0 && (
          <EmpreendimentoDetailCharts
            apts={(apartamentos ?? []).map((apt) => {
              const af = aptFinMap[apt.id] ?? emptyFin()
              return { numero: apt.numero, faturamento: af.fat, custos: af.custos, lucro: af.fat - af.custos }
            })}
            gestao={{ fatAdm: fin.fatAdm, fatSub: fin.fatSub, custosAdm: fin.custosAdm, custosSub: fin.custosSub }}
            periodo={`${MESES[mes - 1]} ${ano}`}
          />
        )}

        {apartamentos && apartamentos.length > 0 ? (
          isListView ? (
            <Card className="border border-gray-100 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-100">
                      <TableHead className="text-gray-500 font-medium pl-6">Apartamento</TableHead>
                      <TableHead className="text-gray-500 font-medium">Financeiro (Total / ADM / SUB)</TableHead>
                      <TableHead className="text-gray-500 font-medium text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apartamentos.map((apt) => {
                      const af = aptFinMap[apt.id] ?? emptyFin()
                      const al = af.fat - af.custos
                      const ah = af.fat > 0 || af.custos > 0
                      return (
                        <TableRow key={apt.id} className="border-gray-100 hover:bg-gray-50 cursor-pointer group/row">
                          <TableCell className="pl-6 align-top pt-4">
                            <div className="flex items-center gap-2">
                              <Link href={`/empreendimentos?emp=${empId}&apt=${apt.id}&mes=${mes}&ano=${ano}&view=list`}
                                className="flex items-center gap-3 group">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#19366015]">
                                  <BedDouble size={14} style={{ color: '#193660' }} />
                                </div>
                                <span className="font-semibold text-gray-800 group-hover:text-[#193660] transition-colors">{apt.numero}</span>
                              </Link>
                              <span className="opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <DeleteButton table="apartamentos" id={apt.id} label={`Apartamento ${apt.numero}`} />
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            {ah ? <FinBreakdown f={af} onlyTotal /> : <span className="text-gray-300 text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-center align-top pt-4">
                            {ah ? (
                              <Badge className={`text-xs ${al >= 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`} variant="outline">
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
                const af = aptFinMap[apt.id] ?? emptyFin()
                const al = af.fat - af.custos
                const ah = af.fat > 0 || af.custos > 0
                return (
                  <div key={apt.id} className="relative group/card">
                    <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <DeleteButton table="apartamentos" id={apt.id} label={`Apartamento ${apt.numero}`} />
                    </div>
                    <Link href={`/empreendimentos?emp=${empId}&apt=${apt.id}&mes=${mes}&ano=${ano}&view=grid`}>
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-[#193660]/30 transition-all p-4 cursor-pointer group h-full">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#19366015]">
                            <BedDouble size={14} style={{ color: '#193660' }} />
                          </div>
                          <span className="font-semibold text-gray-800 group-hover:text-[#193660] transition-colors">{apt.numero}</span>
                        </div>
                        {ah && (
                          <Badge className={`text-xs ${al >= 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`} variant="outline">
                            {al >= 0 ? <TrendingUp size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                            {al >= 0 ? 'Lucro' : 'Prejuízo'}
                          </Badge>
                        )}
                      </div>
                      {ah ? <FinBreakdown f={af} size="xs" /> : (
                        <p className="text-xs text-gray-300 italic">Sem dados para {MESES[mes - 1]}</p>
                      )}
                    </div>
                    </Link>
                  </div>
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
          <p className="text-gray-500 text-sm mt-1">{empreendimentos?.length ?? 0} empreendimento(s) — {MESES[mes - 1]} {ano}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <CriarEmpreendimentoModal />
          <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
            <Link href={`/empreendimentos?${baseParams}&view=grid`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${!isListView ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid size={15} />Cards
            </Link>
            <Link href={`/empreendimentos?${baseParams}&view=list`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${isListView ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
              <List size={15} />Linhas
            </Link>
          </div>
          <Suspense fallback={null}><MonthYearFilter mes={mes} ano={ano} /></Suspense>
        </div>
      </div>

      {empreendimentos && empreendimentos.length > 0 && Object.keys(finMap).length > 0 && (
        <EmpreendimentosListCharts
          data={empreendimentos
            .filter((e) => finMap[e.id])
            .map((e) => {
              const f = finMap[e.id]
              const nomeAbrev = e.nome.length > 12 ? e.nome.substring(0, 12) : e.nome
              return { nome: e.nome, nomeAbrev, faturamento: f.fat, custos: f.custos, lucro: f.fat - f.custos }
            })}
          periodo={`${MESES[mes - 1]} ${ano}`}
        />
      )}

      {empreendimentos && empreendimentos.length > 0 ? (
        isListView ? (
          <Card className="border border-gray-100 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100">
                    <TableHead className="text-gray-500 font-medium pl-6">Empreendimento</TableHead>
                    <TableHead className="text-gray-500 font-medium text-center">Aptos</TableHead>
                    <TableHead className="text-gray-500 font-medium">Financeiro (Total / ADM / SUB)</TableHead>
                    <TableHead className="text-gray-500 font-medium text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {empreendimentos.map((emp) => {
                    const fin = finMap[emp.id] ?? emptyFin()
                    const lucro = fin.fat - fin.custos
                    const hasData = fin.fat > 0 || fin.custos > 0
                    return (
                      <TableRow key={emp.id} className="border-gray-100 hover:bg-gray-50 cursor-pointer group/row">
                        <TableCell className="pl-6 align-top pt-4">
                          <div className="flex items-center gap-2">
                            <Link href={`/empreendimentos?emp=${emp.id}&${baseParams}&view=list`} className="flex items-center gap-3 group">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#193660' }}>
                                <Building2 size={14} className="text-white" />
                              </div>
                              <span className="font-semibold text-gray-800 group-hover:text-[#193660] transition-colors">{emp.nome}</span>
                            </Link>
                            <span className="opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <DeleteButton table="empreendimentos" id={emp.id} label={emp.nome} />
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-gray-500 text-sm align-top pt-4">
                          {(emp.apartamentos as any[])?.length ?? 0}
                        </TableCell>
                        <TableCell className="py-3">
                          {hasData ? <FinBreakdown f={fin} onlyTotal /> : <span className="text-gray-300 text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-center align-top pt-4">
                          {hasData ? (
                            <Badge className={`text-xs ${lucro >= 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`} variant="outline">
                              {lucro >= 0 ? <TrendingUp size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                              {lucro >= 0 ? 'Lucro' : 'Prejuízo'}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {empreendimentos.map((emp) => {
              const fin = finMap[emp.id] ?? emptyFin()
              const lucro = fin.fat - fin.custos
              const hasData = fin.fat > 0 || fin.custos > 0
              return (
                <div key={emp.id} className="relative group/card">
                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <DeleteButton table="empreendimentos" id={emp.id} label={emp.nome} />
                  </div>
                  <Link href={`/empreendimentos?emp=${emp.id}&${baseParams}&view=grid`}>
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
                          <Badge className={`text-xs shrink-0 ${lucro >= 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`} variant="outline">
                            {lucro >= 0 ? <TrendingUp size={10} className="mr-1" /> : <TrendingDown size={10} className="mr-1" />}
                            {lucro >= 0 ? 'Lucro' : 'Prejuízo'}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                        <BedDouble size={13} />
                        <span>{(emp.apartamentos as any[])?.length ?? 0} apartamento(s)</span>
                      </div>
                      {hasData ? <FinBreakdown f={fin} /> : (
                        <p className="text-xs text-gray-300 italic">Sem dados para {MESES[mes - 1]}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
                </div>
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

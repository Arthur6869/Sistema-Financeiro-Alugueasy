import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { EvolucaoChart } from '@/components/proprietario/evolucao-chart'
import { formatCurrency, MESES, MESES_ABREV } from '@/lib/constants'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Receipt, Wallet, Home } from 'lucide-react'

type SearchParams = Promise<{ mes?: string; ano?: string }>

type ApartamentoVinculo = {
  id: string
  numero: string
  tipo_gestao: 'adm' | 'sub' | null
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  empreendimentos: { nome: string } | null
}

function calcularRepasse(
  faturamento: number,
  lucro: number,
  taxaRepasse: number,
  tipoRepasse: 'lucro' | 'faturamento'
) {
  const base = tipoRepasse === 'faturamento' ? faturamento : lucro
  return base * (taxaRepasse / 100)
}

export default async function ProprietarioDashboard({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'proprietario') redirect('/')

  const params = await searchParams
  const now = new Date()
  const mes = params.mes !== undefined ? parseInt(params.mes) : now.getMonth() + 1
  const ano = params.ano !== undefined ? parseInt(params.ano) : now.getFullYear()
  const mesLabel = `${MESES[mes - 1]} ${ano}`
  const primeiroNome = profile?.full_name?.split(' ')[0] ?? 'Proprietário'

  // Buscar apartamentos vinculados
  const { data: vinculos } = await supabase
    .from('proprietario_apartamentos')
    .select('apartamentos(id, numero, tipo_gestao, taxa_repasse, tipo_repasse, empreendimentos(nome))')
    .eq('proprietario_id', user.id)
    .eq('ativo', true)

  type VinculoRow = { apartamentos: ApartamentoVinculo | null }
  const apartamentos: ApartamentoVinculo[] = ((vinculos ?? []) as unknown as VinculoRow[])
    .map(v => v.apartamentos)
    .filter((a): a is ApartamentoVinculo => a !== null)

  if (apartamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Home size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Nenhum apartamento vinculado</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          Entre em contato com a AlugEasy para vincular seus imóveis ao portal.
        </p>
      </div>
    )
  }

  const aptIds = apartamentos.map(a => a.id)
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  const [{ data: custosData }, { data: diariasData }] = await Promise.all([
    supabase
      .from('custos')
      .select('apartamento_id, valor')
      .in('apartamento_id', aptIds)
      .eq('mes', mes)
      .eq('ano', ano),
    supabase
      .from('diarias')
      .select('apartamento_id, valor')
      .in('apartamento_id', aptIds)
      .gte('data', dataInicio)
      .lte('data', dataFim),
  ])

  // Métricas por apartamento
  const metricas = apartamentos.map(apt => {
    const faturamento = (diariasData ?? [])
      .filter(d => d.apartamento_id === apt.id)
      .reduce((s, d) => s + (d.valor ?? 0), 0)
    const custos = (custosData ?? [])
      .filter(c => c.apartamento_id === apt.id)
      .reduce((s, c) => s + (c.valor ?? 0), 0)
    const lucro = faturamento - custos
    const taxaRepasse = apt.taxa_repasse ?? 0
    const tipoRepasse = apt.tipo_repasse ?? 'lucro'
    const repasse = calcularRepasse(faturamento, lucro, taxaRepasse, tipoRepasse)
    const valorProprietario = lucro - repasse
    return { apt, faturamento, custos, lucro, repasse, valorProprietario, taxaRepasse, tipoRepasse }
  })

  const totalFaturamento = metricas.reduce((s, m) => s + m.faturamento, 0)
  const totalCustos = metricas.reduce((s, m) => s + m.custos, 0)
  const totalLucro = metricas.reduce((s, m) => s + m.lucro, 0)
  const totalValorProprietario = metricas.reduce((s, m) => s + m.valorProprietario, 0)
  const semDados = totalFaturamento === 0 && totalCustos === 0

  // Histórico 6 meses para gráfico
  const periodos = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(ano, mes - 1 - (5 - i), 1)
    return { m: d.getMonth() + 1, a: d.getFullYear(), label: MESES_ABREV[d.getMonth()] }
  })

  const historicoData = await Promise.all(
    periodos.map(async ({ m, a, label }) => {
      const di = `${a}-${String(m).padStart(2, '0')}-01`
      const df = new Date(a, m, 0).toISOString().slice(0, 10)
      const [{ data: fat }, { data: cus }] = await Promise.all([
        supabase.from('diarias').select('valor').in('apartamento_id', aptIds).gte('data', di).lte('data', df),
        supabase.from('custos').select('valor').in('apartamento_id', aptIds).eq('mes', m).eq('ano', a),
      ])
      const faturamento = (fat ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
      const lucro = faturamento - (cus ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
      const repasse = metricas.length > 0
        ? calcularRepasse(faturamento, lucro, metricas[0].taxaRepasse, metricas[0].tipoRepasse)
        : 0
      return { label, faturamento, lucro, repasse }
    })
  )

  const mesesComDados = historicoData.filter(h => h.faturamento > 0 || h.lucro !== 0).length

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Saudação */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            Olá, {primeiroNome}! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Resumo dos seus imóveis em{' '}
            <span className="font-medium text-gray-700">{mesLabel}</span>
          </p>
        </div>
        <MonthYearFilter mes={mes} ano={ano} />
      </div>

      {/* Aviso de dados ausentes */}
      {semDados && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-amber-800 text-sm font-medium">
            ⏳ Os dados de {mesLabel} ainda estão sendo processados.
            Tente novamente em alguns dias ou entre em contato com a AlugEasy.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Faturamento */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-[#193660]" />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} className="text-[#193660]" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Faturamento</span>
            </div>
            <p className="text-lg md:text-2xl font-bold text-[#193660]">{formatCurrency(totalFaturamento)}</p>
            <p className="text-xs text-gray-400 mt-1">{mesLabel}</p>
          </div>
        </div>

        {/* Custos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="h-1 bg-red-400" />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Receipt size={15} className="text-red-500" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custos</span>
            </div>
            <p className="text-lg md:text-2xl font-bold text-red-600">{formatCurrency(totalCustos)}</p>
            <p className="text-xs text-gray-400 mt-1">{mesLabel}</p>
          </div>
        </div>

        {/* Lucro */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`h-1 ${totalLucro >= 0 ? 'bg-green-400' : 'bg-red-400'}`} />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              {totalLucro >= 0
                ? <TrendingUp size={15} className="text-green-500" />
                : <TrendingDown size={15} className="text-red-500" />}
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Lucro Líquido</span>
            </div>
            <p className={`text-lg md:text-2xl font-bold ${totalLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totalLucro)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{mesLabel}</p>
          </div>
        </div>

        {/* Repasse ao proprietário */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`h-1 ${totalValorProprietario >= 0 ? 'bg-amber-400' : 'bg-red-400'}`} />
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Wallet size={15} className="text-amber-500" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Seu Repasse</span>
            </div>
            <p className={`text-lg md:text-2xl font-bold ${totalValorProprietario >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
              {formatCurrency(totalValorProprietario)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Após taxa AlugEasy</p>
          </div>
        </div>
      </div>

      {/* Cards por apartamento — só aparece se tiver mais de 1 */}
      {metricas.length > 1 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800">Por Apartamento</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {metricas.map(({ apt, faturamento, custos, lucro, repasse, valorProprietario, taxaRepasse, tipoRepasse }) => (
              <Card key={apt.id} className="border border-gray-100 shadow-sm">
                <CardHeader className="pb-2 border-b border-gray-50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-gray-800">
                      Apt {apt.numero} — {apt.empreendimentos?.nome}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={apt.tipo_gestao === 'adm'
                        ? 'border-blue-200 bg-blue-50 text-blue-700 text-xs'
                        : 'border-purple-200 bg-purple-50 text-purple-700 text-xs'}
                    >
                      {apt.tipo_gestao === 'adm' ? 'ADM' : 'SUB'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-3 space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Faturamento</p>
                      <p className="font-semibold text-[#193660]">{formatCurrency(faturamento)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Custos</p>
                      <p className="font-semibold text-red-600">{formatCurrency(custos)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Lucro</p>
                      <p className={`font-semibold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(lucro)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">
                        Repasse ({taxaRepasse}% s/ {tipoRepasse === 'faturamento' ? 'fat.' : 'lucro'})
                      </p>
                      <p className="font-semibold text-amber-600">{formatCurrency(repasse)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Seu valor</p>
                      <p className={`font-bold text-base ${valorProprietario >= 0 ? 'text-[#193660]' : 'text-red-600'}`}>
                        {formatCurrency(valorProprietario)}
                      </p>
                    </div>
                    <Link
                      href={`/proprietario/extrato?mes=${mes}&ano=${ano}`}
                      className="text-xs font-medium text-[#193660] border border-[#193660]/30 rounded-lg px-3 py-1.5 hover:bg-[#193660] hover:text-white transition-colors w-full md:w-auto text-center mt-2 md:mt-0 block md:inline-block"
                    >
                      Ver extrato →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico de evolução */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-gray-800">
            Evolução dos últimos 6 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mesesComDados < 2 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              Histórico disponível após 2 meses de operação
            </div>
          ) : (
            <div className="h-48 md:h-64">
              <EvolucaoChart data={historicoData} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

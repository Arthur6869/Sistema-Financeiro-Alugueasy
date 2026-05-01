import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { EvolucaoChart } from '@/components/proprietario/evolucao-chart'
import { formatCurrency, MESES, MESES_ABREV } from '@/lib/constants'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Home, AlertCircle } from 'lucide-react'

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
        <p className="text-gray-500 text-sm">Entre em contato com a AlugEasy para vincular seus imóveis.</p>
      </div>
    )
  }

  const aptIds = apartamentos.map(a => a.id)

  // Buscar custos do mês
  const { data: custosData } = await supabase
    .from('custos')
    .select('apartamento_id, categoria, valor')
    .in('apartamento_id', aptIds)
    .eq('mes', mes)
    .eq('ano', ano)

  // Buscar faturamento do mês (diárias xlsx ou amenitiz_reservas)
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  const { data: diariasData } = await supabase
    .from('diarias')
    .select('apartamento_id, valor')
    .in('apartamento_id', aptIds)
    .gte('data', dataInicio)
    .lte('data', dataFim)

  // Calcular métricas por apartamento
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

  // Totais agregados
  const totalFaturamento = metricas.reduce((s, m) => s + m.faturamento, 0)
  const totalCustos = metricas.reduce((s, m) => s + m.custos, 0)
  const totalLucro = metricas.reduce((s, m) => s + m.lucro, 0)
  const totalRepasse = metricas.reduce((s, m) => s + m.repasse, 0)
  const totalValorProprietario = metricas.reduce((s, m) => s + m.valorProprietario, 0)

  const semDados = totalFaturamento === 0 && totalCustos === 0

  // Histórico últimos 6 meses para o gráfico
  const historicoData = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ano, mes - 1 - i, 1)
      return { m: d.getMonth() + 1, a: d.getFullYear(), label: MESES_ABREV[d.getMonth()] }
    })
      .reverse()
      .map(async ({ m, a, label }) => {
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

  const mesLabel = `${MESES[mes - 1]} ${ano}`

  return (
    <div className="space-y-8">
      {/* Saudação */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {profile?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Resumo financeiro de {mesLabel}
          </p>
        </div>
        <MonthYearFilter mes={mes} ano={ano} />
      </div>

      {/* Aviso sem dados */}
      {semDados && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          Os dados de {mesLabel} ainda não foram sincronizados ou não há registros para seus apartamentos neste período.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Faturamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#193660]">{formatCurrency(totalFaturamento)}</p>
            <p className="text-xs text-gray-400 mt-1">{mesLabel}</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Custos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalCustos)}</p>
            <p className="text-xs text-gray-400 mt-1">{mesLabel}</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Lucro Líquido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1.5">
              {totalLucro >= 0
                ? <TrendingUp size={16} className="text-green-500" />
                : <TrendingDown size={16} className="text-red-500" />}
              <p className={`text-2xl font-bold ${totalLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalLucro)}
              </p>
            </div>
            <p className="text-xs text-gray-400 mt-1">{mesLabel}</p>
          </CardContent>
        </Card>

        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Seu Valor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${totalValorProprietario >= 0 ? 'text-[#193660]' : 'text-red-600'}`}>
              {formatCurrency(totalValorProprietario)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Após repasse AlugEasy</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards por apartamento (se houver mais de um) */}
      {metricas.length > 1 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-gray-800">Por Apartamento</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {metricas.map(({ apt, faturamento, custos, lucro, repasse, valorProprietario, taxaRepasse, tipoRepasse }) => (
              <Card key={apt.id} className="border border-gray-100 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-gray-800">
                      {apt.empreendimentos?.nome} — Apt {apt.numero}
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
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Faturamento</span>
                    <span className="font-medium">{formatCurrency(faturamento)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Custos</span>
                    <span className="font-medium text-red-600">{formatCurrency(custos)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2">
                    <span className="text-gray-500">Lucro</span>
                    <span className={`font-medium ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(lucro)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">
                      Repasse ({taxaRepasse}% s/ {tipoRepasse === 'faturamento' ? 'fat.' : 'lucro'})
                    </span>
                    <span className="font-medium text-amber-600">{formatCurrency(repasse)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2">
                    <span className="font-semibold text-gray-700">Seu valor</span>
                    <span className={`font-bold ${valorProprietario >= 0 ? 'text-[#193660]' : 'text-red-600'}`}>
                      {formatCurrency(valorProprietario)}
                    </span>
                  </div>
                  <Link
                    href={`/proprietario/extrato?mes=${mes}&ano=${ano}`}
                    className="block text-center text-xs text-[#193660] hover:underline pt-1"
                  >
                    Ver extrato completo →
                  </Link>
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
            Evolução — Últimos 6 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <EvolucaoChart data={historicoData} />
        </CardContent>
      </Card>
    </div>
  )
}

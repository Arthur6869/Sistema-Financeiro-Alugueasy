import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, MESES } from '@/lib/constants'
import { Home, History } from 'lucide-react'
import Link from 'next/link'
import { HistoricoCardsMobile } from '@/components/proprietario/historico-cards-mobile'

type ApartamentoVinculo = {
  id: string
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
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

type StatusBadge = 'em_andamento' | 'fechado' | 'sem_dados'

function StatusPill({ status }: { status: StatusBadge }) {
  if (status === 'em_andamento') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
        Em andamento
      </span>
    )
  }
  if (status === 'fechado') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">
        Fechado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">
      Sem dados
    </span>
  )
}

export default async function HistoricoPropPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'proprietario') redirect('/')

  const { data: vinculos } = await supabase
    .from('proprietario_apartamentos')
    .select('apartamentos(id, taxa_repasse, tipo_repasse)')
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
  const now = new Date()
  const mesAtual = now.getMonth() + 1
  const anoAtual = now.getFullYear()

  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { m: d.getMonth() + 1, a: d.getFullYear() }
  }).reverse()

  const dados = await Promise.all(
    meses.map(async ({ m, a }) => {
      const di = `${a}-${String(m).padStart(2, '0')}-01`
      const df = new Date(a, m, 0).toISOString().slice(0, 10)

      const [{ data: fat }, { data: cus }] = await Promise.all([
        supabase.from('diarias').select('valor').in('apartamento_id', aptIds).gte('data', di).lte('data', df),
        supabase.from('custos').select('valor').in('apartamento_id', aptIds).eq('mes', m).eq('ano', a),
      ])

      const faturamento = (fat ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
      const custos = (cus ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
      const lucro = faturamento - custos
      const taxaRepasse = apartamentos[0]?.taxa_repasse ?? 0
      const tipoRepasse = apartamentos[0]?.tipo_repasse ?? 'lucro'
      const repasse = calcularRepasse(faturamento, lucro, taxaRepasse, tipoRepasse)
      const valorProprietario = lucro - repasse

      const isAtual = m === mesAtual && a === anoAtual
      const semDados = faturamento === 0 && custos === 0
      const status: StatusBadge = semDados ? 'sem_dados' : isAtual ? 'em_andamento' : 'fechado'

      return { m, a, faturamento, custos, lucro, repasse, valorProprietario, semDados, status }
    })
  )

  const mesesComDados = dados.filter(d => !d.semDados)
  const totais = {
    faturamento: mesesComDados.reduce((s, d) => s + d.faturamento, 0),
    custos: mesesComDados.reduce((s, d) => s + d.custos, 0),
    lucro: mesesComDados.reduce((s, d) => s + d.lucro, 0),
    repasse: mesesComDados.reduce((s, d) => s + d.repasse, 0),
    valorProprietario: mesesComDados.reduce((s, d) => s + d.valorProprietario, 0),
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <History size={20} className="text-[#193660]" />
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Histórico</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Últimos 12 meses — toque no mês para ver o extrato
        </p>
      </div>

      {/* Cards mobile (substituem a tabela) */}
      <HistoricoCardsMobile dados={dados.map(d => ({
        m: d.m,
        a: d.a,
        faturamento: d.faturamento,
        lucro: d.lucro,
        valorProprietario: d.valorProprietario,
        semDados: d.semDados,
        status: d.status,
      }))} />

      {/* Tabela desktop */}
      <Card className="hidden md:block border border-gray-100 shadow-sm overflow-hidden">
        <CardHeader className="py-3 bg-gray-50 border-b border-gray-100">
          <CardTitle className="text-sm font-semibold text-gray-700">Resumo Mensal</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Mês</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Faturamento</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Custos</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Lucro</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Repasse</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Seu Valor</th>
                </tr>
              </thead>
              <tbody>
                {dados.map(({ m, a, faturamento, custos, lucro, repasse, valorProprietario, semDados, status }) => {
                  const isAtual = m === mesAtual && a === anoAtual
                  return (
                    <tr
                      key={`${a}-${m}`}
                      className={`border-b border-gray-50 transition-colors ${
                        isAtual ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/proprietario/extrato?mes=${m}&ano=${a}`}
                          className="font-medium text-gray-800 hover:text-[#193660] hover:underline"
                        >
                          {MESES[m - 1]} {a}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {semDados ? <span className="text-gray-300 text-xs">—</span>
                          : <span className="text-[#193660] font-medium">{formatCurrency(faturamento)}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {semDados ? <span className="text-gray-300 text-xs">—</span>
                          : <span className="text-red-600">{formatCurrency(custos)}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {semDados ? <span className="text-gray-300 text-xs">—</span>
                          : <span className={lucro >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{formatCurrency(lucro)}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {semDados ? <span className="text-gray-300 text-xs">—</span>
                          : <span className="text-amber-600">{formatCurrency(repasse)}</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {semDados ? <span className="text-gray-300 text-xs">—</span>
                          : <span className={`font-semibold ${valorProprietario >= 0 ? 'text-[#193660]' : 'text-red-600'}`}>{formatCurrency(valorProprietario)}</span>}
                      </td>
                    </tr>
                  )
                })}

                {/* Linha de totais */}
                {mesesComDados.length > 0 && (
                  <tr className="bg-gray-100 border-t-2 border-gray-200">
                    <td className="px-4 py-3 font-bold text-gray-800" colSpan={2}>
                      Total ({mesesComDados.length} {mesesComDados.length === 1 ? 'mês' : 'meses'})
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#193660]">{formatCurrency(totais.faturamento)}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(totais.custos)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${totais.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(totais.lucro)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-amber-600">{formatCurrency(totais.repasse)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${totais.valorProprietario >= 0 ? 'text-[#193660]' : 'text-red-600'}`}>
                      {formatCurrency(totais.valorProprietario)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

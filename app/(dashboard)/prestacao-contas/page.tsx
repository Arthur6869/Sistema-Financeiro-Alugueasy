import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { GerarPdfButton } from '@/components/shared/gerar-pdf-button'
import { formatCurrency, MESES } from '@/lib/constants'

type ApartamentoItem = {
  id: string
  numero: string
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  nome_proprietario: string | null
  modelo_contrato: 'administracao' | 'sublocacao' | null
  empreendimentos: Array<{
    id: string
    nome: string
  }>
}

type Props = {
  searchParams: Promise<{
    mes?: string
    ano?: string
    apartamento_id?: string
  }>
}

export default async function PrestacaoContasPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const now = new Date()
  const mesRaw = params.mes ? parseInt(params.mes) : now.getMonth() + 1
  const anoRaw = params.ano ? parseInt(params.ano) : now.getFullYear()
  // Garante que mes e ano são sempre válidos (MonthYearFilter permite valor 0 = "Todos")
  const mes = mesRaw >= 1 && mesRaw <= 12 ? mesRaw : now.getMonth() + 1
  const ano = anoRaw >= 2020 ? anoRaw : now.getFullYear()

  const { data: apartamentos } = await supabase
    .from('apartamentos')
    .select('id, numero, taxa_repasse, tipo_repasse, nome_proprietario, modelo_contrato, empreendimentos!inner(id, nome)')
    .order('empreendimento_id')
    .order('numero')

  if (!apartamentos || apartamentos.length === 0) {
    return (
      <div className="p-8 w-full">
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Prestação de Contas</h1>
            <p className="text-gray-500">Nenhum apartamento cadastrado no sistema.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedApartmentId = params.apartamento_id ?? apartamentos[0].id
  const apartamentoSelecionado = apartamentos.find((apt) => apt.id === selectedApartmentId) ?? apartamentos[0]
  const empreendimentoNome = apartamentoSelecionado.empreendimentos?.[0]?.nome ?? 'Desconhecido'
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  const [{ data: diarias }, { data: custos }] = await Promise.all([
    supabase
      .from('diarias')
      .select('valor, tipo_gestao')
      .eq('apartamento_id', apartamentoSelecionado.id)
      .gte('data', dataInicio)
      .lte('data', dataFim),
    supabase
      .from('custos')
      .select('valor, categoria, tipo_gestao')
      .eq('apartamento_id', apartamentoSelecionado.id)
      .eq('mes', mes)
      .eq('ano', ano),
  ])

  const receitaAdm = diarias?.filter((item) => item.tipo_gestao === 'adm').reduce((sum, item) => sum + Number(item.valor ?? 0), 0) ?? 0
  const receitaSub = diarias?.filter((item) => item.tipo_gestao === 'sub').reduce((sum, item) => sum + Number(item.valor ?? 0), 0) ?? 0
  const receitaTotal = receitaAdm + receitaSub
  const custosAdm = custos?.filter((item) => item.tipo_gestao === 'adm').reduce((sum, item) => sum + Number(item.valor ?? 0), 0) ?? 0
  const custosSub = custos?.filter((item) => item.tipo_gestao === 'sub').reduce((sum, item) => sum + Number(item.valor ?? 0), 0) ?? 0
  const custosTotal = custosAdm + custosSub
  const lucroLiquido = receitaTotal - custosTotal
  const taxa = Number(apartamentoSelecionado.taxa_repasse ?? 0) / 100
  const baseCalculo = apartamentoSelecionado.tipo_repasse === 'faturamento' ? receitaTotal : lucroLiquido
  const valorRepasse = baseCalculo * taxa
  const valorLiquidoProprietario = lucroLiquido - valorRepasse
  const margemLiquida = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0

  const hasAdm = receitaAdm > 0 || custosAdm > 0
  const hasSub = receitaSub > 0 || custosSub > 0
  const hasData = (diarias?.length ?? 0) > 0 || (custos?.length ?? 0) > 0

  const baseCalculoLabel = apartamentoSelecionado.tipo_repasse === 'faturamento' ? 'Faturamento Bruto' : 'Lucro Líquido'

  return (
    <div className="p-8 w-full space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prestação de Contas</h1>
          <p className="text-gray-500 mt-2">
            Competência: {MESES[mes - 1]} {ano} — {empreendimentoNome} — Apt {apartamentoSelecionado.numero}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form className="flex flex-wrap items-center gap-3" method="get" action="/prestacao-contas">
            <div className="min-w-[280px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Apartamento</label>
              <select
                name="apartamento_id"
                defaultValue={apartamentoSelecionado.id}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#193660]/30"
              >
                {apartamentos.reduce((groups: Array<{ empreendimento: string; itens: ApartamentoItem[] }>, apt) => {
                  const empNome = apt.empreendimentos?.[0]?.nome ?? 'Desconhecido'
                  const group = groups.find((g) => g.empreendimento === empNome)
                  if (group) group.itens.push(apt)
                  else groups.push({ empreendimento: empNome, itens: [apt] })
                  return groups
                }, []).map((group) => (
                  <optgroup key={group.empreendimento} label={group.empreendimento}>
                    {group.itens.map((apt) => (
                      <option key={apt.id} value={apt.id}>
                        Apt {apt.numero}{apt.nome_proprietario ? ` — ${apt.nome_proprietario}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <input type="hidden" name="mes" value={mes} />
            <input type="hidden" name="ano" value={ano} />
            <button
              type="submit"
              className="rounded-xl bg-[#193660] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152b4d] transition"
            >
              Atualizar
            </button>
          </form>
          <MonthYearFilter mes={mes} ano={ano} />
          <GerarPdfButton apartamentoId={apartamentoSelecionado.id} mes={mes} ano={ano} label="Gerar PDF" />
        </div>
      </div>

      {!hasData ? (
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Nenhum dado encontrado para {MESES[mes - 1]}/{ano}</h2>
            <p className="text-gray-500 mb-4">Verifique se as planilhas foram importadas.</p>
            <Link
              href="/importar"
              className="inline-flex rounded-xl bg-[#193660] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152b4d] transition"
            >
              Ir para Importar
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Receita Bruta</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#193660]">{formatCurrency(receitaTotal)}</p>
                <p className="text-sm text-gray-500">Faturamento de diárias no período</p>
              </CardContent>
            </Card>

            <Card className="border border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Custos Totais</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(custosTotal)}</p>
                <p className="text-sm text-gray-500">{receitaTotal > 0 ? `${((custosTotal / receitaTotal) * 100).toFixed(2)}% do faturamento` : 'Sem faturamento'}</p>
              </CardContent>
            </Card>

            <Card className="border border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Lucro Líquido</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>{lucroLiquido >= 0 ? '' : '-'}{formatCurrency(Math.abs(lucroLiquido))}</p>
                <p className="text-sm text-gray-500">Margem de {margemLiquida.toFixed(2)}%</p>
              </CardContent>
            </Card>

            <Card className="border border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Repasse</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-[#d97706]">{formatCurrency(valorRepasse)}</p>
                <p className="text-sm text-gray-500">{apartamentoSelecionado.taxa_repasse ?? 0}% sobre {baseCalculoLabel.toLowerCase()}</p>
              </CardContent>
            </Card>
          </div>

          {(hasAdm || hasSub) && (
            <Card className="border border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">ADM vs SUB</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-100">
                      <TableHead className="text-gray-500">Tipo</TableHead>
                      <TableHead className="text-gray-500 text-right">Faturamento</TableHead>
                      <TableHead className="text-gray-500 text-right">Custos</TableHead>
                      <TableHead className="text-gray-500 text-right">Lucro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hasAdm && (
                      <TableRow className="border-gray-100">
                        <TableCell>ADM</TableCell>
                        <TableCell className="text-right">{formatCurrency(receitaAdm)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(custosAdm)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(receitaAdm - custosAdm)}</TableCell>
                      </TableRow>
                    )}
                    {hasSub && (
                      <TableRow className="border-gray-100">
                        <TableCell>SUB</TableCell>
                        <TableCell className="text-right">{formatCurrency(receitaSub)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(custosSub)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(receitaSub - custosSub)}</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="border-gray-100 bg-gray-50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{formatCurrency(receitaTotal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(custosTotal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(lucroLiquido)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card className="border border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Custos Detalhados</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-100">
                    <TableHead className="text-gray-500">Categoria</TableHead>
                    <TableHead className="text-gray-500">Gestão</TableHead>
                    <TableHead className="text-gray-500 text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custos && custos.length > 0 ? custos.map((item, index) => (
                    <TableRow key={index} className="border-gray-100">
                      <TableCell>{item.categoria}</TableCell>
                      <TableCell>{item.tipo_gestao?.toUpperCase()}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(item.valor ?? 0))}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-400 py-8">Nenhum custo cadastrado para este período</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-gray-50 font-semibold">
                    <TableCell>Total</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{formatCurrency(custosTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border border-[#f59e0b] border-l-4 shadow-sm bg-[#fffbf0]">
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm font-semibold text-gray-900">Proprietário: {apartamentoSelecionado.nome_proprietario || 'Não configurado'}</div>
                <div className="grid gap-2">
                  <div className="flex justify-between text-sm text-gray-600"><span>Receita Bruta:</span><span>{formatCurrency(receitaTotal)}</span></div>
                  <div className="flex justify-between text-sm text-gray-600"><span>(−) Custos Totais:</span><span>− {formatCurrency(custosTotal)}</span></div>
                  <div className="flex justify-between text-sm text-gray-600"><span>(=) Lucro Líquido:</span><span>{formatCurrency(lucroLiquido)}</span></div>
                  <div className="flex justify-between text-sm text-gray-600"><span>(−) Taxa Alugueasy [{apartamentoSelecionado.taxa_repasse ?? 0}%] s/ {baseCalculoLabel.toLowerCase()}:</span><span>− {formatCurrency(valorRepasse)}</span></div>
                </div>
                <div className="mt-4 rounded-xl bg-[#193660] px-4 py-4 text-white">
                  <div className="text-sm font-semibold">VALOR LÍQUIDO AO PROPRIETÁRIO</div>
                  <div className="text-2xl font-bold">{formatCurrency(valorLiquidoProprietario)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

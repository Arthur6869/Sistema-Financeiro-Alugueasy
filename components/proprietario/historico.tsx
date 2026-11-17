'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Tabs } from '@base-ui/react/tabs'
import {
  createColumnHelper, createSortedRowModel, rowSortingFeature, tableFeatures, useTable, type Row,
} from '@tanstack/react-table'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, History } from 'lucide-react'
import { MESES_ABREV } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { PaginaInterna } from '@/components/painel/pagina'
import { moeda } from '@/components/dashboard/valor'

export type MesHistorico = {
  m: number
  a: number
  label: string
  faturamento: number
  custos: number | null
  lucro: number
  /** Taxa AlugEasy do mês */
  taxa: number
  valorProprietario: number
  semDados: boolean
  isAtual: boolean
}

export type ImovelHistorico = {
  id: string
  nome: string
  meses: { label: string; faturamento: number; custos: number; lucro: number }[]
}

/* Cores das séries: as mesmas validadas no restante do sistema */
const COR_FATURAMENTO = '#2a63b8'
const COR_CUSTOS = '#eb6834'
const COR_VALOR = '#15803d'

const eixoK = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} mil` : String(Math.round(v)))
const caixa = 'rounded-xl border border-linha bg-white px-3 py-2.5 text-[13px] shadow-lg'

/* ── gráfico 1: o que ficou com o proprietário, mês a mês ─────────── */

function CaixaValor({ active, payload }: { active?: boolean; payload?: { payload?: MesHistorico }[] }) {
  const d = payload?.[0]?.payload
  if (!active || !d || d.semDados) return null
  return (
    <div className={caixa}>
      <p className="mb-1.5 font-semibold text-tinta">{d.label}{d.isAtual && <span className="ml-1.5 font-normal text-apagado">· em andamento</span>}</p>
      <p className="flex justify-between gap-6 text-tinta-suave"><span>Faturamento</span><span className="tabular-nums text-tinta">{moeda(d.faturamento)}</span></p>
      <p className="flex justify-between gap-6 text-tinta-suave"><span>Lucro</span><span className="tabular-nums text-tinta">{moeda(d.lucro)}</span></p>
      <p className="mt-1 flex justify-between gap-6 border-t border-linha pt-1 font-semibold text-tinta"><span>Seu valor</span><span className="tabular-nums">{moeda(d.valorProprietario)}</span></p>
    </div>
  )
}

function GraficoValor({ linhas }: { linhas: MesHistorico[] }) {
  const dados = linhas.map(l => ({ ...l, valor: l.semDados ? null : l.valorProprietario, curto: `${MESES_ABREV[l.m - 1].toLowerCase()}/${String(l.a).slice(2)}` }))
  if (!linhas.some(l => !l.semDados && l.valorProprietario !== 0)) {
    return <p className="py-10 text-center text-sm text-apagado">Nenhum repasse registrado nos últimos 12 meses.</p>
  }
  return (
    <div className="h-56 w-full" role="img" aria-label="Seu valor em cada um dos últimos 12 meses">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 224 }}>
        <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#e6e1d6" strokeDasharray="2 4" />
          <XAxis dataKey="curto" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#5a6a82' }} dy={6} interval="preserveStartEnd" minTickGap={14} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#5a6a82' }} tickFormatter={eixoK} width={44} />
          <Tooltip content={<CaixaValor />} cursor={{ fill: 'rgba(15, 26, 46, 0.04)' }} />
          <Bar dataKey="valor" name="Seu valor" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {/* o mês em andamento é o mesmo dado, só ainda incompleto: mesma cor, mais clara */}
            {dados.map(d => <Cell key={`${d.a}-${d.m}`} fill={COR_VALOR} fillOpacity={d.isAtual ? 0.45 : 1} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── gráfico 2: faturamento × custos de um imóvel ─────────────────── */

type MesImovel = ImovelHistorico['meses'][number]

function CaixaImovel({ active, payload }: { active?: boolean; payload?: { payload?: MesImovel }[] }) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div className={caixa}>
      <p className="mb-1.5 font-semibold text-tinta">{d.label}</p>
      <p className="flex items-center justify-between gap-6 text-tinta-suave"><span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: COR_FATURAMENTO }} />Faturamento</span><span className="tabular-nums text-tinta">{moeda(d.faturamento)}</span></p>
      <p className="flex items-center justify-between gap-6 text-tinta-suave"><span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: COR_CUSTOS }} />Custos</span><span className="tabular-nums text-tinta">{moeda(d.custos)}</span></p>
      <p className="mt-1 flex justify-between gap-6 border-t border-linha pt-1 font-semibold text-tinta"><span>Lucro</span><span className={cn('tabular-nums', d.lucro < 0 && 'text-negativo')}>{moeda(d.lucro)}</span></p>
    </div>
  )
}

function DesempenhoImovel({ imoveis }: { imoveis: ImovelHistorico[] }) {
  const [selecionado, setSelecionado] = useState(imoveis[0]?.id ?? '')
  const imovel = imoveis.find(i => i.id === selecionado) ?? imoveis[0]
  if (!imovel) return null

  const totais = imovel.meses.reduce(
    (t, m) => ({ faturamento: t.faturamento + m.faturamento, custos: t.custos + m.custos, lucro: t.lucro + m.lucro }),
    { faturamento: 0, custos: 0, lucro: 0 },
  )
  const semDados = imovel.meses.every(m => m.faturamento === 0 && m.custos === 0)

  return (
    <Tabs.Root value={selecionado} onValueChange={v => setSelecionado(String(v))}>
      {imoveis.length > 1 && (
        <Tabs.List aria-label="Imóvel" className="relative mb-4 flex max-w-full gap-1 overflow-x-auto rounded-full border border-linha bg-creme p-1 [scrollbar-width:none] sm:inline-flex">
          {imoveis.map(i => (
            <Tabs.Tab
              key={i.id} value={i.id}
              className="h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-medium text-apagado transition-colors hover:text-tinta focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca-700 data-selected:bg-white data-selected:text-tinta data-selected:shadow-sm"
            >
              {i.nome}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      )}

      <Tabs.Panel value={imovel.id} keepMounted>
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            { rotulo: 'Faturamento em 12 meses', valor: totais.faturamento, cor: COR_FATURAMENTO },
            { rotulo: 'Custos em 12 meses', valor: totais.custos, cor: COR_CUSTOS },
            { rotulo: 'Lucro em 12 meses', valor: totais.lucro, cor: null },
          ].map(t => (
            <div key={t.rotulo} className="rounded-xl border border-linha bg-creme/50 px-4 py-3">
              <dt className="flex items-center gap-2 text-[13px] text-apagado">
                {t.cor && <span aria-hidden="true" className="size-2.5 rounded-[3px]" style={{ background: t.cor }} />}
                {t.rotulo}
              </dt>
              <dd className={cn('mt-1 text-lg font-semibold tabular-nums', t.cor === null && totais.lucro < 0 ? 'text-negativo' : 'text-tinta')}>{moeda(t.valor)}</dd>
            </div>
          ))}
        </dl>

        {semDados ? (
          <p className="py-10 text-center text-sm text-apagado">Este imóvel ainda não registrou faturamento nem custos nos últimos 12 meses.</p>
        ) : (
          <>
            <ul className="mb-2 mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-tinta-suave">
              <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-4 rounded-sm" style={{ background: COR_FATURAMENTO }} />Faturamento</li>
              <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-4 rounded-sm" style={{ background: COR_CUSTOS }} />Custos</li>
            </ul>
            <div className="h-56 w-full" role="img" aria-label={`Faturamento e custos de ${imovel.nome} nos últimos 12 meses`}>
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 224 }}>
                <BarChart data={imovel.meses} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%" barGap={2}>
                  <CartesianGrid vertical={false} stroke="#e6e1d6" strokeDasharray="2 4" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#5a6a82' }} dy={6} interval="preserveStartEnd" minTickGap={14} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#5a6a82' }} tickFormatter={eixoK} width={44} />
                  <Tooltip content={<CaixaImovel />} cursor={{ fill: 'rgba(15, 26, 46, 0.04)' }} />
                  <Bar dataKey="faturamento" name="Faturamento" fill={COR_FATURAMENTO} radius={[4, 4, 0, 0]} maxBarSize={16} />
                  <Bar dataKey="custos" name="Custos" fill={COR_CUSTOS} radius={[4, 4, 0, 0]} maxBarSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Tabs.Panel>
    </Tabs.Root>
  )
}

/* ── tabela: um mês por linha (TanStack Table) ─────────────────────── */

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() })
type LinhaTabela = Row<typeof features, MesHistorico>
const ajudante = createColumnHelper<typeof features, MesHistorico>()
const numero = (chave: 'faturamento' | 'custos' | 'lucro' | 'taxa' | 'valorProprietario') =>
  (a: LinhaTabela, b: LinhaTabela) => (a.original[chave] ?? -Infinity) - (b.original[chave] ?? -Infinity)
const colunas = ajudante.columns([
  ajudante.accessor('label', { sortFn: (a, b) => a.original.a - b.original.a || a.original.m - b.original.m }),
  ajudante.accessor('faturamento', { sortFn: numero('faturamento'), sortDescFirst: true }),
  ajudante.accessor('custos', { sortFn: numero('custos'), sortDescFirst: true }),
  ajudante.accessor('lucro', { sortFn: numero('lucro'), sortDescFirst: true }),
  ajudante.accessor('taxa', { sortFn: numero('taxa'), sortDescFirst: true }),
  ajudante.accessor('valorProprietario', { sortFn: numero('valorProprietario'), sortDescFirst: true }),
])

function Situacao({ linha }: { linha: MesHistorico }) {
  const [classe, texto] = linha.isAtual
    ? ['bg-marca-50 text-marca-700', 'Em andamento']
    : linha.semDados ? ['bg-creme text-apagado', 'Sem dados'] : ['bg-positivo/10 text-positivo', 'Disponível']
  return <span className={cn('inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11.5px] font-medium', classe)}>{texto}</span>
}

const hrefDoMes = (l: MesHistorico) => `/proprietario/extrato?mes=${l.m}&ano=${l.a}`

function TabelaMeses({ linhas }: { linhas: MesHistorico[] }) {
  const router = useRouter()
  const tabela = useTable({ features, columns: colunas, data: linhas, getRowId: l => `${l.a}-${l.m}`, enableSortingRemoval: true })
  const vazio = <span className="text-apagado/50">—</span>

  const cabecalho = (id: string, rotulo: string, numerico = false) => {
    const coluna = tabela.getColumn(id)
    const ordem = coluna?.getIsSorted() ?? false
    const Icone = ordem === 'asc' ? ArrowUp : ordem === 'desc' ? ArrowDown : ArrowUpDown
    return (
      <th key={id} scope="col" aria-sort={ordem === 'asc' ? 'ascending' : ordem === 'desc' ? 'descending' : 'none'} className={cn('px-3 py-2.5 font-medium first:pl-5 last:pr-5', numerico ? 'text-right' : 'text-left')}>
        <button
          type="button" onClick={coluna?.getToggleSortingHandler()}
          className={cn('inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700', numerico && 'flex-row-reverse', ordem ? 'text-tinta' : 'text-apagado')}
        >
          {rotulo}
          <Icone size={13} aria-hidden="true" className={ordem ? '' : 'opacity-50'} />
        </button>
      </th>
    )
  }

  return (
    <>
      {/* a partir do tablet: tabela */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-linha text-[13px]">
              {cabecalho('label', 'Mês')}
              <th scope="col" className="px-3 py-2.5 text-left font-medium text-apagado">Situação</th>
              {cabecalho('faturamento', 'Faturamento', true)}
              {cabecalho('custos', 'Custos', true)}
              {cabecalho('lucro', 'Lucro', true)}
              {cabecalho('taxa', 'Taxa AlugEasy', true)}
              {cabecalho('valorProprietario', 'Seu valor', true)}
            </tr>
          </thead>
          <tbody>
            {tabela.getRowModel().rows.map(r => {
              const l = r.original
              return (
                <tr
                  key={r.id}
                  onClick={l.semDados ? undefined : () => router.push(hrefDoMes(l))}
                  className={cn('border-b border-linha/70 last:border-0', !l.semDados && 'cursor-pointer transition-colors hover:bg-creme/60')}
                >
                  <th scope="row" className="py-3 pl-5 pr-3 text-left font-medium">
                    {l.semDados
                      ? <span className={l.isAtual ? 'text-tinta' : 'text-apagado'}>{l.label}</span>
                      : <Link href={hrefDoMes(l)} className="rounded-md text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700">{l.label}</Link>}
                  </th>
                  <td className="px-3 py-3"><Situacao linha={l} /></td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-tinta">{l.semDados ? vazio : moeda(l.faturamento)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-tinta-suave">{l.custos === null ? vazio : moeda(l.custos)}</td>
                  <td className={cn('whitespace-nowrap px-3 py-3 text-right tabular-nums', l.lucro < 0 ? 'text-negativo' : 'text-tinta')}>{l.semDados ? vazio : moeda(l.lucro)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-tinta-suave">{l.semDados ? vazio : moeda(l.taxa)}</td>
                  <td className={cn('whitespace-nowrap py-3 pl-3 pr-5 text-right font-semibold tabular-nums', l.semDados ? 'text-apagado/50' : l.valorProprietario < 0 ? 'text-negativo' : 'text-positivo')}>
                    {l.semDados ? '—' : moeda(l.valorProprietario)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* celular: um cartão por mês, do mais recente para o mais antigo */}
      <ul className="divide-y divide-linha/70 md:hidden">
        {[...linhas].reverse().map(l => {
          const conteudo = (
            <>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="whitespace-nowrap font-semibold text-tinta">{l.label}</span><Situacao linha={l} /></span>
                {!l.semDados && (
                  <span className="mt-1 block text-xs text-apagado">Faturou {moeda(l.faturamento)} · lucro {moeda(l.lucro)}</span>
                )}
              </span>
              <span className={cn('shrink-0 text-right font-semibold tabular-nums', l.semDados ? 'text-apagado/50' : l.valorProprietario < 0 ? 'text-negativo' : 'text-positivo')}>
                {l.semDados ? '—' : moeda(l.valorProprietario)}
              </span>
              {!l.semDados && <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-apagado" />}
            </>
          )
          return (
            <li key={`${l.a}-${l.m}`}>
              {l.semDados
                ? <div className="flex items-center gap-3 px-4 py-3.5">{conteudo}</div>
                : <Link href={hrefDoMes(l)} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-creme/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca-700">{conteudo}</Link>}
            </li>
          )
        })}
      </ul>
    </>
  )
}

/* ── a página ──────────────────────────────────────────────────────── */

export function HistoricoProprietario({ linhas, imoveis }: { linhas: MesHistorico[]; imoveis: ImovelHistorico[] }) {
  const comDados = useMemo(() => linhas.filter(l => !l.semDados).length, [linhas])
  return (
    <PaginaInterna
      estreita
      rotulo="Histórico"
      titulo="Últimos 12 meses"
      sub={comDados === 0 ? 'Ainda não há meses fechados' : `${comDados} ${comDados === 1 ? 'mês com movimento' : 'meses com movimento'} · toque num mês para ver a rentabilidade completa`}
    >
      <section data-entrada data-tour="his-grafico" aria-labelledby="titulo-valor" className="rounded-2xl border border-linha bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="titulo-valor" className="text-[15px] font-semibold text-tinta">Seu valor, mês a mês</h2>
          <p className="text-[13px] text-apagado">O que ficou com você depois de custos e taxa</p>
        </div>
        <div className="mt-4"><GraficoValor linhas={linhas} /></div>
      </section>

      {imoveis.length > 0 && (
        <section data-entrada data-tour="his-imovel" aria-labelledby="titulo-imovel" className="rounded-2xl border border-linha bg-white p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="titulo-imovel" className="text-[15px] font-semibold text-tinta">Desempenho por imóvel</h2>
            <p className="text-[13px] text-apagado">Faturamento e custos de cada imóvel; o lucro aparece ao passar sobre o mês</p>
          </div>
          <DesempenhoImovel imoveis={imoveis} />
        </section>
      )}

      <section data-entrada data-tour="his-tabela" aria-labelledby="titulo-tabela" className="rounded-2xl border border-linha bg-white">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-linha px-5 py-4">
          <h2 id="titulo-tabela" className="flex items-center gap-2 text-[15px] font-semibold text-tinta"><History size={16} aria-hidden="true" className="text-marca-700" />Resumo detalhado</h2>
          <p className="text-[13px] text-apagado">Clique no título de uma coluna para ordenar</p>
        </div>
        <TabelaMeses linhas={linhas} />
      </section>
    </PaginaInterna>
  )
}

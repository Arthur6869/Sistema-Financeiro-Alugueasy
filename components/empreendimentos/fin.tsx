'use client'

import Link from 'next/link'
import { LayoutGrid, List, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { margemDe, moeda, moedaComSinal, porcento } from '@/components/dashboard/valor'

/*
 * Peças pequenas compartilhadas pelos três níveis da aba Empreendimentos
 * (lista → empreendimento → apartamento). Os números chegam prontos de
 * app/(dashboard)/empreendimentos/page.tsx; aqui só se exibe.
 */

/** Totais de um empreendimento ou apartamento no período, com a quebra por gestão. */
export type Fin = {
  fat: number; custos: number
  fatAdm: number; fatSub: number
  custosAdm: number; custosSub: number
}

export type Visao = 'grid' | 'list'

export const lucroDe = (f: Fin) => f.fat - f.custos

/** Teve faturamento ou custo no período? */
export const temMovimento = (f: Fin | null | undefined): f is Fin => !!f && (f.fat > 0 || f.custos > 0)

/** Estado nunca só pela cor: ícone + palavra. */
export function SeloResultado({ lucro, className }: { lucro: number; className?: string }) {
  const positivo = lucro >= 0
  return (
    <span className={cn(
      'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
      positivo ? 'bg-positivo/10 text-positivo' : 'bg-negativo/10 text-negativo',
      className,
    )}>
      {positivo ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
      {positivo ? 'Lucro' : 'Prejuízo'}
    </span>
  )
}

export function SeloGestao({ tipo }: { tipo: string | null | undefined }) {
  if (!tipo) return null
  return (
    <span
      title={tipo === 'adm' ? 'Administração' : tipo === 'sub' ? 'Sublocação' : undefined}
      className="inline-block rounded-md border border-linha bg-creme px-1.5 py-0.5 font-rotulo text-[10.5px] font-semibold uppercase tracking-wide text-tinta-suave"
    >
      {tipo}
    </span>
  )
}

/**
 * Faturamento (azul) sobre custos (laranja), na mesma escala: `maior` é o
 * teto comum a todos os itens da lista, então dá para comparar cartões.
 */
export function BarrasFatCusto({ fat, custos, maior, className }: {
  fat: number; custos: number; maior: number; className?: string
}) {
  const largura = (v: number) => `${Math.max(0, Math.min(100, (v / Math.max(maior, 1)) * 100))}%`
  return (
    <span aria-hidden="true" className={cn('relative block h-[22px]', className)}>
      <span data-barra className="absolute left-0 top-0 h-2.5 origin-left rounded-r-[4px] bg-serie-faturamento" style={{ width: largura(fat) }} />
      <span data-barra className="absolute bottom-0 left-0 h-2.5 origin-left rounded-r-[4px] bg-serie-custo-reservas" style={{ width: largura(custos) }} />
    </span>
  )
}

export function LegendaFatCusto() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-tinta-suave">
      <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-4 rounded-sm bg-serie-faturamento" />Faturamento</li>
      <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-4 rounded-sm bg-serie-custo-reservas" />Custos</li>
    </ul>
  )
}

/** Lucro com sinal; vermelho só quando é prejuízo. */
export function Lucro({ valor, className }: { valor: number; className?: string }) {
  return <span className={cn(valor < 0 ? 'text-negativo' : 'text-tinta', className)}>{moedaComSinal(valor)}</span>
}

export function Margem({ fat, lucro }: { fat: number; lucro: number }) {
  const m = margemDe(fat, lucro)
  return m === null ? <span className="text-apagado/60">—</span> : <>{porcento(m)}</>
}

/**
 * Administração × Sublocação num cartão: só aparece quando o item tem os
 * dois tipos (com um só, a linha repetiria o total).
 */
export function QuebraGestao({ fin }: { fin: Fin }) {
  const temAdm = fin.fatAdm > 0 || fin.custosAdm > 0
  const temSub = fin.fatSub > 0 || fin.custosSub > 0
  if (!temAdm || !temSub) return null

  const linhas = [
    { tipo: 'adm', fat: fin.fatAdm, lucro: fin.fatAdm - fin.custosAdm },
    { tipo: 'sub', fat: fin.fatSub, lucro: fin.fatSub - fin.custosSub },
  ]
  return (
    <dl className="space-y-1.5 border-t border-linha pt-3 text-[13px] tabular-nums">
      {linhas.map(l => (
        <div key={l.tipo} className="flex items-baseline justify-between gap-3">
          <dt><SeloGestao tipo={l.tipo} /></dt>
          <dd className="flex min-w-0 flex-wrap justify-end gap-x-3 text-right">
            <span className="text-apagado">{moeda(l.fat)}</span>
            <Lucro valor={l.lucro} className="font-medium" />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Cards × Linhas — pela URL (`view`), para o modo acompanhar a navegação entre níveis. */
export function AlternarVisao({ visao, hrefDe }: { visao: Visao; hrefDe: (v: Visao) => string }) {
  const opcoes: { v: Visao; rotulo: string; icone: typeof List }[] = [
    { v: 'grid', rotulo: 'Cards', icone: LayoutGrid },
    { v: 'list', rotulo: 'Linhas', icone: List },
  ]
  return (
    // no celular a lista é sempre em cartões: a alternância só existe a partir do tablet
    <div role="group" aria-label="Modo de exibição" className="hidden rounded-full border border-linha bg-creme p-0.5 md:inline-flex">
      {opcoes.map(o => (
        <Link
          key={o.v} href={hrefDe(o.v)} scroll={false} aria-current={visao === o.v ? 'true' : undefined}
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700',
            visao === o.v ? 'bg-white text-tinta shadow-sm' : 'text-apagado hover:text-tinta',
          )}
        >
          <o.icone size={15} aria-hidden="true" />
          {o.rotulo}
        </Link>
      ))}
    </div>
  )
}

export const campoBusca =
  'h-10 w-full rounded-full border border-linha bg-white pl-10 pr-4 text-sm text-tinta transition-colors placeholder:text-apagado/70 ' +
  'hover:border-[#cfc8b6] focus-visible:border-marca-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-700/15 ' +
  '[&::-webkit-search-cancel-button]:appearance-none'

export const botaoSecundario =
  'inline-flex h-11 items-center gap-2 rounded-full border border-linha bg-white px-4 text-sm font-medium text-tinta transition-colors ' +
  'hover:bg-creme-escuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700'

'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Flip } from 'gsap/Flip'
import { ChevronRight } from 'lucide-react'
import { Segmentado, margemDe, moeda, porcento, semMovimento } from '@/components/dashboard/valor'
import { BarrasFatCusto, LegendaFatCusto, Lucro } from './fin'

gsap.registerPlugin(useGSAP, Flip)

type Ordem = 'fat' | 'custos' | 'luc' | 'margem'

const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'fat', rotulo: 'Faturamento' },
  { valor: 'custos', rotulo: 'Custos' },
  { valor: 'luc', rotulo: 'Lucro' },
  { valor: 'margem', rotulo: 'Margem' },
]

export type ItemRanking = {
  id: string
  nome: string
  /** Linha pequena sob o nome (ex.: "12 apartamentos") */
  detalhe?: string
  href: string
  fat: number
  custos: number
}

/**
 * Faturamento × custos em barras horizontais ordenáveis, com o lucro escrito
 * ao lado. Serve à lista de empreendimentos e à de apartamentos.
 *
 * Substitui os gráficos de colunas (nomes cortados no eixo, valor só no
 * hover, custo em vermelho como se fosse erro) e as roscas de duas fatias.
 * Cada linha abre o item.
 */
export function RankingFinanceiro({ titulo, sub, itens }: {
  titulo: string
  sub?: string
  itens: ItemRanking[]
}) {
  const [ordem, setOrdem] = useState<Ordem>('fat')
  const lista = useRef<HTMLOListElement>(null)
  const posicoes = useRef<Flip.FlipState | null>(null)

  const ordenados = useMemo(() => {
    const chave = (i: ItemRanking) =>
      ordem === 'fat' ? i.fat
        : ordem === 'custos' ? i.custos
        : ordem === 'luc' ? i.fat - i.custos
        : margemDe(i.fat, i.fat - i.custos) ?? -Infinity
    return [...itens].sort((a, b) => chave(b) - chave(a) || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
  }, [itens, ordem])

  // Reordenar: as linhas deslizam até a nova posição
  function reordenar(nova: Ordem) {
    if (nova === ordem) return
    if (lista.current && !semMovimento()) posicoes.current = Flip.getState(lista.current.children)
    setOrdem(nova)
  }
  useGSAP(() => {
    if (!posicoes.current) return
    Flip.from(posicoes.current, { duration: 0.5, ease: 'power2.inOut', stagger: 0.012 })
    posicoes.current = null
  }, { dependencies: [ordem] })

  const maior = Math.max(1, ...itens.map(i => Math.max(i.fat, i.custos)))
  const id = `ranking-${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  if (itens.length === 0) return null

  return (
    <section data-entrada aria-labelledby={id} className="rounded-2xl border border-linha bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <h2 id={id} className="text-[15px] font-semibold text-tinta">{titulo}</h2>
          {sub && <p className="mt-0.5 text-[13px] text-apagado">{sub}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-apagado max-sm:hidden">Ordenar por</span>
          <Segmentado rotulo="Ordenar por" opcoes={ORDENS} valor={ordem} onMudar={reordenar} className="max-sm:flex-wrap" />
        </div>
      </div>

      <div className="mt-4"><LegendaFatCusto /></div>

      <ol ref={lista} className="mt-3 space-y-0.5">
        {ordenados.map(i => {
          const lucro = i.fat - i.custos
          const margem = margemDe(i.fat, lucro)
          return (
            <li key={i.id}>
              <Link
                href={i.href}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-xl px-3 py-2.5 transition-colors hover:bg-creme focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto_minmax(7.5rem,auto)_auto]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-tinta group-hover:text-marca-700">{i.nome}</span>
                  {i.detalhe && <span className="block truncate text-xs text-apagado">{i.detalhe}</span>}
                </span>

                <BarrasFatCusto fat={i.fat} custos={i.custos} maior={maior} className="order-3 col-span-2 sm:order-none sm:col-span-1" />

                {/* os dois valores ficam alinhados às duas barras */}
                <span className="hidden text-right text-[13px] leading-[1.35] tabular-nums sm:block">
                  <span className="block font-medium text-tinta">{moeda(i.fat)}</span>
                  <span className="block text-tinta-suave">{moeda(i.custos)}</span>
                </span>

                <span className="text-right text-[13px] leading-[1.35] tabular-nums">
                  <Lucro valor={lucro} className="block font-semibold" />
                  <span className="block text-xs text-apagado">{margem === null ? 'sem faturamento' : `margem ${porcento(margem)}`}</span>
                </span>

                <ChevronRight size={16} aria-hidden="true" className="hidden text-apagado/50 transition-transform group-hover:translate-x-0.5 group-hover:text-marca-700 sm:block" />

                {/* no celular os valores das barras vão para uma linha própria */}
                <span className="order-4 col-span-2 text-xs tabular-nums text-apagado sm:hidden">
                  Faturamento {moeda(i.fat)} · custos {moeda(i.custos)}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

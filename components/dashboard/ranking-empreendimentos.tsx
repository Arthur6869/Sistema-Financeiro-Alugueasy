'use client'

import { useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Flip } from 'gsap/Flip'
import { cn } from '@/lib/utils'
import { Segmentado, Valor, margemDe, moeda, moedaComSinal, porcento, semMovimento, useCensura } from './valor'
import type { EmpreendimentoLinha } from './tipos'

gsap.registerPlugin(useGSAP, Flip)

type Ordem = 'fat' | 'luc' | 'margem'

const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'fat', rotulo: 'Faturamento' },
  { valor: 'luc', rotulo: 'Lucro' },
  { valor: 'margem', rotulo: 'Margem' },
]

/**
 * Faturamento × lucro por empreendimento, em barras horizontais ordenadas.
 *
 * Substitui o gráfico de colunas (nomes cortados no eixo, valor só no hover) e
 * a grade de cartões que repetia os mesmos números logo abaixo: aqui o nome
 * aparece inteiro e o valor fica escrito ao lado de cada barra.
 *
 * Clicar numa linha filtra a tabela de apartamentos; clicar de novo solta.
 */
export function RankingEmpreendimentos({ linhas, cadastrados, selecionado, onSelecionar }: {
  linhas: EmpreendimentoLinha[]
  /** Total de empreendimentos cadastrados (com ou sem movimento) */
  cadastrados: number
  selecionado: string | null
  onSelecionar: (nome: string | null) => void
}) {
  const censurado = useCensura()
  const [ordem, setOrdem] = useState<Ordem>('fat')
  const lista = useRef<HTMLOListElement>(null)
  const posicoes = useRef<Flip.FlipState | null>(null)

  const ordenadas = useMemo(() => {
    const chave = (l: EmpreendimentoLinha) =>
      ordem === 'fat' ? l.fat : ordem === 'luc' ? l.luc : margemDe(l.fat, l.luc) ?? -Infinity
    return [...linhas].sort((a, b) => chave(b) - chave(a) || a.nome.localeCompare(b.nome))
  }, [linhas, ordem])

  // Reordenar: as linhas deslizam até a nova posição em vez de trocar de lugar num salto
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

  // Escala única para as duas séries. Se algum lucro for negativo, o zero
  // sai da borda esquerda e o prejuízo cresce para o outro lado.
  const maior = Math.max(1, ...linhas.map(l => Math.max(l.fat, l.luc)))
  const menor = Math.min(0, ...linhas.map(l => l.luc))
  const faixa = maior - menor
  const zero = (-menor / faixa) * 100
  const temPrejuizo = menor < 0
  const posicao = (v: number) => {
    const largura = (Math.abs(v) / faixa) * 100
    return { left: `${v >= 0 ? zero : zero - largura}%`, width: `${largura}%` }
  }

  return (
    <section data-entrada aria-labelledby="titulo-ranking" className="rounded-2xl border border-linha bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div>
          <h2 id="titulo-ranking" className="text-[15px] font-semibold text-tinta">Resultado por empreendimento</h2>
          <p className="mt-0.5 text-[13px] text-apagado">
            {linhas.length} de {cadastrados} com movimento no período · clique para filtrar os apartamentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* no celular o rótulo quebrava em duas linhas; o grupo já se anuncia pelo aria-label */}
          <span className="text-[13px] text-apagado max-sm:hidden">Ordenar por</span>
          <Segmentado rotulo="Ordenar empreendimentos por" opcoes={ORDENS} valor={ordem} onMudar={reordenar} />
        </div>
      </div>

      {/* Duas séries → legenda sempre presente */}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-tinta-suave">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-4 rounded-sm bg-serie-faturamento" />Faturamento</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-4 rounded-sm bg-serie-lucro" />Lucro</li>
        {temPrejuizo && (
          <li className="flex items-center gap-2"><span aria-hidden="true" className="h-2 w-4 rounded-sm bg-negativo" />Prejuízo</li>
        )}
      </ul>

      <ol ref={lista} className="mt-3 space-y-0.5">
        {ordenadas.map(l => {
          const margem = margemDe(l.fat, l.luc)
          const ativo = selecionado === l.nome
          return (
            <li key={l.nome}>
              <button
                type="button"
                aria-pressed={ativo}
                onClick={() => onSelecionar(ativo ? null : l.nome)}
                className={cn(
                  'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-xl px-3 py-2.5 text-left transition-[background-color,opacity]',
                  'sm:grid-cols-[minmax(0,13.5rem)_minmax(0,1fr)_auto]',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700',
                  ativo ? 'bg-marca-50 ring-1 ring-marca-700/25' : 'hover:bg-creme',
                  selecionado && !ativo && 'opacity-50 hover:opacity-100',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-tinta">{l.nome}</span>
                  <span className="block text-xs text-apagado">
                    {l.apartamentos} {l.apartamentos === 1 ? 'apartamento' : 'apartamentos'}
                    {margem !== null && <> · margem <Valor>{porcento(margem)}</Valor></>}
                  </span>
                </span>

                {/* barras: finas, ponta arredondada, base reta no zero */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative order-3 col-span-2 block h-[22px] sm:order-none sm:col-span-1',
                    censurado && 'opacity-60 blur-[5px]',
                  )}
                >
                  {temPrejuizo && <span className="absolute inset-y-0 w-px bg-linha" style={{ left: `${zero}%` }} />}
                  <span data-barra className="absolute top-0 h-2.5 origin-left rounded-r-[4px] bg-serie-faturamento" style={posicao(l.fat)} />
                  <span
                    data-barra
                    className={cn(
                      'absolute bottom-0 h-2.5',
                      l.luc >= 0 ? 'origin-left rounded-r-[4px] bg-serie-lucro' : 'origin-right rounded-l-[4px] bg-negativo',
                    )}
                    style={posicao(l.luc)}
                  />
                </span>

                <span className="text-right text-[13px] leading-[1.35] tabular-nums">
                  <Valor className="block font-medium text-tinta">{moeda(l.fat)}</Valor>
                  <Valor className={cn('block', l.luc < 0 ? 'font-medium text-negativo' : 'text-tinta-suave')}>
                    {moedaComSinal(l.luc)}
                  </Valor>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

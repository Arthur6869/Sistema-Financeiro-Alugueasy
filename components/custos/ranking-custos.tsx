'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { moeda, porcento } from '@/components/dashboard/valor'

export type ItemRanking = { nome: string; valor: number }

/** Quantas linhas aparecem antes do "Ver todas" */
const VISIVEIS = 6

/**
 * Onde o dinheiro foi gasto: barras horizontais ordenadas, do maior para o
 * menor. Uma cor só — todas as barras medem a mesma coisa (custo), então a
 * cor não precisa dizer nada além disso.
 *
 * Clicar numa linha filtra os lançamentos (e o ranking vizinho); clicar de
 * novo solta.
 */
export function RankingCustos({
  id, titulo, plural, feminino, recorte, itens, selecionado, onSelecionar,
  cor = 'bg-serie-custo-reservas', dica = 'clique para filtrar os lançamentos', vazio = 'Sem custos neste recorte.', controle,
}: {
  id: string
  titulo: string
  /** "categorias", "empreendimentos" */
  plural: string
  /** Concordância: "todas as categorias" × "todos os empreendimentos" */
  feminino?: boolean
  /** Filtro vindo do outro ranking, ex.: "ATHOS" — entra no subtítulo */
  recorte: string | null
  /** Já ordenados do maior para o menor */
  itens: ItemRanking[]
  selecionado: string | null
  onSelecionar: (nome: string | null) => void
  /** Classe de fundo das barras — a cor da série (custos de reservas por padrão) */
  cor?: string
  /** O que o clique faz, no subtítulo */
  dica?: string
  /** Texto quando não há nenhum item */
  vazio?: string
  /** Controle à direita do título (ex.: trocar a dimensão do ranking) */
  controle?: ReactNode
}) {
  const [aberto, setAberto] = useState(false)

  const total = itens.reduce((s, i) => s + i.valor, 0)
  const maior = Math.max(1, ...itens.map(i => i.valor))

  // O item escolhido nunca some: nem por estar além do corte, nem por não ter
  // custo no recorte do outro ranking (aí aparece zerado, e dá para soltar).
  let visiveis = aberto ? itens : itens.slice(0, VISIVEIS)
  if (selecionado && !visiveis.some(i => i.nome === selecionado)) {
    visiveis = [...visiveis, itens.find(i => i.nome === selecionado) ?? { nome: selecionado, valor: 0 }]
  }

  const fatia = (v: number) => {
    const p = total > 0 ? (v / total) * 100 : 0
    return p > 0 && p < 1 ? '<1%' : porcento(p)
  }

  return (
    <section data-entrada aria-labelledby={`titulo-${id}`} className="rounded-2xl border border-linha bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id={`titulo-${id}`} className="text-[15px] font-semibold text-tinta">{titulo}</h2>
        {controle}
      </div>
      <p className="mt-0.5 text-[13px] text-apagado">
        {recorte && <>em <strong className="font-semibold text-tinta-suave">{recorte}</strong> · </>}
        {itens.length} {plural}{itens.length > 0 && <> · {dica}</>}
      </p>

      {itens.length === 0 && !selecionado ? (
        <p className="mt-6 text-sm text-apagado">{vazio}</p>
      ) : (
        <ol className="mt-3 space-y-0.5">
          {visiveis.map(i => {
            const ativo = selecionado === i.nome
            return (
              <li key={i.nome}>
                <button
                  type="button" aria-pressed={ativo}
                  onClick={() => onSelecionar(ativo ? null : i.nome)}
                  className={cn(
                    'block w-full rounded-xl px-3 py-2 text-left transition-[background-color,opacity]',
                    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700',
                    ativo ? 'bg-marca-50 ring-1 ring-marca-700/25' : 'hover:bg-creme',
                    selecionado && !ativo && 'opacity-50 hover:opacity-100',
                  )}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-medium text-tinta">{i.nome}</span>
                    <span className="shrink-0 text-[13px] tabular-nums">
                      <span className="font-semibold text-tinta">{moeda(i.valor)}</span>
                      <span className="text-apagado"> · {fatia(i.valor)}</span>
                    </span>
                  </span>
                  {/* barra fina, base reta à esquerda e ponta arredondada */}
                  <span aria-hidden="true" className="mt-1.5 block h-2">
                    <span
                      data-barra
                      className={cn(
                        'block h-full origin-left rounded-r-[4px] transition-[width] duration-500 ease-out', cor,
                        i.valor > 0 && 'min-w-[3px]',
                      )}
                      style={{ width: `${(i.valor / maior) * 100}%` }}
                    />
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {itens.length > VISIVEIS && (
        <button
          type="button" onClick={() => setAberto(a => !a)} aria-expanded={aberto}
          className="mt-2 h-9 rounded-full px-3 text-[13px] font-medium text-marca-700 transition-colors hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
        >
          {aberto
            ? `Ver só ${feminino ? 'as' : 'os'} ${VISIVEIS} maiores`
            : `Ver ${feminino ? 'todas as' : 'todos os'} ${itens.length} ${plural}`}
        </button>
      )}
    </section>
  )
}

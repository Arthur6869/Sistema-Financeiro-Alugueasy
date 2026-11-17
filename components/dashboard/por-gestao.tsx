'use client'

import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Valor, moeda, moedaComSinal, porcento, useCensura } from './valor'
import type { ApartamentoCard, FiltroGestao } from './tipos'

const GESTOES = [
  { tipo: 'sub', nome: 'Sublocação' },
  { tipo: 'adm', nome: 'Administração' },
] as const

/**
 * Quanto do faturamento vem de cada tipo de gestão. Tudo derivado dos
 * apartamentos que a página já entrega — nenhuma consulta nova.
 *
 * A soma dos apartamentos pode ficar abaixo do faturamento total: reservas ou
 * diárias sem apartamento vinculado entram no total mas não em nenhuma linha.
 * Essa diferença aparece como "Sem apartamento vinculado", para a conta fechar.
 */
export function PorGestao({ apartamentos, faturamentoTotal, filtro, onFiltrar }: {
  apartamentos: ApartamentoCard[]
  faturamentoTotal: number
  filtro: FiltroGestao
  onFiltrar: (gestao: FiltroGestao) => void
}) {
  const censurado = useCensura()

  const grupos = GESTOES.map(g => {
    const itens = apartamentos.filter(a => a.tipo === g.tipo)
    return {
      ...g,
      imoveis: itens.length,
      fat: itens.reduce((s, a) => s + a.fat, 0),
      luc: itens.reduce((s, a) => s + a.luc, 0),
    }
  }).filter(g => g.imoveis > 0)

  const atribuido = apartamentos.reduce((s, a) => s + a.fat, 0)
  const semVinculo = faturamentoTotal - atribuido
  const base = Math.max(faturamentoTotal, atribuido, 1)
  const fatia = (v: number) => (v / base) * 100

  if (grupos.length === 0) return null

  return (
    <section data-entrada aria-labelledby="titulo-gestao" className="rounded-2xl border border-linha bg-white p-5">
      <h2 id="titulo-gestao" className="text-[15px] font-semibold text-tinta">Faturamento por tipo de gestão</h2>
      <p className="mt-0.5 text-[13px] text-apagado">Clique para filtrar os apartamentos</p>

      <ul className="mt-4 space-y-1">
        {grupos.map(g => {
          const ativo = filtro === g.tipo
          return (
            <li key={g.tipo}>
              <button
                type="button"
                aria-pressed={ativo}
                onClick={() => onFiltrar(ativo ? 'todos' : g.tipo)}
                className={cn(
                  'block w-full rounded-xl px-3 py-3 text-left transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700',
                  ativo ? 'bg-marca-50 ring-1 ring-marca-700/25' : 'hover:bg-creme',
                )}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-tinta">{g.nome}</span>
                  <Valor className="text-sm font-semibold tabular-nums text-tinta">{moeda(g.fat)}</Valor>
                </span>
                <span className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-apagado">
                  <span>{g.imoveis} {g.imoveis === 1 ? 'imóvel' : 'imóveis'} · lucro <Valor>{moedaComSinal(g.luc)}</Valor></span>
                  <span><Valor>{porcento(fatia(g.fat))}</Valor> do total</span>
                </span>
                {/* medidor: trilho num tom claro da mesma cor do preenchimento */}
                <span
                  aria-hidden="true"
                  className={cn('mt-2.5 block h-2 overflow-hidden rounded-full bg-serie-faturamento/15', censurado && 'opacity-60 blur-[5px]')}
                >
                  <span data-barra className="block h-full origin-left rounded-full bg-serie-faturamento" style={{ width: `${fatia(g.fat)}%` }} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {semVinculo > 0.5 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-creme px-3 py-2.5 text-[13px] leading-snug text-tinta-suave">
          <Info size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-apagado" />
          <span>
            <Valor className="font-semibold">{moeda(semVinculo)}</Valor> (<Valor>{porcento(fatia(semVinculo))}</Valor>) do
            faturamento não está ligado a nenhum apartamento e não aparece nas listas abaixo.
          </span>
        </p>
      )}
    </section>
  )
}

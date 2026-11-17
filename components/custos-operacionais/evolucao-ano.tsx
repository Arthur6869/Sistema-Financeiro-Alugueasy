'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MESES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { moeda } from '@/components/dashboard/valor'

/** "63,9 mil" — rótulo curto para caber em cima da coluna. */
export const compacto = (n: number) =>
  n >= 1000
    ? `${(n / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mil`
    : n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

/**
 * O ano em doze colunas: quanto a operação custou em cada mês. Uma série só
 * (custo operacional), então uma cor só; o mês aberto fica em cor cheia e os
 * outros mais claros. A linha tracejada é o valor base — a soma do que as
 * contas "costumam ser" — para ver de relance quais meses fugiram dela.
 *
 * Clicar numa coluna abre aquele mês.
 */
export function EvolucaoAno({ ano, mes, totais, contas, base, onIr }: {
  ano: number
  /** Mês aberto (1–12) */
  mes: number
  /** Total de cada mês, jan → dez */
  totais: number[]
  /** Quantas contas têm valor em cada mês */
  contas: number[]
  /** Soma do valor base das contas ativas; 0 esconde a linha */
  base: number
  onIr: (mes: number) => void
}) {
  const teto = Math.max(1, base, ...totais)
  const comValor = totais.filter(t => t > 0).length
  const alturaBase = (base / teto) * 100

  return (
    <section data-entrada aria-labelledby="titulo-evolucao" className="flex flex-col rounded-2xl border border-linha bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="titulo-evolucao" className="text-[15px] font-semibold text-tinta">Custo operacional em {ano}</h2>
        <p className="text-[13px] text-apagado">
          {comValor === 0 ? 'nenhum mês lançado' : `${comValor} ${comValor === 1 ? 'mês lançado' : 'meses lançados'}`} · clique para abrir o mês
        </p>
      </div>

      {/* `@container`: os rótulos de todos os meses só aparecem quando a coluna tem largura para eles */}
      <div className="@container mt-5 flex-1">
        <div className="relative flex h-52 items-stretch gap-1 sm:gap-2">
          {base > 0 && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-6 top-6">
              <div className="absolute inset-x-0 border-t border-dashed border-tinta-suave/45" style={{ bottom: `${alturaBase}%` }}>
                <span className="absolute -top-[18px] right-0 rounded bg-white/90 px-1 text-[11px] text-apagado">base {compacto(base)}</span>
              </div>
            </div>
          )}

          {totais.map((total, i) => {
            const m = i + 1
            const aberto = m === mes
            return (
              <Tooltip key={m}>
                <TooltipTrigger
                  render={
                    <button
                      type="button" onClick={() => onIr(m)} aria-current={aberto ? 'true' : undefined}
                      aria-label={`${MESES[i]}: ${total > 0 ? `${moeda(total)}, ${contas[i]} ${contas[i] === 1 ? 'conta' : 'contas'}` : 'sem valores lançados'}`}
                    />
                  }
                  className={cn(
                    'group relative flex min-w-0 flex-1 flex-col rounded-lg pb-6 pt-6 transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700',
                    aberto ? 'bg-marca-50' : 'hover:bg-creme',
                  )}
                >
                  <span className="relative flex-1">
                    {total > 0 ? (
                      <span className="absolute inset-x-0 bottom-0 flex flex-col items-center" style={{ height: `${(total / teto) * 100}%` }}>
                        <span className={cn(
                          'absolute -top-[18px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums',
                          aberto ? 'font-semibold text-tinta' : 'hidden text-tinta-suave @[620px]:inline',
                        )}>
                          {compacto(total)}
                        </span>
                        <span
                          data-coluna
                          className={cn(
                            'w-full max-w-7 flex-1 origin-bottom rounded-t-[4px] bg-serie-custo-op transition-opacity',
                            aberto ? '' : 'opacity-40 group-hover:opacity-70',
                          )}
                        />
                      </span>
                    ) : (
                      <span className="absolute inset-x-0 bottom-0 flex justify-center">
                        <span className="h-0.5 w-full max-w-7 rounded-full bg-linha" />
                      </span>
                    )}
                  </span>
                  <span className={cn(
                    'absolute inset-x-0 bottom-1 text-center text-[11px] uppercase tracking-wide',
                    aberto ? 'font-semibold text-tinta' : 'text-apagado',
                  )}>
                    {MESES[i].slice(0, 3)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <span className="font-semibold">{total > 0 ? moeda(total) : 'Sem valores'}</span>
                  <span className="opacity-75">
                    {MESES[i]} {ano}{total > 0 && <> · {contas[i]} {contas[i] === 1 ? 'conta' : 'contas'}</>}
                  </span>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>
    </section>
  )
}

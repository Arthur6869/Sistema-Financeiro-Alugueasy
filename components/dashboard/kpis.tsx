'use client'

import type { ReactNode } from 'react'
import { BadgeCheck, Radio, TrendingDown, TrendingUp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/constants'
import { NumeroAnimado, Valor, moeda, moedaComSinal, porcento, useCensura } from './valor'
import type { FonteFaturamento } from './tipos'

/* ── Número que cabe no cartão ─────────────────────────────────────── */

/**
 * O valor encolhe para caber: 100cqw é a largura útil do cartão e cada
 * caractere ocupa ~0,6em. Nunca passa de `max` nem fica menor que 20px.
 */
export function Numero({ texto, max, className, children }: {
  /** Texto final, só para medir o comprimento */
  texto: string
  max: number
  className?: string
  children: ReactNode
}) {
  const colunas = Math.max(texto.length, 8) * 0.6
  return (
    <div className="@container">
      <p
        className={cn('whitespace-nowrap font-semibold leading-none tracking-[-0.02em]', className)}
        style={{ fontSize: `clamp(20px, calc(100cqw / ${colunas}), ${max}px)` }}
      >
        {children}
      </p>
    </div>
  )
}

export function Cartao({ rotulo, cor, selo, numero, rodape, linhaInteira }: {
  rotulo: string
  /** Classe de fundo da série — a mesma cor que ela tem nos gráficos */
  cor: string
  selo?: ReactNode
  numero: ReactNode
  rodape: ReactNode
  /** Ocupa as duas colunas no celular/tablet (no desktop são quatro cartões lado a lado) */
  linhaInteira?: boolean
}) {
  return (
    <article
      data-entrada
      className={cn('flex flex-col rounded-2xl border border-linha bg-white p-4 sm:p-5', linhaInteira && 'col-span-2 xl:col-span-1')}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[13px] font-medium text-apagado">
          <span aria-hidden="true" className={cn('size-2.5 shrink-0 rounded-[3px]', cor)} />
          {rotulo}
        </h2>
        {selo}
      </div>
      <div className="mt-4">{numero}</div>
      <p className="mt-auto pt-4 text-[13px] leading-snug text-apagado">{rodape}</p>
    </article>
  )
}

const FONTES: Record<FonteFaturamento, { icone: typeof BadgeCheck; texto: string }> = {
  diarias: { icone: BadgeCheck, texto: 'Conferido na planilha de diárias' },
  'amenitiz-ao-vivo': { icone: Radio, texto: 'Reservas Amenitiz, ao vivo' },
  amenitiz: { icone: Radio, texto: 'Reservas Amenitiz' },
}

/* ── Indicadores ───────────────────────────────────────────────────── */

export function Indicadores({
  faturamento, custosReservas, custosOperacionais, lucro, margemPct, hasData, periodo, fonte,
}: {
  faturamento: number
  custosReservas: number
  custosOperacionais: number
  lucro: number
  margemPct: number
  hasData: boolean
  periodo: string
  fonte: FonteFaturamento
}) {
  const doFaturamento = (v: number) => (faturamento > 0 ? Math.round((v / faturamento) * 100) : 0)
  const Fonte = FONTES[fonte]
  const vazio = <span className="text-apagado/45">R$ —</span>

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)]">
      {/* Faturamento — o número que abre o dashboard */}
      <article
        data-entrada
        className="relative isolate col-span-2 flex flex-col overflow-hidden rounded-2xl bg-marca-800 p-5 text-white sm:p-6 xl:col-span-1"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_100%_0%,rgba(59,130,246,0.32),transparent_70%)]"
        />
        <h2 className="flex items-center gap-2 text-[13px] font-medium text-white/70">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px] bg-serie-faturamento ring-1 ring-white/50" />
          Faturamento
        </h2>
        <div className="mt-4">
          <Numero texto={formatCurrency(faturamento)} max={48}>
            {hasData ? (
              <Valor sobreEscuro><NumeroAnimado valor={faturamento} formatar={moeda} /></Valor>
            ) : (
              <span className="text-white/40">R$ —</span>
            )}
          </Numero>
        </div>
        <p className="mt-auto flex flex-col gap-1 pt-5 text-[13px] text-white/65">
          <span>{periodo}</span>
          {hasData && (
            <span className="inline-flex items-center gap-1.5">
              <Fonte.icone size={14} aria-hidden="true" className="shrink-0" />
              {Fonte.texto}
            </span>
          )}
        </p>
      </article>

      <Cartao
        rotulo="Custos de reservas"
        cor="bg-serie-custo-reservas"
        numero={
          <Numero texto={formatCurrency(custosReservas)} max={28} className="text-tinta">
            {hasData ? <Valor><NumeroAnimado valor={custosReservas} formatar={moeda} /></Valor> : vazio}
          </Numero>
        }
        rodape={
          !hasData ? '—'
            : custosReservas === 0 && faturamento > 0 ? 'Nenhum custo lançado no período'
            : <><Valor>{porcento(doFaturamento(custosReservas))}</Valor> do faturamento</>
        }
      />

      <Cartao
        rotulo="Custos operacionais"
        cor="bg-serie-custo-op"
        numero={
          <Numero texto={formatCurrency(custosOperacionais)} max={28} className="text-tinta">
            {hasData ? <Valor><NumeroAnimado valor={custosOperacionais} formatar={moeda} /></Valor> : vazio}
          </Numero>
        }
        rodape={hasData ? <><Valor>{porcento(doFaturamento(custosOperacionais))}</Valor> do faturamento</> : '—'}
      />

      <Cartao
        linhaInteira
        rotulo="Lucro líquido"
        cor="bg-serie-lucro"
        selo={hasData && (
          // estado nunca só pela cor: ícone + palavra
          <span className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
            lucro >= 0 ? 'bg-positivo/10 text-positivo' : 'bg-negativo/10 text-negativo',
          )}>
            {lucro >= 0 ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
            {lucro >= 0 ? 'Lucro' : 'Prejuízo'}
          </span>
        )}
        numero={
          <Numero
            texto={moedaComSinal(lucro)} max={28}
            className={!hasData ? '' : lucro >= 0 ? 'text-positivo' : 'text-negativo'}
          >
            {hasData ? <Valor><NumeroAnimado valor={lucro} formatar={moedaComSinal} /></Valor> : vazio}
          </Numero>
        }
        rodape={hasData ? <>Margem de <Valor>{porcento(margemPct)}</Valor> sobre o faturamento</> : '—'}
      />
    </div>
  )
}

/* ── Para onde vai o faturamento ───────────────────────────────────── */

/**
 * Uma barra só, dividida em partes: quanto do faturamento virou custo e
 * quanto sobrou. Substitui as três barrinhas soltas que cada cartão tinha.
 *
 * A ordem (custo de reservas → custo operacional → lucro) também é a ordem
 * em que as cores foram validadas: lucro (verde) e custo de reservas
 * (laranja) não podem ficar vizinhos.
 */
export function Composicao({ faturamento, custosReservas, custosOperacionais, lucro }: {
  faturamento: number
  custosReservas: number
  custosOperacionais: number
  lucro: number
}) {
  const censurado = useCensura()
  const custos = custosReservas + custosOperacionais
  // Com prejuízo (ou sem faturamento) não existe "fatia de lucro": mostramos de que são feitos os custos
  const sobra = lucro >= 0 && faturamento > 0
  const todo = sobra ? faturamento : custos

  const partes = [
    { nome: 'Custos de reservas', valor: custosReservas, fundo: 'bg-serie-custo-reservas', texto: 'text-[#0b0b0b]' },
    { nome: 'Custos operacionais', valor: custosOperacionais, fundo: 'bg-serie-custo-op', texto: 'text-white' },
    ...(sobra ? [{ nome: 'Lucro líquido', valor: lucro, fundo: 'bg-serie-lucro', texto: 'text-white' }] : []),
  ].filter(p => p.valor > 0)

  if (todo <= 0 || partes.length === 0) return null

  const fatia = (v: number) => Math.round((v / todo) * 100)
  const resumo = partes.map(p => `${p.nome}: ${fatia(p.valor)}%`).join(', ')

  return (
    <section data-entrada aria-labelledby="titulo-composicao" className="rounded-2xl border border-linha bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="titulo-composicao" className="text-[15px] font-semibold text-tinta">
          {sobra ? 'Para onde vai o faturamento' : 'Do que são feitos os custos'}
        </h2>
        {!sobra && faturamento > 0 && (
          <p className="text-[13px] text-apagado">
            O faturamento cobre <Valor>{porcento((faturamento / custos) * 100)}</Valor> dos custos — faltam{' '}
            <Valor className="font-medium text-negativo">{formatCurrency(custos - faturamento)}</Valor>.
          </p>
        )}
      </div>

      <div
        role="group"
        aria-label={censurado ? 'Composição oculta' : resumo}
        className={cn('mt-4 flex h-7 gap-0.5', censurado && 'pointer-events-none select-none opacity-60 blur-[5px]')}
      >
        {partes.map(p => (
          <Tooltip key={p.nome} disabled={censurado}>
            <TooltipTrigger
              render={
                <button
                  type="button" data-barra style={{ flexGrow: p.valor }}
                  aria-label={censurado ? p.nome : `${p.nome}: ${formatCurrency(p.valor)}, ${fatia(p.valor)}%`}
                />
              }
              className={cn(
                '@container flex min-w-1.5 basis-0 origin-left items-center overflow-hidden rounded-[4px] transition-[filter]',
                'hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700',
                p.fundo,
              )}
            >
              {/* a fatia só imprime o percentual quando ele cabe com folga */}
              <span className={cn('hidden pl-2.5 text-xs font-semibold @[52px]:inline', p.texto)}>
                {fatia(p.valor)}%
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-semibold">{formatCurrency(p.valor)}</span>
              <span className="opacity-75">{p.nome} · {fatia(p.valor)}%</span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-tinta-suave">
        {partes.map(p => (
          <li key={p.nome} className="flex items-center gap-2">
            <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', p.fundo)} />
            {p.nome}
          </li>
        ))}
      </ul>
    </section>
  )
}

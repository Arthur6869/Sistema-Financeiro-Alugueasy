'use client'

import { createContext, useContext, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/constants'

gsap.registerPlugin(useGSAP)

/* ── Formatação ────────────────────────────────────────────────────── */

/** "R$ 1.234,56"; negativos com o sinal à frente: "−R$ 1.234,56". */
export const moeda = (n: number) => (n < 0 ? `−${formatCurrency(Math.abs(n))}` : formatCurrency(n))

/** Resultado, sempre com sinal: "+R$ 1.234,56" / "−R$ 1.234,56". */
export const moedaComSinal = (n: number) => `${n < 0 ? '−' : '+'}${formatCurrency(Math.abs(n))}`

export const porcento = (n: number) => `${Math.round(n)}%`

/** Margem em %; `null` quando não há faturamento (não existe margem sobre zero). */
export const margemDe = (fat: number, luc: number) => (fat > 0 ? (luc / fat) * 100 : null)

export const semMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ── Ocultar valores ───────────────────────────────────────────────── */

const CensuraContext = createContext(false)
export const CensuraProvider = CensuraContext.Provider

/** `true` enquanto "Ocultar valores" está ligado. */
export const useCensura = () => useContext(CensuraContext)

/**
 * Todo número sensível passa por aqui. Com "Ocultar valores" ligado vira uma
 * tarja; o texto continua no HTML, então serve para compartilhar a tela — não
 * é proteção contra quem tem acesso ao sistema.
 */
export function Valor({ children, className, sobreEscuro }: {
  children: ReactNode
  className?: string
  /** A tarja precisa ser clara quando o fundo é azul-escuro */
  sobreEscuro?: boolean
}) {
  const censurado = useCensura()
  return (
    <span
      className={cn(
        'rounded-[5px] transition-colors duration-200',
        className,
        censurado && 'select-none text-transparent!',
        censurado && (sobreEscuro ? 'bg-white/25' : 'bg-marca-900/80'),
      )}
    >
      {children}
    </span>
  )
}

/* ── Número que conta ──────────────────────────────────────────────── */

/**
 * Mostra `valor` já formatado e, quando ele muda (troca de período), conta do
 * número anterior até o novo. Na primeira vez conta a partir de zero.
 */
export function NumeroAnimado({ valor, formatar }: { valor: number; formatar: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const anterior = useRef<number | null>(null)
  const contagem = useRef<gsap.core.Tween | null>(null)

  useGSAP(() => {
    const el = ref.current
    if (!el) return
    const de = anterior.current ?? 0
    anterior.current = valor
    contagem.current?.kill()
    if (de === valor || semMovimento()) {
      el.textContent = formatar(valor)
      return
    }
    const estado = { v: de }
    contagem.current = gsap.to(estado, {
      v: valor, duration: 0.9, ease: 'power3.out',
      onUpdate: () => { el.textContent = formatar(estado.v) },
    })
  }, { dependencies: [valor] })

  return <span ref={ref}>{formatar(valor)}</span>
}

/* ── Controle segmentado ───────────────────────────────────────────── */

export function Segmentado<T extends string>({ rotulo, opcoes, valor, onMudar, className }: {
  /** Nome do grupo para leitores de tela */
  rotulo: string
  opcoes: { valor: T; rotulo: string }[]
  valor: T
  onMudar: (valor: T) => void
  className?: string
}) {
  return (
    <div role="group" aria-label={rotulo} className={cn('inline-flex rounded-full border border-linha bg-creme p-0.5', className)}>
      {opcoes.map(o => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={valor === o.valor}
          onClick={() => onMudar(o.valor)}
          className={cn(
            'h-8 whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700',
            valor === o.valor ? 'bg-white text-tinta shadow-sm' : 'text-apagado hover:text-tinta',
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  )
}

'use client'

import { useRef, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PeriodoNav } from '@/components/dashboard/periodo-nav'
import { semMovimento } from '@/components/dashboard/valor'

gsap.registerPlugin(useGSAP)

const LIMPAR = 'transform,translate,rotate,scale,opacity'

/**
 * Casca das abas da área interna: fundo creme, título em serifa, controles do
 * período numa linha só e o conteúdo logo abaixo.
 *
 * - `periodo`: mostra as setas/seletores de mês e ano. Trocar o período
 *   navega pela URL (`mes`/`ano`), preservando os outros parâmetros; enquanto
 *   os dados novos chegam, o conteúdo antigo fica esmaecido no lugar.
 * - Animação: tudo que tiver `data-entrada` entra uma vez; `data-barra`
 *   (barra horizontal) e `data-coluna` (vertical) crescem da base na entrada
 *   e a cada troca de período. Com prefers-reduced-motion nada anima.
 */
export function PaginaInterna({ rotulo, titulo, sub, voltar, periodo, acoes, estreita, tourPeriodo, children }: {
  /** Linha pequena acima do título */
  rotulo: string
  titulo: ReactNode
  sub?: ReactNode
  voltar?: { href: string; rotulo: string }
  /** `permitirTodos: false` nas abas que consultam um mês específico; `'meses'` = só "Todos os meses" */
  periodo?: { mes: number; ano: number; permitirTodos?: boolean | 'meses' }
  /** Botões à direita do período */
  acoes?: ReactNode
  /** Largura de leitura (1100px) em vez da largura de trabalho (1400px) — portal do proprietário */
  estreita?: boolean
  /** `data-tour` da linha de controles (o tour guiado do portal aponta para ela) */
  tourPeriodo?: string
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const raiz = useRef<HTMLDivElement>(null)
  const [pendente, iniciarTransicao] = useTransition()

  function irPara(mes: number, ano: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', String(mes))
    params.set('ano', String(ano))
    iniciarTransicao(() => router.push(`${pathname}?${params.toString()}`))
  }

  // `opacity`, não autoAlpha: nada pode ficar sem foco/clique durante a entrada
  useGSAP(() => {
    const itens = raiz.current?.querySelectorAll('[data-entrada]')
    if (!itens?.length || semMovimento()) return
    gsap.from(itens, { y: 14, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.04, clearProps: LIMPAR })
  }, { scope: raiz })

  // O nível (lista → empreendimento → apartamento) vem na URL: mudar de nível
  // também é "dados novos", então as barras crescem de novo.
  const nivel = `${searchParams.get('emp') ?? ''}/${searchParams.get('apt') ?? ''}`
  useGSAP(() => {
    if (semMovimento()) return
    const barras = raiz.current?.querySelectorAll('[data-barra]')
    const colunas = raiz.current?.querySelectorAll('[data-coluna]')
    const base = { duration: 0.8, ease: 'power3.out', stagger: 0.008, clearProps: LIMPAR }
    if (barras?.length) gsap.from(barras, { scaleX: 0, ...base })
    if (colunas?.length) gsap.from(colunas, { scaleY: 0, ...base })
  }, { scope: raiz, dependencies: [periodo?.mes, periodo?.ano, nivel] })

  return (
    <div
      ref={raiz}
      className="min-h-[calc(100dvh-3.5rem)] bg-creme px-4 pb-16 pt-5 text-tinta sm:px-6 lg:min-h-dvh lg:px-8 lg:pt-8"
    >
      <div className={cn('mx-auto', estreita ? 'max-w-[1100px]' : 'max-w-[1400px]')}>
        {voltar && (
          <Link
            href={voltar.href}
            data-entrada
            className="mb-3 inline-flex items-center gap-1.5 rounded-full text-sm font-medium text-apagado transition-colors hover:text-marca-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marca-700"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {voltar.rotulo}
          </Link>
        )}

        <header data-entrada className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <p className="font-rotulo text-[11px] font-semibold uppercase tracking-[0.14em] text-apagado">{rotulo}</p>
            <h1 className="mt-1.5 break-words font-titulo text-[40px] leading-none tracking-[-0.02em] text-tinta sm:text-[52px]">
              {titulo}
            </h1>
            {sub && <p className="mt-2 text-sm text-apagado">{sub}</p>}
          </div>

          {(periodo || acoes) && (
            <div className="flex flex-wrap items-center gap-2" data-tour={tourPeriodo}>
              {periodo && (
                <PeriodoNav
                  mes={periodo.mes} ano={periodo.ano} onIr={irPara} pendente={pendente}
                  permitirTodos={periodo.permitirTodos}
                />
              )}
              {acoes}
            </div>
          )}
        </header>

        <div
          aria-busy={pendente}
          className={cn('mt-6 space-y-4 transition-opacity duration-200', pendente && 'pointer-events-none opacity-50')}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

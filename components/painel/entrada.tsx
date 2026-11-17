'use client'

import { useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SplitText } from 'gsap/SplitText'
import { semMovimento } from '@/components/dashboard/valor'

gsap.registerPlugin(useGSAP, SplitText)

/**
 * Entrada de uma tela que não usa a `PaginaInterna` (ex.: boas-vindas do
 * portal): o que tiver `data-entrada` sobe e aparece em sequência; o que tiver
 * `data-split` entra palavra por palavra. Com prefers-reduced-motion nada anima.
 */
export function Entrada({ children, className }: { children: ReactNode; className?: string }) {
  const raiz = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (semMovimento() || !raiz.current) return
    const linha = gsap.timeline({ defaults: { ease: 'power3.out' } })
    const itens = raiz.current.querySelectorAll('[data-entrada]')
    if (itens.length) linha.from(itens, { y: 16, opacity: 0, duration: 0.6, stagger: 0.06, clearProps: 'transform,translate,opacity' })
    const titulo = raiz.current.querySelector<HTMLElement>('[data-split]')
    if (titulo) {
      const partes = SplitText.create(titulo, { type: 'words', wordsClass: 'inline-block' })
      linha.from(partes.words, { y: '0.6em', opacity: 0, duration: 0.7, stagger: 0.05, onComplete: () => partes.revert() }, 0.15)
    }
  }, { scope: raiz })

  return <div ref={raiz} className={className}>{children}</div>
}

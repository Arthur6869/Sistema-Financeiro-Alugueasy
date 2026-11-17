'use client'

import { type RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SplitText } from 'gsap/SplitText'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { formatCurrency } from '@/lib/constants'

gsap.registerPlugin(useGSAP, SplitText, DrawSVGPlugin)

/**
 * O GSAP grava `translate/rotate/scale: none` inline em tudo que anima, o que
 * anula o hover do CSS (que usa `translate`). Nas entradas de uma vez só,
 * limpamos o inline ao terminar. Mesma regra da landing.
 */
const LIMPAR = 'transform,translate,rotate,scale,opacity,visibility'
const SO_TRANSFORMS = 'transform,translate,rotate,scale'

const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** `data-formato="kpi"` → "R$ 148k"; sem ele → moeda completa ("R$ 8.420,00"). */
function formatador(el: HTMLElement) {
  const antes = el.dataset.prefix ?? ''
  const depois = el.dataset.suffix ?? ''
  return el.dataset.formato === 'kpi'
    ? (n: number) => `${antes}${Math.round(n)}${depois}`
    : (n: number) => `${antes}${formatCurrency(Math.round(n))}${depois}`
}

/** Conta de 0 até `data-count`, escrevendo o texto formatado no elemento. */
function contador(el: HTMLElement, vars: gsap.TweenVars = {}) {
  const formatar = formatador(el)
  const estado = { v: 0 }
  el.textContent = formatar(0)
  return gsap.to(estado, {
    v: Number(el.dataset.count ?? 0),
    duration: 1.1,
    ease: 'power2.out',
    ...vars,
    onUpdate: () => { el.textContent = formatar(estado.v) },
  })
}

/**
 * Demonstração da limpeza: os itens são marcados um a um, a limpeza é
 * finalizada e a AlugEasy é avisada — então recomeça. Quem decide a etapa
 * "da vez" e o contador é o tempo da própria timeline (onUpdate), para o
 * estado continuar certo a cada repetição.
 */
function demoLimpeza(root: HTMLElement, viz: HTMLElement, atraso: number) {
  const um = <T extends Element = HTMLElement>(s: string) => root.querySelector<T>(s)!
  const itens = Array.from(root.querySelectorAll<HTMLElement>('.lg-check-item'))
  const passos = Array.from(root.querySelectorAll<HTMLElement>('.lg-passo'))
  const feitos = um('.lg-feitos')
  const barra = um('.lg-prog-fill')
  const conteudo = um('.lg-check-wrap')
  const botao = um('.lg-fim-btn')
  const aviso = um('.lg-fim-ok')
  const acento = getComputedStyle(root).getPropertyValue('--acento').trim() || '#5eead4'

  const INTERVALO = 0.62
  const tMarcar = 0.9
  const tFinalizar = tMarcar + itens.length * INTERVALO + 0.35
  const tAviso = tFinalizar + 0.8

  const estado = { feitos: 0 }
  let passoAtual = -1

  viz.setAttribute('data-loop', '')

  const tl = gsap.timeline({
    repeat: -1, repeatDelay: 0.5, delay: atraso, defaults: { ease: 'power2.out' },
    onUpdate() {
      feitos.textContent = String(Math.round(estado.feitos))
      const t = tl.time()
      const passo = t < tMarcar ? 0 : t < tFinalizar ? 1 : t < tAviso ? 2 : 3
      if (passo !== passoAtual) {
        passoAtual = passo
        passos.forEach((p, i) => p.classList.toggle('is-on', i === passo))
      }
    },
  })

  tl.fromTo(conteudo, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45 }, 0)
    .fromTo(barra, { scaleX: 0 }, { scaleX: 0, duration: 0.01 }, 0)

  itens.forEach((item, i) => {
    const t = tMarcar + i * INTERVALO
    tl.fromTo(item.querySelector('.lg-box'),
      { backgroundColor: 'rgba(255,255,255,0)', borderColor: 'rgba(255,255,255,0.38)' },
      { backgroundColor: acento, borderColor: acento, duration: 0.22 }, t)
      .fromTo(item.querySelector('.lg-tick'),
        { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.3, ease: 'power1.inOut' }, t + 0.05)
      .fromTo(item.querySelector('.lg-check-txt'), { opacity: 1 }, { opacity: 0.62, duration: 0.3 }, t + 0.1)
      .to(barra, { scaleX: (i + 1) / itens.length, duration: 0.4 }, t)
      .to(estado, { feitos: i + 1, duration: 0.01 }, t + 0.1)
  })

  tl.fromTo(botao, { opacity: 0.45 }, { opacity: 1, duration: 0.3 }, tFinalizar - 0.25)
    .to(botao, { scale: 0.93, duration: 0.12, ease: 'power1.in' }, tFinalizar + 0.25)
    .to(botao, { scale: 1, duration: 0.4, ease: 'back.out(3)' }, tFinalizar + 0.37)
    .fromTo(aviso, { autoAlpha: 0, x: -10 }, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'back.out(1.6)' }, tAviso)
    .to(conteudo, { autoAlpha: 0, duration: 0.4, ease: 'power1.in' }, tAviso + 2.9)
    .to(barra, { scaleX: 0, duration: 0.4, ease: 'power1.in' }, '<')

  return () => {
    viz.removeAttribute('data-loop')
    passos.forEach(p => p.classList.remove('is-on'))
  }
}

/**
 * Animação das telas de login.
 *
 * - Entrada rápida (o formulário já aceita digitação desde o primeiro quadro).
 * - Título do painel revelado linha a linha (SplitText).
 * - Prévia do portal: contadores e barras (interno), extrato (proprietário)
 *   ou a demonstração do checklist com DrawSVG (operacional).
 * - Erro de login balança o cartão; sucesso dá um pulso no botão.
 *
 * Com `prefers-reduced-motion` nada disso roda e a tela aparece completa.
 */
export function useLoginMotion(
  rootRef: RefObject<HTMLDivElement | null>,
  { erro, sucesso }: { erro: string; sucesso: boolean },
) {
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return

    const el = <T extends Element = HTMLElement>(seletor: string) => root.querySelector<T>(seletor)!
    const todos = <T extends Element = HTMLElement>(seletor: string) =>
      Array.from(root.querySelectorAll<T>(seletor))

    let entradaFeita = false // a entrada roda uma vez, não a cada troca de breakpoint

    const mm = gsap.matchMedia()
    mm.add(
      {
        sempre: '(min-width: 0px)',
        movimento: '(prefers-reduced-motion: no-preference)',
        largo: '(min-width: 961px)', // abaixo disso o painel vira faixa e a prévia some
        ponteiroFino: '(hover: hover) and (pointer: fine)',
      },
      (ctx) => {
        const { movimento, largo, ponteiroFino } = ctx.conditions as Record<string, boolean>
        if (!movimento) return

        const desfazer: Array<() => void> = []
        const primeira = !entradaFeita
        entradaFeita = true

        // Contadores reescrevem o texto; guardamos o original para devolver no fim
        const textos = new Map<HTMLElement, string>()
        todos('[data-count], .lg-feitos').forEach(n => textos.set(n, n.textContent ?? ''))
        desfazer.push(() => textos.forEach((texto, n) => { n.textContent = texto }))

        const entrada = gsap.timeline({ defaults: { ease: 'expo.out' } })

        if (primeira) {
          entrada
            .from(el('.lg-brand-top'), { y: -14, autoAlpha: 0, duration: 0.8 }, 0)
            .from(el('.lg-selo'), { y: 14, autoAlpha: 0, duration: 0.8 }, 0.08)
            .from(el('.lg-brand-sub'), { y: 16, autoAlpha: 0, duration: 0.9 }, 0.4)
            // `opacity`, não `autoAlpha`: autoAlpha põe visibility:hidden, e um campo
            // invisível não aceita foco nem digitação — o formulário precisa
            // funcionar desde o primeiro quadro, mesmo no meio da entrada.
            .from(el('.lg-card'), { y: largo ? 26 : 44, opacity: 0, duration: 0.9, clearProps: LIMPAR }, 0.1)
            .from(todos('[data-in]'), {
              y: 14, opacity: 0, duration: 0.7, stagger: 0.045, clearProps: LIMPAR,
            }, 0.22)

          SplitText.create(el('.lg-brand-title'), {
            type: 'lines', mask: 'lines', linesClass: 'lg-line', autoSplit: true,
            onSplit: (self) => gsap.from(self.lines, {
              yPercent: 115, duration: 1.1, stagger: 0.09, ease: 'expo.out', delay: 0.12,
            }),
          })
        }

        // Luzes do fundo: deriva lenta, só para o painel não ficar parado
        gsap.to(el('.lg-orb--a'), { x: 40, y: 30, duration: 11, ease: 'sine.inOut', yoyo: true, repeat: -1 })
        gsap.to(el('.lg-orb--b'), { x: -30, y: -40, duration: 13, ease: 'sine.inOut', yoyo: true, repeat: -1 })

        /* ── Prévia do portal (só existe no layout largo) ─────────────────── */
        const viz = root.querySelector<HTMLElement>('[data-viz]')
        if (largo && viz) {
          const tipo = viz.dataset.viz
          const t0 = primeira ? 0.4 : 0

          if (primeira) {
            entrada.from(viz, { y: 44, autoAlpha: 0, duration: 1.2 }, 0.35)
            // a lista de recursos não existe no operacional (lá são as etapas)
            const recursos = todos('.lg-extra > li')
            if (recursos.length) {
              entrada.from(recursos, { y: 12, autoAlpha: 0, duration: 0.7, stagger: 0.05 }, 0.9)
            }
          }

          if (tipo === 'interno') {
            entrada.from(todos('.lg-vbar'), {
              scaleY: 0, transformOrigin: '50% 100%', duration: 1, stagger: 0.018,
            }, t0 + 0.45)
            todos('.lg-kpis [data-count]').forEach((k, i) => {
              entrada.add(contador(k, { duration: 1.3 }), t0 + 0.45 + i * 0.08)
            })
          }

          if (tipo === 'proprietario') {
            entrada.from(todos('.lg-ext-linha'), { y: 10, autoAlpha: 0, duration: 0.7, stagger: 0.1 }, t0 + 0.35)
            todos('.lg-viz [data-count]').forEach((v, i) => {
              entrada.add(contador(v), t0 + 0.45 + i * 0.1)
            })
          }

          if (tipo === 'operacional') {
            desfazer.push(demoLimpeza(root, viz, primeira ? 1.3 : 0.2))
          }

          // Três camadas para os movimentos não brigarem pela mesma propriedade:
          // .lg-viz entra, .lg-float flutua, .lg-tilt inclina com o ponteiro.
          gsap.to(el('.lg-float'), { y: -8, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 })

          if (ponteiroFino) {
            const vidro = el('.lg-tilt')
            const painel = el('.lg-brand')
            const emX = gsap.quickTo(vidro, 'rotationX', { duration: 0.8, ease: 'power3.out' })
            const emY = gsap.quickTo(vidro, 'rotationY', { duration: 0.8, ease: 'power3.out' })
            const aoMover = (e: PointerEvent) => {
              const r = painel.getBoundingClientRect()
              emY(((e.clientX - r.left) / r.width - 0.5) * 9)
              emX(-((e.clientY - r.top) / r.height - 0.5) * 7)
            }
            const aoSair = () => { emX(0); emY(0) }
            painel.addEventListener('pointermove', aoMover)
            painel.addEventListener('pointerleave', aoSair)
            desfazer.push(() => {
              painel.removeEventListener('pointermove', aoMover)
              painel.removeEventListener('pointerleave', aoSair)
            })
          }
        }

        return () => desfazer.forEach(fn => fn())
      },
    )

    // Libera o conteúdo que o CSS segura até o JS assumir (ver login.css)
    root.setAttribute('data-ready', '')
  }, { scope: rootRef })

  // Cada novo erro balança o cartão: sinal claro de "não entrou", sem depender de cor
  useGSAP(() => {
    const cartao = rootRef.current?.querySelector('.lg-card')
    if (!erro || !cartao || reduzido()) return
    gsap.fromTo(cartao, { x: 0 }, {
      keyframes: { x: [0, -10, 9, -6, 3, 0] }, duration: 0.5, ease: 'power1.out',
      // com keyframes o clearProps do próprio tween não limpa o inline; faz-se no fim
      onComplete: () => { gsap.set(cartao, { clearProps: SO_TRANSFORMS }) },
    })
  }, { dependencies: [erro], scope: rootRef })

  useGSAP(() => {
    const botao = rootRef.current?.querySelector('.lg-submit')
    if (!sucesso || !botao || reduzido()) return
    gsap.fromTo(botao, { scale: 0.96 }, {
      scale: 1, duration: 0.6, ease: 'back.out(3)', clearProps: SO_TRANSFORMS,
    })
  }, { dependencies: [sucesso], scope: rootRef })
}

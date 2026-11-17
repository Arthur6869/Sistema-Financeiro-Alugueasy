'use client'

import { type RefObject } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { SplitText } from 'gsap/SplitText'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'
import { formatCurrency } from '@/lib/constants'

gsap.registerPlugin(useGSAP, ScrollTrigger, ScrollSmoother, SplitText, DrawSVGPlugin)

/** Distância do topo em que as âncoras param, para não ficarem sob a barra fixa. */
const FOLGA_NAV = 96

/**
 * O GSAP grava `translate/rotate/scale: none` inline em tudo que anima, o que
 * anula o hover do CSS (que usa `translate`). Nas entradas de uma vez só,
 * limpamos o inline ao terminar para o elemento voltar a obedecer à folha.
 */
const LIMPAR = 'transform,translate,rotate,scale,opacity,visibility'

/** Conta de 0 até `data-count`, escrevendo o texto formatado no elemento. */
function contador(el: HTMLElement, formatar: (n: number) => string, vars: gsap.TweenVars = {}) {
  const estado = { v: 0 }
  return gsap.to(estado, {
    v: Number(el.dataset.count ?? 0),
    duration: 1,
    ease: 'power2.out',
    ...vars,
    onUpdate: () => { el.textContent = formatar(estado.v) },
  })
}

const comoKpi = (el: HTMLElement) => (n: number) =>
  `${el.dataset.prefix ?? ''}${Math.round(n)}${el.dataset.suffix ?? ''}`

const comoDinheiro = (el: HTMLElement) => (n: number) =>
  `${el.dataset.prefix ?? ''}${formatCurrency(Math.round(n))}`

/**
 * Linha do tempo do extrato de exemplo, com um rótulo por etapa (e1…e5).
 * Fica pausada: quem move o cursor é a rolagem (etapa ativa) no desktop,
 * ou um play() simples quando o cartão entra na tela no celular.
 */
function montarExtrato(root: HTMLElement) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } })

  for (let etapa = 1; etapa <= 5; etapa++) {
    const blocos = Array.from(root.querySelectorAll<HTMLElement>(`[data-st="${etapa}"]`))
    const valores = blocos.flatMap(b =>
      b.matches('[data-count]') ? [b] : Array.from(b.querySelectorAll<HTMLElement>('[data-count]')),
    )
    const inicio = tl.duration()

    tl.fromTo(blocos, { opacity: 0.2 }, { opacity: 1, duration: 0.5, stagger: 0.14 }, inicio)
    valores.forEach((el, i) => {
      el.textContent = comoDinheiro(el)(0)
      tl.add(contador(el, comoDinheiro(el), { duration: 0.9 }), inicio + i * 0.14)
    })
    if (etapa === 5) {
      tl.from(root.querySelector('.lp-st-pdf-ok'), {
        scale: 0, rotate: -90, duration: 0.5, ease: 'back.out(2.5)',
      }, inicio + 0.15)
    }
    tl.addLabel(`e${etapa}`)
  }
  return tl
}

/**
 * Toda a animação da landing em um lugar só.
 *
 * - ScrollSmoother: rolagem suave + parallax (`data-speed`) no desktop.
 * - ScrollTrigger: prévia do dashboard que "deita" ao rolar, extrato fixado
 *   que se preenche por etapa, portais que se abrem em leque, barra de progresso.
 * - SplitText: títulos revelados linha a linha.
 * - DrawSVG: a linha do gráfico se desenha.
 *
 * Com `prefers-reduced-motion` nada disso roda e a página aparece completa.
 * O `useGSAP` desfaz tudo ao desmontar (inclusive smoother e SplitText).
 */
export function useLandingMotion(rootRef: RefObject<HTMLDivElement | null>) {
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return

    const el = <T extends Element = HTMLElement>(seletor: string) => root.querySelector<T>(seletor)!
    const todos = <T extends Element = HTMLElement>(seletor: string) =>
      Array.from(root.querySelectorAll<T>(seletor))

    let suave: ScrollSmoother | null = null
    let entradaFeita = false // a entrada do hero roda uma vez, não a cada troca de breakpoint

    const mm = gsap.matchMedia()

    mm.add(
      {
        sempre: '(min-width: 0px)',
        movimento: '(prefers-reduced-motion: no-preference)',
        desktop: '(min-width: 981px)',
        // a história rolável só vale se o extrato couber fixado na altura da janela
        // (abaixo de 800px de altura o CSS já troca o extrato pela versão compacta)
        historia: '(min-width: 981px) and (min-height: 640px)',
        ponteiroFino: '(hover: hover) and (pointer: fine)',
      },
      (ctx) => {
        const { movimento, desktop, historia, ponteiroFino } = ctx.conditions as Record<string, boolean>
        const desfazer: Array<() => void> = []

        const nav = el('.lp-nav')
        const hero = el('.lp-hero')

        /* ── Rolagem suave: precisa existir antes de qualquer ScrollTrigger ── */
        if (movimento && desktop) {
          suave = ScrollSmoother.create({
            wrapper: el('#smooth-wrapper'),
            content: el('#smooth-content'),
            smooth: 1.1,
            effects: true,
          })
          root.setAttribute('data-smooth', '')
          desfazer.push(() => { suave = null; root.removeAttribute('data-smooth') })
        }

        /* ── Sempre ativos (não são "movimento", são estado da interface) ── */
        // Callbacks em vez de toggleClass: com um `end`, a classe cairia ao
        // chegar no fim da página e a barra ficaria transparente sobre o rodapé.
        ScrollTrigger.create({
          trigger: hero, start: 'bottom top+=84',
          onEnter: () => nav.classList.add('is-solid'),
          onLeaveBack: () => nav.classList.remove('is-solid'),
        })
        desfazer.push(() => nav.classList.remove('is-solid'))

        gsap.to(el('.lp-progress'), {
          scaleX: 1, ease: 'none',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
        })

        todos<HTMLAnchorElement>('.lp-nav-links a').forEach(link => {
          const secao = root.querySelector(link.hash)
          if (!secao) return
          ScrollTrigger.create({
            trigger: secao, start: 'top 55%', end: 'bottom 55%',
            toggleClass: { targets: link, className: 'is-current' },
          })
        })

        if (!movimento) return () => desfazer.forEach(fn => fn())

        // Os contadores reescrevem o texto; guardamos o original para devolver no fim
        const textos = new Map<HTMLElement, string>()
        todos('[data-count]').forEach(n => textos.set(n, n.textContent ?? ''))
        desfazer.push(() => textos.forEach((texto, n) => { n.textContent = texto }))

        /* ── Hero: entrada ──────────────────────────────────────────────── */
        const palco = el('.lp-stage')
        const mock = el('.lp-mock')

        if (!entradaFeita) {
          entradaFeita = true
          const kpis = todos('.lp-count')
          kpis.forEach(k => { k.textContent = comoKpi(k)(0) })

          const entrada = gsap.timeline({ defaults: { ease: 'expo.out' } })
          entrada
            .from(nav, { y: -24, autoAlpha: 0, duration: 1 }, 0)
            .from(el('.lp-eyebrow'), { y: 18, autoAlpha: 0, duration: 0.9 }, 0.05)
            .from(el('.lp-hero-sub'), { y: 22, autoAlpha: 0, duration: 1 }, 0.5)
            .from(todos('.lp-hero-ctas > *'), {
              y: 22, autoAlpha: 0, duration: 0.9, stagger: 0.07, clearProps: LIMPAR,
            }, 0.6)
            .from(palco, { y: 110, autoAlpha: 0, duration: 1.5 }, 0.55)
            .from(todos('.lp-bar'), {
              scaleY: 0, transformOrigin: '50% 100%', duration: 1.1, stagger: 0.022,
            }, 1.05)
            .from(todos('.lp-chip'), {
              scale: 0.7, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.8)', stagger: 0.16,
            }, 1.35)
          kpis.forEach((k, i) => {
            entrada.add(contador(k, comoKpi(k), { duration: 1.4 }), 1.05 + i * 0.08)
          })

          SplitText.create(el('.lp-h1'), {
            type: 'lines', mask: 'lines', linesClass: 'lp-line', autoSplit: true,
            onSplit: (self) => gsap.from(self.lines, {
              yPercent: 115, duration: 1.2, stagger: 0.1, ease: 'expo.out', delay: 0.12,
            }),
          })
        }

        /* ── Hero: a prévia começa inclinada e "deita" conforme a rolagem ── */
        const topoDoPalco = () => {
          let y = 0
          let no: HTMLElement | null = palco
          while (no && no !== hero) { y += no.offsetTop; no = no.offsetParent as HTMLElement | null }
          return y
        }
        if (desktop) gsap.set(todos('.lp-chip'), { z: 60 })
        gsap.fromTo(mock,
          { rotateX: desktop ? 26 : 14, scale: desktop ? 0.93 : 0.96 },
          {
            rotateX: 0, scale: 1, ease: 'none',
            scrollTrigger: {
              trigger: hero, start: 'top top', scrub: 0.7, invalidateOnRefresh: true,
              end: () => `+=${Math.max(240, topoDoPalco() - window.innerHeight * 0.22)}`,
            },
          },
        )

        if (desktop && ponteiroFino) {
          const girar = gsap.quickTo(mock, 'rotationY', { duration: 0.9, ease: 'power3.out' })
          const aoMover = (e: PointerEvent) => {
            const r = hero.getBoundingClientRect()
            girar(((e.clientX - r.left) / r.width - 0.5) * 7)
          }
          const aoSair = () => girar(0)
          hero.addEventListener('pointermove', aoMover)
          hero.addEventListener('pointerleave', aoSair)
          desfazer.push(() => {
            hero.removeEventListener('pointermove', aoMover)
            hero.removeEventListener('pointerleave', aoSair)
          })
        }

        /* ── Faixa do fluxo: desliza na horizontal presa à rolagem ───────── */
        gsap.to(el('.lp-marquee-track'), {
          xPercent: -14, ease: 'none',
          scrollTrigger: { trigger: el('.lp-marquee'), start: 'top bottom', end: 'bottom top', scrub: 0.6 },
        })

        /* ── Títulos linha a linha + elementos de apoio ──────────────────── */
        todos('[data-split]').forEach(titulo => {
          SplitText.create(titulo, {
            type: 'lines', mask: 'lines', linesClass: 'lp-line', autoSplit: true,
            onSplit: (self) => gsap.from(self.lines, {
              yPercent: 115, duration: 1.1, stagger: 0.09, ease: 'expo.out',
              scrollTrigger: { trigger: titulo, start: 'top 88%', once: true },
            }),
          })
        })

        const revelar = (alvos: HTMLElement[], y = 28, gatilho = 'top 90%') => {
          if (!alvos.length) return
          gsap.set(alvos, { autoAlpha: 0, y })
          ScrollTrigger.batch(alvos, {
            start: gatilho, once: true,
            onEnter: lote => gsap.to(lote, {
              autoAlpha: 1, y: 0, duration: 1.05, ease: 'expo.out', stagger: 0.09, overwrite: true,
              clearProps: LIMPAR,
            }),
          })
        }
        revelar(todos('[data-reveal]'))

        /* ── Funcionalidades ─────────────────────────────────────────────── */
        revelar(todos('.lp-feat'), 48)

        const cartaoGrafico = el('.lp-feat--a')
        gsap.timeline({ scrollTrigger: { trigger: cartaoGrafico, start: 'top 70%', once: true } })
          .from(el('.lp-spark-line'), { drawSVG: '0%', duration: 1.8, ease: 'power2.inOut' }, 0)
          .from(el('.lp-spark-area'), { autoAlpha: 0, duration: 1.2 }, 0.6)
          .from(el('.lp-spark-dot'), {
            scale: 0, transformOrigin: '50% 50%', duration: 0.5, ease: 'back.out(3)',
          }, 1.6)

        /* ── Como funciona: trilho + extrato que se preenche ─────────────── */
        const passos = todos('.lp-step')
        const cartaoExtrato = el('.lp-statement')
        const extrato = montarExtrato(root)

        gsap.fromTo(el('.lp-rail-fill'), { scaleY: 0 }, {
          scaleY: 1, ease: 'none',
          scrollTrigger: { trigger: el('.lp-steps'), start: 'top 58%', end: 'bottom 58%', scrub: 0.4 },
        })

        if (historia) {
          root.setAttribute('data-story', '')
          desfazer.push(() => {
            root.removeAttribute('data-story')
            passos.forEach(p => p.classList.remove('is-active', 'is-done'))
          })

          // sticky não funciona dentro do conteúdo transformado pelo smoother: fixamos via pin
          ScrollTrigger.create({
            trigger: el('.lp-cf-grid'),
            start: `top top+=${FOLGA_NAV}`,
            end: () => `bottom top+=${FOLGA_NAV + cartaoExtrato.offsetHeight}`,
            pin: cartaoExtrato, pinSpacing: false, invalidateOnRefresh: true,
          })

          const ativar = (indice: number, imediato = false) => {
            passos.forEach((p, k) => {
              p.classList.toggle('is-active', k === indice)
              p.classList.toggle('is-done', k < indice)
            })
            const destino = extrato.labels[`e${indice + 1}`]
            if (imediato) { extrato.time(destino); return }
            extrato.tweenTo(destino, {
              duration: gsap.utils.clamp(0.35, 1.3, Math.abs(destino - extrato.time())),
              ease: 'power1.out',
            })
          }

          const gatilhos = passos.map((passo, i) => ScrollTrigger.create({
            trigger: passo, start: 'top 58%', end: 'bottom 58%',
            onToggle: self => { if (self.isActive) ativar(i) },
          }))
          // Estado inicial: etapa 1, ou a última já ultrapassada se a página abrir no meio
          ativar(gatilhos.reduce((ultimo, st, i) => (st.progress > 0 ? i : ultimo), 0), true)
        } else {
          revelar(passos, 32)
          ScrollTrigger.create({
            trigger: cartaoExtrato, start: 'top 78%', once: true,
            onEnter: () => extrato.timeScale(1.2).play(),
          })
        }

        /* ── Portais: "um sistema" que se abre em três ───────────────────── */
        // Movemos o "slot" de cada portal, não o cartão: o leque é reversível
        // (scrub), então o transform inline fica — e o hover vive no cartão de dentro.
        const portais = todos('.lp-portal-slot')
        if (desktop && portais.length === 3) {
          gsap.timeline({
            defaults: { ease: 'power2.out' },
            scrollTrigger: { trigger: el('.lp-portals-grid'), start: 'top 92%', end: 'top 40%', scrub: 0.7 },
          })
            .from(portais[0], { xPercent: 103, rotate: -8, y: 46 }, 0)
            .from(portais[2], { xPercent: -103, rotate: 8, y: 46 }, 0)
            .from(portais[1], { scale: 0.95, y: 20 }, 0)
        } else {
          revelar(portais, 40)
        }

        /* ── Rodapé: a marca sobe por trás do fechamento ─────────────────── */
        gsap.from(el('.lp-wordmark'), {
          yPercent: 45, ease: 'none',
          scrollTrigger: { trigger: el('.lp-cta'), start: 'top 60%', end: 'bottom bottom', scrub: 0.5 },
        })

        return () => desfazer.forEach(fn => fn())
      },
    )

    /* ── Âncoras: passam pelo smoother quando ele existe ─────────────────── */
    const aoClicar = (e: MouseEvent) => {
      const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]')
      const alvo = link && root.querySelector<HTMLElement>(link.hash)
      if (!link || !alvo) return
      e.preventDefault()
      if (suave) {
        suave.scrollTo(alvo, true, `top ${FOLGA_NAV}px`)
      } else {
        const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        alvo.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth', block: 'start' })
      }
      history.replaceState(null, '', link.hash)
    }
    root.addEventListener('click', aoClicar)

    /* ── Brilho que segue o ponteiro nos cartões de funcionalidade ───────── */
    const bento = el('.lp-bento')
    const aoIluminar = (e: PointerEvent) => {
      const cartao = (e.target as Element).closest<HTMLElement>('.lp-feat')
      if (!cartao) return
      const r = cartao.getBoundingClientRect()
      cartao.style.setProperty('--mx', `${e.clientX - r.left}px`)
      cartao.style.setProperty('--my', `${e.clientY - r.top}px`)
    }
    bento.addEventListener('pointermove', aoIluminar)

    // Libera o conteúdo que o CSS segura até o JS assumir (ver landing.css)
    root.setAttribute('data-ready', '')

    // A troca de fonte muda alturas; recalcula os gatilhos quando ela termina
    let vivo = true
    document.fonts?.ready.then(() => { if (vivo) ScrollTrigger.refresh() })

    return () => {
      vivo = false
      root.removeEventListener('click', aoClicar)
      bento.removeEventListener('pointermove', aoIluminar)
    }
  }, { scope: rootRef })
}

'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  useEffect, useRef, useState, useSyncExternalStore,
  type KeyboardEvent, type ReactNode,
} from 'react'
import {
  AlertCircle, ArrowBigUp, ArrowLeft, ArrowRight, Check, Eye, EyeOff, Info, Loader2, Lock, Mail,
  type LucideIcon,
} from 'lucide-react'
import { fontesMarca } from '@/lib/fontes-marca'
import { useLoginMotion } from './use-login-motion'
import './login.css'

/*
 * Moldura e peças de formulário compartilhadas pelas três telas de login.
 * Aqui só existe APRESENTAÇÃO: a autenticação (signIn, checagem de papel,
 * redirecionamento) continua inteira em cada page.tsx.
 */

export type Tom = 'navy' | 'green' | 'teal'

function LogoIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 3L3 15H7.5V28H13.5V21H18.5V28H24.5V15H29L16 3Z" fill="currentColor" />
    </svg>
  )
}

/* ── Saudação pela hora local ──────────────────────────────────────── */

const semAssinatura = () => () => {}
const saudacaoDaHora = () => {
  const h = new Date().getHours()
  return h >= 5 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite'
}

/**
 * "Bom dia" / "Boa tarde" / "Boa noite" pelo relógio do usuário. No servidor
 * devolve '' — o fuso de lá não é o de quem está acessando —, e o
 * useSyncExternalStore troca pelo valor real sem erro de hidratação.
 */
function useSaudacao() {
  return useSyncExternalStore(semAssinatura, saudacaoDaHora, () => '')
}

/* ── Moldura ───────────────────────────────────────────────────────── */

export function LoginShell({ tom, selo, titulo, resumo, visual, erro, sucesso, children }: {
  tom: Tom
  /** Rótulo do portal no painel colorido */
  selo: string
  titulo: ReactNode
  resumo: string
  /** Prévia animada do que a pessoa encontra depois de entrar */
  visual: ReactNode
  /** Mensagem de erro atual — cada novo erro balança o cartão */
  erro: string
  sucesso: boolean
  children: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  useLoginMotion(root, { erro, sucesso })

  return (
    <div ref={root} className={`lg-root ${fontesMarca}`} data-tom={tom}>
      <aside className="lg-brand">
        <div className="lg-brand-bg" aria-hidden="true">
          <div className="lg-grid" />
          <div className="lg-orb lg-orb--a" />
          <div className="lg-orb lg-orb--b" />
        </div>

        <div className="lg-brand-top">
          <Link href="/home" className="lg-logo" aria-label="AlugEasy — página inicial">
            <LogoIcon />
            <span>ALUGUEASY</span>
          </Link>
          <Link href="/home" className="lg-back">
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="lg-back-full">Voltar para a página inicial</span>
            <span className="lg-back-short">Início</span>
          </Link>
        </div>

        <div className="lg-brand-body">
          <span className="lg-selo">{selo}</span>
          <p className="lg-brand-title">{titulo}</p>
          <p className="lg-brand-sub">{resumo}</p>
          {visual}
        </div>

        <p className="lg-copy">© {new Date().getFullYear()} AlugEasy</p>
      </aside>

      <main className="lg-main">
        <div className="lg-card">
          <div className="lg-card-inner">{children}</div>
        </div>
      </main>
    </div>
  )
}

/* ── Cabeçalho do formulário ───────────────────────────────────────── */

export function LoginCabecalho({ icon: Icon, selo, titulo, sub }: {
  icon: LucideIcon; selo: string; titulo: ReactNode; sub: string
}) {
  const saudacao = useSaudacao()
  return (
    <header>
      <span className="lg-tag" data-in>
        <Icon size={12} aria-hidden="true" />
        {selo}
      </span>
      <p className="lg-ola" data-in>{saudacao && `${saudacao},`}</p>
      <h1 className="lg-h1" data-in>{titulo}</h1>
      <p className="lg-sub" data-in>{sub}</p>
    </header>
  )
}

/* ── Campos ────────────────────────────────────────────────────────── */

export function CampoEmail({ id, label, placeholder, value, onChange, disabled }: {
  id: string; label: string; placeholder: string
  value: string; onChange: (valor: string) => void; disabled: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const jaFocou = useRef(false)

  // Foco inicial só no desktop, uma vez, quando o campo é liberado. No celular
  // o foco automático abre o teclado e cobre a tela antes de a pessoa ler nada.
  useEffect(() => {
    if (disabled || jaFocou.current) return
    jaFocou.current = true
    const desktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (desktop && document.activeElement === document.body) ref.current?.focus({ preventScroll: true })
  }, [disabled])

  return (
    <div className="lg-field" data-in>
      <label htmlFor={id}>{label}</label>
      <div className="lg-input-wrap">
        <Mail className="lg-input-ico" size={18} aria-hidden="true" />
        <input
          ref={ref} id={id} type="email" className="lg-input" placeholder={placeholder}
          value={value} onChange={e => onChange(e.target.value)}
          disabled={disabled} required
          autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
        />
      </div>
    </div>
  )
}

export function CampoSenha({ id, value, onChange, disabled, carregando }: {
  id: string; value: string; onChange: (valor: string) => void
  disabled: boolean; carregando: boolean
}) {
  const [visivel, setVisivel] = useState(false)
  const [caps, setCaps] = useState(false)
  const lerCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState('CapsLock'))
  const idCaps = `${id}-caps`

  return (
    <div className="lg-field" data-in>
      <label htmlFor={id}>Senha</label>
      <div className="lg-input-wrap">
        <Lock className="lg-input-ico" size={18} aria-hidden="true" />
        <input
          id={id} type={visivel ? 'text' : 'password'} className="lg-input lg-input--senha" placeholder="••••••••"
          value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={lerCaps} onKeyUp={lerCaps} onBlur={() => setCaps(false)}
          disabled={disabled} required autoComplete="current-password"
          aria-describedby={caps ? idCaps : undefined}
        />
        <button
          type="button" className="lg-pw" onClick={() => setVisivel(v => !v)} disabled={carregando}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={visivel}
        >
          {visivel ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {caps && (
        <p id={idCaps} className="lg-caps" role="status">
          <ArrowBigUp size={15} aria-hidden="true" />
          Caps Lock está ativado
        </p>
      )}
    </div>
  )
}

/* ── Avisos ────────────────────────────────────────────────────────── */

export function Alerta({ tipo, soEstreito, children }: {
  tipo: 'err' | 'warn' | 'info'
  /** Mostra só no celular/tablet (quando o painel com o mesmo texto some) */
  soEstreito?: boolean
  children: ReactNode
}) {
  const Icone = tipo === 'info' ? Info : AlertCircle
  return (
    <div
      className={`lg-alert lg-alert--${tipo}${soEstreito ? ' lg-so-estreito' : ''}`}
      role={tipo === 'info' ? undefined : 'alert'}
    >
      <Icone size={16} aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

/**
 * Explica por que a pessoa foi devolvida ao login quando o proxy.ts manda um
 * `?erro=` na URL. Lê a query com useSearchParams, então precisa ficar dentro
 * de um <Suspense> — isolado aqui para o resto da página continuar pré-renderizado.
 */
export function AvisoDaUrl({ mensagens }: { mensagens: Record<string, string> }) {
  const codigo = useSearchParams().get('erro')
  const texto = codigo ? mensagens[codigo] : undefined
  return texto ? <Alerta tipo="err">{texto}</Alerta> : null
}

/* ── Botão de entrar ───────────────────────────────────────────────── */

export function BotaoEntrar({ rotulo, rotuloCarregando, carregando, sucesso, disabled }: {
  rotulo: string; rotuloCarregando: string
  carregando: boolean; sucesso: boolean; disabled: boolean
}) {
  return (
    <button type="submit" className={`lg-submit${sucesso ? ' is-ok' : ''}`} disabled={disabled} data-in>
      {sucesso ? (
        <><Check size={18} aria-hidden="true" /> {rotuloCarregando}</>
      ) : carregando ? (
        <><Loader2 size={17} className="animate-spin" aria-hidden="true" /> {rotuloCarregando}</>
      ) : (
        <>{rotulo}<ArrowRight size={17} className="lg-seta" aria-hidden="true" /></>
      )}
    </button>
  )
}

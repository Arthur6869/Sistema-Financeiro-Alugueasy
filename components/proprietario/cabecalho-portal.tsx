'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LogoMarca } from '@/components/marca/logo-marca'
import { LogoutButton } from './logout-button'

export const ABAS_PORTAL = [
  { href: '/proprietario', rotulo: 'Início' },
  { href: '/proprietario/extrato', rotulo: 'Rentabilidade' },
  { href: '/proprietario/historico', rotulo: 'Histórico' },
]

/** Mantém o mês/ano escolhidos ao trocar de aba. */
export function hrefComPeriodo(base: string, mes: string | null, ano: string | null) {
  const params = new URLSearchParams()
  if (mes) params.set('mes', mes)
  if (ano) params.set('ano', ano)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

function Abas() {
  const caminho = usePathname()
  const params = useSearchParams()
  const mes = params.get('mes')
  const ano = params.get('ano')
  return (
    <nav aria-label="Seções do portal" data-tour="navegacao" className="hidden items-center gap-1 rounded-full border border-linha bg-creme p-1 md:flex">
      {ABAS_PORTAL.map(a => {
        const ativa = caminho === a.href
        return (
          <Link
            key={a.href} href={hrefComPeriodo(a.href, mes, ano)} aria-current={ativa ? 'page' : undefined}
            className={cn(
              'h-9 rounded-full px-4 text-[13.5px] font-medium leading-9 transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700',
              ativa ? 'bg-white text-tinta shadow-sm' : 'text-apagado hover:text-tinta',
            )}
          >
            {a.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Barra do topo do portal do proprietário: marca, abas (a partir do tablet),
 * quem está logado e sair. No celular as abas ficam na barra de baixo.
 */
export function CabecalhoPortal({ nome, iniciais }: { nome: string; iniciais: string }) {
  const primeiroNome = nome.split(' ')[0] ?? ''
  return (
    <header className="sticky top-0 z-40 border-b border-linha bg-white/90 backdrop-blur supports-backdrop-filter:bg-white/80">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/proprietario"
          className="flex min-w-0 items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marca-700"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-marca-800 text-white">
            <LogoMarca size={20} />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[13px] font-bold tracking-[0.08em] text-tinta">ALUGUEASY</span>
            <span className="block truncate font-rotulo text-[10px] uppercase tracking-[0.12em] text-apagado">Portal do proprietário</span>
          </span>
        </Link>

        <Suspense fallback={null}>
          <Abas />
        </Suspense>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-full bg-marca-50 text-xs font-bold tracking-wide text-marca-700 ring-1 ring-marca-100"
          >
            {iniciais}
          </span>
          <span className="hidden max-w-[12rem] truncate text-sm font-medium text-tinta sm:block">{nome}</span>
          <span className="text-sm text-apagado sm:hidden">{primeiroNome}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  )
}

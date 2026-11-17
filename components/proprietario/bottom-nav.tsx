'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { FileText, History, Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hrefComPeriodo } from './cabecalho-portal'

const ITENS = [
  { href: '/proprietario', icone: Home, rotulo: 'Início' },
  { href: '/proprietario/extrato', icone: FileText, rotulo: 'Rentabilidade' },
  { href: '/proprietario/historico', icone: History, rotulo: 'Histórico' },
]

function Barra() {
  const caminho = usePathname()
  const params = useSearchParams()
  const mes = params.get('mes')
  const ano = params.get('ano')

  return (
    <nav
      aria-label="Seções do portal" data-tour="navegacao-mobile"
      className="fixed inset-x-0 bottom-0 z-50 flex border-t border-linha bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {ITENS.map(({ href, icone: Icone, rotulo }) => {
        const ativa = caminho === href
        return (
          <Link
            key={href} href={hrefComPeriodo(href, mes, ano)} aria-current={ativa ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca-700',
              ativa ? 'text-marca-700' : 'text-apagado',
            )}
          >
            <span className={cn('grid h-8 w-12 place-items-center rounded-full transition-colors', ativa && 'bg-marca-50')}>
              <Icone size={21} strokeWidth={ativa ? 2.4 : 1.8} aria-hidden="true" />
            </span>
            {rotulo}
          </Link>
        )
      })}
    </nav>
  )
}

/** Abas do portal no celular (no desktop elas ficam no cabeçalho). */
export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <Barra />
    </Suspense>
  )
}

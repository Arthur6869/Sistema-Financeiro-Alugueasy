'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, History } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITENS = [
  { href: '/operacional', label: 'Imóveis', icon: Building2 },
  { href: '/operacional/historico', label: 'Minhas limpezas', icon: History },
]

function ativo(path: string, href: string) {
  // O checklist (/operacional/limpeza/...) acende "Imóveis".
  if (href === '/operacional') return path === href || path.startsWith('/operacional/limpeza')
  return path.startsWith(href)
}

export function OperacionalNav({ variante }: { variante: 'topo' | 'base' }) {
  const path = usePathname()

  if (variante === 'topo') {
    return (
      <nav className="flex items-center gap-1">
        {ITENS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors',
              ativo(path, href) ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
            )}
          >
            <Icon size={15} />
            {label}
          </Link>
        ))}
      </nav>
    )
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {ITENS.map(({ href, label, icon: Icon }) => {
        const on = ativo(path, href)
        return (
          <Link key={href} href={href} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5">
            <Icon size={20} className={on ? 'text-[#0f766e]' : 'text-gray-400'} />
            <span className={cn('text-[11px] font-medium', on ? 'text-[#0f766e]' : 'text-gray-400')}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

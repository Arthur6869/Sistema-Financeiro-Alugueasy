'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, FileText, History } from 'lucide-react'

const items = [
  { href: '/proprietario', icon: Home, label: 'Início' },
  { href: '/proprietario/extrato', icon: FileText, label: 'Extrato' },
  { href: '/proprietario/historico', icon: History, label: 'Histórico' },
]

export function BottomNav() {
  const path = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {items.map(({ href, icon: Icon, label }) => {
        const active = path === href
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
            style={{ color: active ? '#193660' : '#9ca3af' }}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-[#193660]/10' : ''}`}>
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            </div>
            <span className={`text-[10px] font-medium ${active ? 'text-[#193660]' : 'text-gray-400'}`}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

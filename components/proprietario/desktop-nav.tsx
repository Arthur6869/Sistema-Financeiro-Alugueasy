'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const NAV = [
  { href: '/proprietario', label: 'Início' },
  { href: '/proprietario/extrato', label: 'Extrato' },
  { href: '/proprietario/historico', label: 'Histórico' },
]

function DesktopNavInner() {
  const searchParams = useSearchParams()
  const mes = searchParams.get('mes')
  const ano = searchParams.get('ano')

  function buildHref(base: string) {
    const params = new URLSearchParams()
    if (mes) params.set('mes', mes)
    if (ano) params.set('ano', ano)
    const qs = params.toString()
    return qs ? `${base}?${qs}` : base
  }

  return (
    <nav className="hidden md:flex" style={{ gap: 2 }}>
      {NAV.map(({ href, label }) => (
        <Link
          key={href}
          href={buildHref(href)}
          style={{
            fontSize: 13.5, fontWeight: 500, color: '#5a6a82',
            padding: '7px 14px', borderRadius: 9,
            textDecoration: 'none', transition: 'all .15s',
            display: 'block',
          }}
          className="hover:bg-[#f8f6f1] hover:!text-[#0f1a2e]"
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}

export function DesktopNav() {
  return (
    <Suspense fallback={
      <nav className="hidden md:flex" style={{ gap: 2 }}>
        {NAV.map(({ href, label }) => (
          <span key={href} style={{ fontSize: 13.5, fontWeight: 500, color: '#5a6a82', padding: '7px 14px', borderRadius: 9, display: 'block' }}>
            {label}
          </span>
        ))}
      </nav>
    }>
      <DesktopNavInner />
    </Suspense>
  )
}

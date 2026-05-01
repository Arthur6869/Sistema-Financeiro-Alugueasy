import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/proprietario/logout-button'
import { BottomNav } from '@/components/proprietario/bottom-nav'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portal do Proprietário — AlugEasy',
  description: 'Acompanhe o rendimento dos seus imóveis',
  themeColor: '#193660',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AlugEasy',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default async function ProprietarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'proprietario') redirect('/')

  const primeiroNome = profile?.full_name?.split(' ')[0] ?? ''

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 md:gap-3">
            <img src="/logo-alugueasy.png" alt="AlugEasy" className="h-7 md:h-8" />
            <span className="text-xs text-gray-400 font-medium hidden sm:block">
              Portal do Proprietário
            </span>
          </div>

          {/* Nav desktop (oculta no mobile — substituída pelo BottomNav) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/proprietario" className="text-gray-600 hover:text-[#193660] transition-colors">
              Início
            </Link>
            <Link href="/proprietario/extrato" className="text-gray-600 hover:text-[#193660] transition-colors">
              Extrato
            </Link>
            <Link href="/proprietario/historico" className="text-gray-600 hover:text-[#193660] transition-colors">
              Histórico
            </Link>
          </nav>

          {/* Usuário + Sair */}
          <div className="flex items-center gap-2 md:gap-4">
            <span className="text-sm text-gray-600 hidden md:block">
              {profile?.full_name}
            </span>
            {/* Mobile: mostra só primeiro nome abreviado */}
            <span className="text-xs text-gray-500 md:hidden">
              {primeiroNome}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      {/* pb-24 no mobile para não ficar atrás do BottomNav (h-16 + safe area) */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-24 md:pb-8">
        {children}
      </main>

      {/* Footer — oculto no mobile (BottomNav substitui) */}
      <footer className="hidden md:block text-center text-xs text-gray-400 py-6 border-t border-gray-100 bg-white">
        AlugEasy © {new Date().getFullYear()} — Portal do Proprietário
      </footer>

      {/* Bottom navigation mobile */}
      <BottomNav />
    </div>
  )
}

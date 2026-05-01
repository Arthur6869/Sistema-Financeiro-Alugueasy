import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LogoutButton } from '@/components/proprietario/logout-button'

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-alugueasy.png" alt="AlugEasy" className="h-8" />
            <span className="text-sm text-gray-400 font-medium hidden sm:block">
              Portal do Proprietário
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link
              href="/proprietario"
              className="text-gray-600 hover:text-[#193660] transition-colors"
            >
              Início
            </Link>
            <Link
              href="/proprietario/extrato"
              className="text-gray-600 hover:text-[#193660] transition-colors"
            >
              Extrato
            </Link>
            <Link
              href="/proprietario/historico"
              className="text-gray-600 hover:text-[#193660] transition-colors"
            >
              Histórico
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 hidden sm:block">
              {profile?.full_name}
            </span>
            <LogoutButton />
          </div>
        </div>

        {/* Nav mobile */}
        <div className="md:hidden border-t border-gray-100">
          <div className="flex">
            <Link
              href="/proprietario"
              className="flex-1 text-center py-2 text-xs font-medium text-gray-600 hover:text-[#193660] hover:bg-gray-50 transition-colors"
            >
              Início
            </Link>
            <Link
              href="/proprietario/extrato"
              className="flex-1 text-center py-2 text-xs font-medium text-gray-600 hover:text-[#193660] hover:bg-gray-50 transition-colors"
            >
              Extrato
            </Link>
            <Link
              href="/proprietario/historico"
              className="flex-1 text-center py-2 text-xs font-medium text-gray-600 hover:text-[#193660] hover:bg-gray-50 transition-colors"
            >
              Histórico
            </Link>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        {children}
      </main>

      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-100 bg-white">
        AlugEasy © 2026 — Portal do Proprietário
      </footer>
    </div>
  )
}

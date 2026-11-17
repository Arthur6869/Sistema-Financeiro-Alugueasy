import { AppSidebar } from '@/components/layout/app-sidebar'
import { fontesMarca } from '@/lib/fontes-marca'

/**
 * Moldura da área interna: menu lateral + conteúdo.
 *
 * - Desktop (≥ 1024px): o menu fica fixo na lateral e acompanha a rolagem.
 * - Abaixo disso: o menu vira gaveta e uma barra de 56px fica fixa no topo —
 *   por isso o `pt-14` no conteúdo.
 *
 * A autenticação continua em app/(dashboard)/layout.tsx; aqui é só layout.
 */
export function AppShell({ role, fullName, email, children }: {
  role: string
  fullName: string
  email: string
  children: React.ReactNode
}) {
  return (
    <div className={`flex min-h-dvh bg-creme ${fontesMarca}`}>
      <AppSidebar role={role} fullName={fullName} email={email} />
      <main className="min-w-0 flex-1 overflow-auto bg-white pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}

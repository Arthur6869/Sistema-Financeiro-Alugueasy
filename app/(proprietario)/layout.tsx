import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LogoutButton } from '@/components/proprietario/logout-button'
import { BottomNav } from '@/components/proprietario/bottom-nav'
import { DesktopNav } from '@/components/proprietario/desktop-nav'
import { PresencaHeartbeat } from '@/components/presenca/presenca-heartbeat'
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
  const iniciais = (profile?.full_name ?? '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase() ?? '')
    .join('') || '?'

  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <PresencaHeartbeat />

      {/* ─── Header ─── */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #e7e9ee',
        position: 'sticky', top: 0, zIndex: 40,
        boxShadow: '0 1px 8px rgba(15,26,46,.05)',
      }}>
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: 1400, margin: '0 auto', padding: '0 24px',
          gap: 16,
        }}>

          {/* Marca */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/image.png"
              alt="AlugEasy"
              style={{ height: 44, width: 'auto', display: 'block', borderRadius: 8 }}
            />
          </div>

          {/* Nav desktop — repassa mes/ano da URL atual para manter filtro entre abas */}
          <DesktopNav />

          {/* Usuário + Sair */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Avatar com iniciais */}
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: '#193660', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, letterSpacing: '.04em',
              flexShrink: 0, userSelect: 'none',
            }}>
              {iniciais}
            </div>
            {/* Nome completo no desktop */}
            <span className="hidden md:block" style={{ fontSize: 13, fontWeight: 500, color: '#0f1a2e' }}>
              {profile?.full_name}
            </span>
            {/* Primeiro nome no mobile */}
            <span className="md:hidden" style={{ fontSize: 12.5, color: '#5a6a82' }}>
              {primeiroNome}
            </span>
            {/* Divisor */}
            <div className="hidden md:block" style={{ width: 1, height: 18, background: '#e7e9ee', flexShrink: 0 }} />
            <LogoutButton />
          </div>

        </div>
      </header>

      {/* Conteúdo — sem max-width: cada página controla a própria largura via .pg-wrap */}
      <main className="flex-1 w-full pb-24 md:pb-0">
        {children}
      </main>

      {/* Footer desktop */}
      <footer className="hidden md:block" style={{
        textAlign: 'center', fontSize: 11.5,
        color: '#94a3b8', padding: '20px 24px',
        borderTop: '1px solid #e7e9ee', background: '#fff',
      }}>
        AlugEasy &copy; 2026 &mdash; Portal do Proprietário
      </footer>

      <BottomNav />
    </div>
  )
}

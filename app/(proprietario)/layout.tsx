import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Metadata, Viewport } from 'next'
import { fontesMarca } from '@/lib/fontes-marca'
import { PresencaHeartbeat } from '@/components/presenca/presenca-heartbeat'
import { CabecalhoPortal } from '@/components/proprietario/cabecalho-portal'
import { BottomNav } from '@/components/proprietario/bottom-nav'
import { AssistenteAlugEasy } from '@/components/proprietario/assistente-alugueasy'

export const metadata: Metadata = {
  title: 'Portal do Proprietário — AlugEasy',
  description: 'Acompanhe o rendimento dos seus imóveis',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AlugEasy',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

// A cor da barra do navegador vai no `viewport` (no `metadata` o Next 16 só avisa e ignora)
export const viewport: Viewport = { themeColor: '#0f2647' }

/**
 * Moldura do portal do proprietário: cabeçalho com as abas, conteúdo e, no
 * celular, a barra de abas embaixo. A autenticação continua aqui.
 *
 * As fontes da marca vêm por `fontesMarca` (next/font): o @import do Google
 * Fonts que cada página carregava era bloqueado pela CSP e nunca chegou a valer.
 */
export default async function ProprietarioLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, ativo')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'proprietario') redirect('/')
  // Conta suspensa. Antes isso só era verificado no proxy.ts — e o proxy não
  // cobre /api nem existe para um cliente mobile falando direto com o Supabase.
  // A trava definitiva é a RLS (migration 037); esta aqui é a de superfície.
  if (profile.ativo === false) redirect('/login-proprietario?erro=conta_desativada')

  const nome = profile?.full_name?.trim() || 'Proprietário'
  const iniciais = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n: string) => n[0]?.toUpperCase() ?? '')
    .join('') || '?'

  return (
    <div className={`flex min-h-dvh flex-col bg-creme text-tinta ${fontesMarca}`}>
      <PresencaHeartbeat />
      <CabecalhoPortal nome={nome} iniciais={iniciais} />

      {/* overflow-x clip: nenhum elemento largo pode criar rolagem lateral na página inteira */}
      <main className="w-full flex-1 pb-24 md:pb-0" style={{ overflowX: 'clip' }}>
        {children}
      </main>

      <footer className="hidden border-t border-linha bg-white px-6 py-5 text-center text-xs text-apagado md:block">
        AlugEasy © 2026 — Portal do Proprietário
      </footer>

      <BottomNav />
      <AssistenteAlugEasy />
    </div>
  )
}

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PresencaHeartbeat } from '@/components/presenca/presenca-heartbeat'
import { OperacionalNav } from '@/components/operacional/operacional-nav'
import { SairOperacional } from '@/components/operacional/sair-operacional'

export const metadata: Metadata = {
  title: 'Operacional — AlugEasy',
  description: 'Checklist de limpeza dos imóveis',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'AlugEasy' },
  other: { 'mobile-web-app-capable': 'yes' },
}

export default async function OperacionalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login-operacional')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, ativo')
    .eq('id', user.id)
    .single()

  // Defesa em profundidade: o proxy já barra, mas a rota pode ser atingida direto.
  if (profile?.role === 'proprietario') redirect('/proprietario')
  if (profile?.role === 'admin' || profile?.role === 'analista') redirect('/')
  if (profile?.role !== 'operacional') redirect('/login-operacional')
  if (profile.ativo === false) redirect('/login-operacional?erro=conta_desativada')

  const primeiroNome = profile.full_name?.split(' ')[0] ?? ''

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f5f7]" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <PresencaHeartbeat />

      <header className="sticky top-0 z-40 bg-[#134e4a] text-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[13px] font-bold tracking-[0.1em]">ALUGUEASY</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-white/15 rounded-full px-2 py-0.5">Operacional</span>
          </div>
          <div className="hidden md:block">
            <OperacionalNav variante="topo" />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm text-white/80 truncate max-w-[120px]">{primeiroNome}</span>
            <SairOperacional />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-5 pb-28 md:pb-10">
        {children}
      </main>

      <div className="md:hidden">
        <OperacionalNav variante="base" />
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { PresencaHeartbeat } from '@/components/presenca/presenca-heartbeat'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Buscar perfil com role
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  // FAIL-CLOSED: só admin/analista/proprietario têm acesso. Qualquer outro papel
  // (ou profile ausente — ex.: auto-cadastro) é barrado. O middleware já bloqueia,
  // isto é defesa em profundidade caso a rota seja atingida direto.
  const role = profile?.role
  const fullName = profile?.full_name ?? user.email ?? 'Usuário'
  const email = user.email ?? ''

  if (role === 'proprietario') redirect('/proprietario')
  if (role !== 'admin' && role !== 'analista') redirect('/login?erro=sem_acesso')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <PresencaHeartbeat />
      <AppSidebar role={role} fullName={fullName} email={email} />
      <main className="flex-1 bg-white overflow-auto">
        {children}
      </main>
    </div>
  )
}

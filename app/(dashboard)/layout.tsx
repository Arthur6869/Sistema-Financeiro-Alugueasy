import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppSidebar } from '@/components/layout/app-sidebar'

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

  const role = profile?.role ?? 'analista'
  const fullName = profile?.full_name ?? user.email ?? 'Usuário'
  const email = user.email ?? ''

  if (role === 'proprietario') redirect('/proprietario')

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AppSidebar role={role} fullName={fullName} email={email} />
      <main className="flex-1 bg-white overflow-auto">
        {children}
      </main>
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { UsuariosClient } from './usuarios-client'

export default async function UsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (myProfile?.role !== 'analista') redirect('/')

  const [
    { data: profiles },
    { data: apartamentosData },
    { data: vinculosData },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .order('created_at'),
    supabase
      .from('apartamentos')
      .select('id, numero, tipo_gestao, empreendimentos(nome)')
      .order('numero'),
    supabase
      .from('proprietario_apartamentos')
      .select('proprietario_id, apartamento_id, ativo'),
  ])

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
            <Badge style={{ backgroundColor: '#193660' }} className="text-white text-xs">
              Analista only
            </Badge>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {profiles?.length ?? 0} usuário(s) cadastrado(s) no sistema
          </p>
        </div>
      </div>

      <UsuariosClient
        profiles={profiles ?? []}
        apartamentos={(apartamentosData ?? []) as unknown as Array<{
          id: string
          numero: string
          tipo_gestao: string | null
          empreendimentos: { nome: string } | null
        }>}
        vinculos={(vinculosData ?? []) as Array<{
          proprietario_id: string
          apartamento_id: string
          ativo: boolean
        }>}
      />
    </div>
  )
}

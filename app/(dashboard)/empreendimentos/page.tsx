import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, BedDouble } from 'lucide-react'

export default async function EmpreendimentosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: empreendimentos } = await supabase
    .from('empreendimentos')
    .select('id, nome, apartamentos(id)')
    .order('nome')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Empreendimentos</h1>
        <p className="text-gray-500 text-sm mt-1">
          {empreendimentos?.length ?? 0} empreendimento(s) cadastrado(s)
        </p>
      </div>

      {empreendimentos && empreendimentos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {empreendimentos.map((emp) => (
            <Card key={emp.id} className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#193660' }}
                  >
                    <Building2 size={18} className="text-white" />
                  </div>
                  <CardTitle className="text-base font-semibold text-gray-800">
                    {emp.nome}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <BedDouble size={14} />
                  <span>{(emp.apartamentos as any[])?.length ?? 0} apartamento(s)</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border border-gray-100 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhum empreendimento cadastrado</p>
            <p className="text-gray-400 text-sm mt-1">
              Importe uma planilha Excel para popular os dados
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Building2, BedDouble } from 'lucide-react'

export default async function ApartamentosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: apartamentos } = await supabase
    .from('apartamentos')
    .select('*, empreendimentos(nome)')
    .order('numero')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Apartamentos</h1>
        <p className="text-gray-500 text-sm mt-1">
          {apartamentos?.length ?? 0} unidade(s) registrada(s) no sistema
        </p>
      </div>

      <Card className="border border-gray-100 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <BedDouble size={18} />
            Unidades Registradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100">
                <TableHead className="text-gray-500 font-medium">Unidade</TableHead>
                <TableHead className="text-gray-500 font-medium">Empreendimento</TableHead>
                <TableHead className="text-gray-500 font-medium text-right">Cadastrado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {apartamentos && apartamentos.length > 0 ? (
                apartamentos.map((apt) => (
                  <TableRow key={apt.id} className="border-gray-100 hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-900">{apt.numero}</TableCell>
                    <TableCell className="text-gray-600">{(apt.empreendimentos as any)?.nome}</TableCell>
                    <TableCell className="text-gray-500 text-sm text-right">
                      {new Date(apt.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-400 py-12">
                    Nenhum apartamento encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

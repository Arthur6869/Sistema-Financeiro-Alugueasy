'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, Shield, Eye } from 'lucide-react'
import { CadastrarUsuarioModal } from '@/components/modals/cadastrar-usuario-modal'

interface Profile {
  id: string
  full_name: string
  role: string
  created_at: string
}

interface Props {
  profiles: Profile[]
}

export function UsuariosClient({ profiles: profilesIniciais }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>(profilesIniciais)

  function adicionarUsuario(novo: Profile) {
    setProfiles(prev => [...prev, novo])
  }

  return (
    <Card className="border border-gray-100 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
          <Users size={18} />
          Usuários do Sistema
        </CardTitle>
        <CadastrarUsuarioModal onUsuarioCriado={adicionarUsuario} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-gray-100">
              <TableHead className="text-gray-500 font-medium">Nome</TableHead>
              <TableHead className="text-gray-500 font-medium">Papel</TableHead>
              <TableHead className="text-gray-500 font-medium">Cadastrado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.id} className="border-gray-100 hover:bg-gray-50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: '#193660' }}
                    >
                      {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <span className="font-medium text-gray-800">{profile.full_name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      profile.role === 'admin'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-blue-200 bg-blue-50 text-blue-700'
                    }
                  >
                    {profile.role === 'admin' ? (
                      <><Shield size={10} className="mr-1" />Admin</>
                    ) : (
                      <><Eye size={10} className="mr-1" />Analista</>
                    )}
                  </Badge>
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

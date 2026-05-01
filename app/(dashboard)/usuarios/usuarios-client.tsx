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
import { Users, Shield, Eye, Home } from 'lucide-react'
import { CadastrarUsuarioModal } from '@/components/modals/cadastrar-usuario-modal'
import { CadastrarProprietarioModal } from '@/components/modals/cadastrar-proprietario-modal'
import { GerenciarProprietarioModal } from '@/components/modals/gerenciar-proprietario-modal'

interface Profile {
  id: string
  full_name: string
  role: string
  created_at: string
}

interface Apartamento {
  id: string
  numero: string
  tipo_gestao: string | null
  empreendimentos: { nome: string } | null
}

interface Vinculo {
  proprietario_id: string
  apartamento_id: string
  ativo: boolean
}

interface Props {
  profiles: Profile[]
  apartamentos: Apartamento[]
  vinculos: Vinculo[]
}

export function UsuariosClient({ profiles: profilesIniciais, apartamentos, vinculos: vinculosIniciais }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>(profilesIniciais)
  const [vinculos, setVinculos] = useState<Vinculo[]>(vinculosIniciais)

  function adicionarUsuario(novo: Profile) {
    setProfiles(prev => [...prev, novo])
  }

  function adicionarProprietario(novo: Profile) {
    setProfiles(prev => [...prev, novo])
  }

  const sistemicos = profiles.filter(p => p.role !== 'proprietario')
  const proprietarios = profiles.filter(p => p.role === 'proprietario')

  function getVinculosProprietario(proprietarioId: string) {
    return vinculos.filter(v => v.proprietario_id === proprietarioId)
  }

  function getApartamentosProprietario(proprietarioId: string) {
    const idsAtivos = vinculos
      .filter(v => v.proprietario_id === proprietarioId && v.ativo)
      .map(v => v.apartamento_id)
    return apartamentos.filter(a => idsAtivos.includes(a.id))
  }

  return (
    <div className="space-y-8">
      {/* Usuários internos (admin + analista) */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Users size={18} />
            Usuários Internos
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
              {sistemicos.map((profile) => (
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
              {sistemicos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-gray-400 text-sm py-6">
                    Nenhum usuário interno cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Proprietários */}
      <Card className="border border-gray-100 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Home size={18} />
            Proprietários
            <Badge variant="outline" className="text-xs border-green-200 bg-green-50 text-green-700 ml-1">
              Portal exclusivo
            </Badge>
          </CardTitle>
          <CadastrarProprietarioModal
            apartamentos={apartamentos}
            onCriado={adicionarProprietario}
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-100">
                <TableHead className="text-gray-500 font-medium">Nome</TableHead>
                <TableHead className="text-gray-500 font-medium">Apartamentos</TableHead>
                <TableHead className="text-gray-500 font-medium">Cadastrado em</TableHead>
                <TableHead className="text-gray-500 font-medium w-40">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proprietarios.map((profile) => {
                const aptsVinculados = getApartamentosProprietario(profile.id)
                const vinculosProp = getVinculosProprietario(profile.id)

                return (
                  <TableRow key={profile.id} className="border-gray-100 hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: '#22c55e' }}
                        >
                          {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                        <span className="font-medium text-gray-800">{profile.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {aptsVinculados.length === 0 ? (
                          <span className="text-gray-400 text-xs italic">Nenhum vinculado</span>
                        ) : (
                          aptsVinculados.map(apt => (
                            <Badge
                              key={apt.id}
                              variant="outline"
                              className="text-xs border-gray-200 bg-gray-50 text-gray-600"
                            >
                              {apt.empreendimentos?.nome} {apt.numero}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <GerenciarProprietarioModal
                        proprietarioId={profile.id}
                        proprietarioNome={profile.full_name}
                        todosApartamentos={apartamentos}
                        vinculosIniciais={vinculosProp}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
              {proprietarios.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-400 text-sm py-6">
                    Nenhum proprietário cadastrado. Use o botão acima para adicionar.
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

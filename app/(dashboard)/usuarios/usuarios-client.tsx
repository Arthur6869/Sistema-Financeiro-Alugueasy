'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Users, Shield, Eye, Home, Power, Trash2, X, Sparkles } from 'lucide-react'
import { CadastrarUsuarioModal } from '@/components/modals/cadastrar-usuario-modal'
import { CadastrarOperacionalModal } from '@/components/modals/cadastrar-operacional-modal'
import { RedefinirSenhaModal } from '@/components/modals/redefinir-senha-modal'
import { CadastrarProprietarioModal } from '@/components/modals/cadastrar-proprietario-modal'
import { GerenciarProprietarioModal } from '@/components/modals/gerenciar-proprietario-modal'
import { EnviarExtratoButton } from '@/components/modals/enviar-extrato-button'

interface Profile {
  id: string
  full_name: string
  role: string
  created_at: string
  ativo?: boolean
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

type PresenceMap = Record<string, boolean>

export function UsuariosClient({ profiles: profilesIniciais, apartamentos, vinculos: vinculosIniciais }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>(profilesIniciais)
  const [vinculos, setVinculos] = useState<Vinculo[]>(vinculosIniciais)
  const [presence, setPresence] = useState<PresenceMap>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [confirmarExclusao, setConfirmarExclusao] = useState<Profile | null>(null)

  function adicionarUsuario(novo: Profile) {
    setProfiles(prev => [...prev, { ...novo, ativo: novo.ativo ?? true }])
  }

  function adicionarProprietario(novo: Profile) {
    setProfiles(prev => [...prev, { ...novo, ativo: novo.ativo ?? true }])
  }

  function removerProprietario(id: string) {
    setProfiles(prev => prev.filter(p => p.id !== id))
  }

  function atualizarStatusProprietario(id: string, ativo: boolean) {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ativo } : p))
  }

  function isAtivo(profile: Profile) {
    return profile.ativo !== false
  }

  // Operacional tem bloco próprio — antes de existir, toda conta que não fosse
  // proprietário caía em "Usuários Internos" com o selo de Analista.
  const sistemicos = profiles.filter(p => p.role !== 'proprietario' && p.role !== 'operacional')
  const proprietarios = profiles.filter(p => p.role === 'proprietario')
  const operacionais = profiles.filter(p => p.role === 'operacional')

  const allIds = useMemo(() => profiles.map(p => p.id), [profiles])

  useEffect(() => {
    let alive = true
    let interval: number | null = null

    async function carregarPresenca() {
      try {
        const res = await fetch('/api/presenca', { method: 'GET' })
        const data = await res.json()
        if (!res.ok) return
        if (!alive) return

        const map: PresenceMap = {}
        for (const p of (data.presencas ?? []) as Array<{ user_id: string; online: boolean }>) {
          map[p.user_id] = !!p.online
        }
        setPresence(map)
      } catch {
        // silencioso
      }
    }

    carregarPresenca()
    interval = window.setInterval(carregarPresenca, 15_000)

    return () => {
      alive = false
      if (interval) window.clearInterval(interval)
    }
  }, [allIds.length])

  function StatusDot({ userId }: { userId: string }) {
    const online = !!presence[userId]
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300'}`}
          title={online ? 'Online' : 'Offline'}
        />
        <span className={`text-xs ${online ? 'text-green-700' : 'text-gray-500'}`}>
          {online ? 'Online' : 'Offline'}
        </span>
      </div>
    )
  }

  function getVinculosProprietario(proprietarioId: string) {
    return vinculos.filter(v => v.proprietario_id === proprietarioId)
  }

  function getApartamentosProprietario(proprietarioId: string) {
    const idsAtivos = vinculos
      .filter(v => v.proprietario_id === proprietarioId && v.ativo)
      .map(v => v.apartamento_id)
    return apartamentos.filter(a => idsAtivos.includes(a.id))
  }

  async function handleToggleAtivo(profile: Profile) {
    const atualAtivo = isAtivo(profile)
    const novoAtivo = !atualAtivo
    atualizarStatusProprietario(profile.id, novoAtivo) // otimista
    setLoadingId(profile.id)
    try {
      const res = await fetch(`/api/usuarios/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoAtivo }),
      })
      if (!res.ok) {
        const data = await res.json()
        atualizarStatusProprietario(profile.id, atualAtivo) // reverter
        alert(data.error ?? 'Erro ao atualizar status')
      }
    } catch {
      atualizarStatusProprietario(profile.id, atualAtivo) // reverter
      alert('Erro de conexão')
    } finally {
      setLoadingId(null)
    }
  }

  async function handleExcluir(profile: Profile) {
    setConfirmarExclusao(null)
    setLoadingId(profile.id)
    try {
      const res = await fetch(`/api/usuarios/${profile.id}`, { method: 'DELETE' })
      if (res.ok) {
        removerProprietario(profile.id)
      } else {
        const data = await res.json()
        alert(data.error ?? 'Erro ao excluir usuário')
      }
    } catch {
      alert('Erro de conexão')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <>
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
                  <TableHead className="text-gray-500 font-medium">Status</TableHead>
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
                      <StatusDot userId={profile.id} />
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
                    <TableCell colSpan={4} className="text-center text-gray-400 text-sm py-6">
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
                  <TableHead className="text-gray-500 font-medium">Status</TableHead>
                  <TableHead className="text-gray-500 font-medium">Conta</TableHead>
                  <TableHead className="text-gray-500 font-medium">Apartamentos</TableHead>
                  <TableHead className="text-gray-500 font-medium">Cadastrado em</TableHead>
                  <TableHead className="text-gray-500 font-medium">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proprietarios.map((profile) => {
                  const aptsVinculados = getApartamentosProprietario(profile.id)
                  const vinculosProp = getVinculosProprietario(profile.id)
                  const isLoading = loadingId === profile.id

                  return (
                    <TableRow key={profile.id} className="border-gray-100 hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: isAtivo(profile) ? '#22c55e' : '#9ca3af' }}
                          >
                            {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <span className="font-medium text-gray-800">{profile.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusDot userId={profile.id} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            isAtivo(profile)
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-red-200 bg-red-50 text-red-600'
                          }
                        >
                          {isAtivo(profile) ? 'Ativo' : 'Inativo'}
                        </Badge>
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
                        <div className="flex items-center gap-1 flex-wrap">
                          <GerenciarProprietarioModal
                            proprietarioId={profile.id}
                            proprietarioNome={profile.full_name}
                            todosApartamentos={apartamentos}
                            vinculosIniciais={vinculosProp}
                          />
                          <EnviarExtratoButton
                            proprietarioId={profile.id}
                            proprietarioNome={profile.full_name}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleToggleAtivo(profile)}
                            className={
                              isAtivo(profile)
                                ? 'border-amber-200 text-amber-700 hover:bg-amber-50 gap-1'
                                : 'border-green-200 text-green-700 hover:bg-green-50 gap-1'
                            }
                            title={isAtivo(profile) ? 'Desativar acesso ao portal' : 'Reativar acesso ao portal'}
                          >
                            <Power size={13} />
                            {isAtivo(profile) ? 'Desativar' : 'Reativar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => setConfirmarExclusao(profile)}
                            className="border-red-200 text-red-600 hover:bg-red-50 gap-1"
                            title="Excluir proprietário permanentemente"
                          >
                            <Trash2 size={13} />
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {proprietarios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-400 text-sm py-6">
                      Nenhum proprietário cadastrado. Use o botão acima para adicionar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Equipe operacional (limpeza) */}
        <Card className="border border-gray-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <Sparkles size={18} />
              Equipe Operacional
              <Badge variant="outline" className="text-xs border-teal-200 bg-teal-50 text-teal-700 ml-1">
                Limpeza · checklist
              </Badge>
            </CardTitle>
            <CadastrarOperacionalModal onCriado={adicionarUsuario} />
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-100">
                  <TableHead className="text-gray-500 font-medium">Nome</TableHead>
                  <TableHead className="text-gray-500 font-medium">Status</TableHead>
                  <TableHead className="text-gray-500 font-medium">Conta</TableHead>
                  <TableHead className="text-gray-500 font-medium">Cadastrado em</TableHead>
                  <TableHead className="text-gray-500 font-medium">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operacionais.map((profile) => {
                  const isLoading = loadingId === profile.id
                  return (
                    <TableRow key={profile.id} className="border-gray-100 hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: isAtivo(profile) ? '#0f766e' : '#9ca3af' }}
                          >
                            {profile.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <span className="font-medium text-gray-800">{profile.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusDot userId={profile.id} /></TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={isAtivo(profile) ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-600'}
                        >
                          {isAtivo(profile) ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {new Date(profile.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          <RedefinirSenhaModal userId={profile.id} nome={profile.full_name} />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => handleToggleAtivo(profile)}
                            className={
                              isAtivo(profile)
                                ? 'border-amber-200 text-amber-700 hover:bg-amber-50 gap-1'
                                : 'border-green-200 text-green-700 hover:bg-green-50 gap-1'
                            }
                            title={isAtivo(profile) ? 'Bloquear o acesso' : 'Liberar o acesso'}
                          >
                            <Power size={13} />
                            {isAtivo(profile) ? 'Desativar' : 'Reativar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isLoading}
                            onClick={() => setConfirmarExclusao(profile)}
                            className="border-red-200 text-red-600 hover:bg-red-50 gap-1"
                            title="Excluir conta permanentemente"
                          >
                            <Trash2 size={13} />
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {operacionais.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-400 text-sm py-6">
                      Nenhuma conta operacional. Use o botão acima para cadastrar a equipe de limpeza.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Modal de confirmação de exclusão */}
      {confirmarExclusao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmarExclusao(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 z-10 p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {confirmarExclusao.role === 'operacional' ? 'Excluir conta operacional?' : 'Excluir proprietário?'}
              </h2>
              <button onClick={() => setConfirmarExclusao(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            {confirmarExclusao.role === 'operacional' ? (
              <p className="text-sm text-gray-600 mb-6">
                Você está prestes a excluir permanentemente a conta de{' '}
                <strong>{confirmarExclusao.full_name}</strong>. O login deixa de existir, mas as limpezas
                que essa pessoa registrou continuam no histórico. Para apenas bloquear o acesso, use Desativar.{' '}
                <strong>Esta ação não pode ser desfeita.</strong>
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-6">
                Você está prestes a excluir permanentemente o proprietário{' '}
                <strong>{confirmarExclusao.full_name}</strong>. Esta ação removerá o usuário do
                sistema de autenticação, o perfil e todos os vínculos de apartamentos.{' '}
                <strong>Esta ação não pode ser desfeita.</strong>
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmarExclusao(null)}>
                Cancelar
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => handleExcluir(confirmarExclusao)}
              >
                Excluir permanentemente
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

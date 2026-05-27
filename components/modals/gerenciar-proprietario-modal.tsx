'use client'

import { useEffect, useState } from 'react'
import { Settings, X, Loader2, Home, Building2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Apartamento {
  id: string
  numero: string
  tipo_gestao: string | null
  empreendimentos: { nome: string } | null
}

interface Vinculo {
  apartamento_id: string
  ativo: boolean
}

interface Props {
  proprietarioId: string
  proprietarioNome: string
  todosApartamentos: Apartamento[]
  vinculosIniciais: Vinculo[]
}

export function GerenciarProprietarioModal({
  proprietarioId,
  proprietarioNome,
  todosApartamentos,
  vinculosIniciais,
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingCredenciais, setLoadingCredenciais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [emailOriginal, setEmailOriginal] = useState('')
  const [credenciais, setCredenciais] = useState({ email: '', password: '' })

  // IDs ativos
  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(vinculosIniciais.filter(v => v.ativo).map(v => v.apartamento_id))
  )

  // Agrupar apartamentos por empreendimento
  const porEmpreendimento = todosApartamentos.reduce<Record<string, Apartamento[]>>((acc, apt) => {
    const nome = apt.empreendimentos?.nome ?? 'Sem empreendimento'
    if (!acc[nome]) acc[nome] = []
    acc[nome].push(apt)
    return acc
  }, {})

  function toggleApt(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function fechar() {
    setAberto(false)
    setErro(null)
    setSucesso(false)
    setCredenciais({ email: '', password: '' })
    setEmailOriginal('')
    setMostrarSenha(false)
  }

  useEffect(() => {
    if (!aberto) return

    async function carregarCredenciais() {
      setLoadingCredenciais(true)
      setErro(null)

      try {
        const res = await fetch(`/api/usuarios?user_id=${proprietarioId}`)
        const data = await res.json()
        if (!res.ok) {
          setErro(data.error ?? 'Erro ao carregar credenciais do proprietário')
          return
        }

        const email = data.user?.email ?? ''
        setEmailOriginal(email)
        setCredenciais({ email, password: '' })
      } catch {
        setErro('Erro de conexão ao carregar credenciais.')
      } finally {
        setLoadingCredenciais(false)
      }
    }

    carregarCredenciais()
  }, [aberto, proprietarioId])

  function houveMudancaCredenciais() {
    return credenciais.email.trim() !== emailOriginal.trim() || credenciais.password.trim().length > 0
  }

  async function salvar() {
    setErro(null)
    setSucesso(false)
    setLoading(true)

    try {
      const resAcessos = await fetch('/api/proprietario-apartamentos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proprietario_id: proprietarioId,
          apartamento_ids_ativos: Array.from(selecionados),
        }),
      })

      const dataAcessos = await resAcessos.json()
      if (!resAcessos.ok) {
        setErro(dataAcessos.error ?? 'Erro ao salvar vínculos')
        return
      }

      if (!credenciais.email.trim()) {
        setErro('Email do proprietário é obrigatório.')
        return
      }

      if (credenciais.password.trim() && credenciais.password.trim().length < 6) {
        setErro('A nova senha deve ter no mínimo 6 caracteres.')
        return
      }

      if (houveMudancaCredenciais()) {
        const payload: { user_id: string; email?: string; password?: string } = { user_id: proprietarioId }

        if (credenciais.email.trim() !== emailOriginal.trim()) {
          payload.email = credenciais.email.trim()
        }
        if (credenciais.password.trim()) {
          payload.password = credenciais.password.trim()
        }

        const resCredenciais = await fetch('/api/usuarios', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const dataCredenciais = await resCredenciais.json()
        if (!resCredenciais.ok) {
          setErro(dataCredenciais.error ?? 'Erro ao atualizar credenciais')
          return
        }
      }

      setEmailOriginal(credenciais.email.trim())
      setCredenciais(prev => ({ ...prev, password: '' }))
      setSucesso(true)
      setTimeout(fechar, 1200)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 text-xs border-gray-200 text-gray-600 hover:bg-gray-50"
      >
        <Settings size={13} />
        Gerenciar Acessos
      </Button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={fechar} />

          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 z-10 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Gerenciar Acessos</h2>
                <p className="text-sm text-gray-500 mt-0.5">{proprietarioNome}</p>
              </div>
              <button onClick={fechar} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Corpo — scroll */}
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              <div className="space-y-4 p-4 rounded-lg border border-gray-100 bg-gray-50/60">
                <p className="text-sm font-medium text-gray-700">
                  Credenciais do proprietário
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor={`email-${proprietarioId}`} className="text-sm text-gray-700">Email</Label>
                  <Input
                    id={`email-${proprietarioId}`}
                    type="email"
                    value={credenciais.email}
                    onChange={e => setCredenciais(prev => ({ ...prev, email: e.target.value }))}
                    disabled={loading || loadingCredenciais}
                    className="border-gray-200 bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`senha-${proprietarioId}`} className="text-sm text-gray-700">Nova senha (opcional)</Label>
                  <div className="relative">
                    <Input
                      id={`senha-${proprietarioId}`}
                      type={mostrarSenha ? 'text' : 'password'}
                      placeholder="Deixe em branco para manter a atual"
                      value={credenciais.password}
                      onChange={e => setCredenciais(prev => ({ ...prev, password: e.target.value }))}
                      disabled={loading || loadingCredenciais}
                      className="border-gray-200 bg-white pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Use este campo para redefinir acesso quando necessário.
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-3">
                  Marque os apartamentos que este proprietário pode visualizar no portal.
                </p>

                {Object.entries(porEmpreendimento).map(([empreendimento, apts]) => (
                  <div key={empreendimento}>
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 size={13} className="text-gray-400" />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {empreendimento}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {apts.map(apt => {
                        const marcado = selecionados.has(apt.id)
                        return (
                          <label
                            key={apt.id}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                              marcado
                                ? 'border-[#193660] bg-[#193660]/5'
                                : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => toggleApt(apt.id)}
                              className="rounded border-gray-300 text-[#193660] focus:ring-[#193660]"
                            />
                            <Home size={13} className={marcado ? 'text-[#193660]' : 'text-gray-400'} />
                            <span className={`text-sm ${marcado ? 'font-medium text-[#193660]' : 'text-gray-700'}`}>
                              Apt {apt.numero}
                            </span>
                            {apt.tipo_gestao && (
                              <span className="ml-auto text-xs text-gray-400 uppercase">
                                {apt.tipo_gestao}
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Erro / sucesso */}
            {erro && (
              <div className="mx-6 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {erro}
              </div>
            )}
            {sucesso && (
              <div className="mx-6 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                Acessos e credenciais atualizados com sucesso!
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-gray-100">
              <Button
                variant="outline"
                onClick={fechar}
                disabled={loading}
                className="flex-1 border-gray-200 text-gray-600"
              >
                Cancelar
              </Button>
              <Button
                onClick={salvar}
                disabled={loading || loadingCredenciais}
                className="flex-1 text-white font-semibold"
                style={{ backgroundColor: '#193660' }}
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin mr-2" />Salvando…</>
                ) : loadingCredenciais ? (
                  <><Loader2 size={16} className="animate-spin mr-2" />Carregando…</>
                ) : (
                  'Salvar Acessos'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

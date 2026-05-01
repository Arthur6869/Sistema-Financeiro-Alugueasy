'use client'

import { useState } from 'react'
import { UserPlus, X, Eye, EyeOff, Loader2, Home, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Apartamento {
  id: string
  numero: string
  tipo_gestao: string | null
  empreendimentos: { nome: string } | null
}

interface NovoProprietario {
  id: string
  full_name: string
  email: string
  role: 'proprietario'
  created_at: string
}

interface Props {
  apartamentos: Apartamento[]
  onCriado: (prop: NovoProprietario) => void
}

export function CadastrarProprietarioModal({ apartamentos, onCriado }: Props) {
  const [aberto, setAberto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const [form, setForm] = useState({ full_name: '', email: '', password: '' })

  // Agrupar apartamentos por empreendimento
  const porEmpreendimento = apartamentos.reduce<Record<string, Apartamento[]>>((acc, apt) => {
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

  function resetar() {
    setForm({ full_name: '', email: '', password: '' })
    setSelecionados(new Set())
    setErro(null)
    setMostrarSenha(false)
  }

  function fechar() {
    setAberto(false)
    resetar()
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          role: 'proprietario',
          apartamento_ids: Array.from(selecionados),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErro(data.error ?? 'Erro ao cadastrar proprietário')
        return
      }

      onCriado({ ...data.user, created_at: new Date().toISOString() })
      fechar()
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 text-sm font-semibold text-white"
        style={{ backgroundColor: '#193660' }}
      >
        <UserPlus size={16} />
        Novo Proprietário
      </Button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={fechar} />

          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 z-10 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Cadastrar Proprietário</h2>
                <p className="text-sm text-gray-500 mt-0.5">Acesso restrito ao Portal do Proprietário</p>
              </div>
              <button onClick={fechar} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submeter} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto flex-1 p-6 space-y-5">
                {/* Nome */}
                <div className="space-y-1.5">
                  <Label htmlFor="p_full_name" className="text-sm font-medium text-gray-700">Nome completo</Label>
                  <Input
                    id="p_full_name"
                    type="text"
                    placeholder="Ex: João Silva"
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    required
                    disabled={loading}
                    className="border-gray-200"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="p_email" className="text-sm font-medium text-gray-700">E-mail</Label>
                  <Input
                    id="p_email"
                    type="email"
                    placeholder="proprietario@email.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                    disabled={loading}
                    className="border-gray-200"
                  />
                </div>

                {/* Senha */}
                <div className="space-y-1.5">
                  <Label htmlFor="p_password" className="text-sm font-medium text-gray-700">Senha temporária</Label>
                  <div className="relative">
                    <Input
                      id="p_password"
                      type={mostrarSenha ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required
                      disabled={loading}
                      className="border-gray-200 pr-10"
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
                </div>

                {/* Apartamentos */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Apartamentos vinculados
                    <span className="ml-1 text-xs text-gray-400 font-normal">({selecionados.size} selecionado{selecionados.size !== 1 ? 's' : ''})</span>
                  </Label>

                  {apartamentos.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">Nenhum apartamento cadastrado.</p>
                  ) : (
                    Object.entries(porEmpreendimento).map(([emp, apts]) => (
                      <div key={emp}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Building2 size={12} className="text-gray-400" />
                          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{emp}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {apts.map(apt => {
                            const marcado = selecionados.has(apt.id)
                            return (
                              <label
                                key={apt.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all text-sm ${
                                  marcado
                                    ? 'border-[#193660] bg-[#193660]/5 text-[#193660] font-medium'
                                    : 'border-gray-100 hover:border-gray-200 text-gray-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  onChange={() => toggleApt(apt.id)}
                                  className="rounded border-gray-300 text-[#193660] focus:ring-[#193660]"
                                />
                                <Home size={12} className={marcado ? 'text-[#193660]' : 'text-gray-400'} />
                                Apt {apt.numero}
                                {apt.tipo_gestao && (
                                  <span className="ml-auto text-xs text-gray-400 uppercase">{apt.tipo_gestao}</span>
                                )}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {erro && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {erro}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 p-6 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={fechar}
                  disabled={loading}
                  className="flex-1 border-gray-200 text-gray-600"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 text-white font-semibold"
                  style={{ backgroundColor: '#193660' }}
                >
                  {loading ? (
                    <><Loader2 size={16} className="animate-spin mr-2" />Cadastrando…</>
                  ) : (
                    <><UserPlus size={16} className="mr-2" />Cadastrar</>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

'use client'

import { useState } from 'react'
import { UserPlus, X, Eye, EyeOff, Shield, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface NovoUsuario {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'analista'
  created_at: string
}

interface Props {
  onUsuarioCriado: (usuario: NovoUsuario) => void
}

export function CadastrarUsuarioModal({ onUsuarioCriado }: Props) {
  const [aberto, setAberto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'admin' as 'admin' | 'analista',
  })

  function resetar() {
    setForm({ full_name: '', email: '', password: '', role: 'admin' })
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
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) {
        setErro(data.error ?? 'Erro ao cadastrar usuário')
        return
      }

      onUsuarioCriado({
        ...data.user,
        created_at: new Date().toISOString(),
      })
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
        Novo Usuário
      </Button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={fechar}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Cadastrar Usuário</h2>
                <p className="text-sm text-gray-500 mt-0.5">Novo acesso ao sistema AlugEasy</p>
              </div>
              <button
                onClick={fechar}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submeter} className="space-y-4">
              {/* Nome */}
              <div className="space-y-1.5">
                <Label htmlFor="full_name" className="text-sm font-medium text-gray-700">
                  Nome completo
                </Label>
                <Input
                  id="full_name"
                  type="text"
                  placeholder="Ex: João Silva"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  required
                  disabled={loading}
                  className="border-gray-200 focus:border-[#193660] focus:ring-[#193660]/20"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="joao@alugueasy.com.br"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  disabled={loading}
                  className="border-gray-200 focus:border-[#193660] focus:ring-[#193660]/20"
                />
              </div>

              {/* Senha */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Senha
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    disabled={loading}
                    className="border-gray-200 focus:border-[#193660] focus:ring-[#193660]/20 pr-10"
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

              {/* Role */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Papel no sistema</Label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Admin */}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, role: 'admin' }))}
                    disabled={loading}
                    className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border-2 text-left transition-all ${
                      form.role === 'admin'
                        ? 'border-[#193660] bg-[#193660]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Shield size={14} className={form.role === 'admin' ? 'text-[#193660]' : 'text-gray-400'} />
                      <span className={`text-sm font-semibold ${form.role === 'admin' ? 'text-[#193660]' : 'text-gray-600'}`}>
                        Admin
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 leading-tight">Somente visualização de dados</span>
                  </button>

                  {/* Analista */}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, role: 'analista' }))}
                    disabled={loading}
                    className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border-2 text-left transition-all ${
                      form.role === 'analista'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <UserPlus size={14} className={form.role === 'analista' ? 'text-blue-600' : 'text-gray-400'} />
                      <span className={`text-sm font-semibold ${form.role === 'analista' ? 'text-blue-600' : 'text-gray-600'}`}>
                        Analista
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 leading-tight">Acesso total ao sistema</span>
                  </button>
                </div>
              </div>

              {/* Erro */}
              {erro && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {erro}
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={fechar}
                  disabled={loading}
                  className="flex-1 border-gray-200 text-gray-600 hover:bg-gray-50"
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

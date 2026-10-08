'use client'

import { useState } from 'react'
import { Sparkles, X, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface NovoOperacional {
  id: string
  full_name: string
  email: string
  role: 'operacional'
  created_at: string
}

/**
 * Cadastro de conta da equipe operacional (limpeza).
 * Separado do modal de usuários internos de propósito: o papel é fixo em
 * 'operacional', então não há como criar por engano um analista daqui.
 */
export function CadastrarOperacionalModal({ onCriado }: { onCriado: (u: NovoOperacional) => void }) {
  const [aberto, setAberto] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })

  function fechar() {
    setAberto(false)
    setForm({ full_name: '', email: '', password: '' })
    setErro(null)
    setMostrarSenha(false)
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: 'operacional' }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao cadastrar'); return }
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
        style={{ backgroundColor: '#0f766e' }}
      >
        <UserPlus size={16} />
        Nova conta operacional
      </Button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={fechar} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles size={18} className="text-[#0f766e]" />
                  Conta operacional
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">Acesso da equipe de limpeza ao checklist</p>
              </div>
              <button onClick={fechar} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="mb-4 rounded-lg bg-teal-50 border border-teal-200 p-3 text-xs text-teal-800 leading-relaxed">
              Esta pessoa entra por <strong>/login-operacional</strong> (ou pelo app) e vê só a lista de imóveis e o
              checklist. Não tem acesso a valores, reservas nem proprietários.
            </div>

            <form onSubmit={submeter} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="op_nome" className="text-sm font-medium text-gray-700">Nome completo</Label>
                <Input id="op_nome" value={form.full_name} required disabled={loading} placeholder="Ex: Maria Souza"
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="op_email" className="text-sm font-medium text-gray-700">E-mail de login</Label>
                <Input id="op_email" type="email" value={form.email} required disabled={loading} placeholder="maria@email.com"
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="op_senha" className="text-sm font-medium text-gray-700">Senha</Label>
                <div className="relative">
                  <Input id="op_senha" type={mostrarSenha ? 'text' : 'password'} value={form.password} required disabled={loading}
                    placeholder="Mínimo 6 caracteres" className="pr-10"
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  <button type="button" tabIndex={-1} onClick={() => setMostrarSenha(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {erro && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{erro}</div>}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={fechar} disabled={loading} className="flex-1">Cancelar</Button>
                <Button type="submit" disabled={loading} className="flex-1 text-white font-semibold" style={{ backgroundColor: '#0f766e' }}>
                  {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Cadastrando…</> : 'Cadastrar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

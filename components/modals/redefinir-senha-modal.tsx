'use client'

import { useState } from 'react'
import { KeyRound, X, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Redefine a senha de uma conta operacional (usa PATCH /api/usuarios, que só
 * aceita proprietário e operacional — nunca analista/admin).
 */
export function RedefinirSenhaModal({ userId, nome }: { userId: string; nome: string }) {
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState('')
  const [mostrar, setMostrar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function fechar() { setAberto(false); setSenha(''); setErro(null); setMostrar(false) }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    if (senha.trim().length < 6) { setErro('A senha precisa ter no mínimo 6 caracteres'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, password: senha }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao redefinir'); return }
      toast.success(`Senha de ${nome.split(' ')[0]} redefinida`)
      fechar()
    } catch {
      setErro('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setAberto(true)} className="gap-1 border-gray-200 text-gray-700" title="Redefinir senha">
        <KeyRound size={13} />
        Senha
      </Button>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={fechar} />
          <form onSubmit={salvar} className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 z-10 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Redefinir senha</h2>
                <p className="text-sm text-gray-500">{nome}</p>
              </div>
              <button type="button" onClick={fechar} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="relative">
              <Input type={mostrar ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)}
                placeholder="Nova senha (mínimo 6)" disabled={loading} className="pr-10" autoFocus />
              <button type="button" tabIndex={-1} onClick={() => setMostrar(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {erro && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{erro}</div>}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={fechar} disabled={loading} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={loading} className="flex-1 text-white" style={{ backgroundColor: '#193660' }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

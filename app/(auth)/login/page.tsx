'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [systemError, setSystemError] = useState('')

  // Validar variáveis de ambiente no mounting
  useEffect(() => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!url || !key) {
        setSystemError('⚠️ Configuração incompleta: Variáveis de ambiente Supabase não encontradas')
        console.error('Supabase URL:', url ? 'OK' : 'FALTA')
        console.error('Supabase Key:', key ? 'OK' : 'FALTA')
        return
      }

      if (url.includes('undefined') || key.includes('undefined')) {
        setSystemError('⚠️ Variáveis de ambiente não carregadas corretamente')
        return
      }

      const client = createClient()
      setSupabase(client)
      setSystemError('')
    } catch (err: any) {
      setSystemError(`Erro ao inicializar: ${err.message}`)
      console.error('Erro na inicialização do Supabase:', err)
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!supabase) {
      setError('Sistema não inicializado. Recarregue a página.')
      setLoading(false)
      return
    }

    if (!email || !password) {
      setError('Preenchha email e senha')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        console.error('Erro de login:', error)
        setError(error.message || 'Email ou senha incorretos. Verifique suas credenciais.')
        setLoading(false)
        return
      }

      // Aguardar um pouco antes de redirecionar para garantir que o cookie foi setado
      await new Promise(resolve => setTimeout(resolve, 500))

      router.push('/')
      router.refresh()
    } catch (err: any) {
      console.error('Exceção no login:', err)
      setError(`Erro: ${err.message || 'Falha na autenticação. Verifique sua conexão.'}`)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Painel esquerdo — azul AlugEasy */}
      <div
        className="hidden lg:flex w-1/2 flex-col items-center justify-center p-12"
        style={{ backgroundColor: '#193660' }}
      >
        <div className="flex flex-col items-center gap-6 text-white">
          <Image
            src="/logo-alugueasy.png"
            alt="AlugEasy"
            width={220}
            height={180}
            priority
            className="object-contain"
          />
          <div className="text-center mt-4">
            <p className="text-white/70 text-lg font-light">
              Gestão financeira de imóveis por temporada
            </p>
          </div>
        </div>

        <div className="mt-auto text-white/40 text-sm">
          © {new Date().getFullYear()} AlugEasy — Todos os direitos reservados
        </div>
      </div>

      {/* Painel direito — branco */}
      <div className="flex-1 flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <Image
              src="/logo-alugueasy.png"
              alt="AlugEasy"
              width={150}
              height={120}
              className="object-contain"
              style={{ filter: 'hue-rotate(0deg)' }}
            />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Bem-vindo de volta</h1>
            <p className="text-gray-500 mt-1 text-sm">
              Acesso restrito ao sistema financeiro AlugEasy
            </p>
          </div>

          {/* Erro de Sistema */}
          {systemError && (
            <div className="mb-5 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-lg flex gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>{systemError}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700 font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading || !supabase}
                required
                autoComplete="email"
                className="h-11 border-gray-200 focus-visible:ring-[#193660]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-gray-700 font-medium">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || !supabase}
                  required
                  autoComplete="current-password"
                  className="h-11 pr-10 border-gray-200 focus-visible:ring-[#193660]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || !supabase}
              className="w-full h-11 text-white font-semibold text-base"
              style={{ backgroundColor: '#193660' }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            🔒 Acesso autorizado apenas para usuários cadastrados
          </p>
        </div>
      </div>
    </div>
  )
}

'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Home } from 'lucide-react'
import {
  LoginShell, LoginCabecalho, CampoEmail, CampoSenha, Alerta, AvisoDaUrl, BotaoEntrar,
} from '@/components/login/login-shell'
import { VisualProprietario } from '@/components/login/login-visuais'

const RESUMO = 'Acesse sua prestação de contas mensal, extrato do apartamento e relatórios em PDF com um clique.'

// O proxy.ts encerra a sessão de proprietário desativado e manda para cá com ?erro=
const AVISOS_URL = {
  conta_desativada: 'Sua conta está desativada. Fale com a equipe AlugEasy.',
}

export default function LoginProprietarioPage() {
  const router = useRouter()

  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sucesso,  setSucesso]  = useState(false)
  const [error,    setError]    = useState('')
  const [portalErrado, setPortalErrado] = useState(false)
  const [irOperacional, setIrOperacional] = useState(false)
  const [systemError, setSystemError] = useState('')

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (!active) return
      try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (!url || !key || url.includes('undefined') || key.includes('undefined')) {
          setSystemError('⚠️ Configuração incompleta. Variáveis de ambiente não encontradas.')
          return
        }
        setSupabase(createClient())
      } catch (err) {
        setSystemError(`Erro ao inicializar: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
    return () => { active = false }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setPortalErrado(false)
    setIrOperacional(false)

    if (!supabase) {
      setError('Sistema não inicializado. Recarregue a página.')
      setLoading(false)
      return
    }

    if (!email || !password) {
      setError('Preencha email e senha.')
      setLoading(false)
      return
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError('Email ou senha incorretos. Verifique seus dados.')
        setLoading(false)
        return
      }

      // Este portal é exclusivo de proprietários: contas da equipe interna
      // (analista/admin) devem entrar pelo acesso interno.
      const userId = authData.user?.id
      const { data: profile } = userId
        ? await supabase.from('profiles').select('role').eq('id', userId).single()
        : { data: null }

      if (profile?.role !== 'proprietario') {
        await supabase.auth.signOut()
        if (profile?.role === 'analista' || profile?.role === 'admin') {
          setPortalErrado(true)
          setError('Este portal é exclusivo para proprietários. Membros da equipe devem entrar pelo acesso interno.')
        } else if (profile?.role === 'operacional') {
          setIrOperacional(true)
          setError('Este portal é exclusivo para proprietários. A equipe de limpeza entra pelo acesso operacional.')
        } else {
          setError('Sua conta não tem acesso ao portal. Fale com a equipe AlugEasy.')
        }
        setLoading(false)
        return
      }

      setSucesso(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      router.push('/proprietario/bem-vindo')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(`Erro: ${msg || 'Falha na autenticação. Verifique sua conexão.'}`)
      setLoading(false)
    }
  }

  return (
    <LoginShell
      tom="green"
      selo="Portal do Proprietário"
      titulo={<>Acompanhe seu imóvel com <em>transparência e clareza</em></>}
      resumo={RESUMO}
      visual={<VisualProprietario />}
      erro={error}
      sucesso={sucesso}
    >
      <LoginCabecalho
        icon={Home}
        selo="Portal do proprietário"
        titulo="Bem-vindo"
        sub="Acesse sua área exclusiva de prestação de contas"
      />

      {systemError && <Alerta tipo="warn">{systemError}</Alerta>}

      {/* No desktop este texto já está no painel ao lado; aqui ele cobre o celular */}
      <Alerta tipo="info" soEstreito>{RESUMO}</Alerta>

      <form onSubmit={handleLogin} className="lg-form">
        <CampoEmail
          id="prop-email" label="Email cadastrado" placeholder="seu@email.com"
          value={email} onChange={setEmail} disabled={loading || !supabase}
        />
        <CampoSenha
          id="prop-password" value={password} onChange={setPassword}
          disabled={loading || !supabase} carregando={loading}
        />

        {error ? (
          <Alerta tipo="err">
            {error}
            {portalErrado && (
              <>
                {' '}
                <Link href="/login">Ir para o acesso interno →</Link>
              </>
            )}
            {irOperacional && (
              <>
                {' '}
                <Link href="/login-operacional">Ir para o acesso operacional →</Link>
              </>
            )}
          </Alerta>
        ) : (
          <Suspense fallback={null}>
            <AvisoDaUrl mensagens={AVISOS_URL} />
          </Suspense>
        )}

        <BotaoEntrar
          rotulo="Acessar meu portal" rotuloCarregando="Acessando…"
          carregando={loading} sucesso={sucesso} disabled={loading || !supabase}
        />
      </form>

      <div className="lg-ou" data-in>ou</div>

      <div className="lg-outros" data-in>
        <p>
          Faz parte da equipe?{' '}
          <Link href="/login" className="is-navy">Acesso interno →</Link>
        </p>
      </div>

      <p className="lg-nota" data-in>Dúvidas? Entre em contato com a equipe AlugEasy</p>
    </LoginShell>
  )
}

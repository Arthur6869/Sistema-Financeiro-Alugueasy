'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Sparkles } from 'lucide-react'
import {
  LoginShell, LoginCabecalho, CampoEmail, CampoSenha, Alerta, AvisoDaUrl, BotaoEntrar,
} from '@/components/login/login-shell'
import { VisualOperacional, PASSOS_LIMPEZA } from '@/components/login/login-visuais'

// O proxy.ts encerra a sessão de operacional desativado e manda para cá com ?erro=
const AVISOS_URL = {
  conta_desativada: 'Sua conta está desativada. Fale com a equipe AlugEasy.',
}

export default function LoginOperacionalPage() {
  const router = useRouter()

  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sucesso,  setSucesso]  = useState(false)
  const [error,    setError]    = useState('')
  const [portalErrado, setPortalErrado] = useState<'interno' | 'proprietario' | null>(null)
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
    setPortalErrado(null)

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

      // Este acesso é exclusivo da equipe operacional (limpeza). Outras contas
      // são desconectadas e orientadas para a porta certa.
      const userId = authData.user?.id
      const { data: profile } = userId
        ? await supabase.from('profiles').select('role, ativo').eq('id', userId).single()
        : { data: null }

      if (profile?.role !== 'operacional' || profile?.ativo === false) {
        await supabase.auth.signOut()
        if (profile?.role === 'analista' || profile?.role === 'admin') {
          setPortalErrado('interno')
          setError('Este acesso é da equipe de limpeza. Membros da equipe interna entram pelo acesso interno.')
        } else if (profile?.role === 'proprietario') {
          setPortalErrado('proprietario')
          setError('Este acesso é da equipe de limpeza. Proprietários entram pelo portal do proprietário.')
        } else if (profile?.role === 'operacional') {
          setError('Sua conta está desativada. Fale com a equipe AlugEasy.')
        } else {
          setError('Sua conta não tem acesso. Fale com a equipe AlugEasy.')
        }
        setLoading(false)
        return
      }

      setSucesso(true)
      router.push('/operacional')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(`Erro: ${msg || 'Falha na autenticação. Verifique sua conexão.'}`)
      setLoading(false)
    }
  }

  return (
    <LoginShell
      tom="teal"
      selo="Acesso operacional"
      titulo={<>Registre cada limpeza com o <em>checklist do imóvel</em></>}
      resumo="A AlugEasy é avisada na hora."
      visual={<VisualOperacional />}
      erro={error}
      sucesso={sucesso}
    >
      <LoginCabecalho
        icon={Sparkles}
        selo="Equipe de limpeza"
        titulo="Bom trabalho!"
        sub="Entre com seu login para registrar as limpezas"
      />

      {systemError && <Alerta tipo="warn">{systemError}</Alerta>}

      <form onSubmit={handleLogin} className="lg-form">
        <CampoEmail
          id="op-email" label="Email" placeholder="seu@email.com"
          value={email} onChange={setEmail} disabled={loading || !supabase}
        />
        <CampoSenha
          id="op-password" value={password} onChange={setPassword}
          disabled={loading || !supabase} carregando={loading}
        />

        {error ? (
          <Alerta tipo="err">
            {error}
            {portalErrado && (
              <>
                {' '}
                <Link href={portalErrado === 'interno' ? '/login' : '/login-proprietario'}>
                  {portalErrado === 'interno' ? 'Ir para o acesso interno →' : 'Ir para o portal do proprietário →'}
                </Link>
              </>
            )}
          </Alerta>
        ) : (
          // Só este pedaço lê a URL (useSearchParams exige Suspense); o resto da
          // página continua pré-renderizado em vez de esperar o JS.
          <Suspense fallback={null}>
            <AvisoDaUrl mensagens={AVISOS_URL} />
          </Suspense>
        )}

        <BotaoEntrar
          rotulo="Entrar" rotuloCarregando="Entrando…"
          carregando={loading} sucesso={sucesso} disabled={loading || !supabase}
        />
      </form>

      <p className="lg-nota" data-in>
        O login é criado pela equipe AlugEasy. Esqueceu a senha? Fale com o escritório.
      </p>

      {/* No celular o painel com a demonstração some; as etapas aparecem aqui, resumidas */}
      <ol className="lg-mini-passos" data-in>
        {PASSOS_LIMPEZA.map(p => (
          <li key={p.label}>
            <p.icon size={17} aria-hidden="true" />
            {p.label}
          </li>
        ))}
      </ol>
    </LoginShell>
  )
}

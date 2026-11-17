'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, Shield, Lock, type LucideIcon } from 'lucide-react'
import {
  LoginShell, LoginCabecalho, CampoEmail, CampoSenha, Alerta, AvisoDaUrl, BotaoEntrar,
} from '@/components/login/login-shell'
import { VisualInterno } from '@/components/login/login-visuais'

type Role = 'analista' | 'admin'

// O perfil escolhido aqui NÃO entra no login: quem define o acesso é a conta
// (profiles.role, checado em handleLogin e no proxy.ts). A seleção só troca a
// prévia do painel e o texto explicativo abaixo dos botões.
const PERFIS: { id: Role; icon: LucideIcon; nome: string; desc: string; nota: string }[] = [
  {
    id: 'analista', icon: BarChart3, nome: 'Analista', desc: 'Acesso completo',
    nota: 'Analista vê tudo e também importa, lança e edita.',
  },
  {
    id: 'admin', icon: Shield, nome: 'Admin', desc: 'Somente leitura',
    nota: 'Admin acompanha dashboards e relatórios, sem editar.',
  },
]

// Motivos que o proxy.ts / layout do dashboard mandam em ?erro= ao devolver alguém para cá
const AVISOS_URL = {
  sem_acesso: 'Sua conta não tem acesso ao sistema. Fale com a equipe AlugEasy.',
}

export default function LoginPage() {
  const router = useRouter()

  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)
  const [role,     setRole]     = useState<Role>('analista')
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
          setSystemError('⚠️ Configuração incompleta. Variáveis de ambiente Supabase não encontradas.')
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
        // O Supabase responde em inglês. O caso do dia a dia (credencial errada)
        // sai em português; os demais (limite de tentativas etc.) seguem como vêm.
        setError(
          authError.message === 'Invalid login credentials'
            ? 'Email ou senha incorretos. Verifique suas credenciais.'
            : authError.message || 'Email ou senha incorretos. Verifique suas credenciais.',
        )
        setLoading(false)
        return
      }

      // Este formulário é exclusivo da equipe interna: contas de proprietário
      // devem entrar pelo portal próprio. Sem esta checagem a sessão é criada
      // e o proxy redireciona para o portal, "aceitando" o login no lugar errado.
      const userId = authData.user?.id
      const { data: profile } = userId
        ? await supabase.from('profiles').select('role').eq('id', userId).single()
        : { data: null }

      if (profile?.role !== 'analista' && profile?.role !== 'admin') {
        await supabase.auth.signOut()
        if (profile?.role === 'proprietario') {
          setPortalErrado(true)
          setError('Este acesso é exclusivo da equipe interna. Para entrar na sua conta, use o Portal do Proprietário.')
        } else if (profile?.role === 'operacional') {
          setIrOperacional(true)
          setError('Este acesso é exclusivo da equipe interna. A equipe de limpeza entra pelo acesso operacional.')
        } else {
          setError('Sua conta não tem acesso ao sistema. Fale com a equipe AlugEasy.')
        }
        setLoading(false)
        return
      }

      setSucesso(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      router.push('/')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(`Erro: ${msg || 'Falha na autenticação. Verifique sua conexão.'}`)
      setLoading(false)
    }
  }

  const perfilAtual = PERFIS.find(p => p.id === role) ?? PERFIS[0]

  return (
    <LoginShell
      tom="navy"
      selo="Sistema financeiro interno"
      titulo={<>Gestão financeira de <em>imóveis por temporada</em></>}
      resumo="Centralize receitas, custos e repasses em uma plataforma única."
      visual={<VisualInterno perfil={role} />}
      erro={error}
      sucesso={sucesso}
    >
      <LoginCabecalho
        icon={Lock}
        selo="Equipe interna"
        titulo={<>Bem-vindo <em>de volta</em></>}
        sub="Entre com sua conta para acessar o sistema"
      />

      {systemError && <Alerta tipo="warn">{systemError}</Alerta>}

      <div className="lg-perfis" role="group" aria-label="Perfis de acesso" data-in>
        {PERFIS.map(p => (
          <button
            key={p.id} type="button" className="lg-perfil"
            aria-pressed={role === p.id} onClick={() => setRole(p.id)}
          >
            <span className="lg-perfil-ico"><p.icon size={18} aria-hidden="true" /></span>
            <span>
              <b>{p.nome}</b>
              <small>{p.desc}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="lg-perfis-nota" aria-live="polite" data-in>
        {perfilAtual.nota} O perfil vem da sua conta, não desta seleção.
      </p>

      <form onSubmit={handleLogin} className="lg-form">
        <CampoEmail
          id="email" label="Email corporativo" placeholder="usuario@alugueasy.com.br"
          value={email} onChange={setEmail} disabled={loading || !supabase}
        />
        <CampoSenha
          id="password" value={password} onChange={setPassword}
          disabled={loading || !supabase} carregando={loading}
        />

        {error ? (
          <Alerta tipo="err">
            {error}
            {portalErrado && (
              <>
                {' '}
                <Link href="/login-proprietario">Ir para o Portal do Proprietário →</Link>
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
          rotulo="Entrar no sistema" rotuloCarregando="Entrando…"
          carregando={loading} sucesso={sucesso} disabled={loading || !supabase}
        />
      </form>

      <div className="lg-outros" data-in>
        <p>
          É proprietário?{' '}
          <Link href="/login-proprietario" className="is-green">Acesse seu portal →</Link>
        </p>
        <p>
          Equipe de limpeza?{' '}
          <Link href="/login-operacional" className="is-teal">Acesso operacional →</Link>
        </p>
      </div>

      <p className="lg-nota" data-in>
        <Lock size={12} aria-hidden="true" />
        Acesso restrito — apenas usuários cadastrados
      </p>
    </LoginShell>
  )
}

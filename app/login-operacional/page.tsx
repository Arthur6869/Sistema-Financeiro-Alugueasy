'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, AlertCircle, ArrowLeft, Sparkles, ClipboardCheck, Building2, Mail } from 'lucide-react'

function LogoIcon({ size = 40, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 4L4 18H9.5V35H16.5V27H23.5V35H30.5V18H36L20 4Z" fill={color} opacity=".9" />
    </svg>
  )
}

const PASSOS = [
  { icon: Building2,      label: 'Escolha o imóvel' },
  { icon: ClipboardCheck, label: 'Marque o checklist' },
  { icon: Sparkles,       label: 'Finalize a limpeza' },
  { icon: Mail,           label: 'A AlugEasy é avisada' },
]

const COR = '#0f766e'

function LoginOperacionalForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [portalErrado, setPortalErrado] = useState<'interno' | 'proprietario' | null>(null)
  const [systemError, setSystemError] = useState('')

  const erroUrl = searchParams.get('erro')
  const avisoUrl = erroUrl === 'conta_desativada'
    ? 'Sua conta está desativada. Fale com a equipe AlugEasy.'
    : ''

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

      router.push('/operacional')
      router.refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(`Erro: ${msg || 'Falha na autenticação. Verifique sua conexão.'}`)
      setLoading(false)
    }
  }

  const erroExibido = error || avisoUrl

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .op-wrap { min-height: 100vh; display: flex; font-family: 'DM Sans', sans-serif; }
        .op-side {
          width: 420px; flex-shrink: 0; background: #134e4a;
          display: flex; flex-direction: column; align-items: center; justify-content: space-between;
          padding: 48px 40px; position: relative; overflow: hidden;
        }
        .op-side::before { content:''; position:absolute; width:300px; height:300px; border-radius:50%; background:rgba(255,255,255,.03); top:-80px; right:-100px; }
        .op-side-content { text-align: center; position: relative; z-index: 1; width: 100%; }
        .op-brand { color: #fff; font-size: 16px; font-weight: 700; letter-spacing: .1em; margin-top: 12px; }
        .op-label {
          display: inline-block; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.15);
          border-radius: 100px; padding: 4px 14px; font-size: 11px; font-weight: 600; letter-spacing: .06em;
          color: rgba(255,255,255,.75); margin-top: 8px;
        }
        .op-passos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 32px; }
        .op-passo {
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 12px;
          padding: 14px 12px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
        }
        .op-passo span { font-size: 11px; color: rgba(255,255,255,.55); line-height: 1.4; }
        .op-copy { color: rgba(255,255,255,.2); font-size: 11px; position: relative; z-index: 1; }
        .op-panel { flex: 1; display: flex; align-items: center; justify-content: center; background: #fff; padding: 40px 32px; }
        .op-inner { width: 100%; max-width: 400px; }
        .op-tag {
          display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700;
          letter-spacing: .08em; text-transform: uppercase; padding: 4px 10px; border-radius: 100px;
          margin-bottom: 18px; background: rgba(15,118,110,.08); color: ${COR};
        }
        .op-field { margin-bottom: 16px; }
        .op-field label { font-size: 12px; font-weight: 500; color: #5a6a82; display: block; margin-bottom: 5px; }
        .op-input {
          width: 100%; padding: 13px 14px; border: 1px solid #e2e8f0; border-radius: 10px;
          font-size: 16px; font-family: 'DM Sans', sans-serif; outline: none; background: #fafafa;
          transition: border-color .15s, box-shadow .15s, background .15s; color: #0f1a2e;
        }
        .op-input:focus { border-color: ${COR}; box-shadow: 0 0 0 3px rgba(15,118,110,.12); background: #fff; }
        .op-input-wrap { position: relative; }
        .op-pw {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #94a3b8; padding: 4px; display: flex; align-items: center;
        }
        .op-submit {
          width: 100%; padding: 15px; background: ${COR}; color: #fff; border: none; border-radius: 10px;
          font-size: 15px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity .15s; margin-top: 4px;
        }
        .op-submit:hover:not(:disabled) { opacity: .9; }
        .op-submit:disabled { opacity: .6; cursor: not-allowed; }
        .op-alert { border-radius: 10px; padding: 12px 14px; display: flex; gap: 8px; align-items: flex-start; font-size: 13px; margin-bottom: 14px; }
        .op-alert-err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
        .op-alert-warn { background: #fefce8; border: 1px solid #fde68a; color: #92400e; }
        .op-back { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #94a3b8; text-decoration: none; margin-bottom: 20px; }
        .op-back:hover { color: ${COR}; }
        @media (max-width: 768px) {
          .op-side { display: none; }
          .op-panel { padding: 32px 20px; align-items: flex-start; padding-top: 48px; }
        }
      `}</style>

      <div className="op-wrap">
        <div className="op-side">
          <div className="op-side-content">
            <LogoIcon size={48} color="#fff" />
            <div className="op-brand">ALUGUEASY</div>
            <div className="op-label">Acesso operacional</div>
            <div className="op-passos">
              {PASSOS.map(p => (
                <div key={p.label} className="op-passo">
                  <p.icon size={18} color="rgba(255,255,255,0.55)" />
                  <span>{p.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="op-copy">© {new Date().getFullYear()} AlugEasy</div>
        </div>

        <div className="op-panel">
          <div className="op-inner">
            <Link href="/home" className="op-back">
              <ArrowLeft size={13} />
              Voltar para a página inicial
            </Link>

            <div className="op-tag">
              <Sparkles size={10} />
              Equipe de limpeza
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f1a2e', marginBottom: 4 }}>Bom trabalho!</h1>
            <p style={{ fontSize: 13, color: '#5a6a82', marginBottom: 22 }}>Entre com seu login para registrar as limpezas</p>

            {systemError && (
              <div className="op-alert op-alert-warn">
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{systemError}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="op-field">
                <label htmlFor="op-email">Email</label>
                <input
                  id="op-email" type="email" className="op-input" placeholder="seu@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  disabled={loading || !supabase} required autoComplete="email" inputMode="email"
                />
              </div>

              <div className="op-field">
                <label htmlFor="op-password">Senha</label>
                <div className="op-input-wrap">
                  <input
                    id="op-password" type={showPw ? 'text' : 'password'} className="op-input" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    disabled={loading || !supabase} required autoComplete="current-password"
                    style={{ paddingRight: 46 }}
                  />
                  <button type="button" className="op-pw" onClick={() => setShowPw(v => !v)} disabled={loading} tabIndex={-1} aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}>
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {erroExibido && (
                <div className="op-alert op-alert-err">
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    {erroExibido}
                    {portalErrado && (
                      <>
                        {' '}
                        <Link
                          href={portalErrado === 'interno' ? '/login' : '/login-proprietario'}
                          style={{ fontWeight: 600, color: '#0f2647', textDecoration: 'underline' }}
                        >
                          {portalErrado === 'interno' ? 'Ir para o acesso interno →' : 'Ir para o portal do proprietário →'}
                        </Link>
                      </>
                    )}
                  </span>
                </div>
              )}

              <button type="submit" className="op-submit" disabled={loading || !supabase}>
                {loading ? (<><Loader2 size={16} className="animate-spin" /> Entrando…</>) : 'Entrar'}
              </button>
            </form>

            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 22, lineHeight: 1.5 }}>
              O login é criado pela equipe AlugEasy. Esqueceu a senha? Fale com o escritório.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default function LoginOperacionalPage() {
  return (
    <Suspense fallback={null}>
      <LoginOperacionalForm />
    </Suspense>
  )
}

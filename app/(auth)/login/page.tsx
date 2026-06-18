'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, AlertCircle, BarChart2, Shield, Lock, ArrowLeft } from 'lucide-react'

type Role = 'analista' | 'admin'

function LogoIcon({ size = 40, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 4L4 18H9.5V35H16.5V27H23.5V35H30.5V18H36L20 4Z" fill={color} opacity=".9" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()

  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)
  const [role,     setRole]     = useState<Role>('analista')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [systemError, setSystemError] = useState('')

  useEffect(() => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!url || !key || url.includes('undefined') || key.includes('undefined')) {
        setSystemError('⚠️ Configuração incompleta. Variáveis de ambiente Supabase não encontradas.')
        return
      }
      setSupabase(createClient())
    } catch (err: any) {
      setSystemError(`Erro ao inicializar: ${err.message}`)
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
      setError('Preencha email e senha.')
      setLoading(false)
      return
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError(authError.message || 'Email ou senha incorretos. Verifique suas credenciais.')
        setLoading(false)
        return
      }

      await new Promise(resolve => setTimeout(resolve, 500))
      router.push('/')
      router.refresh()
    } catch (err: any) {
      setError(`Erro: ${err.message || 'Falha na autenticação. Verifique sua conexão.'}`)
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .ae-login-wrap { min-height: 100vh; display: flex; font-family: 'DM Sans', sans-serif; }

        .ae-side {
          width: 420px; flex-shrink: 0; background: #0f2647;
          display: flex; flex-direction: column; align-items: center; justify-content: space-between;
          padding: 48px 40px; position: relative; overflow: hidden;
        }
        .ae-side::before { content:''; position:absolute; width:300px; height:300px; border-radius:50%; background:rgba(255,255,255,.03); top:-80px; right:-100px; }
        .ae-side::after  { content:''; position:absolute; width:200px; height:200px; border-radius:50%; background:rgba(255,255,255,.03); bottom:60px; left:-70px; }
        .ae-side-content { text-align: center; position: relative; z-index: 1; }
        .ae-brand-name { color: #fff; font-size: 16px; font-weight: 700; letter-spacing: .1em; margin-top: 12px; }
        .ae-tagline { color: rgba(255,255,255,.45); font-size: 13px; line-height: 1.6; margin-top: 8px; }
        .ae-features { margin-top: 40px; display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 260px; }
        .ae-feature { display: flex; align-items: center; gap: 10px; }
        .ae-feature-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.3); flex-shrink: 0; }
        .ae-feature span { font-size: 12px; color: rgba(255,255,255,.5); }
        .ae-copy { color: rgba(255,255,255,.2); font-size: 11px; position: relative; z-index: 1; }

        .ae-form-panel { flex: 1; display: flex; align-items: center; justify-content: center; background: #fff; padding: 40px 32px; }
        .ae-form-inner { width: 100%; max-width: 400px; }

        .ae-back-link { display:inline-flex; align-items:center; gap:5px; font-size:12px; color:#94a3b8; text-decoration:none; margin-bottom:20px; transition: color .15s; }
        .ae-back-link:hover { color: #0f2647; }

        .ae-portal-tag {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px; font-weight: 700; letter-spacing: .08em;
          text-transform: uppercase; padding: 4px 10px; border-radius: 100px; margin-bottom: 18px;
          background: rgba(25,54,96,.08); color: #193660;
        }

        .ae-role-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 22px; }
        .ae-role-chip {
          padding: 12px 8px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: #fafafa;
          cursor: pointer; text-align: center; transition: all .15s;
          display: flex; flex-direction: column; align-items: center; gap: 5px;
        }
        .ae-role-chip:hover { border-color: #193660; background: rgba(25,54,96,.03); }
        .ae-role-chip.active { border-color: #0f2647; background: rgba(15,38,71,.06); }
        .ae-role-chip-icon { color: #94a3b8; }
        .ae-role-chip.active .ae-role-chip-icon { color: #0f2647; }
        .ae-role-chip-name { font-size: 13px; font-weight: 600; color: #0f1a2e; }
        .ae-role-chip-desc { font-size: 10px; color: #5a6a82; }

        .ae-field { margin-bottom: 16px; }
        .ae-field label { font-size: 12px; font-weight: 500; color: #5a6a82; display: block; margin-bottom: 5px; }
        .ae-input {
          width: 100%; padding: 11px 14px; border: 1px solid #e2e8f0; border-radius: 10px;
          font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; background: #fafafa;
          transition: border-color .15s, box-shadow .15s, background .15s; color: #0f1a2e;
        }
        .ae-input:focus { border-color: #0f2647; box-shadow: 0 0 0 3px rgba(15,38,71,.1); background: #fff; }
        .ae-input-wrap { position: relative; }
        .ae-pw-toggle {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #94a3b8; padding: 0; display: flex; align-items: center;
        }
        .ae-pw-toggle:hover { color: #5a6a82; }

        .ae-submit {
          width: 100%; padding: 13px; background: #0f2647; color: #fff; border: none; border-radius: 10px;
          font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity .15s, transform .15s; margin-top: 4px;
        }
        .ae-submit:hover:not(:disabled) { opacity: .88; transform: translateY(-1px); }
        .ae-submit:disabled { opacity: .6; cursor: not-allowed; }

        .ae-alert { border-radius: 10px; padding: 12px 14px; display: flex; gap: 8px; align-items: flex-start; font-size: 13px; margin-bottom: 14px; }
        .ae-alert-warn { background: #fefce8; border: 1px solid #fde68a; color: #92400e; }
        .ae-alert-err  { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

        @media (max-width: 768px) {
          .ae-side { display: none; }
          .ae-form-panel { padding: 32px 20px; }
        }
      `}</style>

      <div className="ae-login-wrap">

        <div className="ae-side">
          <div className="ae-side-content">
            <LogoIcon size={48} color="#fff" />
            <div className="ae-brand-name">ALUGUEASY</div>
            <div className="ae-tagline">Sistema financeiro interno<br />Gestão de imóveis por temporada</div>
            <div className="ae-features">
              {[
                'Dashboard com KPIs em tempo real',
                'Importação de planilhas Excel',
                'Sincronização com Amenitiz',
                'Relatório analítico 6 meses',
                'Controle por empreendimento',
              ].map(f => (
                <div key={f} className="ae-feature">
                  <span className="ae-feature-dot" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ae-copy">© {new Date().getFullYear()} AlugEasy</div>
        </div>

        <div className="ae-form-panel">
          <div className="ae-form-inner">

            <Link href="/home" className="ae-back-link">
              <ArrowLeft size={13} />
              Voltar para a página inicial
            </Link>

            <div className="ae-portal-tag">
              <Lock size={10} />
              Equipe interna
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f1a2e', marginBottom: 4 }}>Bem-vindo de volta</h1>
            <p style={{ fontSize: 13, color: '#5a6a82', marginBottom: 24 }}>Selecione seu perfil e acesse o sistema</p>

            {systemError && (
              <div className="ae-alert ae-alert-warn">
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{systemError}</span>
              </div>
            )}

            <div className="ae-role-row">
              <button type="button" className={`ae-role-chip ${role === 'analista' ? 'active' : ''}`} onClick={() => setRole('analista')}>
                <BarChart2 size={22} className="ae-role-chip-icon" />
                <div className="ae-role-chip-name">Analista</div>
                <div className="ae-role-chip-desc">Acesso completo</div>
              </button>
              <button type="button" className={`ae-role-chip ${role === 'admin' ? 'active' : ''}`} onClick={() => setRole('admin')}>
                <Shield size={22} className="ae-role-chip-icon" />
                <div className="ae-role-chip-name">Admin</div>
                <div className="ae-role-chip-desc">Somente leitura</div>
              </button>
            </div>

            <form onSubmit={handleLogin}>
              <div className="ae-field">
                <label htmlFor="email">Email corporativo</label>
                <input
                  id="email" type="email" className="ae-input" placeholder="usuario@alugueasy.com.br"
                  value={email} onChange={e => setEmail(e.target.value)}
                  disabled={loading || !supabase} required autoComplete="email"
                />
              </div>

              <div className="ae-field">
                <label htmlFor="password">Senha</label>
                <div className="ae-input-wrap">
                  <input
                    id="password" type={showPw ? 'text' : 'password'} className="ae-input" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    disabled={loading || !supabase} required autoComplete="current-password"
                    style={{ paddingRight: 42 }}
                  />
                  <button type="button" className="ae-pw-toggle" onClick={() => setShowPw(v => !v)} disabled={loading} tabIndex={-1} aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}>
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="ae-alert ae-alert-err">
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="ae-submit" disabled={loading || !supabase}>
                {loading ? (<><Loader2 size={16} className="animate-spin" /> Entrando…</>) : 'Entrar no sistema'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 20, borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>É proprietário? </span>
              <Link href="/login-proprietario" style={{ fontSize: 12, fontWeight: 600, color: '#15803d', textDecoration: 'none' }}>
                Acesse seu portal →
              </Link>
            </div>

            <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 16 }}>
              🔒 Acesso restrito — apenas usuários cadastrados
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

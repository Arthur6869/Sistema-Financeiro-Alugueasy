'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Eye, EyeOff, Loader2, AlertCircle,
  Home, FileText, Download, BarChart2,
  ArrowLeft, Info,
} from 'lucide-react'

function LogoIcon({ size = 40, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 4L4 18H9.5V35H16.5V27H23.5V35H30.5V18H36L20 4Z" fill={color} opacity=".9" />
    </svg>
  )
}

const PORTAL_FEATURES = [
  { icon: FileText,  label: 'Prestação de contas mensal' },
  { icon: Home,      label: 'Extrato do seu apartamento' },
  { icon: Download,  label: 'Download de relatórios PDF' },
  { icon: BarChart2, label: 'Indicadores financeiros'    },
]

export default function LoginProprietarioPage() {
  const router = useRouter()

  const [supabase, setSupabase] = useState<ReturnType<typeof createClient> | null>(null)
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
        setSystemError('⚠️ Configuração incompleta. Variáveis de ambiente não encontradas.')
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
        setError('Email ou senha incorretos. Verifique seus dados.')
        setLoading(false)
        return
      }

      await new Promise(resolve => setTimeout(resolve, 500))
      router.push('/proprietario')
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

        .prop-wrap { min-height: 100vh; display: flex; font-family: 'DM Sans', sans-serif; }

        .prop-side {
          width: 420px; flex-shrink: 0; background: #14532d;
          display: flex; flex-direction: column; align-items: center; justify-content: space-between;
          padding: 48px 40px; position: relative; overflow: hidden;
        }
        .prop-side::before { content:''; position:absolute; width:300px; height:300px; border-radius:50%; background:rgba(255,255,255,.03); top:-80px; right:-100px; }
        .prop-side::after  { content:''; position:absolute; width:200px; height:200px; border-radius:50%; background:rgba(255,255,255,.03); bottom:60px; left:-70px; }
        .prop-side-content { text-align: center; position: relative; z-index: 1; width: 100%; }
        .prop-brand-name { color: #fff; font-size: 16px; font-weight: 700; letter-spacing: .1em; margin-top: 12px; }
        .prop-portal-label {
          display: inline-block; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.15);
          border-radius: 100px; padding: 4px 14px; font-size: 11px; font-weight: 600; letter-spacing: .06em;
          color: rgba(255,255,255,.7); margin-top: 8px;
        }
        .prop-tagline { color: rgba(255,255,255,.4); font-size: 13px; line-height: 1.6; margin-top: 8px; }

        .prop-feat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 32px; }
        .prop-feat-card {
          background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 12px;
          padding: 14px 12px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
        }
        .prop-feat-card span { font-size: 11px; color: rgba(255,255,255,.5); line-height: 1.4; }
        .prop-copy { color: rgba(255,255,255,.2); font-size: 11px; position: relative; z-index: 1; }

        .prop-form-panel { flex: 1; display: flex; align-items: center; justify-content: center; background: #fff; padding: 40px 32px; }
        .prop-form-inner { width: 100%; max-width: 400px; }

        .prop-portal-tag {
          display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700;
          letter-spacing: .08em; text-transform: uppercase; padding: 4px 10px; border-radius: 100px;
          margin-bottom: 18px; background: rgba(21,128,61,.08); color: #15803d;
        }

        .prop-info-strip { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 14px; margin-bottom: 20px; display: flex; gap: 8px; align-items: flex-start; }
        .prop-info-strip p { font-size: 12px; color: #166534; line-height: 1.5; }

        .prop-field { margin-bottom: 16px; }
        .prop-field label { font-size: 12px; font-weight: 500; color: #5a6a82; display: block; margin-bottom: 5px; }
        .prop-input {
          width: 100%; padding: 11px 14px; border: 1px solid #e2e8f0; border-radius: 10px;
          font-size: 14px; font-family: 'DM Sans', sans-serif; outline: none; background: #fafafa;
          transition: border-color .15s, box-shadow .15s, background .15s; color: #0f1a2e;
        }
        .prop-input:focus { border-color: #15803d; box-shadow: 0 0 0 3px rgba(21,128,61,.1); background: #fff; }
        .prop-input-wrap { position: relative; }
        .prop-pw-toggle {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #94a3b8; padding: 0; display: flex; align-items: center;
        }
        .prop-pw-toggle:hover { color: #5a6a82; }

        .prop-submit {
          width: 100%; padding: 13px; background: #15803d; color: #fff; border: none; border-radius: 10px;
          font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity .15s, transform .15s; margin-top: 4px;
        }
        .prop-submit:hover:not(:disabled) { opacity: .88; transform: translateY(-1px); }
        .prop-submit:disabled { opacity: .6; cursor: not-allowed; }

        .prop-alert { border-radius: 10px; padding: 12px 14px; display: flex; gap: 8px; align-items: flex-start; font-size: 13px; margin-bottom: 14px; }
        .prop-alert-err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
        .prop-alert-warn { background: #fefce8; border: 1px solid #fde68a; color: #92400e; }

        .prop-back { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #94a3b8; text-decoration: none; margin-bottom: 20px; transition: color .15s; }
        .prop-back:hover { color: #15803d; }

        .prop-divider { display: flex; align-items: center; gap: 10px; margin: 20px 0; }
        .prop-divider-line { flex: 1; height: 1px; background: #f1f5f9; }
        .prop-divider span { font-size: 11px; color: #cbd5e1; }

        @media (max-width: 768px) {
          .prop-side { display: none; }
          .prop-form-panel { padding: 32px 20px; }
        }
      `}</style>

      <div className="prop-wrap">

        <div className="prop-side">
          <div className="prop-side-content">
            <LogoIcon size={48} color="#fff" />
            <div className="prop-brand-name">ALUGUEASY</div>
            <div className="prop-portal-label">Portal do Proprietário</div>
            <div className="prop-tagline">Acompanhe seu imóvel com<br />transparência e clareza</div>

            <div className="prop-feat-grid">
              {PORTAL_FEATURES.map(f => (
                <div key={f.label} className="prop-feat-card">
                  <f.icon size={18} color="rgba(255,255,255,0.5)" />
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="prop-copy">© {new Date().getFullYear()} AlugEasy</div>
        </div>

        <div className="prop-form-panel">
          <div className="prop-form-inner">

            <Link href="/home" className="prop-back">
              <ArrowLeft size={13} />
              Voltar para a página inicial
            </Link>

            <div className="prop-portal-tag">
              <Home size={10} />
              Portal do proprietário
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f1a2e', marginBottom: 4 }}>Bem-vindo</h1>
            <p style={{ fontSize: 13, color: '#5a6a82', marginBottom: 20 }}>Acesse sua área exclusiva de prestação de contas</p>

            {systemError && (
              <div className="prop-alert prop-alert-warn">
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{systemError}</span>
              </div>
            )}

            <div className="prop-info-strip">
              <Info size={15} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
              <p>Acesse sua prestação de contas mensal, extrato do apartamento e relatórios em PDF com um clique.</p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="prop-field">
                <label htmlFor="prop-email">Email cadastrado</label>
                <input
                  id="prop-email" type="email" className="prop-input" placeholder="seu@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  disabled={loading || !supabase} required autoComplete="email"
                />
              </div>

              <div className="prop-field">
                <label htmlFor="prop-password">Senha</label>
                <div className="prop-input-wrap">
                  <input
                    id="prop-password" type={showPw ? 'text' : 'password'} className="prop-input" placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    disabled={loading || !supabase} required autoComplete="current-password"
                    style={{ paddingRight: 42 }}
                  />
                  <button type="button" className="prop-pw-toggle" onClick={() => setShowPw(v => !v)} disabled={loading} tabIndex={-1} aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}>
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="prop-alert prop-alert-err">
                  <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="prop-submit" disabled={loading || !supabase}>
                {loading ? (<><Loader2 size={16} className="animate-spin" /> Acessando…</>) : 'Acessar meu portal'}
              </button>
            </form>

            <div className="prop-divider">
              <div className="prop-divider-line" />
              <span>ou</span>
              <div className="prop-divider-line" />
            </div>

            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Faz parte da equipe? </span>
              <Link href="/login" style={{ fontSize: 12, fontWeight: 600, color: '#0f2647', textDecoration: 'none' }}>
                Acesso interno →
              </Link>
            </div>

            <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 20 }}>
              Dúvidas? Entre em contato com a equipe AlugEasy
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

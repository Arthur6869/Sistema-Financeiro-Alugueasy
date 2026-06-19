import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

async function getNomeProprietario(): Promise<{ nome: string; email: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login-proprietario')
  }

  const email = user.email ?? null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const nomeCandidato =
    profile?.nome ||
    profile?.full_name ||
    profile?.name ||
    (email ? email.split('@')[0] : null) ||
    'Proprietário'

  const nomeFormatado = nomeCandidato
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((palavra: string) => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ')

  return { nome: nomeFormatado, email }
}

export default async function BemVindoPage() {
  const { nome } = await getNomeProprietario()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        .wv-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f4f5f7;
          font-family: 'DM Sans', sans-serif;
          padding: 24px;
        }

        .wv-stage {
          background: #fff;
          border: 1px solid #e7e9ee;
          border-radius: 24px;
          padding: 64px 48px;
          text-align: center;
          position: relative;
          overflow: hidden;
          max-width: 480px;
          width: 100%;
          box-shadow: 0 1px 3px rgba(15,38,71,.04);
        }
        .wv-stage::before {
          content: '';
          position: absolute;
          width: 220px; height: 220px;
          border-radius: 50%;
          background: #f0fdf4;
          top: -90px; right: -90px;
        }
        .wv-stage::after {
          content: '';
          position: absolute;
          width: 160px; height: 160px;
          border-radius: 50%;
          background: #f8f6f1;
          bottom: -60px; left: -60px;
        }

        .wv-content { position: relative; z-index: 1; }

        .wv-logo-circle {
          width: 64px; height: 64px; border-radius: 50%;
          background: #f0fdf4; border: 1px solid #d1f0db;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 24px;
        }

        .wv-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: #f0fdf4; border: 1px solid #d1f0db;
          border-radius: 100px; padding: 5px 14px; font-size: 11px; font-weight: 700;
          letter-spacing: .06em; text-transform: uppercase; color: #166534;
          margin-bottom: 28px;
        }

        .wv-greeting { font-size: 14px; color: #5a6a82; margin-bottom: 8px; }
        .wv-name {
          font-family: 'Instrument Serif', Georgia, serif; font-size: 36px; font-weight: 400;
          color: #0f1a2e; line-height: 1.25; margin-bottom: 20px; word-break: break-word;
        }
        .wv-sub { font-size: 14px; color: #5a6a82; line-height: 1.65; margin-bottom: 36px; max-width: 360px; margin-left: auto; margin-right: auto; }

        .wv-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: #15803d; color: #fff; font-size: 14px; font-weight: 600;
          padding: 14px 30px; border-radius: 12px; border: none; cursor: pointer;
          font-family: inherit; text-decoration: none; transition: all .15s;
          box-shadow: 0 2px 8px rgba(21,128,61,.22);
        }
        .wv-btn:hover { background: #166534; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(21,128,61,.28); }

        .wv-foot { font-size: 11px; color: #94a3b8; margin-top: 24px; }

        @media (max-width: 480px) {
          .wv-stage { padding: 48px 28px; }
          .wv-name { font-size: 28px; }
        }
      `}</style>

      <div className="wv-page">
        <div className="wv-stage">
          <div className="wv-content">

            <div className="wv-logo-circle">
              <svg width="26" height="26" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path d="M20 4L4 18H9.5V35H16.5V27H23.5V35H30.5V18H36L20 4Z" fill="#15803d" />
              </svg>
            </div>

            <div className="wv-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              Portal do proprietário
            </div>

            <div className="wv-greeting">Seja bem-vindo</div>
            <h1 className="wv-name">{nome}</h1>

            <p className="wv-sub">
              Sua área exclusiva está pronta. Aqui você acompanha o faturamento, os
              custos e o repasse do seu imóvel todos os meses.
            </p>

            <Link href="/proprietario" className="wv-btn">
              Acessar meu portal
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>

            <div className="wv-foot">AlugEasy &copy; {new Date().getFullYear()} &mdash; Gestão financeira de imóveis por temporada</div>
          </div>
        </div>
      </div>
    </>
  )
}

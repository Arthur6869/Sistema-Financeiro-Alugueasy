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
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ─── Layout split: painel escuro à esquerda + conteúdo à direita ─── */

        .bv-page {
          min-height: calc(100vh - 64px);
          display: flex;
          font-family: 'DM Sans', sans-serif;
        }

        /* ──────── PAINEL ESQUERDO (marca) ──────── */

        .bv-left {
          width: 400px;
          flex-shrink: 0;
          background: #0f1a2e;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 40px 40px 36px;
          position: relative;
          overflow: hidden;
        }

        /* Círculos decorativos — profundidade sutil */
        .bv-left::before {
          content: '';
          position: absolute;
          width: 340px; height: 340px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,.05);
          top: -120px; right: -100px;
          pointer-events: none;
        }
        .bv-left::after {
          content: '';
          position: absolute;
          width: 240px; height: 240px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,.04);
          bottom: -80px; left: -80px;
          pointer-events: none;
        }

        /* Mancha verde translúcida no canto inferior — calor de marca */
        .bv-left-glow {
          position: absolute;
          width: 280px; height: 280px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(21,128,61,.18) 0%, transparent 70%);
          bottom: -60px; right: -60px;
          pointer-events: none;
        }

        .bv-left-top { position: relative; z-index: 1; }
        .bv-left-mid { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 0; }
        .bv-left-bot { position: relative; z-index: 1; }

        /* Logo */
        .bv-logo-row {
          display: flex; align-items: center; gap: 10px;
        }
        .bv-logo-box {
          width: 38px; height: 38px; border-radius: 9px;
          background: rgba(255,255,255,.08);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .bv-logo-name {
          font-size: 15px; font-weight: 700; color: #fff; letter-spacing: .02em;
        }
        .bv-logo-tag {
          font-size: 10.5px; color: rgba(255,255,255,.4); letter-spacing: .04em; text-transform: uppercase;
          display: block; margin-top: 1px;
        }

        /* Tagline */
        .bv-tagline {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 28px; font-weight: 400;
          color: #fff; line-height: 1.35;
          margin-bottom: 16px;
        }
        .bv-tagline-sub {
          font-size: 13.5px; color: rgba(255,255,255,.45); line-height: 1.7;
          margin-bottom: 36px;
        }

        /* Lista de recursos */
        .bv-feat-list { display: flex; flex-direction: column; gap: 18px; }
        .bv-feat { display: flex; align-items: flex-start; gap: 12px; }
        .bv-feat-dot {
          width: 22px; height: 22px; border-radius: 50%;
          background: rgba(21,128,61,.25);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px;
        }
        .bv-feat-dot svg { display: block; }
        .bv-feat-text {}
        .bv-feat-title { font-size: 13.5px; font-weight: 600; color: rgba(255,255,255,.9); }
        .bv-feat-desc  { font-size: 12px; color: rgba(255,255,255,.4); margin-top: 1px; }

        /* Divisor horizontal */
        .bv-divider {
          height: 1px; background: rgba(255,255,255,.07); margin: 28px 0;
        }

        /* Rodapé esquerdo */
        .bv-left-foot-text {
          font-size: 11px; color: rgba(255,255,255,.25); line-height: 1.5;
        }

        /* ──────── PAINEL DIREITO (conteúdo) ──────── */

        .bv-right {
          flex: 1;
          background: #f4f5f7;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 48px;
          position: relative;
          overflow: hidden;
        }

        /* Padrão de pontinhos sutil no fundo */
        .bv-right-bg {
          position: absolute; inset: 0;
          background-image: radial-gradient(circle, #d1d5db 1px, transparent 1px);
          background-size: 24px 24px;
          opacity: .35;
          pointer-events: none;
        }

        /* Container interno: card + mockup lado a lado */
        .bv-right-inner {
          display: flex;
          align-items: center;
          gap: 36px;
          max-width: 960px;
          width: 100%;
          position: relative;
          z-index: 1;
        }

        .bv-card {
          background: #fff;
          border: 1px solid #e7e9ee;
          border-radius: 20px;
          padding: 44px 40px 36px;
          width: 100%;
          max-width: 400px;
          flex-shrink: 0;
          box-shadow: 0 2px 12px rgba(15,26,46,.06);
        }

        /* ──────── MOCKUP DO DASHBOARD (lado direito do bv-right) ──────── */

        .bv-mockup {
          flex: 1;
          min-width: 0;
          background: #fff;
          border: 1px solid #e7e9ee;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 12px rgba(15,26,46,.05);
          opacity: .92;
        }

        .bv-mock-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 20px; padding-bottom: 14px;
          border-bottom: 1px solid #f1f2f5;
        }
        .bv-mock-label {
          font-size: 11.5px; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase; color: #94a3b8;
        }
        .bv-mock-badge {
          font-size: 10px; font-weight: 700; background: #f0fdf4;
          color: #166534; padding: 3px 9px; border-radius: 100px;
          border: 1px solid #d1f0db; letter-spacing: .04em;
        }

        /* Grade 2×2 de KPI cards mini */
        .bv-mock-kpis {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
          margin-bottom: 20px;
        }
        .bv-mock-kpi {
          background: #f8f9fb; border: 1px solid #f0f1f4;
          border-radius: 12px; padding: 14px 14px 12px;
        }
        .bv-mock-kpi-label {
          font-size: 10px; color: #94a3b8; font-weight: 600;
          letter-spacing: .04em; text-transform: uppercase; margin-bottom: 6px;
        }
        .bv-mock-kpi-val {
          font-size: 18px; font-weight: 700; color: #0f1a2e; letter-spacing: -.01em;
        }
        .bv-mock-kpi-val.green { color: #166534; }
        .bv-mock-kpi-val.dim   { color: #c4ccd8; }

        /* Mini gráfico de barras CSS */
        .bv-mock-chart-label {
          font-size: 10.5px; color: #94a3b8; font-weight: 600;
          letter-spacing: .04em; text-transform: uppercase; margin-bottom: 10px;
        }
        .bv-mock-bars {
          display: flex; align-items: flex-end; gap: 5px;
          height: 70px; padding-bottom: 2px;
        }
        .bv-mock-bar {
          flex: 1; border-radius: 3px 3px 0 0;
          background: #e7e9ee; transition: height .2s;
          min-width: 0;
        }
        .bv-mock-bar.hl { background: #193660; }

        /* Badge */
        .bv-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: #f0fdf4; border: 1px solid #d1f0db;
          border-radius: 100px; padding: 5px 14px;
          font-size: 10.5px; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase; color: #166534;
          margin-bottom: 24px;
        }

        .bv-greeting { font-size: 13px; color: #94a3b8; margin-bottom: 6px; }

        .bv-name {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 34px; font-weight: 400;
          color: #0f1a2e; line-height: 1.2;
          margin-bottom: 14px; word-break: break-word;
        }

        .bv-sub {
          font-size: 13.5px; color: #5a6a82; line-height: 1.65;
          margin-bottom: 28px;
        }

        .bv-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: #15803d; color: #fff;
          font-size: 14px; font-weight: 600;
          padding: 14px 28px; border-radius: 12px;
          border: none; cursor: pointer; font-family: inherit;
          text-decoration: none; transition: all .15s;
          box-shadow: 0 2px 8px rgba(21,128,61,.22);
          width: 100%;
        }
        .bv-btn:hover { background: #166534; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(21,128,61,.28); }

        /* Preview cards das funcionalidades */
        .bv-previews {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 8px;
          margin-top: 24px;
        }

        .bv-preview {
          border: 1px solid #e7e9ee; border-radius: 12px;
          padding: 14px 10px; text-align: center;
          transition: border-color .15s, background .15s;
        }
        .bv-preview:hover { border-color: #c3d5e8; background: #fafbfc; }

        .bv-preview-icon {
          width: 32px; height: 32px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 8px;
        }
        .bv-preview-title {
          font-size: 11px; font-weight: 700; color: #0f1a2e;
          line-height: 1.3; margin-bottom: 2px;
        }
        .bv-preview-desc {
          font-size: 10px; color: #94a3b8; line-height: 1.4;
        }

        /* Linha separadora antes dos previews */
        .bv-sep {
          height: 1px; background: #f1f2f5; margin: 24px 0 0;
        }

        /* ──────── ALU: arte de apresentação + cartão de boas-vindas ──────── */

        .bv-mockup.bv-alu-art {
          padding: 0; overflow: hidden;
          background: #0d1c3f; border: none; opacity: 1;
        }
        .bv-mockup.bv-alu-art img {
          width: 100%; height: auto; display: block;
        }

        .bv-alu-row {
          display: flex; gap: 12px; align-items: center;
          margin-top: 20px; background: #f0fdf4;
          border: 1px solid #d1f0db; border-radius: 12px;
          padding: 12px 14px;
        }
        .bv-alu-img {
          width: 42px; height: 42px; border-radius: 50%;
          object-fit: cover; flex-shrink: 0;
        }
        .bv-alu-title { font-size: 12.5px; font-weight: 700; color: #0f1a2e; }
        .bv-alu-desc { font-size: 11px; color: #5a6a82; line-height: 1.5; margin-top: 1px; }

        /* ──────── RESPONSIVO: telas médias (sem espaço para mockup) ──────── */
        @media (max-width: 1100px) {
          .bv-mockup { display: none; }
          .bv-card { max-width: 460px; }
        }

        /* ──────── RESPONSIVO: mobile ──────── */
        @media (max-width: 768px) {
          .bv-page { flex-direction: column; }

          .bv-left {
            width: 100%;
            padding: 24px 20px;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }
          .bv-left::before, .bv-left::after { display: none; }
          .bv-left-glow { display: none; }
          .bv-left-mid, .bv-left-bot, .bv-tagline-sub { display: none; }
          .bv-left-top { flex: 1; }
          .bv-tagline {
            font-size: 15px; margin-bottom: 0;
            font-family: 'DM Sans', sans-serif; font-weight: 600;
            color: rgba(255,255,255,.75);
          }
          .bv-divider, .bv-feat-list { display: none; }

          .bv-right { padding: 24px 16px; align-items: flex-start; }
          .bv-right-bg { opacity: .2; }
          .bv-right-inner { flex-direction: column; }
          .bv-card { max-width: 100%; padding: 28px 24px 24px; }
          .bv-name { font-size: 28px; }
          .bv-previews { grid-template-columns: repeat(3,1fr); }
        }
      `}</style>

      <div className="bv-page">

        {/* ── Painel esquerdo: identidade da marca ── */}
        <div className="bv-left">
          <div className="bv-left-glow" />

          <div className="bv-left-top">
            <div className="bv-logo-row">
              <div className="bv-logo-box">
                <svg width="32" height="18" viewBox="0 0 48 27" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M16.1746 17.9933L20.7434 22.5621C23.5238 25.3425 28.0316 25.3425 30.812 22.5621C31.7289 21.6452 32.3435 20.5403 32.6556 19.3715L35.8462 22.5621C38.6266 25.3425 43.1344 25.3425 45.9147 22.5621C48.6951 19.7818 48.6951 15.274 45.9147 12.4936L35.8462 2.4251C33.0659 -0.355243 28.558 -0.355242 25.7777 2.4251C24.8607 3.34206 24.2462 4.44691 23.9341 5.61573L20.7434 2.4251C17.9631 -0.355241 13.4553 -0.355241 10.6749 2.42511L2.38936 10.7107C-0.796453 13.8965 -0.796453 19.0617 2.38936 22.2475C5.57517 25.4333 10.7404 25.4333 13.9262 22.2475C15.1322 21.0415 15.8817 19.5519 16.1746 17.9933ZM18.2263 4.94223C16.8361 3.55206 14.5822 3.55206 13.192 4.94224C11.8025 6.33181 11.8019 8.5844 13.1903 9.97471L23.2606 20.045C24.6507 21.4352 26.9047 21.4352 28.2948 20.045C29.6843 18.6556 29.685 16.4033 28.297 15.013L18.2263 4.94223ZM11.4091 13.2278L8.15778 9.9765L4.90649 13.2278C3.11085 15.0234 3.11085 17.9347 4.90649 19.7304C6.70213 21.526 9.61344 21.526 11.4091 19.7304C13.2047 17.9347 13.2047 15.0234 11.4091 13.2278ZM28.2919 9.97354C26.9047 8.58313 26.9056 6.33142 28.2948 4.94223C29.685 3.55206 31.9389 3.55206 33.3291 4.94223L43.3976 15.0108C44.7878 16.4009 44.7878 18.6548 43.3976 20.045C42.0074 21.4352 39.7535 21.4352 38.3634 20.045L28.2919 9.97354Z" fill="white"/>
                </svg>
              </div>
              <div>
                <div className="bv-logo-name">AlugEasy</div>
                <span className="bv-logo-tag">Portal do Proprietário</span>
              </div>
            </div>
          </div>

          <div className="bv-left-mid">
            <div className="bv-tagline">
              Transparência financeira<br />
              do seu imóvel,<br />
              todo mês.
            </div>
            <div className="bv-tagline-sub">
              Acompanhe o rendimento dos seus imóveis,<br />
              entenda cada centavo e baixe a prestação<br />
              de contas quando precisar.
            </div>

            <div className="bv-divider" />

            <div className="bv-feat-list">
              <div className="bv-feat">
                <div className="bv-feat-dot">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="bv-feat-text">
                  <div className="bv-feat-title">Repasse mensal em tempo real</div>
                  <div className="bv-feat-desc">Veja quanto vai receber antes do fechamento</div>
                </div>
              </div>
              <div className="bv-feat">
                <div className="bv-feat-dot">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="bv-feat-text">
                  <div className="bv-feat-title">Histórico de 12 meses</div>
                  <div className="bv-feat-desc">Evolução de faturamento, custos e lucro</div>
                </div>
              </div>
              <div className="bv-feat">
                <div className="bv-feat-dot">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div className="bv-feat-text">
                  <div className="bv-feat-title">Prestação de contas em PDF</div>
                  <div className="bv-feat-desc">Relatório pronto para o contador ou arquivo pessoal</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bv-left-bot">
            <div className="bv-left-foot-text">
              AlugEasy &copy; 2026 &mdash; Gestão financeira<br />de imóveis por temporada
            </div>
          </div>
        </div>

        {/* ── Painel direito: boas-vindas + card + mockup ── */}
        <div className="bv-right">
          <div className="bv-right-bg" />

          <div className="bv-right-inner">
          <div className="bv-card">

            <div className="bv-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              Sua área exclusiva
            </div>

            <div className="bv-greeting">Seja bem-vindo</div>
            <h1 className="bv-name">{nome}</h1>

            <p className="bv-sub">
              Seu portal está pronto. Aqui você acompanha o faturamento,
              os custos e o repasse dos seus imóveis todos os meses.
            </p>

            <Link href="/proprietario" className="bv-btn">
              Acessar meu portal
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>

            {/* Apresentação da ALU — assistente virtual do portal */}
            <div className="bv-alu-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/alu-avatar.png" alt="ALU — assistente virtual AlugEasy" className="bv-alu-img" />
              <div>
                <div className="bv-alu-title">Conheça a ALU, sua assistente</div>
                <div className="bv-alu-desc">
                  Ela te guia pelo portal no primeiro acesso e responde suas dúvidas a qualquer momento.
                </div>
              </div>
            </div>

            <div className="bv-sep" />

            {/* Preview das 3 funcionalidades principais */}
            <div className="bv-previews">

              <div className="bv-preview">
                <div className="bv-preview-icon" style={{ background: '#f0fdf4' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="1.8">
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                    <line x1="12" y1="12" x2="12" y2="16"/>
                    <line x1="10" y1="14" x2="14" y2="14"/>
                  </svg>
                </div>
                <div className="bv-preview-title">Seu repasse</div>
                <div className="bv-preview-desc">Valor do mês atual</div>
              </div>

              <div className="bv-preview">
                <div className="bv-preview-icon" style={{ background: '#e6f1fb' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0c447c" strokeWidth="1.8">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div className="bv-preview-title">Histórico</div>
                <div className="bv-preview-desc">Últimos 12 meses</div>
              </div>

              <div className="bv-preview">
                <div className="bv-preview-icon" style={{ background: '#faeeda' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#854f0b" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <div className="bv-preview-title">PDF</div>
                <div className="bv-preview-desc">Prestação de contas</div>
              </div>

            </div>

          </div>

            {/* ── Arte de apresentação da ALU (visível apenas em telas largas) ── */}
            <div className="bv-mockup bv-alu-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/alu-apresentacao.png" alt="ALU — assistente virtual AlugEasy: consulte resultados por mês, visualize extratos completos e acompanhe o histórico" />
            </div>

          </div>{/* /bv-right-inner */}
        </div>

      </div>
    </>
  )
}

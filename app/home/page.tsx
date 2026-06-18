'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  Lock, Home, BarChart2, FileText, Users, Download, RefreshCw,
} from 'lucide-react'
import { ComoFuncionaSection } from '@/components/landing/como-funciona-section'

function LogoIcon({ size = 32, color = '#0f2647' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 3L3 15H7.5V28H13.5V21H18.5V28H24.5V15H29L16 3Z" fill={color} />
    </svg>
  )
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: scrolled ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(14px)',
        borderBottom: scrolled ? '1px solid #e2e8f0' : '1px solid transparent',
        height: 64, display: 'flex', alignItems: 'center', padding: '0 5%',
        justifyContent: 'space-between', transition: 'all .2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <LogoIcon size={30} color="#0f2647" />
        <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', color: '#0f2647' }}>
          ALUGUEASY
        </span>
      </div>

      <div className="nav-links-desktop" style={{ display: 'flex', gap: 28 }}>
        <a href="#funcionalidades" style={{ fontSize: 13, fontWeight: 500, color: '#5a6a82', textDecoration: 'none' }}>Funcionalidades</a>
        <a href="#como-funciona" style={{ fontSize: 13, fontWeight: 500, color: '#5a6a82', textDecoration: 'none' }}>Como funciona</a>
        <a href="#portais" style={{ fontSize: 13, fontWeight: 500, color: '#5a6a82', textDecoration: 'none' }}>Portais</a>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Link href="/login-proprietario" className="btn-outline-green btn-pill btn-sm">
          <Home size={13} />
          Portal proprietário
        </Link>
        <Link href="/login" className="btn-navy btn-pill btn-sm">
          <Lock size={13} />
          Acesso interno
        </Link>
      </div>
    </nav>
  )
}

function Hero() {
  const bars = [38, 52, 45, 60, 35, 55, 42, 48, 65, 70, 30]

  return (
    <section style={{ background: '#0f2647', padding: '100px 5% 90px', position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 60% at 72% 50%, rgba(59,130,246,0.10) 0%, transparent 70%)',
        }}
      />
      <div
        className="hero-grid"
        style={{
          maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1,
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 100, padding: '5px 14px', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase',
              marginBottom: 20,
            }}
          >
            <BarChart2 size={11} />
            Sistema financeiro interno
          </div>

          <h1
            style={{
              fontSize: 'clamp(34px, 4vw, 48px)', lineHeight: 1.1, color: '#fff', marginBottom: 18,
              fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400,
            }}
          >
            Gestão financeira de{' '}
            <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.55)' }}>imóveis por temporada</em>
          </h1>

          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.75, marginBottom: 32, maxWidth: 460 }}>
            Centralize receitas, custos e repasses em uma plataforma única. Dashboard em
            tempo real, prestação de contas automatizada e controle total por empreendimento.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/login" className="btn-white btn-xl">
              <Lock size={16} />
              Acesso interno
            </Link>
            <Link href="/login-proprietario" className="btn-ghost btn-xl">
              <Home size={16} />
              Portal do proprietário
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, backdropFilter: 'blur(8px)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
              Dashboard financeiro
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { val: 'R$148k', lbl: 'Faturamento',    up: '▲ 12%' },
                { val: 'R$94k',  lbl: 'Lucro líquido',  up: '▲ 8%'  },
                { val: '63%',    lbl: 'Margem',          up: '▲ 2pp' },
                { val: '11',     lbl: 'Empreendimentos', up: ''      },
              ].map(k => (
                <div key={k.lbl} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' }}>{k.val}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{k.lbl}</div>
                  {k.up && <div style={{ fontSize: 10, color: '#4ade80', fontWeight: 600, marginTop: 4 }}>{k.up}</div>}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Faturamento × Lucro por empreendimento</p>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
              {bars.map((v, i) => (
                <div key={i} style={{ width: 16, height: v * 0.7, borderRadius: '3px 3px 0 0', background: i % 3 === 1 ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.18)' }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  { icon: FileText,  cor: 'navy',  title: 'Importação de planilhas', desc: 'Carregue Excel de Custos ADM/SUB e Diárias ADM/SUB. O sistema processa e armazena automaticamente.' },
  { icon: BarChart2, cor: 'navy',  title: 'Dashboard financeiro',    desc: 'KPIs de faturamento, custos, lucro e margem filtráveis por mês/ano. Gráficos por empreendimento.' },
  { icon: RefreshCw, cor: 'navy',  title: 'Sincronização Amenitiz',  desc: 'Importação automática de reservas via API Amenitiz com cálculo de taxas por plataforma.' },
  { icon: Home,      cor: 'green', title: 'Prestação de contas',     desc: 'Relatório por apartamento com valor de repasse calculado. PDF gerado automaticamente.' },
  { icon: Users,     cor: 'green', title: 'Controle de acessos',     desc: 'Perfis Analista (acesso total) e Admin (somente leitura). RLS no Supabase em camadas.' },
  { icon: Download,  cor: 'green', title: 'Exportação XLSX & PDF',   desc: 'Baixe dados em planilha Excel ou gere PDFs de prestação de contas com um clique.' },
]

function Features() {
  return (
    <section id="funcionalidades" style={{ padding: '72px 5%', background: '#f8f6f1' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span className="section-tag">Funcionalidades</span>
          <h2 className="section-title" style={{ textAlign: 'center' }}>Tudo que sua gestão precisa</h2>
          <p style={{ fontSize: 15, color: '#5a6a82', maxWidth: 520, margin: '0 auto' }}>
            Do upload da planilha ao PDF de prestação de contas, cada etapa automatizada.
          </p>
        </div>

        <div className="feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
          {FEATURES.map(f => (
            <div key={f.title} className="feat-card">
              <div className="feat-icon" style={{ background: f.cor === 'navy' ? 'rgba(25,54,96,0.08)' : 'rgba(21,128,61,0.08)' }}>
                <f.icon size={18} color={f.cor === 'navy' ? '#193660' : '#15803d'} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: '#5a6a82', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Portais() {
  return (
    <section id="portais" style={{ padding: '72px 5%', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <span className="section-tag">Portais de acesso</span>
        <h2 className="section-title">Dois portais, um sistema</h2>
        <p style={{ fontSize: 15, color: '#5a6a82', maxWidth: 480, marginBottom: 40 }}>
          Cada perfil acessa exatamente o que precisa, com segurança e clareza.
        </p>

        <div className="portals-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div style={{ background: '#0f2647', borderRadius: 20, padding: '36px 32px' }}>
            <span style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100, display: 'inline-block', marginBottom: 18 }}>
              Equipe interna
            </span>
            <h3 style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 26, fontWeight: 400, color: '#fff', marginBottom: 10 }}>
              Acesso ao sistema financeiro
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
              Para analistas e administradores com perfis de permissão distintos.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
              {['Analista — acesso total', 'Admin — somente leitura'].map(b => (
                <span key={b} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 100, padding: '4px 10px', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{b}</span>
              ))}
            </div>
            <ul style={{ listStyle: 'none', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Dashboard com KPIs em tempo real', 'Importação de planilhas Excel', 'Sincronização com Amenitiz', 'Relatório analítico 6 meses', 'Gestão de empreendimentos'].map(i => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
                  {i}
                </li>
              ))}
            </ul>
            <Link href="/login" className="btn-white btn-lg">
              <Lock size={15} />
              Entrar no sistema
            </Link>
          </div>

          <div style={{ background: '#14532d', borderRadius: 20, padding: '36px 32px' }}>
            <span style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 100, display: 'inline-block', marginBottom: 18 }}>
              Proprietários
            </span>
            <h3 style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 26, fontWeight: 400, color: '#fff', marginBottom: 10 }}>
              Portal do proprietário
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
              Acompanhe resultados e receba a prestação de contas do seu imóvel.
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 22 }}>
              {['Acesso via email', 'Somente leitura'].map(b => (
                <span key={b} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 100, padding: '4px 10px', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{b}</span>
              ))}
            </div>
            <ul style={{ listStyle: 'none', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Prestação de contas mensal', 'Extrato do apartamento', 'Download de relatórios PDF', 'Histórico de repasses', 'Indicadores do imóvel'].map(i => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                  {i}
                </li>
              ))}
            </ul>
            <Link href="/login-proprietario" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.3)' }} className="btn-lg">
              <Home size={15} />
              Acessar meu portal
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function CtaStrip() {
  return (
    <section style={{ background: '#0f2647', padding: '60px 5%' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: '"Instrument Serif",Georgia,serif', fontSize: 30, color: '#fff', fontWeight: 400, marginBottom: 6 }}>
            Pronto para acessar?
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Escolha seu portal e entre com suas credenciais.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/login-proprietario" className="btn-green btn-md"><Home size={15} /> Portal proprietário</Link>
          <Link href="/login" className="btn-white btn-md"><Lock size={15} /> Acesso interno</Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer style={{ background: '#0a1b36', padding: '28px 5%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <LogoIcon size={22} color="rgba(255,255,255,0.35)" />
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)' }}>ALUGUEASY</span>
      </div>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
        © {new Date().getFullYear()} AlugEasy — Todos os direitos reservados
      </span>
    </footer>
  )
}

export default function HomeLandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

        .btn-navy, .btn-green, .btn-white, .btn-ghost, .btn-outline-green {
          display: inline-flex; align-items: center; gap: 7px;
          font-family: 'DM Sans', sans-serif; font-weight: 600;
          border: none; cursor: pointer; transition: all .2s cubic-bezier(.4,0,.2,1);
          text-decoration: none; white-space: nowrap;
        }
        .btn-sm { font-size: 12px; padding: 8px 16px;  border-radius: 8px; }
        .btn-md { font-size: 13px; padding: 11px 22px; border-radius: 12px; }
        .btn-lg { font-size: 14px; padding: 14px 28px; border-radius: 12px; display: inline-flex; align-items: center; gap: 7px; text-decoration: none; cursor: pointer; font-weight: 600; }
        .btn-xl { font-size: 15px; padding: 16px 32px; border-radius: 14px; }
        .btn-pill { border-radius: 100px !important; }

        .btn-navy { background: #0f2647; color: #fff; box-shadow: 0 2px 8px rgba(15,38,71,.25); }
        .btn-navy:hover { background: #1e4578; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(15,38,71,.3); }

        .btn-green { background: #15803d; color: #fff; box-shadow: 0 2px 8px rgba(21,128,61,.25); }
        .btn-green:hover { background: #166534; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(21,128,61,.3); }

        .btn-white { background: #fff; color: #0f2647; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
        .btn-white:hover { background: #f0f5ff; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,.15); }

        .btn-ghost { background: rgba(255,255,255,.12); color: #fff; border: 1px solid rgba(255,255,255,.2) !important; }
        .btn-ghost:hover { background: rgba(255,255,255,.22); transform: translateY(-1px); }

        .btn-outline-green { background: transparent; color: #15803d; border: 1.5px solid #15803d !important; }
        .btn-outline-green:hover { background: #15803d; color: #fff; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(21,128,61,.2); }

        .section-tag { display:inline-block; font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#193660; background:rgba(25,54,96,.07); padding:4px 12px; border-radius:100px; margin-bottom:14px; }
        .section-title { font-family:'Instrument Serif',Georgia,serif; font-size:clamp(28px,3vw,38px); font-weight:400; color:#0f1a2e; line-height:1.2; margin-bottom:10px; }

        .feat-card { background:#fff; border-radius:16px; padding:24px; border:1px solid #e2e8f0; transition:all .2s; }
        .feat-card:hover { transform:translateY(-3px); box-shadow:0 12px 32px rgba(15,38,71,.08); }
        .feat-icon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; margin-bottom:14px; }

        @media (max-width: 900px) {
          .feat-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-visual { display: none; }
          .portals-grid { grid-template-columns: 1fr !important; }
          .nav-links-desktop { display: none !important; }
        }
        @media (max-width: 600px) {
          .feat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ paddingTop: 64 }}>
        <Navbar />
        <Hero />
        <Features />
        <ComoFuncionaSection />
        <Portais />
        <CtaStrip />
        <Footer />
      </div>
    </>
  )
}

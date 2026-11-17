'use client'

import Link from 'next/link'
import { useRef } from 'react'
import {
  BarChart3, Building2, CalendarCheck, CalendarDays, Check, DollarSign, Download,
  FileSpreadsheet, FileText, Home, LayoutDashboard, Lock, RefreshCw, ShieldCheck,
  Sparkles, Users, type LucideIcon,
} from 'lucide-react'
import { ComoFuncionaSection } from './como-funciona-section'
import { useLandingMotion } from './use-landing-motion'
import './landing.css'

function LogoIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 3L3 15H7.5V28H13.5V21H18.5V28H24.5V15H29L16 3Z" fill="currentColor" />
    </svg>
  )
}

/* ── Navegação ─────────────────────────────────────────────────────── */

function Navbar() {
  return (
    <header className="lp-nav">
      <a href="#topo" className="lp-brand" aria-label="AlugEasy — voltar ao topo">
        <LogoIcon size={26} />
        <span className="lp-brand-text">ALUGUEASY</span>
      </a>

      <nav className="lp-nav-links" aria-label="Seções da página">
        <a href="#funcionalidades">Funcionalidades</a>
        <a href="#como-funciona">Como funciona</a>
        <a href="#portais">Portais</a>
      </nav>

      <div className="lp-nav-actions">
        <Link href="/login-proprietario" className="lp-navbtn lp-navbtn--green">
          <Home size={13} aria-hidden="true" />
          <span className="lp-lbl-full">Portal proprietário</span>
          <span className="lp-lbl-short">Proprietário</span>
        </Link>
        <Link href="/login" className="lp-navbtn lp-navbtn--solid">
          <Lock size={13} aria-hidden="true" />
          <span className="lp-lbl-full">Acesso interno</span>
          <span className="lp-lbl-short">Equipe</span>
        </Link>
        <Link href="/login-operacional" className="lp-navbtn lp-navbtn--teal">
          <Sparkles size={13} aria-hidden="true" />
          <span className="lp-lbl-full">Acesso operacional</span>
          <span className="lp-lbl-short">Limpeza</span>
        </Link>
      </div>
    </header>
  )
}

/* ── Hero ──────────────────────────────────────────────────────────── */

// Tudo na prévia é ilustrativo — nenhum número vem do banco.
const MOCK_NAV: { icon: LucideIcon; label: string; ativo?: boolean }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', ativo: true },
  { icon: Building2, label: 'Empreendimentos' },
  { icon: DollarSign, label: 'Custos' },
  { icon: CalendarDays, label: 'Diárias' },
  { icon: CalendarCheck, label: 'Reservas' },
  { icon: BarChart3, label: 'Relatório' },
  { icon: FileText, label: 'Prestação de Contas' },
]

const MOCK_KPIS = [
  { label: 'Faturamento', valor: 148, prefixo: 'R$ ', sufixo: 'k', delta: '▲ 12%' },
  { label: 'Custos', valor: 54, prefixo: 'R$ ', sufixo: 'k', delta: '▼ 3%' },
  { label: 'Lucro líquido', valor: 94, prefixo: 'R$ ', sufixo: 'k', delta: '▲ 8%' },
  { label: 'Margem', valor: 63, prefixo: '', sufixo: '%', delta: '▲ 2pp' },
]

// [faturamento, lucro] em % da altura do gráfico, um par por empreendimento
const MOCK_BARRAS = [
  [62, 38], [84, 55], [71, 44], [96, 63], [55, 30], [88, 57],
  [67, 41], [76, 47], [100, 66], [92, 60], [48, 27],
]

const MOCK_REPASSES = [
  { apt: 'Apto 101', tipo: 'ADM', valor: 'R$ 4.120' },
  { apt: 'Apto 202', tipo: 'ADM', valor: 'R$ 5.304' },
  { apt: 'Apto 303', tipo: 'SUB', valor: 'R$ 3.200' },
  { apt: 'Apto 404', tipo: 'ADM', valor: 'R$ 3.870' },
]

function DashboardMock() {
  return (
    <div className="lp-mock" role="img" aria-label="Prévia ilustrativa do dashboard financeiro da AlugEasy">
      <div className="lp-mock-glow" />

      <div className="lp-mock-frame" aria-hidden="true">
        <div className="lp-mock-bar">
          <i /><i /><i />
          <span className="lp-mock-url">alugueasy · dashboard</span>
        </div>

        <div className="lp-mock-body">
          <div className="lp-mock-side">
            <div className="lp-mock-logo">
              <LogoIcon size={18} />
              ALUGUEASY
            </div>
            {MOCK_NAV.map(item => (
              <div key={item.label} className={`lp-mock-nav${item.ativo ? ' is-on' : ''}`}>
                <item.icon size={14} />
                {item.label}
              </div>
            ))}
          </div>

          <div className="lp-mock-main">
            <div className="lp-mock-top">
              <div>
                <strong>Dashboard</strong>
                <small>Visão consolidada · 11 empreendimentos</small>
              </div>
              <div className="lp-mock-filters">
                <span>Este mês</span>
                <span className="is-on">ADM + SUB</span>
              </div>
            </div>

            <div className="lp-mock-kpis">
              {MOCK_KPIS.map(k => (
                <div key={k.label} className="lp-kpi">
                  <span className="lp-kpi-label">{k.label}</span>
                  <span
                    className="lp-kpi-value lp-count"
                    data-count={k.valor}
                    data-prefix={k.prefixo}
                    data-suffix={k.sufixo}
                  >
                    {`${k.prefixo}${k.valor}${k.sufixo}`}
                  </span>
                  <span className="lp-kpi-delta">{k.delta}</span>
                </div>
              ))}
            </div>

            <div className="lp-mock-panels">
              <div className="lp-panel">
                <div className="lp-panel-head">
                  <strong>Faturamento × Lucro por empreendimento</strong>
                  <span className="lp-legend">
                    <i className="is-fat" />Faturamento
                    <i className="is-luc" />Lucro
                  </span>
                </div>
                <div className="lp-bars">
                  {MOCK_BARRAS.map(([fat, luc], i) => (
                    <div key={i} className="lp-bar-group">
                      <span className="lp-bar lp-bar--fat" style={{ height: `${fat}%` }} />
                      <span className="lp-bar lp-bar--luc" style={{ height: `${luc}%` }} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="lp-panel lp-panel--list">
                <div className="lp-panel-head">
                  <strong>Repasses do mês</strong>
                </div>
                <ul className="lp-repasses">
                  {MOCK_REPASSES.map(r => (
                    <li key={r.apt}>
                      <span>{r.apt}<em>{r.tipo}</em></span>
                      <b>{r.valor}</b>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lp-chip lp-chip--sync" aria-hidden="true">
        <span className="lp-chip-ico"><RefreshCw size={15} /></span>
        <span>
          <b>Amenitiz sincronizado</b>
          <small>Reservas atualizadas</small>
        </span>
      </div>
      <div className="lp-chip lp-chip--pdf" aria-hidden="true">
        <span className="lp-chip-ico is-green"><Check size={15} /></span>
        <span>
          <b>Prestação de contas</b>
          <small>PDF gerado</small>
        </span>
      </div>
    </div>
  )
}

function Hero() {
  return (
    <section className="lp-hero" id="topo">
      <div className="lp-hero-bg" aria-hidden="true">
        {/* data-speed = parallax do ScrollSmoother; clamp() mantém a posição natural no topo */}
        <div className="lp-hero-grid" data-speed="clamp(0.8)" />
        <div className="lp-orb lp-orb--a" data-speed="clamp(0.6)" />
        <div className="lp-orb lp-orb--b" data-speed="clamp(0.7)" />
      </div>

      <div className="lp-wrap">
        <div className="lp-hero-copy">
          <p className="lp-eyebrow">
            <span className="lp-pulse" aria-hidden="true" />
            Sistema financeiro interno
          </p>

          <h1 className="lp-h1">
            Gestão financeira de <em>imóveis por temporada</em>
          </h1>

          <p className="lp-hero-sub">
            Centralize receitas, custos e repasses em uma plataforma única. Dashboard em
            tempo real, prestação de contas automatizada e controle total por empreendimento.
          </p>

          <div className="lp-hero-ctas">
            <Link href="/login" className="lp-btn lp-btn--lg lp-btn--white">
              <Lock size={16} aria-hidden="true" />
              Acesso interno
            </Link>
            <Link href="/login-proprietario" className="lp-btn lp-btn--lg lp-btn--glass lp-cta-prop">
              <Home size={16} aria-hidden="true" />
              Portal do proprietário
            </Link>
            <Link href="/login-operacional" className="lp-btn lp-btn--lg lp-btn--glass">
              <Sparkles size={16} aria-hidden="true" />
              Acesso operacional
            </Link>
          </div>
        </div>

        <div className="lp-stage">
          <DashboardMock />
        </div>
      </div>
    </section>
  )
}

/* ── Faixa do fluxo ────────────────────────────────────────────────── */

const FLUXO = ['Reservas', 'Diárias', 'Custos', 'Lucro', 'Repasse', 'Prestação de contas']

function Marquee() {
  return (
    <div className="lp-marquee" aria-hidden="true">
      <div className="lp-marquee-track">
        {[0, 1, 2].map(volta =>
          FLUXO.map(palavra => (
            <span key={`${volta}-${palavra}`}>
              {palavra}
              <b>→</b>
            </span>
          )),
        )}
      </div>
    </div>
  )
}

/* ── Funcionalidades ───────────────────────────────────────────────── */

function FeatHead({ icon: Icon, verde, titulo, desc }: {
  icon: LucideIcon; verde?: boolean; titulo: string; desc: string
}) {
  return (
    <>
      <div className={`lp-feat-icon${verde ? ' is-green' : ''}`}>
        <Icon size={19} aria-hidden="true" />
      </div>
      <h3>{titulo}</h3>
      <p>{desc}</p>
    </>
  )
}

function Features() {
  return (
    <section id="funcionalidades" className="lp-features">
      <div className="lp-wrap">
        <header className="lp-head lp-head--center">
          <span className="lp-tag" data-reveal>Funcionalidades</span>
          <h2 className="lp-h2" data-split>
            Tudo que sua gestão <em>precisa</em>
          </h2>
          <p className="lp-lead" data-reveal>
            Do upload da planilha ao PDF de prestação de contas, cada etapa automatizada.
          </p>
        </header>

        <div className="lp-bento">
          <article className="lp-feat lp-feat--a">
            <FeatHead
              icon={BarChart3}
              titulo="Dashboard financeiro"
              desc="KPIs de faturamento, custos, lucro e margem filtráveis por mês/ano. Gráficos por empreendimento."
            />
            <div className="lp-viz" aria-hidden="true">
              <div className="lp-viz-stats">
                <div><span>Faturamento</span><b>R$ 148k<i>▲ 12%</i></b></div>
                <div><span>Lucro líquido</span><b>R$ 94k<i>▲ 8%</i></b></div>
                <div><span>Margem</span><b>63%<i>▲ 2pp</i></b></div>
              </div>
              <svg className="lp-spark" viewBox="0 0 620 150">
                <defs>
                  <linearGradient id="lpSparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#193660" stopOpacity=".2" />
                    <stop offset="1" stopColor="#193660" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  className="lp-spark-area"
                  fill="url(#lpSparkFill)"
                  d="M0,118 C40,112 70,84 110,90 S170,116 215,86 S290,40 335,58 S410,44 455,36 S545,34 612,12 L612,150 L0,150 Z"
                />
                <path
                  className="lp-spark-line"
                  fill="none" stroke="#193660" strokeWidth="2.5" strokeLinecap="round"
                  d="M0,118 C40,112 70,84 110,90 S170,116 215,86 S290,40 335,58 S410,44 455,36 S545,34 612,12"
                />
                <circle className="lp-spark-dot" cx="612" cy="12" r="5" fill="#15803d" stroke="#fff" strokeWidth="2.5" />
              </svg>
            </div>
          </article>

          <article className="lp-feat lp-feat--b">
            <FeatHead
              icon={RefreshCw}
              titulo="Sincronização Amenitiz"
              desc="Importação automática de reservas via API Amenitiz com cálculo de taxas por plataforma."
            />
            <div className="lp-viz lp-viz-sync" aria-hidden="true">
              <div className="lp-sync-col">
                <span className="lp-pill">Booking.com</span>
                <span className="lp-pill">Airbnb</span>
                <span className="lp-pill">Reserva direta</span>
              </div>
              <div className="lp-sync-line" />
              <div className="lp-sync-node"><RefreshCw size={19} /></div>
              <div className="lp-sync-line" />
              <div className="lp-sync-col">
                <span className="lp-pill lp-pill--navy">Diárias</span>
                <span className="lp-pill lp-pill--navy">Taxas</span>
              </div>
            </div>
          </article>

          <article className="lp-feat lp-feat--c">
            <FeatHead
              icon={FileText}
              titulo="Importação de planilhas"
              desc="Carregue Excel de Custos ADM/SUB e Diárias ADM/SUB. O sistema processa e armazena automaticamente."
            />
            <div className="lp-viz lp-viz-files" aria-hidden="true">
              {['Custos ADM', 'Custos SUB', 'Diárias ADM', 'Diárias SUB'].map(nome => (
                <div key={nome} className="lp-file">
                  <FileSpreadsheet size={15} />
                  {nome}.xlsx
                  <Check size={14} />
                </div>
              ))}
            </div>
          </article>

          <article className="lp-feat lp-feat--d">
            <FeatHead
              icon={Home}
              verde
              titulo="Prestação de contas"
              desc="Relatório por apartamento com valor de repasse calculado. PDF gerado automaticamente."
            />
            <div className="lp-viz" aria-hidden="true">
              <div className="lp-viz-paper">
                <div className="lp-paper-row"><span>Receita das reservas</span><b>R$ 8.420,00</b></div>
                <div className="lp-paper-row"><span>(−) Custos do mês</span><b>R$ 2.180,00</b></div>
                <div className="lp-paper-row"><span>(=) Lucro líquido</span><b>R$ 6.240,00</b></div>
                <div className="lp-paper-row is-total"><span>Repasse</span><b>R$ 5.304,00</b></div>
              </div>
            </div>
          </article>

          <div className="lp-feat-stack">
            <article className="lp-feat">
              <FeatHead
                icon={Users}
                verde
                titulo="Controle de acessos"
                desc="Perfis Analista (acesso total) e Admin (somente leitura). RLS no Supabase em camadas."
              />
              <div className="lp-viz-row" aria-hidden="true">
                {['Analista', 'Admin', 'Proprietário', 'Operacional'].map(papel => (
                  <span key={papel} className="lp-badge"><ShieldCheck size={12} />{papel}</span>
                ))}
              </div>
            </article>

            <article className="lp-feat">
              <FeatHead
                icon={Download}
                verde
                titulo="Exportação XLSX & PDF"
                desc="Baixe dados em planilha Excel ou gere PDFs de prestação de contas com um clique."
              />
              <div className="lp-viz-row" aria-hidden="true">
                <span className="lp-badge"><Download size={12} />XLSX</span>
                <span className="lp-badge"><Download size={12} />PDF</span>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Portais ───────────────────────────────────────────────────────── */

const PORTAIS: {
  tom: 'navy' | 'green' | 'teal'; icon: LucideIcon; kicker: string; titulo: string; desc: string
  badges: string[]; itens: string[]; href: string; cta: string; botao: string
}[] = [
  {
    tom: 'navy', icon: Lock, kicker: 'Equipe interna',
    titulo: 'Acesso ao sistema financeiro',
    desc: 'Para analistas e administradores com perfis de permissão distintos.',
    badges: ['Analista — acesso total', 'Admin — somente leitura'],
    itens: ['Dashboard com KPIs em tempo real', 'Importação de planilhas Excel', 'Sincronização com Amenitiz', 'Relatório analítico 6 meses', 'Gestão de empreendimentos'],
    href: '/login', cta: 'Entrar no sistema', botao: 'lp-btn--white',
  },
  {
    tom: 'green', icon: Home, kicker: 'Proprietários',
    titulo: 'Portal do proprietário',
    desc: 'Acompanhe resultados e receba a prestação de contas do seu imóvel.',
    badges: ['Acesso via email', 'Somente leitura'],
    itens: ['Prestação de contas mensal', 'Extrato do apartamento', 'Download de relatórios PDF', 'Histórico de repasses', 'Indicadores do imóvel'],
    href: '/login-proprietario', cta: 'Acessar meu portal', botao: 'lp-btn--glass',
  },
  {
    tom: 'teal', icon: Sparkles, kicker: 'Equipe de limpeza',
    titulo: 'Acesso operacional',
    desc: 'Registre cada limpeza com o checklist do imóvel. A AlugEasy é avisada na hora.',
    badges: ['Login individual', 'Web e celular'],
    itens: ['Lista de todos os imóveis', 'Checklist por cômodo', 'Observações de problemas', 'Aviso por e-mail ao finalizar', 'Histórico das suas limpezas'],
    href: '/login-operacional', cta: 'Registrar limpeza', botao: 'lp-btn--glass',
  },
]

function Portais() {
  return (
    <section id="portais" className="lp-portals">
      <div className="lp-wrap">
        <header className="lp-head">
          <span className="lp-tag" data-reveal>Portais de acesso</span>
          <h2 className="lp-h2" data-split>
            Três portais, <em>um sistema</em>
          </h2>
          <p className="lp-lead" data-reveal>
            Cada perfil acessa exatamente o que precisa, com segurança e clareza.
          </p>
        </header>

        <div className="lp-portals-grid">
          {PORTAIS.map(p => (
            // O slot é o que a animação de leque move; o hover fica no cartão
            <div key={p.href} className={`lp-portal-slot lp-portal-slot--${p.tom}`}>
              <article className={`lp-portal lp-portal--${p.tom}`}>
                <p.icon className="lp-portal-mark" size={210} strokeWidth={1} aria-hidden="true" />
                <span className="lp-portal-kicker">{p.kicker}</span>
                <h3>{p.titulo}</h3>
                <p>{p.desc}</p>
                <div className="lp-portal-badges">
                  {p.badges.map(b => <span key={b}>{b}</span>)}
                </div>
                <ul>
                  {p.itens.map(item => (
                    <li key={item}>
                      <Check size={15} aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className={`lp-btn ${p.botao}`}>
                  <p.icon size={15} aria-hidden="true" />
                  {p.cta}
                </Link>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── Chamada final + rodapé ────────────────────────────────────────── */

function Closing() {
  return (
    <section className="lp-cta">
      <div className="lp-cta-bg" aria-hidden="true" />
      <div className="lp-wrap">
        <h2 className="lp-cta-title" data-split>
          Pronto para <em>acessar?</em>
        </h2>
        <p className="lp-cta-sub" data-reveal>Escolha seu portal e entre com suas credenciais.</p>
        <div className="lp-cta-actions" data-reveal>
          <Link href="/login-proprietario" className="lp-btn lp-btn--lg lp-btn--green">
            <Home size={16} aria-hidden="true" /> Portal proprietário
          </Link>
          <Link href="/login" className="lp-btn lp-btn--lg lp-btn--white">
            <Lock size={16} aria-hidden="true" /> Acesso interno
          </Link>
          <Link href="/login-operacional" className="lp-btn lp-btn--lg lp-btn--teal">
            <Sparkles size={16} aria-hidden="true" /> Acesso operacional
          </Link>
        </div>

        <footer className="lp-footer">
          <div className="lp-footer-brand">
            <LogoIcon size={20} />
            ALUGUEASY
          </div>
          <span>© {new Date().getFullYear()} AlugEasy — Todos os direitos reservados</span>
        </footer>
      </div>
      <div className="lp-wordmark" aria-hidden="true">AlugEasy</div>
    </section>
  )
}

/* ── Página ────────────────────────────────────────────────────────── */

export function LandingPage({ fontClass = '' }: { fontClass?: string }) {
  const root = useRef<HTMLDivElement>(null)
  useLandingMotion(root)

  return (
    <div ref={root} className={`lp-root ${fontClass}`}>
      <div className="lp-progress" aria-hidden="true" />
      {/* A barra fica FORA do wrapper do ScrollSmoother: dentro dele o
          position:fixed passaria a acompanhar o conteúdo transformado. */}
      <Navbar />

      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <Hero />
            <Marquee />
            <Features />
            <ComoFuncionaSection />
            <Portais />
          </main>
          <Closing />
        </div>
      </div>
    </div>
  )
}

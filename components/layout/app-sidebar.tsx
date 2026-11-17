'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  HandCoins,
  CalendarDays,
  CalendarCheck,
  Upload,
  Users,
  LogOut,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  FileText,
  ClipboardList,
  Sparkles,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useEffect, useState, useSyncExternalStore } from 'react'

interface SidebarProps {
  role: string
  fullName: string
  email: string
}

type ItemMenu = { href: string; label: string; icon: LucideIcon }

const navItems: ItemMenu[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/empreendimentos', label: 'Empreendimentos', icon: Building2 },
  { href: '/custos', label: 'Custos', icon: DollarSign },
  { href: '/custos-operacionais', label: 'Custos Operacionais', icon: ClipboardList },
  { href: '/custos/manual', label: 'Lançamento Manual', icon: HandCoins },
  { href: '/diarias', label: 'Diárias', icon: CalendarDays },
  { href: '/reservas', label: 'Reservas', icon: CalendarCheck },
  { href: '/relatorio', label: 'Relatório', icon: BarChart3 },
  { href: '/relatorio-desempenho', label: 'Desempenho', icon: BarChart3 },
  { href: '/prestacao-contas', label: 'Prestação de Contas', icon: FileText },
  { href: '/limpezas', label: 'Limpezas', icon: Sparkles },
]

const adminItems: ItemMenu[] = [
  { href: '/importar', label: 'Importar', icon: Upload },
  { href: '/usuarios', label: 'Usuários', icon: Users },
]

function LogoMarca({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 3L3 15H7.5V28H13.5V21H18.5V28H24.5V15H29L16 3Z" fill="currentColor" />
    </svg>
  )
}

// O menu só "recolhe" (ícones) no desktop; abaixo de 1024px ele é uma gaveta
// e sempre mostra os rótulos. No servidor assumimos desktop.
const CONSULTA_DESKTOP = '(min-width: 1024px)'
const assinarDesktop = (avisar: () => void) => {
  const mq = window.matchMedia(CONSULTA_DESKTOP)
  mq.addEventListener('change', avisar)
  return () => mq.removeEventListener('change', avisar)
}
const lerDesktop = () => window.matchMedia(CONSULTA_DESKTOP).matches

export function AppSidebar({ role, fullName, email }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [collapsed, setCollapsed] = useState(false)
  const [aberto, setAberto] = useState(false) // gaveta, no celular/tablet
  const desktop = useSyncExternalStore(assinarDesktop, lerDesktop, () => true)
  const recolhido = collapsed && desktop

  const mesAtual = searchParams.get('mes')
  const anoAtual = searchParams.get('ano')
  const periodoSelecionado = new URLSearchParams()
  if (mesAtual) periodoSelecionado.set('mes', mesAtual)
  if (anoAtual) periodoSelecionado.set('ano', anoAtual)

  const buildHref = (baseHref: string) => {
    const query = periodoSelecionado.toString()
    return query ? `${baseHref}?${query}` : baseHref
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Gaveta aberta: Esc fecha e a página atrás não rola
  useEffect(() => {
    if (!aberto) return
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('keydown', aoTeclar)
    const rolagem = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = rolagem
    }
  }, [aberto])

  const estaAtivo = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))
  const paginaAtual = [...navItems, ...adminItems].find(i => estaAtivo(i.href))?.label

  function renderItem(item: ItemMenu) {
    const Icon = item.icon
    const isActive = estaAtivo(item.href)

    return recolhido ? (
      <Tooltip key={item.href}>
        <TooltipTrigger
          render={<Link href={buildHref(item.href)} aria-label={item.label} aria-current={isActive ? 'page' : undefined} />}
          className={cn(
            'flex items-center justify-center rounded-lg p-2.5 transition-colors duration-150',
            isActive ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'
          )}
        >
          <Icon size={18} />
        </TooltipTrigger>
        <TooltipContent side="right"><p>{item.label}</p></TooltipContent>
      </Tooltip>
    ) : (
      <Link
        key={item.href}
        href={buildHref(item.href)}
        onClick={() => setAberto(false)}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
          isActive
            ? 'bg-white/[0.13] text-white before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-areia'
            : 'text-white/65 hover:bg-white/[0.08] hover:text-white'
        )}
      >
        <Icon size={18} className="shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    )
  }

  return (
    <>
      {/* ── BARRA SUPERIOR (celular/tablet) ────────────────────── */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 bg-marca-800 px-3 text-white lg:hidden">
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir menu"
          aria-expanded={aberto}
          aria-controls="menu-lateral"
          className="grid size-10 place-items-center rounded-lg transition-colors hover:bg-white/10"
        >
          <Menu size={20} />
        </button>
        <span className="flex items-center gap-2 text-sm font-bold tracking-[0.08em]">
          <LogoMarca size={20} />
          ALUGUEASY
        </span>
        {paginaAtual && (
          <span className="ml-auto truncate pr-1 text-xs text-white/60">{paginaAtual}</span>
        )}
      </div>

      {/* Fundo escurecido atrás da gaveta */}
      <div
        aria-hidden="true"
        onClick={() => setAberto(false)}
        className={cn(
          'fixed inset-0 z-40 bg-marca-950/60 transition-opacity duration-300 lg:hidden',
          aberto ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      {/* ── SIDEBAR ───────────────────────────────────────────── */}
      <aside
        id="menu-lateral"
        aria-label="Menu principal"
        className={cn(
          'z-50 flex shrink-0 flex-col bg-marca-800 text-white transition-[width,transform,visibility] duration-300',
          // celular/tablet: gaveta que desliza da esquerda
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-72 max-lg:max-w-[86vw] max-lg:shadow-2xl',
          aberto ? 'max-lg:translate-x-0' : 'max-lg:invisible max-lg:-translate-x-full',
          // desktop: fixa na lateral e acompanha a rolagem da página
          'lg:sticky lg:top-0 lg:h-dvh lg:self-start',
          recolhido ? 'lg:w-16' : 'lg:w-64'
        )}
      >
        {/* Recolher/expandir (só desktop) */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="absolute -right-3 top-6 z-10 hidden size-6 items-center justify-center rounded-full border border-linha bg-white text-apagado shadow transition-colors hover:text-tinta lg:flex"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Marca */}
        <div className={cn(
          'flex h-[68px] shrink-0 items-center border-b border-white/10',
          recolhido ? 'justify-center px-2' : 'justify-between pl-5 pr-3'
        )}>
          <Link
            href={buildHref('/')}
            onClick={() => setAberto(false)}
            aria-label="AlugEasy — Dashboard"
            className="flex items-center gap-2.5 text-sm font-bold tracking-[0.08em]"
          >
            <LogoMarca size={24} />
            {!recolhido && <span>ALUGUEASY</span>}
          </Link>
          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar menu"
            className="grid size-9 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navegação principal */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {navItems.map(renderItem)}

          {/* Admin items — visíveis apenas para analista (operador do sistema) */}
          {role === 'analista' && (
            <>
              {!recolhido && (
                <div className="px-3 pb-1 pt-4">
                  <span className="font-rotulo text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    Administração
                  </span>
                </div>
              )}
              {recolhido && <div className="my-2 border-t border-white/10" />}
              {adminItems.map(renderItem)}
            </>
          )}
        </nav>

        {/* Footer — usuário */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className={cn('flex items-center gap-3 rounded-lg px-2 py-2', recolhido && 'justify-center px-0')}>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-bold text-white">
              {fullName.charAt(0).toUpperCase()}
            </div>
            {!recolhido && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white" title={email}>{fullName}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge
                    className="h-4 border-0 px-1.5 py-0 text-xs"
                    style={{
                      backgroundColor: role === 'admin' ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.15)',
                      color: role === 'admin' ? '#FCD34D' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    {role === 'admin' ? 'Admin' : 'Analista'}
                  </Badge>
                </div>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger
                onClick={handleLogout}
                aria-label="Sair"
                className="cursor-pointer rounded p-1 text-white/50 transition-colors hover:text-white"
              >
                <LogOut size={16} />
              </TooltipTrigger>
              <TooltipContent side="right"><p>Sair</p></TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>
    </>
  )
}

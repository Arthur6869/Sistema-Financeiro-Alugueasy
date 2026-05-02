'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Building2,
  DollarSign,
  HandCoins,
  CalendarDays,
  Upload,
  Users,
  LogOut,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  BedDouble,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useState, useEffect } from 'react'

interface SidebarProps {
  role: string
  fullName: string
  email: string
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/empreendimentos', label: 'Empreendimentos', icon: Building2 },
  { href: '/custos', label: 'Custos', icon: DollarSign },
  { href: '/custos/manual', label: 'Lançamento Manual', icon: HandCoins },
  { href: '/diarias', label: 'Diárias', icon: CalendarDays },
  { href: '/relatorio', label: 'Relatório', icon: BarChart3 },
  { href: '/prestacao-contas', label: 'Prestação de Contas', icon: FileText },
]

const adminItems = [
  { href: '/importar', label: 'Importar', icon: Upload },
  { href: '/usuarios', label: 'Usuários', icon: Users },
  { href: '/executar-migration', label: 'Migration', icon: Upload },
]

type ModalType = 'empreendimento' | 'apartamento' | null

export function AppSidebar({ role, fullName, email }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [collapsed, setCollapsed] = useState(false)

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

  return (
    <>
      {/* ── SIDEBAR ───────────────────────────────────────────── */}
      <aside
        className={cn(
          'relative min-h-screen flex flex-col transition-all duration-300 flex-shrink-0',
          collapsed ? 'w-16' : 'w-64'
        )}
        style={{ backgroundColor: '#193660' }}
      >
        {/* Toggle button */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Logo */}
        <div className={cn(
          'flex items-center py-6 border-b border-white/10 overflow-hidden transition-all duration-300',
          collapsed ? 'justify-center px-2' : 'justify-center px-4'
        )}>
          {collapsed ? (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/20">
              <Building2 size={16} className="text-white" />
            </div>
          ) : (
            <Image src="/logo-alugueasy.png" alt="AlugEasy" width={140} height={60} className="object-contain" priority />
          )}
        </div>

        {/* Navegação principal */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

            return collapsed ? (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={<Link href={buildHref(item.href)} />}
                  className={cn(
                    'flex items-center justify-center p-2.5 rounded-lg transition-all duration-150',
                    isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
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
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                )}
              >
                <Icon size={18} />
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight size={14} className="ml-auto opacity-60" />}
              </Link>
            )
          })}

          {/* Admin items — visíveis apenas para analista (operador do sistema) */}
          {role === 'analista' && (
            <>
              {!collapsed && (
                <div className="pt-3 pb-1 px-3">
                  <span className="text-white/30 text-xs font-semibold uppercase tracking-wider">Administração</span>
                </div>
              )}
              {collapsed && <div className="border-t border-white/10 my-2" />}
              {adminItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname.startsWith(item.href)

                return collapsed ? (
                  <Tooltip key={item.href}>
                    <TooltipTrigger
                      render={<Link href={buildHref(item.href)} />}
                      className={cn(
                        'flex items-center justify-center p-2.5 rounded-lg transition-all duration-150',
                        isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
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
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                      isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <Icon size={18} />
                    <span className="truncate">{item.label}</span>
                    {isActive && <ChevronRight size={14} className="ml-auto opacity-60" />}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Footer — usuário */}
        <div className="p-3 border-t border-white/10">
          <div className={cn('flex items-center gap-3 px-2 py-2 rounded-lg', collapsed && 'justify-center px-0')}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
            >
              {fullName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{fullName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge
                    className="text-xs py-0 px-1.5 h-4 border-0"
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
                className="text-white/50 hover:text-white transition-colors p-1 rounded cursor-pointer"
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

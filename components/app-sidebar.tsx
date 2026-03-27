'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Building2,
  BedDouble,
  DollarSign,
  CalendarDays,
  Upload,
  Users,
  LogOut,
  ChevronRight,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SidebarProps {
  role: string
  fullName: string
  email: string
}

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/empreendimentos', label: 'Empreendimentos', icon: Building2 },
  { href: '/apartamentos', label: 'Apartamentos', icon: BedDouble },
  { href: '/custos', label: 'Custos', icon: DollarSign },
  { href: '/diarias', label: 'Diárias', icon: CalendarDays },
  { href: '/relatorio', label: 'Relatório', icon: BarChart3 },
]

const adminItems = [
  { href: '/importar', label: 'Importar', icon: Upload },
  { href: '/usuarios', label: 'Usuários', icon: Users },
]

export function AppSidebar({ role, fullName, email }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="w-64 min-h-screen flex flex-col"
      style={{ backgroundColor: '#193660' }}
    >
      {/* Logo */}
      <div className="flex items-center justify-center py-6 px-4 border-b border-white/10">
        <Image
          src="/logo-alugueasy.png"
          alt="AlugEasy"
          width={140}
          height={60}
          className="object-contain"
          priority
        />
      </div>

      {/* Navegação principal */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon size={18} />
              {item.label}
              {isActive && (
                <ChevronRight size={14} className="ml-auto opacity-60" />
              )}
            </Link>
          )
        })}

        {/* Separador admin */}
        {role === 'admin' && (
          <>
            <div className="pt-3 pb-1 px-3">
              <span className="text-white/30 text-xs font-semibold uppercase tracking-wider">
                Administração
              </span>
            </div>
            {adminItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                  {isActive && (
                    <ChevronRight size={14} className="ml-auto opacity-60" />
                  )}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Footer do sidebar — usuário */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          >
            {fullName.charAt(0).toUpperCase()}
          </div>
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
          <Tooltip>
            <TooltipTrigger
              onClick={handleLogout}
              className="text-white/50 hover:text-white transition-colors p-1 rounded cursor-pointer"
            >
              <LogOut size={16} />
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Sair</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  )
}

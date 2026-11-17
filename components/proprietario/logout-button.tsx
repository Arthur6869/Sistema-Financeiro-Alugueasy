'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function LogoutButton() {
  const router = useRouter()
  const [saindo, setSaindo] = useState(false)

  async function sair() {
    setSaindo(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button
      type="button" onClick={sair} disabled={saindo}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-apagado transition-colors hover:bg-creme hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700 disabled:opacity-60"
    >
      {saindo ? <Loader2 size={15} aria-hidden="true" className="animate-spin" /> : <LogOut size={15} aria-hidden="true" />}
      Sair
    </button>
  )
}

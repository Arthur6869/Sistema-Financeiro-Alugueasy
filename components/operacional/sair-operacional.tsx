'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function SairOperacional() {
  const router = useRouter()

  async function sair() {
    await createClient().auth.signOut()
    router.push('/login-operacional')
    router.refresh()
  }

  return (
    <button
      onClick={sair}
      className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
    >
      <LogOut size={15} />
      Sair
    </button>
  )
}

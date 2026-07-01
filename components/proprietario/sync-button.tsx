'use client'

import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SyncButton({ mes, ano }: { mes: number; ano: number }) {
  const router = useRouter()
  const [estado, setEstado] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [mensagem, setMensagem] = useState('')

  async function sincronizar() {
    if (estado === 'loading') return
    setEstado('loading')
    setMensagem('')
    try {
      const r = await fetch('/api/proprietario/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes, ano }),
      })
      const data = await r.json()
      if (data.success) {
        const n = data.total_reservas ?? 0
        setMensagem(n > 0 ? `${n} reservas carregadas` : 'Dados atualizados')
        setEstado('ok')
        router.refresh()
        setTimeout(() => setEstado('idle'), 5_000)
      } else {
        setMensagem(data.error ?? 'Erro ao sincronizar')
        setEstado('error')
        setTimeout(() => setEstado('idle'), 6_000)
      }
    } catch {
      setMensagem('Erro de conexão')
      setEstado('error')
      setTimeout(() => setEstado('idle'), 6_000)
    }
  }

  const loading = estado === 'loading'
  const ok      = estado === 'ok'
  const error   = estado === 'error'

  const borderColor = ok ? '#86efac' : error ? '#fca5a5' : '#e7e9ee'
  const bgColor     = ok ? '#f0fdf4' : error ? '#fef2f2' : '#fff'
  const textColor   = ok ? '#166534' : error ? '#b91c1c' : '#0f1a2e'
  const iconColor   = ok ? '#166534' : error ? '#b91c1c' : '#193660'

  return (
    <>
      <style>{`
        @keyframes spin-sync { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .sync-btn:hover:not(:disabled) { background: #f8f6f1 !important; border-color: #193660 !important; }
      `}</style>
      <button
        className="sync-btn"
        onClick={sincronizar}
        disabled={loading}
        aria-label="Sincronizar dados com Amenitiz"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 9,
          padding: '7px 14px',
          fontSize: 12.5, fontWeight: 600,
          color: textColor,
          cursor: loading ? 'default' : 'pointer',
          fontFamily: 'DM Sans, sans-serif',
          transition: 'all .15s',
          whiteSpace: 'nowrap',
        }}
      >
        <RefreshCw
          size={13}
          color={iconColor}
          style={{ animation: loading ? 'spin-sync .8s linear infinite' : 'none', flexShrink: 0 }}
        />
        {loading ? 'Sincronizando…' : ok || error ? mensagem : 'Atualizar dados'}
      </button>
    </>
  )
}

'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'

interface RealtimeReservasProps {
  apartamentoIds: string[]
  initialIngestAt: string | null
}

type NovaReserva = {
  booking_id: string
  nome_hospede: string | null
  individual_room_name: string | null
  checkin: string | null
  checkout: string | null
  plataforma_normalizada: string | null
  valor_liquido: number | null
}

type PayloadRow = NovaReserva & { apartamento_id: string | null }

function formatData(s: string | null): string {
  if (!s) return '?'
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Cada reserva nova renderiza como uma linha destacada com selo NOVO + botão de fechar.
function ItemNovaReserva({ r, onDismiss }: { r: NovaReserva; onDismiss: (id: string) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      background: '#fffbf2', border: '1px solid #fde68a',
      borderLeft: '3px solid #d97706',
      borderRadius: '0 10px 10px 0',
      padding: '12px 14px',
      marginBottom: 8,
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{
        background: '#d97706', color: '#fff',
        borderRadius: 5, padding: '2px 7px',
        fontSize: 9, fontWeight: 800, letterSpacing: '.07em',
        textTransform: 'uppercase' as const,
        flexShrink: 0, marginTop: 2,
      }}>
        NOVO
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f1a2e', marginBottom: 2 }}>
          {r.nome_hospede ?? 'Hóspede'}
        </div>
        <div style={{ fontSize: 11.5, color: '#5a6a82', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {r.individual_room_name ?? 'Quarto não identificado'}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, display: 'flex', flexWrap: 'wrap' as const, gap: '0 8px' }}>
          <span>{formatData(r.checkin)} → {formatData(r.checkout)}</span>
          {r.plataforma_normalizada && <span>· {r.plataforma_normalizada}</span>}
          {r.valor_liquido != null && (
            <span style={{ color: '#166534', fontWeight: 600 }}>
              · R$ {formatBRL(r.valor_liquido)}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onDismiss(r.booking_id)}
        aria-label="Fechar"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#94a3b8', fontSize: 18, lineHeight: 1,
          padding: '0 2px', flexShrink: 0, marginTop: -2,
        }}
      >
        ×
      </button>
    </div>
  )
}

// Assina postgres_changes em amenitiz_reservas usando o JWT do usuário autenticado.
// Supabase Realtime avalia a RLS (migration 023) antes de entregar eventos —
// proprietário recebe apenas eventos dos próprios apartamentos.
export function RealtimeReservas({ apartamentoIds, initialIngestAt }: RealtimeReservasProps) {
  const router = useRouter()

  const [ingestAt, setIngestAt] = useState<Date | null>(
    initialIngestAt ? new Date(initialIngestAt) : null
  )
  const [showToast, setShowToast] = useState(false)
  const [novasReservas, setNovasReservas] = useState<NovaReserva[]>([])
  const [retryKey, setRetryKey] = useState(0)
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null)

  // IDs já vistos: dedupe de INSERTs duplicados
  const seenIds = useRef(new Set<string>())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Debounce: agrupa rajada de eventos numa única chamada de refresh (~1.5s)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Ticker de 30s para atualizar "atualizado há X min"
  const [, tick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => tick(n => n + 1), 30_000)
    return () => clearInterval(iv)
  }, [])

  // Resolver o DOM target do portal (div#novas-reservas-portal injetada pelo server component)
  useEffect(() => {
    setPortalEl(document.getElementById('novas-reservas-portal'))
  }, [])

  const aptIdsKey = apartamentoIds.join(',')

  useEffect(() => {
    if (!apartamentoIds.length) return

    const supabase = createClient()
    const channel = supabase
      .channel(`reservas-prop-${retryKey}`)
      .on<PayloadRow>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'amenitiz_reservas' },
        (payload) => {
          if (payload.eventType === 'DELETE') return

          const row = payload.new
          // Defense-in-depth: RLS já filtrou; verificamos localmente também
          if (row.apartamento_id && !apartamentoIds.includes(row.apartamento_id)) return

          const bookingId = row.booking_id ?? ''
          const isNovo = payload.eventType === 'INSERT' && !seenIds.current.has(bookingId)
          if (bookingId) seenIds.current.add(bookingId)

          setIngestAt(new Date())

          if (isNovo) {
            // Adiciona à lista de destaques (prepend — mais recente primeiro)
            setNovasReservas(prev => {
              if (prev.some(r => r.booking_id === bookingId)) return prev
              return [{
                booking_id: bookingId,
                nome_hospede: row.nome_hospede,
                individual_room_name: row.individual_room_name,
                checkin: row.checkin,
                checkout: row.checkout,
                plataforma_normalizada: row.plataforma_normalizada,
                valor_liquido: row.valor_liquido,
              }, ...prev]
            })

            // Toast efêmero (8s)
            setShowToast(true)
            clearTimeout(toastTimer.current)
            toastTimer.current = setTimeout(() => setShowToast(false), 8_000)
          }

          // Debounce: espera 1.5s após o último evento antes de refreshar
          clearTimeout(refreshTimer.current)
          refreshTimer.current = setTimeout(() => router.refresh(), 1_500)
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          supabase.removeChannel(channel)
          setTimeout(() => setRetryKey(k => k + 1), 5_000)
        }
      })

    return () => {
      supabase.removeChannel(channel)
      clearTimeout(toastTimer.current)
      clearTimeout(refreshTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aptIdsKey, retryKey])

  function dismissar(bookingId: string) {
    setNovasReservas(prev => prev.filter(r => r.booking_id !== bookingId))
  }

  function tempoAtras(d: Date): string {
    const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
    if (mins < 1) return 'agora mesmo'
    if (mins === 1) return 'há 1 min'
    if (mins < 60) return `há ${mins} min`
    const h = Math.floor(mins / 60)
    return h === 1 ? 'há 1 hora' : `há ${h} horas`
  }

  return (
    <>
      {/* Badge "atualizado há X min" — renderizado inline no pg-period */}
      {ingestAt && (
        <span style={{
          fontSize: '11px', color: '#94a3b8',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e', display: 'inline-block', flexShrink: 0,
          }} />
          Atualizado {tempoAtras(ingestAt)}
        </span>
      )}

      {/* Toast efêmero de nova reserva (fixed, some em 8s) */}
      {showToast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          background: '#0f2647', color: 'white',
          borderRadius: 12, padding: '12px 20px',
          fontSize: '13px', fontWeight: 600,
          boxShadow: '0 8px 24px rgba(15,38,71,.25)',
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: 'DM Sans, sans-serif',
        }}>
          <span style={{ fontSize: 16 }}>✓</span>
          Nova reserva recebida — dados atualizando…
        </div>
      )}

      {/* Seção "Chegaram agora" — renderizada via portal no fluxo da página */}
      {portalEl && novasReservas.length > 0 && createPortal(
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em',
            textTransform: 'uppercase' as const, color: '#d97706',
            marginBottom: 8, fontFamily: 'DM Sans, sans-serif',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
            Chegaram agora
          </div>
          {novasReservas.map(r => (
            <ItemNovaReserva key={r.booking_id} r={r} onDismiss={dismissar} />
          ))}
        </div>,
        portalEl
      )}
    </>
  )
}

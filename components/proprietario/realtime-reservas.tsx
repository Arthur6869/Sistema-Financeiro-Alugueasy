'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { moeda } from '@/components/dashboard/valor'

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

type PayloadRow = NovaReserva & { apartamento_id: string | null; status: string | null }

function formatData(s: string | null): string {
  if (!s) return '?'
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}

// LGPD: só o primeiro nome do hóspede (o campo vem como "Nome Sobrenome — +55…")
function primeiroNome(raw: string | null): string {
  const nome = (raw ?? '').split(' — ')[0].trim().split(' ')[0] ?? ''
  return nome ? nome.charAt(0).toUpperCase() + nome.slice(1).toLowerCase() : 'Hóspede'
}

/* O relógio e o DOM não são estado do React: são lidos por useSyncExternalStore,
   fora da renderização (no servidor valem `null`, então nada depende da hora
   em que a página foi gerada). */
const JANELA_MS = 30_000
const assinarRelogio = (avisar: () => void) => {
  const iv = setInterval(avisar, JANELA_MS)
  return () => clearInterval(iv)
}
const janelaAtual = () => Math.floor(Date.now() / JANELA_MS)
const semAssinatura = () => () => {}
// div#novas-reservas-portal, renderizada pela tela de Início
const alvoDasNovasReservas = () => document.getElementById('novas-reservas-portal')

function tempoAtras(d: Date, agoraMs: number): string {
  const mins = Math.floor((agoraMs - d.getTime()) / 60_000)
  if (mins < 1) return 'agora mesmo'
  if (mins === 1) return 'há 1 min'
  if (mins < 60) return `há ${mins} min`
  const h = Math.floor(mins / 60)
  return h === 1 ? 'há 1 hora' : `há ${h} horas`
}

// Cada reserva nova é uma linha destacada com selo NOVO + botão de fechar.
function ItemNovaReserva({ r, onDismiss }: { r: NovaReserva; onDismiss: (id: string) => void }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-areia bg-white p-3.5 pl-4">
      <span className="mt-0.5 shrink-0 rounded-md bg-marca-800 px-1.5 py-0.5 font-rotulo text-[10px] font-bold uppercase tracking-wider text-white">Novo</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-tinta">{primeiroNome(r.nome_hospede)}</p>
        <p className="truncate text-xs text-apagado">{r.individual_room_name ?? 'Quarto não identificado'}</p>
        <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-apagado">
          <span>{formatData(r.checkin)} → {formatData(r.checkout)}</span>
          {r.plataforma_normalizada && <span>· {r.plataforma_normalizada}</span>}
          {r.valor_liquido != null && <span className="font-semibold text-positivo">· {moeda(r.valor_liquido)}</span>}
        </p>
      </div>
      <button
        type="button" onClick={() => onDismiss(r.booking_id)} aria-label="Dispensar aviso"
        className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full text-apagado transition-colors hover:bg-creme hover:text-tinta focus-visible:outline-2 focus-visible:outline-marca-700"
      >
        <X size={15} aria-hidden="true" />
      </button>
    </li>
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
  const [novasReservas, setNovasReservas] = useState<NovaReserva[]>([])
  const [retryKey, setRetryKey] = useState(0)

  // IDs já vistos: dedupe de INSERTs duplicados
  const seenIds = useRef(new Set<string>())
  // Debounce: agrupa rajada de eventos numa única chamada de refresh (~1.5s)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // "atualizado há X min": a janela de 30 s muda sozinha e redesenha o selo
  const janela = useSyncExternalStore(assinarRelogio, janelaAtual, () => null)
  // onde a seção "Chegaram agora" é desenhada
  const portalEl = useSyncExternalStore(semAssinatura, alvoDasNovasReservas, () => null)

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
          // Cancelada/no-show inserida pelo sync não é "reserva nova" para o proprietário
          const cancelada = ['cancelled', 'canceled', 'no_show'].includes(String(row.status ?? '').toLowerCase())
          const isNovo = payload.eventType === 'INSERT' && !cancelada && !seenIds.current.has(bookingId)
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
            toast.success('Nova reserva recebida', { description: 'Os números do mês estão sendo atualizados.' })
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
      clearTimeout(refreshTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aptIdsKey, retryKey])

  function dismissar(bookingId: string) {
    setNovasReservas(prev => prev.filter(r => r.booking_id !== bookingId))
  }

  return (
    <>
      {/* Selo "atualizado há X min" — fica ao lado dos controles do período */}
      {ingestAt && janela !== null && (
        <span className="inline-flex h-11 items-center gap-1.5 text-xs text-apagado">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-positivo" />
          Atualizado {tempoAtras(ingestAt, (janela + 1) * JANELA_MS)}
        </span>
      )}

      {/* Seção "Chegaram agora" — renderizada via portal no fluxo da página */}
      {portalEl && novasReservas.length > 0 && createPortal(
        <section aria-labelledby="titulo-novas" className="mb-4">
          <h2 id="titulo-novas" className="mb-2 flex items-center gap-1.5 font-rotulo text-[11px] font-semibold uppercase tracking-[0.14em] text-marca-700">
            <Sparkles size={13} aria-hidden="true" />
            Chegaram agora
          </h2>
          <ul className="space-y-2">
            {novasReservas.map(r => (
              <ItemNovaReserva key={r.booking_id} r={r} onDismiss={dismissar} />
            ))}
          </ul>
        </section>,
        portalEl
      )}
    </>
  )
}

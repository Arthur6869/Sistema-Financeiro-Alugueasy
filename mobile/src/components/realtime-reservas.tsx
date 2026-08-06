import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { supabase } from '@/lib/supabase'
import { CORES, FONTES, formatBRL } from '@/constants/tema'

type NovaReserva = {
  booking_id: string
  nome_hospede: string | null
  individual_room_name: string | null
  checkin: string | null
  checkout: string | null
  plataforma_normalizada: string | null
  valor_liquido: number | null
}

type LinhaPayload = NovaReserva & { apartamento_id: string | null }

function formatData(s: string | null): string {
  if (!s) return '?'
  const [, m, d] = s.split('-')
  return `${d}/${m}`
}

/**
 * Assina `postgres_changes` em `amenitiz_reservas` — espelha
 * `components/proprietario/realtime-reservas.tsx`.
 *
 * O Supabase Realtime avalia a RLS antes de entregar o evento, então um
 * proprietário só recebe mudanças dos próprios imóveis. A checagem local por
 * `apartamento_id` é defesa em profundidade, não a trava principal.
 *
 * `amenitiz_reservas` é a única tabela publicada no Realtime (migration 035) —
 * publicar o que não é usado só amplia a superfície.
 */
export function RealtimeReservas({
  apartamentoIds, aoAtualizar,
}: {
  apartamentoIds: string[]
  aoAtualizar: () => void
}) {
  const [novas, setNovas] = useState<NovaReserva[]>([])
  const [tentativa, setTentativa] = useState(0)

  const vistos = useRef(new Set<string>())
  const timerRefresh = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const chave = apartamentoIds.join(',')

  // O canal é criado uma vez e sua closure congela o `aoAtualizar` daquele
  // render. Sem este ref, trocar de mês na tela deixaria o Realtime recarregando
  // o mês ANTIGO: a reserva nova chegava e o painel não mudava.
  const aoAtualizarRef = useRef(aoAtualizar)
  useEffect(() => { aoAtualizarRef.current = aoAtualizar })

  useEffect(() => {
    if (!apartamentoIds.length) return

    const canal = supabase
      .channel(`reservas-prop-${tentativa}`)
      .on<LinhaPayload>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'amenitiz_reservas' },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          const linha = payload.new
          if (linha.apartamento_id && !apartamentoIds.includes(linha.apartamento_id)) return

          const id = linha.booking_id ?? ''
          const ehNova = payload.eventType === 'INSERT' && !vistos.current.has(id)
          if (id) vistos.current.add(id)

          if (ehNova) {
            setNovas(prev => prev.some(r => r.booking_id === id) ? prev : [{
              booking_id: id,
              nome_hospede: linha.nome_hospede,
              individual_room_name: linha.individual_room_name,
              checkin: linha.checkin,
              checkout: linha.checkout,
              plataforma_normalizada: linha.plataforma_normalizada,
              valor_liquido: linha.valor_liquido,
            }, ...prev])
          }

          // Agrupa uma rajada de eventos numa única recarga.
          clearTimeout(timerRefresh.current)
          timerRefresh.current = setTimeout(() => aoAtualizarRef.current(), 1500)
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          supabase.removeChannel(canal)
          setTimeout(() => setTentativa(t => t + 1), 5000)
        }
      })

    return () => {
      supabase.removeChannel(canal)
      clearTimeout(timerRefresh.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, tentativa])

  if (novas.length === 0) return null

  return (
    <View style={e.bloco}>
      <View style={e.tituloLinha}>
        <View style={e.tituloPonto} />
        <Text style={e.titulo}>Chegaram agora</Text>
      </View>

      {novas.map(r => (
        <View key={r.booking_id} style={e.item}>
          <View style={e.selo}><Text style={e.seloTexto}>NOVO</Text></View>

          <View style={{ flex: 1 }}>
            <Text style={e.hospede}>{r.nome_hospede ?? 'Hóspede'}</Text>
            <Text style={e.quarto} numberOfLines={1}>
              {r.individual_room_name ?? 'Quarto não identificado'}
            </Text>
            <View style={e.metaLinha}>
              <Text style={e.meta}>{formatData(r.checkin)} → {formatData(r.checkout)}</Text>
              {r.plataforma_normalizada ? <Text style={e.meta}>· {r.plataforma_normalizada}</Text> : null}
              {r.valor_liquido != null && (
                <Text style={e.metaValor}>· R$ {formatBRL(r.valor_liquido)}</Text>
              )}
            </View>
          </View>

          <Pressable
            onPress={() => setNovas(prev => prev.filter(x => x.booking_id !== r.booking_id))}
            hitSlop={10}
          >
            <Text style={e.fechar}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}

const e = StyleSheet.create({
  bloco: { marginBottom: 20 },
  tituloLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  tituloPonto: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#d97706' },
  titulo: {
    fontFamily: FONTES.bold, fontSize: 10.5, letterSpacing: 0.7,
    textTransform: 'uppercase', color: '#d97706',
  },
  item: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fffbf2', borderWidth: 1, borderColor: '#fde68a',
    borderLeftWidth: 3, borderLeftColor: '#d97706',
    borderTopRightRadius: 10, borderBottomRightRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
  },
  selo: {
    backgroundColor: '#d97706', borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 2, marginTop: 2,
  },
  seloTexto: { fontFamily: FONTES.bold, fontSize: 9, color: CORES.branco, letterSpacing: 0.7 },
  hospede: { fontFamily: FONTES.semi, fontSize: 13, color: CORES.texto, marginBottom: 2 },
  quarto: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoFraco },
  metaLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  meta: { fontFamily: FONTES.regular, fontSize: 11, color: CORES.textoApagado },
  metaValor: { fontFamily: FONTES.semi, fontSize: 11, color: '#166534' },
  fechar: { fontSize: 20, color: CORES.textoApagado, lineHeight: 20 },
})

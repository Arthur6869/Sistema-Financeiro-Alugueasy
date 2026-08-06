import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native'
import { CORES, FONTES } from '@/constants/tema'
import { supabase } from '@/lib/supabase'

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''

type Estado = 'parado' | 'carregando' | 'ok' | 'erro'

/**
 * Dispara o sync das reservas com a Amenitiz — espelha
 * `components/proprietario/sync-button.tsx`.
 *
 * A rota `/api/proprietario/sync` é a única em que uma sessão de proprietário
 * aciona a service role, então ela exige sessão e papel. Como o app não tem
 * cookies, o token vai no header Authorization (suporte a Bearer adicionado em
 * lib/supabase/api-client.ts).
 *
 * A rota também impõe uma janela mínima de 3 minutos entre syncs — sem isso, um
 * "puxar para atualizar" viraria rajada de chamadas à API externa. Quando a
 * janela está fechada, ela responde `sincronizado_agora: false` com os segundos
 * restantes, e é isso que a mensagem abaixo mostra.
 */
export function SyncButton({
  mes, ano, aoConcluir,
}: {
  mes: number
  ano: number
  aoConcluir: () => void
}) {
  const [estado, setEstado] = useState<Estado>('parado')
  const [mensagem, setMensagem] = useState('')
  const giro = useRef(new Animated.Value(0)).current
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (estado !== 'carregando') { giro.stopAnimation(); giro.setValue(0); return }
    const anim = Animated.loop(
      Animated.timing(giro, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    )
    anim.start()
    return () => anim.stop()
  }, [estado, giro])

  async function sincronizar() {
    if (estado === 'carregando') return
    setEstado('carregando')
    setMensagem('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')

      const resp = await fetch(`${BASE}/api/proprietario/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mes, ano }),
      })
      const dados = await resp.json()

      if (dados.success) {
        if (dados.sincronizado_agora === false && dados.aguarde_segundos) {
          const s = Number(dados.aguarde_segundos)
          setMensagem(s > 60 ? `Aguarde ${Math.ceil(s / 60)} min` : `Aguarde ${s}s`)
        } else {
          const n = dados.total_reservas ?? 0
          setMensagem(n > 0 ? `${n} reservas carregadas` : 'Dados atualizados')
        }
        setEstado('ok')
        aoConcluir()
        timer.current = setTimeout(() => setEstado('parado'), 5000)
      } else {
        setMensagem(dados.error ?? 'Erro ao sincronizar')
        setEstado('erro')
        timer.current = setTimeout(() => setEstado('parado'), 6000)
      }
    } catch {
      setMensagem('Erro de conexão')
      setEstado('erro')
      timer.current = setTimeout(() => setEstado('parado'), 6000)
    }
  }

  const carregando = estado === 'carregando'
  const ok = estado === 'ok'
  const erro = estado === 'erro'

  const corBorda = ok ? '#86efac' : erro ? '#fca5a5' : CORES.borda
  const corFundo = ok ? '#f0fdf4' : erro ? '#fef2f2' : CORES.branco
  const corTexto = ok ? '#166534' : erro ? '#b91c1c' : CORES.texto
  const corIcone = ok ? '#166534' : erro ? '#b91c1c' : CORES.azul

  const rotacao = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <Pressable
      onPress={sincronizar}
      disabled={carregando}
      style={({ pressed }) => [
        e.botao,
        { backgroundColor: corFundo, borderColor: corBorda },
        pressed && !carregando && { backgroundColor: CORES.areia, borderColor: CORES.azul },
      ]}
    >
      <Animated.Text style={[e.icone, { color: corIcone, transform: [{ rotate: rotacao }] }]}>
        ↻
      </Animated.Text>
      <Text style={[e.texto, { color: corTexto }]} numberOfLines={1}>
        {carregando ? 'Sincronizando…' : ok || erro ? mensagem : 'Atualizar dados'}
      </Text>
    </Pressable>
  )
}

/** Badge "Atualizado há X min" — o mesmo do portal, ao lado do botão. */
export function BadgeAtualizacao({ em }: { em: Date | null }) {
  const [, forcar] = useState(0)

  // Ticker de 30s para o texto envelhecer sozinho, como no site.
  useEffect(() => {
    const iv = setInterval(() => forcar(n => n + 1), 30_000)
    return () => clearInterval(iv)
  }, [])

  if (!em) return null

  return (
    <View style={e.badge}>
      <View style={e.badgePonto} />
      <Text style={e.badgeTexto}>Atualizado {tempoAtras(em)}</Text>
    </View>
  )
}

export function tempoAtras(d: Date): string {
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (mins < 1) return 'agora mesmo'
  if (mins === 1) return 'há 1 min'
  if (mins < 60) return `há ${mins} min`
  const h = Math.floor(mins / 60)
  return h === 1 ? 'há 1 hora' : `há ${h} horas`
}

const e = StyleSheet.create({
  botao: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 9,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  icone: { fontSize: 14 },
  texto: { fontFamily: FONTES.semi, fontSize: 12.5, flexShrink: 1 },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  badgePonto: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  badgeTexto: { fontFamily: FONTES.regular, fontSize: 11, color: CORES.textoApagado },
})

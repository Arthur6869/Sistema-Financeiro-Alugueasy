import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, usePathname } from 'expo-router'
import { CORES, FONTES } from '@/constants/tema'

/**
 * Barra inferior do portal do proprietário.
 * Espelha `components/proprietario/bottom-nav.tsx`: três abas, ícone e rótulo,
 * ativo em #193660 e inativo em cinza, com pílula de fundo no item ativo.
 */
const ABAS = [
  { rota: '/proprietario', icone: '⌂', rotulo: 'Início' },
  { rota: '/rentabilidade', icone: '▤', rotulo: 'Rentabilidade' },
  { rota: '/historico', icone: '↻', rotulo: 'Histórico' },
] as const

export function BottomNav() {
  const insets = useSafeAreaInsets()
  const atual = usePathname()

  return (
    <View style={[e.barra, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {ABAS.map(({ rota, icone, rotulo }) => {
        const ativo = atual === rota
        return (
          <Pressable
            key={rota}
            style={e.item}
            onPress={() => { if (!ativo) router.replace(rota as never) }}
          >
            <View style={[e.pilula, ativo && e.pilulaAtiva]}>
              <Text style={[e.icone, ativo && e.iconeAtivo]}>{icone}</Text>
            </View>
            <Text style={[e.rotulo, ativo && e.rotuloAtivo]}>{rotulo}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const e = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    backgroundColor: CORES.branco,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 6,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pilula: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  // 10% de opacidade do azul da marca, como o `bg-[#193660]/10` do web
  pilulaAtiva: { backgroundColor: 'rgba(25,54,96,0.10)' },
  icone: { fontSize: 18, color: '#9ca3af' },
  iconeAtivo: { color: CORES.azul },
  rotulo: { fontFamily: FONTES.media, fontSize: 10, color: '#9ca3af' },
  rotuloAtivo: { color: CORES.azul },
})

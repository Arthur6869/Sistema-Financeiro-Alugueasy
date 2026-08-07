import { View, Text, Pressable, StyleSheet } from 'react-native'
import { CORES, FONTES, MESES } from '@/constants/tema'

/** Seletor de mês usado em todas as telas — mesmo desenho do portal. */
export function FiltroPeriodo({
  mes, ano, aoMudar, direita,
}: {
  mes: number
  ano: number
  aoMudar: (delta: number) => void
  direita?: React.ReactNode
}) {
  return (
    <View style={e.linha}>
      <View style={e.seletor}>
        <Pressable onPress={() => aoMudar(-1)} hitSlop={12} style={e.seta}>
          <Text style={e.setaTexto}>‹</Text>
        </Pressable>
        <Text style={e.periodo}>{MESES[mes - 1]} {ano}</Text>
        <Pressable onPress={() => aoMudar(1)} hitSlop={12} style={e.seta}>
          <Text style={e.setaTexto}>›</Text>
        </Pressable>
      </View>
      {direita}
    </View>
  )
}

const e = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  seletor: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18,
    backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.borda,
    borderRadius: 9, paddingVertical: 9,
  },
  seta: { paddingHorizontal: 10 },
  setaTexto: { fontSize: 22, color: CORES.azul, lineHeight: 26 },
  periodo: { fontFamily: FONTES.media, fontSize: 13, color: CORES.texto, minWidth: 120, textAlign: 'center' },
})

import type { ReactNode } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { CORES, FONTES, formatBRL, MESES_ABREV } from '@/constants/tema'

/** `.panel` do portal: branco, borda #e7e9ee, cantos de 18, padding 24. */
export function Painel({
  titulo, subtitulo, children,
}: {
  titulo: string
  subtitulo?: string
  children: ReactNode
}) {
  return (
    <View style={e.painel}>
      <View style={e.cabecalho}>
        <Text style={e.titulo}>{titulo}</Text>
        {subtitulo ? <Text style={e.subtitulo}>{subtitulo}</Text> : null}
      </View>
      {children}
    </View>
  )
}

/** `.empty-state` do portal. */
export function Vazio({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <View style={e.vazio}>
      <View style={e.vazioIcone}><Text style={{ fontSize: 20, color: CORES.textoApagado }}>◔</Text></View>
      <Text style={e.vazioTitulo}>{titulo}</Text>
      <Text style={e.vazioDescricao}>{descricao}</Text>
    </View>
  )
}

/**
 * Evolução de 6 meses. No web isso é um gráfico Recharts, que não existe em
 * React Native. Em vez de trazer uma biblioteca de gráficos só por isto, as
 * barras são Views com altura proporcional — mesma informação, zero dependência
 * nova e sem custo de bundle.
 */
export function GraficoEvolucao({
  dados,
}: {
  dados: { label: string; faturamento: number; repasse: number }[]
}) {
  const maximo = Math.max(...dados.map(d => Math.max(d.faturamento, d.repasse)), 1)

  return (
    <View>
      <View style={e.legenda}>
        <View style={e.legendaItem}>
          <View style={[e.legendaCor, { backgroundColor: CORES.azul }]} />
          <Text style={e.legendaTexto}>Faturamento</Text>
        </View>
        <View style={e.legendaItem}>
          <View style={[e.legendaCor, { backgroundColor: CORES.repasseTexto }]} />
          <Text style={e.legendaTexto}>Repasse</Text>
        </View>
      </View>

      <View style={e.grafico}>
        {dados.map((d, i) => (
          <View key={`${d.label}-${i}`} style={e.coluna}>
            <View style={e.barras}>
              <View
                style={[e.barra, {
                  height: Math.max(2, (d.faturamento / maximo) * 120),
                  backgroundColor: CORES.azul,
                }]}
              />
              <View
                style={[e.barra, {
                  height: Math.max(2, (Math.max(d.repasse, 0) / maximo) * 120),
                  backgroundColor: CORES.repasseTexto,
                }]}
              />
            </View>
            <Text style={e.mesLabel}>{d.label}</Text>
          </View>
        ))}
      </View>

      <View style={e.rodapeGrafico}>
        <Text style={e.rodapeTexto}>
          Maior mês: R$ {formatBRL(maximo)}
        </Text>
      </View>
    </View>
  )
}

export { MESES_ABREV }

const e = StyleSheet.create({
  painel: {
    backgroundColor: CORES.branco,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  cabecalho: { marginBottom: 16 },
  titulo: { fontFamily: FONTES.semi, fontSize: 15, color: CORES.texto },
  subtitulo: { fontFamily: FONTES.regular, fontSize: 12, color: CORES.textoApagado, marginTop: 2 },

  vazio: { alignItems: 'center', justifyContent: 'center', paddingVertical: 36, paddingHorizontal: 16 },
  vazioIcone: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: CORES.areia,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  vazioTitulo: { fontFamily: FONTES.semi, fontSize: 14, color: CORES.texto, marginBottom: 4 },
  vazioDescricao: {
    fontFamily: FONTES.regular, fontSize: 12.5, color: CORES.textoApagado,
    textAlign: 'center', maxWidth: 280, lineHeight: 18,
  },

  legenda: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaCor: { width: 9, height: 9, borderRadius: 2 },
  legendaTexto: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoFraco },

  grafico: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 150 },
  coluna: { flex: 1, alignItems: 'center' },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 122 },
  barra: { width: 10, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  mesLabel: { fontFamily: FONTES.media, fontSize: 10.5, color: CORES.textoApagado, marginTop: 8 },

  rodapeGrafico: { marginTop: 12, borderTopWidth: 1, borderTopColor: CORES.borda, paddingTop: 10 },
  rodapeTexto: { fontFamily: FONTES.regular, fontSize: 11, color: CORES.textoApagado, textAlign: 'center' },
})

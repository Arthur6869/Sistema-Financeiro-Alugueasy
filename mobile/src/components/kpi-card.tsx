import { View, Text, StyleSheet, type ViewStyle } from 'react-native'
import { CORES, FONTES } from '@/constants/tema'

/**
 * Cartão de KPI do portal web: fundo branco, borda fina, cantos de 16 e uma
 * barra colorida de 3px no topo identificando a métrica.
 * Referência: `.kpi-card` em app/(proprietario)/proprietario/page.tsx.
 */
export function KpiCard({
  rotulo, valor, rodape, corBarra, corValor, icone, corIconeFundo, estilo,
}: {
  rotulo: string
  valor: string
  rodape: string
  corBarra: string
  corValor?: string
  icone: string
  corIconeFundo: string
  estilo?: ViewStyle
}) {
  return (
    <View style={[e.cartao, estilo]}>
      <View style={[e.barra, { backgroundColor: corBarra }]} />
      <View style={e.topo}>
        <View style={[e.icone, { backgroundColor: corIconeFundo }]}>
          <Text style={e.iconeTexto}>{icone}</Text>
        </View>
        <Text style={e.rotulo}>{rotulo}</Text>
      </View>
      <Text style={[e.valor, corValor ? { color: corValor } : null]}>{valor}</Text>
      <Text style={e.rodape}>{rodape}</Text>
    </View>
  )
}

/**
 * Repasse em destaque. No web, a partir de 640px de largura este cartão vira
 * hero: ocupa a linha inteira, ganha fundo verde e o valor cresce para 34px
 * (bloco `@media (max-width: 640px)` do portal). Como o app é sempre estreito,
 * essa é a forma padrão aqui.
 */
export function KpiRepasseHero({ valor, rodape }: { valor: string; rodape: string }) {
  return (
    <View style={[e.cartao, e.hero]}>
      <View style={[e.barra, { backgroundColor: CORES.barraRepasse }]} />
      <View style={e.topo}>
        <View style={[e.icone, { backgroundColor: CORES.branco }]}>
          <Text style={e.iconeTexto}>◈</Text>
        </View>
        <Text style={e.rotulo}>Seu repasse</Text>
      </View>
      <Text style={e.valorHero}>{valor}</Text>
      <Text style={e.rodapeHero}>{rodape}</Text>
    </View>
  )
}

const e = StyleSheet.create({
  cartao: {
    backgroundColor: CORES.branco,
    borderWidth: 1,
    borderColor: CORES.borda,
    borderRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  hero: {
    backgroundColor: CORES.repasseFundo,
    borderColor: CORES.repasseBorda,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 18,
  },
  barra: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  icone: {
    width: 26, height: 26, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  iconeTexto: { fontSize: 12, color: CORES.iconeFaturamento },
  rotulo: {
    fontFamily: FONTES.bold,
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: CORES.textoApagado,
    flexShrink: 1,
  },
  valor: {
    fontFamily: FONTES.bold,
    fontSize: 22,
    color: CORES.texto,
    marginBottom: 3,
  },
  valorHero: {
    fontFamily: FONTES.bold,
    fontSize: 34,
    color: CORES.repasseTexto,
    marginBottom: 3,
  },
  rodape: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado },
  rodapeHero: { fontFamily: FONTES.regular, fontSize: 12.5, color: CORES.textoApagado },
})

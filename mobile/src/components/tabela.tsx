import type { ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { CORES, FONTES } from '@/constants/tema'

/**
 * Lista de registros no formato que funciona em celular.
 *
 * O site usa tabelas largas com 6 a 8 colunas. Em tela estreita isso vira ou
 * scroll horizontal (ruim de usar) ou fonte ilegível, então cada registro aqui
 * é uma linha com título, subtítulo e valor à direita — o mesmo padrão que o
 * próprio portal já adota no celular.
 */
export function LinhaRegistro({
  titulo, subtitulo, valor, valorCor, aoTocar, acoes,
}: {
  titulo: string
  subtitulo?: string
  valor?: string
  valorCor?: string
  aoTocar?: () => void
  acoes?: ReactNode
}) {
  const conteudo = (
    <View style={e.linha}>
      <View style={{ flex: 1 }}>
        <Text style={e.titulo} numberOfLines={1}>{titulo}</Text>
        {subtitulo ? <Text style={e.subtitulo} numberOfLines={1}>{subtitulo}</Text> : null}
      </View>
      {valor ? (
        <Text style={[e.valor, valorCor ? { color: valorCor } : null]}>{valor}</Text>
      ) : null}
      {acoes}
    </View>
  )

  return aoTocar
    ? <Pressable onPress={aoTocar} android_ripple={{ color: CORES.areia }}>{conteudo}</Pressable>
    : conteudo
}

/** Cartão de KPI compacto, para as faixas de resumo das telas internas. */
export function Resumo({ itens }: { itens: { rotulo: string; valor: string; cor?: string }[] }) {
  return (
    <View style={e.resumo}>
      {itens.map((it, i) => (
        <View key={it.rotulo} style={[e.resumoItem, i > 0 && e.resumoDivisor]}>
          <Text style={e.resumoRotulo}>{it.rotulo}</Text>
          <Text style={[e.resumoValor, it.cor ? { color: it.cor } : null]} numberOfLines={1}>
            {it.valor}
          </Text>
        </View>
      ))}
    </View>
  )
}

const e = StyleSheet.create({
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#f1f2f5',
  },
  titulo: { fontFamily: FONTES.semi, fontSize: 13.5, color: CORES.texto },
  subtitulo: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado, marginTop: 2 },
  valor: { fontFamily: FONTES.bold, fontSize: 13.5, color: CORES.texto },

  resumo: {
    flexDirection: 'row', backgroundColor: CORES.azul,
    borderRadius: 16, paddingVertical: 16, paddingHorizontal: 8, marginBottom: 16,
  },
  resumoItem: { flex: 1, paddingHorizontal: 10 },
  resumoDivisor: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.15)' },
  resumoRotulo: {
    fontFamily: FONTES.bold, fontSize: 9.5, letterSpacing: 0.6,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 5,
  },
  resumoValor: { fontFamily: FONTES.bold, fontSize: 16, color: CORES.branco },
})

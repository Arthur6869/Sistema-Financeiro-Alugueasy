import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { CORES, FONTES } from '@/constants/tema'

/**
 * Boas-vindas do primeiro acesso — espelha
 * `app/(proprietario)/proprietario/bem-vindo/page.tsx`.
 *
 * No site é um split de duas colunas (painel escuro à esquerda, cartão à
 * direita). Em tela de celular isso vira uma coluna só: o painel escuro passa a
 * ser o topo e o cartão desce, que é o que o próprio layout do site faz quando
 * a largura aperta.
 */
export default function BemVindo() {
  const { perfil } = useAuth()
  const insets = useSafeAreaInsets()

  // Mesma normalização do site: troca ponto e underline por espaço e capitaliza.
  const nome = (perfil?.full_name ?? 'Proprietário')
    .replace(/[._]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')

  return (
    <View style={e.tela}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={[e.topo, { paddingTop: insets.top + 36 }]}>
          <Text style={e.marca}>AlugEasy</Text>
          <Text style={e.marcaSub}>Gestão financeira de imóveis por temporada</Text>
        </View>

        <View style={e.conteudo}>
          <View style={e.cartao}>
            <View style={e.selo}>
              <Text style={e.seloTexto}>⌂  Sua área exclusiva</Text>
            </View>

            <Text style={e.saudacao}>Seja bem-vindo</Text>
            <Text style={e.nome}>{nome}</Text>

            <Text style={e.sub}>
              Seu portal está pronto. Aqui você acompanha o faturamento,
              os custos e o repasse dos seus imóveis todos os meses.
            </Text>

            <Pressable
              style={({ pressed }) => [e.botao, pressed && { backgroundColor: '#0f2647' }]}
              onPress={() => router.replace('/proprietario')}
            >
              <Text style={e.botaoTexto}>Acessar meu portal  →</Text>
            </Pressable>

            <View style={e.separador} />

            <View style={e.previews}>
              <Preview fundo="#f0fdf4" icone="◈" titulo="Seu repasse" desc="Valor do mês atual" />
              <Preview fundo="#e6f1fb" icone="▤" titulo="Histórico" desc="Últimos 12 meses" />
              <Preview fundo="#faeeda" icone="↓" titulo="PDF" desc="Prestação de contas" />
            </View>
          </View>

          <Text style={e.rodape}>
            AlugEasy © 2026 — Portal do Proprietário
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}

function Preview({ fundo, icone, titulo, desc }: {
  fundo: string; icone: string; titulo: string; desc: string
}) {
  return (
    <View style={e.preview}>
      <View style={[e.previewIcone, { backgroundColor: fundo }]}>
        <Text style={e.previewIconeTexto}>{icone}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={e.previewTitulo}>{titulo}</Text>
        <Text style={e.previewDesc}>{desc}</Text>
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  topo: {
    backgroundColor: '#0f1a2e', paddingHorizontal: 28, paddingBottom: 36,
  },
  marca: { fontFamily: FONTES.serifada, fontSize: 34, color: CORES.branco },
  marcaSub: { fontFamily: FONTES.regular, fontSize: 12.5, color: '#8fa3bf', marginTop: 6 },

  conteudo: { padding: 20, marginTop: -20 },
  cartao: {
    backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.borda,
    borderRadius: 18, padding: 24,
  },
  selo: {
    alignSelf: 'flex-start', backgroundColor: '#e6f1fb',
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 18,
  },
  seloTexto: { fontFamily: FONTES.bold, fontSize: 10.5, color: '#0c447c', letterSpacing: 0.4 },

  saudacao: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco },
  nome: { fontFamily: FONTES.serifada, fontSize: 32, color: CORES.texto, marginTop: 2, marginBottom: 14 },
  sub: { fontFamily: FONTES.regular, fontSize: 13.5, color: CORES.textoFraco, lineHeight: 22, marginBottom: 24 },

  botao: {
    backgroundColor: CORES.azul, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  botaoTexto: { fontFamily: FONTES.bold, fontSize: 14.5, color: CORES.branco },

  separador: { height: 1, backgroundColor: CORES.borda, marginVertical: 24 },

  previews: { gap: 14 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewIcone: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  previewIconeTexto: { fontSize: 16, color: CORES.texto },
  previewTitulo: { fontFamily: FONTES.semi, fontSize: 13.5, color: CORES.texto },
  previewDesc: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado, marginTop: 1 },

  rodape: {
    fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado,
    textAlign: 'center', marginTop: 24,
  },
})

import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, usePathname } from 'expo-router'
import { CORES, FONTES } from '@/constants/tema'

/**
 * Navegação da área interna.
 *
 * No site isso é uma barra lateral com 12 itens. Em celular uma lista dessas não
 * cabe, então as quatro telas de uso diário ficam na barra de baixo e o resto vai
 * para "Mais" — que também é onde entram os itens de Administração, visíveis só
 * para o analista, como no site.
 */
const ABAS = [
  { rota: '/equipe', icone: '▦', rotulo: 'Painel' },
  { rota: '/equipe/custos', icone: '▤', rotulo: 'Custos' },
  { rota: '/equipe/diarias', icone: '▥', rotulo: 'Diárias' },
  { rota: '/equipe/reservas', icone: '▧', rotulo: 'Reservas' },
  { rota: '/equipe/mais', icone: '≡', rotulo: 'Mais' },
] as const

export function EquipeNav() {
  const insets = useSafeAreaInsets()
  const atual = usePathname()

  return (
    <View style={[e.barra, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      {ABAS.map(({ rota, icone, rotulo }) => {
        // "Mais" fica aceso também nas telas que vivem debaixo dele.
        const ativo = rota === '/equipe'
          ? atual === '/equipe'
          : rota === '/equipe/mais'
            ? atual.startsWith('/equipe/') && !ABAS.some(a => a.rota !== '/equipe/mais' && a.rota === atual)
            : atual === rota

        return (
          <Pressable
            key={rota}
            style={e.item}
            onPress={() => { if (atual !== rota) router.replace(rota as never) }}
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
  pilulaAtiva: { backgroundColor: 'rgba(25,54,96,0.10)' },
  icone: { fontSize: 17, color: '#9ca3af' },
  iconeAtivo: { color: CORES.azul },
  rotulo: { fontFamily: FONTES.media, fontSize: 10, color: '#9ca3af' },
  rotuloAtivo: { color: CORES.azul },
})

/** Cabeçalho padrão das telas internas, com o título e o papel do usuário. */
export function EquipeTopo({ titulo, papel }: { titulo: string; papel?: string | null }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[t.barra, { paddingTop: insets.top + 12 }]}>
      <Text style={t.titulo}>{titulo}</Text>
      {papel && (
        <View style={[t.selo, papel === 'admin' ? t.seloAdmin : t.seloAnalista]}>
          <Text style={[t.seloTexto, papel === 'admin' ? t.seloTextoAdmin : t.seloTextoAnalista]}>
            {papel === 'admin' ? 'Admin · leitura' : 'Analista'}
          </Text>
        </View>
      )}
    </View>
  )
}

const t = StyleSheet.create({
  barra: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CORES.branco, paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: CORES.borda, gap: 12,
  },
  titulo: { fontFamily: FONTES.bold, fontSize: 18, color: CORES.azul, flexShrink: 1 },
  selo: { borderRadius: 100, paddingHorizontal: 10, paddingVertical: 3 },
  seloAdmin: { backgroundColor: 'rgba(251,191,36,0.22)' },
  seloAnalista: { backgroundColor: '#e6f1fb' },
  seloTexto: { fontFamily: FONTES.bold, fontSize: 10, letterSpacing: 0.3 },
  seloTextoAdmin: { color: '#92400e' },
  seloTextoAnalista: { color: '#0c447c' },
})

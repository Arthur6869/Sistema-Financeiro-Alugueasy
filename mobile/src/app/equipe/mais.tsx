import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, FONTES } from '@/constants/tema'
import { EquipeNav, EquipeTopo } from '@/components/equipe-nav'
import { useEffect } from 'react'

type Item = { rota: string; icone: string; titulo: string; desc: string }

/**
 * Espelha os itens da barra lateral do site que não couberam nas quatro abas.
 * `Administração` só aparece para o analista — mesma regra de
 * `components/layout/app-sidebar.tsx:157`.
 */
const GESTAO: Item[] = [
  { rota: '/equipe/empreendimentos', icone: '🏢', titulo: 'Empreendimentos', desc: 'Prédios e apartamentos da carteira' },
  { rota: '/equipe/custos-operacionais', icone: '📋', titulo: 'Custos operacionais', desc: 'Volume de diárias do mês' },
  { rota: '/equipe/manual', icone: '💰', titulo: 'Lançamento manual', desc: 'Registrar um custo à mão' },
]

const RELATORIOS: Item[] = [
  { rota: '/equipe/relatorio', icone: '📊', titulo: 'Relatório', desc: 'Consolidado por empreendimento' },
  { rota: '/equipe/desempenho', icone: '📈', titulo: 'Desempenho', desc: 'Rentabilidade da carteira' },
  { rota: '/equipe/prestacao-contas', icone: '📄', titulo: 'Prestação de contas', desc: 'Extrato por proprietário' },
]

const ADMIN: Item[] = [
  { rota: '/equipe/usuarios', icone: '👥', titulo: 'Usuários', desc: 'Contas de proprietário' },
]

export default function Mais() {
  const { perfil, carregando, sair } = useAuth()

  useEffect(() => {
    if (!carregando && !ehEquipe(perfil)) router.replace('/')
  }, [carregando, perfil])

  const ehAnalista = perfil?.role === 'analista'

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Mais" papel={perfil?.role} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        <Secao titulo="Gestão" itens={GESTAO} />
        <Secao titulo="Relatórios" itens={RELATORIOS} />

        {ehAnalista && <Secao titulo="Administração" itens={ADMIN} />}

        {!ehAnalista && (
          <View style={e.avisoAdmin}>
            <Text style={e.avisoTitulo}>Conta de administrador</Text>
            <Text style={e.avisoTexto}>
              Seu acesso é de somente leitura: você consulta todos os dados, mas
              lançamentos e alterações são feitos por uma conta de analista.
            </Text>
          </View>
        )}

        <View style={e.blocoConta}>
          <Text style={e.contaNome}>{perfil?.full_name}</Text>
          <Text style={e.contaPapel}>
            {perfil?.role === 'admin' ? 'Administrador · somente leitura' : 'Analista'}
          </Text>
          <Pressable
            style={({ pressed }) => [e.botaoSair, pressed && { opacity: 0.7 }]}
            onPress={() => sair().then(() => router.replace('/login'))}
          >
            <Text style={e.botaoSairTexto}>Sair da conta</Text>
          </Pressable>
        </View>

        <Text style={e.rodape}>
          A importação de planilhas continua no sistema web — o celular não
          acessa os arquivos do computador.
        </Text>
      </ScrollView>

      <EquipeNav />
    </View>
  )
}

function Secao({ titulo, itens }: { titulo: string; itens: Item[] }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={e.secaoTitulo}>{titulo}</Text>
      <View style={e.lista}>
        {itens.map((item, i) => (
          <Pressable
            key={item.rota}
            style={({ pressed }) => [
              e.item,
              i === itens.length - 1 && { borderBottomWidth: 0 },
              pressed && { backgroundColor: CORES.areia },
            ]}
            onPress={() => router.push(item.rota as never)}
          >
            <Text style={e.itemIcone}>{item.icone}</Text>
            <View style={{ flex: 1 }}>
              <Text style={e.itemTitulo}>{item.titulo}</Text>
              <Text style={e.itemDesc}>{item.desc}</Text>
            </View>
            <Text style={e.itemSeta}>›</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },

  secaoTitulo: {
    fontFamily: FONTES.bold, fontSize: 10.5, letterSpacing: 0.7,
    textTransform: 'uppercase', color: CORES.textoApagado, marginBottom: 8,
  },
  lista: {
    backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.borda,
    borderRadius: 16, overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: '#f1f2f5',
  },
  itemIcone: { fontSize: 20 },
  itemTitulo: { fontFamily: FONTES.semi, fontSize: 14, color: CORES.texto },
  itemDesc: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado, marginTop: 2 },
  itemSeta: { fontSize: 20, color: CORES.textoApagado },

  avisoAdmin: {
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 14, padding: 16, marginBottom: 22,
  },
  avisoTitulo: { fontFamily: FONTES.semi, fontSize: 13, color: '#92400e', marginBottom: 4 },
  avisoTexto: { fontFamily: FONTES.regular, fontSize: 12.5, color: '#92400e', lineHeight: 19 },

  blocoConta: {
    backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.borda,
    borderRadius: 16, padding: 18, alignItems: 'center',
  },
  contaNome: { fontFamily: FONTES.semi, fontSize: 15, color: CORES.texto },
  contaPapel: { fontFamily: FONTES.regular, fontSize: 12, color: CORES.textoApagado, marginTop: 2, marginBottom: 16 },
  botaoSair: {
    borderWidth: 1, borderColor: CORES.borda, borderRadius: 11,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  botaoSairTexto: { fontFamily: FONTES.semi, fontSize: 13.5, color: CORES.textoFraco },

  rodape: {
    fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado,
    textAlign: 'center', marginTop: 20, lineHeight: 17,
  },
})

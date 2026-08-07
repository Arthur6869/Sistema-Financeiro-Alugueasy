import { useEffect } from 'react'
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth, ehEquipe, ehProprietarioAtivo } from '@/lib/auth'
import { CORES, FONTES } from '@/constants/tema'

/**
 * Porta de entrada do app. Decide para onde mandar o usuário conforme o papel.
 *
 * Espelha o que o proxy.ts faz no site, com a mesma regra fail-closed: quem não
 * é equipe nem proprietário ativo volta para o login. Um papel 'pendente' — que
 * é como toda conta nova nasce desde o incidente de julho — cai justamente aqui.
 */
export default function Entrada() {
  const { session, perfil, carregando, sair } = useAuth()
  const { entrou } = useLocalSearchParams<{ entrou?: string }>()

  useEffect(() => {
    if (carregando) return

    if (!session) { router.replace('/login'); return }
    // `as never` porque os tipos de rota do expo-router são gerados pelo dev
    // server; sem ele rodar, as rotas novas ainda não existem para o TypeScript.
    if (ehEquipe(perfil)) { router.replace('/equipe' as never); return }
    if (ehProprietarioAtivo(perfil)) {
      router.replace(entrou === '1' ? '/bem-vindo' : '/proprietario')
      return
    }

    // Sessão válida, mas sem acesso: conta pendente, suspensa ou sem perfil.
    // Encerra a sessão para não deixar um token útil circulando no aparelho.
    sair().finally(() => router.replace('/login?erro=sem_acesso'))
  }, [carregando, session, perfil, entrou, sair])

  return (
    <View style={estilos.container}>
      <Text style={estilos.marca}>AlugEasy</Text>
      <ActivityIndicator color={CORES.branco} style={{ marginTop: 24 }} />
    </View>
  )
}

const estilos = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: CORES.azul },
  marca: { color: CORES.branco, fontSize: 32, fontFamily: FONTES.serifada, letterSpacing: 0.5 },
})

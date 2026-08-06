import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { CORES, FONTES } from '@/constants/tema'

/**
 * Login único para equipe e proprietário.
 *
 * Não existe cadastro aqui, e isso é proposital: contas são criadas pela equipe
 * em /usuarios no sistema web. O auto-cadastro público foi o vetor do incidente
 * de julho e segue desligado no Supabase.
 */
export default function Login() {
  const { entrar, session, carregando } = useAuth()
  const { erro: erroUrl } = useLocalSearchParams<{ erro?: string }>()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Derivado, não guardado em estado: o aviso de "sem acesso" vem da própria
  // rota, então não há o que sincronizar — um efeito aqui só causaria um render
  // extra a cada montagem.
  const erroExibido = erro !== ''
    ? erro
    : erroUrl === 'sem_acesso'
      ? 'Sua conta ainda não tem acesso liberado. Fale com a AlugEasy.'
      : ''

  // Login feito em outra tela ou sessão restaurada: a raiz decide o destino.
  useEffect(() => {
    if (!carregando && session) router.replace('/')
  }, [carregando, session])

  async function aoEntrar() {
    if (!email || !senha) { setErro('Preencha e-mail e senha.'); return }
    setEnviando(true)
    setErro('')
    const { erro: falha } = await entrar(email, senha)
    setEnviando(false)
    if (falha) { setErro(falha); return }
    // `entrou=1` sinaliza login recém-feito: a raiz manda o proprietário para as
    // boas-vindas, como o site faz. Sessão restaurada (app reaberto) vai direto
    // ao portal, sem repetir a tela.
    router.replace('/?entrou=1')
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: CORES.azul }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={estilos.scroll} keyboardShouldPersistTaps="handled">
        <View style={estilos.cabecalho}>
          <Text style={estilos.marca}>AlugEasy</Text>
          <Text style={estilos.subtitulo}>Acompanhe o rendimento dos seus imóveis</Text>
        </View>

        <View style={estilos.cartao}>
          <Text style={estilos.rotulo}>E-mail</Text>
          <TextInput
            style={estilos.campo}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            placeholderTextColor={CORES.textoApagado}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            editable={!enviando}
          />

          <Text style={[estilos.rotulo, { marginTop: 16 }]}>Senha</Text>
          <TextInput
            style={estilos.campo}
            value={senha}
            onChangeText={setSenha}
            placeholder="••••••••"
            placeholderTextColor={CORES.textoApagado}
            secureTextEntry
            autoComplete="current-password"
            editable={!enviando}
            onSubmitEditing={aoEntrar}
            returnKeyType="go"
          />

          {erroExibido !== '' && (
            <View style={estilos.caixaErro}>
              <Text style={estilos.textoErro}>{erroExibido}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [estilos.botao, (enviando || pressed) && { opacity: 0.7 }]}
            onPress={aoEntrar}
            disabled={enviando}
          >
            {enviando
              ? <ActivityIndicator color={CORES.branco} />
              : <Text style={estilos.textoBotao}>Entrar</Text>}
          </Pressable>

          <Text style={estilos.ajuda}>
            O acesso é criado pela equipe AlugEasy. Se você ainda não tem uma
            senha, entre em contato conosco.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const estilos = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  cabecalho: { alignItems: 'center', marginBottom: 32 },
  marca: { color: CORES.branco, fontSize: 36, fontFamily: FONTES.serifada, letterSpacing: 0.5 },
  subtitulo: { color: '#c6d3e6', fontSize: 13.5, fontFamily: FONTES.regular, marginTop: 8, textAlign: 'center' },
  cartao: { backgroundColor: CORES.branco, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: CORES.borda },
  rotulo: { fontSize: 10.5, fontFamily: FONTES.bold, letterSpacing: 0.6, textTransform: 'uppercase', color: CORES.textoApagado, marginBottom: 7 },
  campo: {
    borderWidth: 1, borderColor: CORES.borda, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: CORES.texto, fontFamily: FONTES.regular,
    backgroundColor: '#fbfcfd',
  },
  caixaErro: {
    marginTop: 16, backgroundColor: '#fdf2f2', borderWidth: 1,
    borderColor: '#f7d4d6', borderRadius: 10, padding: 12,
  },
  textoErro: { color: CORES.vermelho, fontSize: 13, fontFamily: FONTES.regular, lineHeight: 18 },
  botao: {
    marginTop: 22, backgroundColor: CORES.azul, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  textoBotao: { color: CORES.branco, fontSize: 15, fontFamily: FONTES.bold },
  ajuda: { marginTop: 18, fontSize: 12, fontFamily: FONTES.regular, color: CORES.textoApagado, textAlign: 'center', lineHeight: 17 },
})

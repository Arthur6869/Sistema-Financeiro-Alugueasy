import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { CORES } from '@/constants/tema'

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

  useEffect(() => {
    if (erroUrl === 'sem_acesso') {
      setErro('Sua conta ainda não tem acesso liberado. Fale com a AlugEasy.')
    }
  }, [erroUrl])

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
    router.replace('/')
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

          {erro !== '' && (
            <View style={estilos.caixaErro}>
              <Text style={estilos.textoErro}>{erro}</Text>
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
  marca: { color: CORES.branco, fontSize: 34, fontWeight: '700', letterSpacing: 0.5 },
  subtitulo: { color: '#c6d3e6', fontSize: 14, marginTop: 8, textAlign: 'center' },
  cartao: { backgroundColor: CORES.branco, borderRadius: 20, padding: 24 },
  rotulo: { fontSize: 12.5, fontWeight: '600', color: CORES.textoFraco, marginBottom: 6 },
  campo: {
    borderWidth: 1, borderColor: CORES.borda, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: CORES.texto,
    backgroundColor: '#fbfcfd',
  },
  caixaErro: {
    marginTop: 16, backgroundColor: '#fdf2f2', borderWidth: 1,
    borderColor: '#f7d4d6', borderRadius: 10, padding: 12,
  },
  textoErro: { color: CORES.vermelho, fontSize: 13, lineHeight: 18 },
  botao: {
    marginTop: 22, backgroundColor: CORES.azul, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  textoBotao: { color: CORES.branco, fontSize: 15.5, fontWeight: '700' },
  ajuda: { marginTop: 18, fontSize: 12, color: CORES.textoApagado, textAlign: 'center', lineHeight: 17 },
})

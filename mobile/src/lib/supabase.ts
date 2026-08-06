import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { AppState } from 'react-native'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Copie o arquivo .env.example para .env e preencha.'
  )
}

/**
 * Armazenamento da sessão no aparelho.
 *
 * O SecureStore guarda no Keychain (iOS) / Keystore (Android) — criptografado
 * pelo sistema operacional e inacessível a outros apps. É o lugar certo para o
 * token, e por isso não usamos AsyncStorage, que grava em texto puro.
 *
 * A pegadinha: o SecureStore tem limite de 2048 bytes por valor, e a sessão do
 * Supabase (access token + refresh token + dados do usuário) passa disso com
 * folga. Gravar direto falha de forma silenciosa em alguns aparelhos — o app
 * "esquece" o login sem erro nenhum. Por isso o valor é fatiado em pedaços, com
 * uma chave de índice guardando quantos pedaços existem.
 */
const TAMANHO_PEDACO = 1800

const SecureStoreAdapter = {
  async getItem(chave: string): Promise<string | null> {
    const qtd = await SecureStore.getItemAsync(`${chave}__n`)
    if (!qtd) {
      // Valor pequeno gravado antes do fatiamento, ou nenhuma sessão salva.
      return SecureStore.getItemAsync(chave)
    }

    const pedacos: string[] = []
    for (let i = 0; i < Number(qtd); i++) {
      const pedaco = await SecureStore.getItemAsync(`${chave}__${i}`)
      if (pedaco === null) return null // sessão incompleta: trata como ausente
      pedacos.push(pedaco)
    }
    return pedacos.join('')
  },

  async setItem(chave: string, valor: string): Promise<void> {
    await this.removeItem(chave)

    const pedacos: string[] = []
    for (let i = 0; i < valor.length; i += TAMANHO_PEDACO) {
      pedacos.push(valor.slice(i, i + TAMANHO_PEDACO))
    }

    for (let i = 0; i < pedacos.length; i++) {
      await SecureStore.setItemAsync(`${chave}__${i}`, pedacos[i])
    }
    await SecureStore.setItemAsync(`${chave}__n`, String(pedacos.length))
  },

  async removeItem(chave: string): Promise<void> {
    const qtd = await SecureStore.getItemAsync(`${chave}__n`)
    if (qtd) {
      for (let i = 0; i < Number(qtd); i++) {
        await SecureStore.deleteItemAsync(`${chave}__${i}`)
      }
      await SecureStore.deleteItemAsync(`${chave}__n`)
    }
    await SecureStore.deleteItemAsync(chave)
  },
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // Só faz sentido na web, onde o token volta na URL depois de um OAuth.
    // Em app nativo isso precisa ficar desligado.
    detectSessionInUrl: false,
  },
})

/**
 * O Supabase renova o token com um timer. Quando o app vai para segundo plano, o
 * sistema operacional congela esses timers — e ao voltar, a sessão pode já ter
 * expirado sem que nada tenha tentado renovar. Religar o refresh no retorno
 * evita que o usuário seja deslogado do nada ao reabrir o app.
 */
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})

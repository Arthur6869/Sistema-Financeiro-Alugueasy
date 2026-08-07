// A API antiga (`downloadAsync`, `cacheDirectory`) vive em `/legacy` desde o
// SDK 54 — a nova é baseada nas classes File/Directory. Aqui a legada basta e é
// mais direta para "baixar com header e compartilhar".
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import { supabase } from './supabase'

const BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? ''

/**
 * Baixa a prestação de contas de um imóvel e abre a folha de compartilhamento.
 *
 * A rota `/api/prestacao-contas-pdf` exige sessão e confere a posse do imóvel
 * antes de gerar o arquivo.
 */
export function baixarPrestacaoContas(
  apartamentoId: string,
  mes: number,
  ano: number,
  nomeArquivo: string,
): Promise<{ erro: string | null }> {
  return baixarPdfAutenticado(
    `/api/prestacao-contas-pdf?apartamento_id=${apartamentoId}&mes=${mes}&ano=${ano}`,
    nomeArquivo,
  )
}

/**
 * Relatório de desempenho da carteira — exclusivo da equipe.
 *
 * A rota monta os números de TODOS os imóveis com a chave de serviço, por isso
 * exige papel admin ou analista. Foi justamente aqui que existiu o IDOR que
 * corrigimos: antes bastava estar autenticado, e um proprietário baixava a
 * carteira inteira.
 */
export function baixarRelatorioDesempenho(
  mes: number,
  ano: number,
): Promise<{ erro: string | null }> {
  return baixarPdfAutenticado(
    `/api/relatorio-desempenho-pdf?mes=${mes}&ano=${ano}`,
    `desempenho-${String(mes).padStart(2, '0')}-${ano}`,
  )
}

/**
 * Busca um PDF protegido e entrega ao usuário.
 *
 * Como o app não tem cookies, o token vai no header `Authorization: Bearer` —
 * suportado desde `lib/supabase/api-client.ts` no sistema web. Por isso não dá
 * para simplesmente abrir a URL no navegador: ela responderia 401.
 */
async function baixarPdfAutenticado(
  caminho: string,
  nomeArquivo: string,
): Promise<{ erro: string | null }> {
  if (!BASE) return { erro: 'EXPO_PUBLIC_API_BASE_URL não configurada.' }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { erro: 'Sessão expirada. Entre novamente.' }

  const url = `${BASE}${caminho}`
  const auth = { Authorization: `Bearer ${session.access_token}` }

  if (Platform.OS === 'web') {
    try {
      const resp = await fetch(url, { headers: auth })
      if (!resp.ok) return { erro: await mensagemDeErro(resp) }
      const blob = await resp.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${nomeArquivo}.pdf`
      link.click()
      URL.revokeObjectURL(link.href)
      return { erro: null }
    } catch (e) {
      // Um fetch cross-origin bloqueado pelo navegador chega aqui como
      // "Failed to fetch", sem status nem corpo — a mensagem crua não diz nada.
      // No aplicativo nativo isso não acontece: CORS é regra de navegador.
      const bruto = e instanceof Error ? e.message : ''
      if (/failed to fetch|networkerror|load failed/i.test(bruto)) {
        return {
          erro: 'O navegador bloqueou o download (CORS). No celular funciona normalmente — '
            + 'na versão web, é preciso que o site esteja publicado com a liberação de origem.',
        }
      }
      return { erro: bruto || 'Falha ao baixar o PDF.' }
    }
  }

  try {
    const destino = `${FileSystem.cacheDirectory}${nomeArquivo}.pdf`
    const resultado = await FileSystem.downloadAsync(url, destino, { headers: auth })

    if (resultado.status !== 200) {
      await FileSystem.deleteAsync(destino, { idempotent: true })
      return {
        erro: resultado.status === 403
          ? 'Você não tem acesso a este relatório.'
          : `O servidor respondeu ${resultado.status}.`,
      }
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(resultado.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Relatório',
        UTI: 'com.adobe.pdf',
      })
    }
    return { erro: null }
  } catch (e) {
    return { erro: e instanceof Error ? e.message : 'Falha ao baixar o PDF.' }
  }
}

async function mensagemDeErro(resp: Response): Promise<string> {
  if (resp.status === 403) return 'Você não tem acesso a este relatório.'
  try {
    const j = await resp.json()
    return j?.error ?? `O servidor respondeu ${resp.status}.`
  } catch {
    return `O servidor respondeu ${resp.status}.`
  }
}

import { useState } from 'react'
import {
  Modal, View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { CORES, FONTES } from '@/constants/tema'

export type CampoEdicao = {
  chave: string
  rotulo: string
  valor: string
  tipo?: 'texto' | 'numero'
  placeholder?: string
}

/**
 * Edição e exclusão de um registro.
 *
 * A escrita vai direto ao Supabase, e é a RLS que decide se passa: depois da
 * migration 037 só `analista` escreve. Um `admin` não recebe erro — o comando
 * simplesmente afeta zero linhas —, então quem chama precisa conferir as linhas
 * retornadas e avisar. Por isso as telas só mostram este modal para analista.
 */
export function EditarValorModal({
  visivel, titulo, subtitulo, campos, permiteExcluir,
  aoSalvar, aoExcluir, aoFechar,
}: {
  visivel: boolean
  titulo: string
  subtitulo?: string
  campos: CampoEdicao[]
  permiteExcluir?: boolean
  aoSalvar: (valores: Record<string, string>) => Promise<string | null>
  aoExcluir?: () => Promise<string | null>
  aoFechar: () => void
}) {
  const [valores, setValores] = useState<Record<string, string>>(
    () => Object.fromEntries(campos.map(c => [c.chave, c.valor])),
  )
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmando] = useState(false)
  const [erro, setErro] = useState('')

  // Recarrega os campos quando o modal abre para outro registro
  const chaveCampos = campos.map(c => `${c.chave}:${c.valor}`).join('|')
  const [ultimaChave, setUltimaChave] = useState(chaveCampos)
  if (chaveCampos !== ultimaChave) {
    setUltimaChave(chaveCampos)
    setValores(Object.fromEntries(campos.map(c => [c.chave, c.valor])))
    setErro('')
    setConfirmando(false)
  }

  async function salvar() {
    setSalvando(true); setErro('')
    const falha = await aoSalvar(valores)
    setSalvando(false)
    if (falha) { setErro(falha); return }
    aoFechar()
  }

  async function excluir() {
    if (!aoExcluir) return
    setSalvando(true); setErro('')
    const falha = await aoExcluir()
    setSalvando(false)
    if (falha) { setErro(falha); return }
    aoFechar()
  }

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={aoFechar}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={e.fundo}>
          <Pressable style={{ flex: 1 }} onPress={aoFechar} />

          <View style={e.painel}>
            <View style={e.topo}>
              <View style={{ flex: 1 }}>
                <Text style={e.titulo}>{titulo}</Text>
                {subtitulo ? <Text style={e.subtitulo}>{subtitulo}</Text> : null}
              </View>
              <Pressable onPress={aoFechar} hitSlop={12}>
                <Text style={e.fechar}>×</Text>
              </Pressable>
            </View>

            {campos.map(c => (
              <View key={c.chave} style={{ marginBottom: 14 }}>
                <Text style={e.rotulo}>{c.rotulo}</Text>
                <TextInput
                  style={e.campo}
                  value={valores[c.chave] ?? ''}
                  onChangeText={v => setValores(x => ({ ...x, [c.chave]: v }))}
                  keyboardType={c.tipo === 'numero' ? 'decimal-pad' : 'default'}
                  placeholder={c.placeholder}
                  placeholderTextColor={CORES.textoApagado}
                  editable={!salvando}
                />
              </View>
            ))}

            {erro !== '' && (
              <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
            )}

            {confirmandoExclusao ? (
              <View style={e.confirmacao}>
                <Text style={e.confirmacaoTexto}>
                  Excluir este registro? Não dá para desfazer.
                </Text>
                <View style={e.botoes}>
                  <Pressable style={e.botaoSec} onPress={() => setConfirmando(false)} disabled={salvando}>
                    <Text style={e.botaoSecTexto}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={e.botaoPerigo} onPress={excluir} disabled={salvando}>
                    {salvando
                      ? <ActivityIndicator size="small" color={CORES.branco} />
                      : <Text style={e.botaoPerigoTexto}>Excluir</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={e.botoes}>
                {permiteExcluir && aoExcluir && (
                  <Pressable style={e.botaoSec} onPress={() => setConfirmando(true)} disabled={salvando}>
                    <Text style={[e.botaoSecTexto, { color: CORES.vermelho }]}>Excluir</Text>
                  </Pressable>
                )}
                <Pressable style={e.botaoPri} onPress={salvar} disabled={salvando}>
                  {salvando
                    ? <ActivityIndicator size="small" color={CORES.branco} />
                    : <Text style={e.botaoPriTexto}>Salvar</Text>}
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const e = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(15,26,46,0.45)' },
  painel: {
    backgroundColor: CORES.branco,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 32,
  },
  topo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18, gap: 12 },
  titulo: { fontFamily: FONTES.bold, fontSize: 16.5, color: CORES.texto },
  subtitulo: { fontFamily: FONTES.regular, fontSize: 12.5, color: CORES.textoApagado, marginTop: 2 },
  fechar: { fontSize: 26, color: CORES.textoApagado, lineHeight: 28 },

  rotulo: {
    fontFamily: FONTES.bold, fontSize: 10.5, letterSpacing: 0.6,
    textTransform: 'uppercase', color: CORES.textoApagado, marginBottom: 7,
  },
  campo: {
    borderWidth: 1, borderColor: CORES.borda, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, fontFamily: FONTES.regular, color: CORES.texto,
    backgroundColor: '#fbfcfd',
  },

  caixaErro: {
    backgroundColor: '#fdf2f2', borderWidth: 1, borderColor: '#f7d4d6',
    borderRadius: 10, padding: 12, marginBottom: 14,
  },
  textoErro: { fontFamily: FONTES.regular, fontSize: 12.5, color: CORES.vermelho, lineHeight: 18 },

  confirmacao: { marginTop: 4 },
  confirmacaoTexto: {
    fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco,
    textAlign: 'center', marginBottom: 12,
  },

  botoes: { flexDirection: 'row', gap: 10, marginTop: 4 },
  botaoSec: {
    flex: 1, borderWidth: 1, borderColor: CORES.borda, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  botaoSecTexto: { fontFamily: FONTES.semi, fontSize: 14, color: CORES.textoFraco },
  botaoPri: {
    flex: 2, backgroundColor: CORES.azul, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  botaoPriTexto: { fontFamily: FONTES.bold, fontSize: 14, color: CORES.branco },
  botaoPerigo: {
    flex: 2, backgroundColor: CORES.vermelho, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  botaoPerigoTexto: { fontFamily: FONTES.bold, fontSize: 14, color: CORES.branco },
})

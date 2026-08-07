import {
  createContext, useCallback, useContext, useMemo, useRef, useState,
  type ReactNode, type RefObject,
} from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, Modal, Image,
  Dimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, usePathname } from 'expo-router'
import { CORES, FONTES } from '@/constants/tema'
import { TOURS, FAQS, MSG_BOAS_VINDAS, type PassoTour, type Faq } from '@/lib/alu-conteudo'
import avatarAlu from '@/assets/images/alu-avatar.png'

type Retangulo = { x: number; y: number; largura: number; altura: number }

type AluContexto = {
  registrarAlvo: (id: string, medir: () => Promise<Retangulo | null>) => void
  registrarRolagem: (fn: (y: number) => void) => void
  abrir: () => void
}

const Ctx = createContext<AluContexto | undefined>(undefined)

export function useAlu() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAlu precisa estar dentro de <AluProvider>')
  return ctx
}

/**
 * Marca um elemento como alvo do tour.
 *
 * No site isso é um atributo `data-tour` e a ALU acha o elemento por seletor
 * CSS. Em React Native não existe DOM, então cada alvo se mede sozinho com
 * `measureInWindow` e se registra no contexto pelo `id`.
 *
 * `collapsable={false}` é obrigatório: sem ele o Android pode fundir esta View
 * na hierarquia por otimização, e aí ela deixa de existir para ser medida.
 */
export function AlvoAlu({ id, children, style }: {
  id: string
  children: ReactNode
  style?: object
}) {
  const { registrarAlvo } = useAlu()
  const ref = useRef<View>(null)

  const aoLayout = useCallback(() => {
    registrarAlvo(id, () => new Promise<Retangulo | null>(resolve => {
      if (!ref.current) return resolve(null)
      ref.current.measureInWindow((x, y, largura, altura) => {
        if (largura === 0 && altura === 0) return resolve(null)
        resolve({ x, y, largura, altura })
      })
    }))
  }, [id, registrarAlvo])

  return (
    <View ref={ref} style={style} onLayout={aoLayout} collapsable={false}>
      {children}
    </View>
  )
}

export function AluProvider({ children }: { children: ReactNode }) {
  const alvos = useRef(new Map<string, () => Promise<Retangulo | null>>())
  const rolar = useRef<((y: number) => void) | null>(null)
  const [aberto, setAberto] = useState(false)

  const registrarAlvo = useCallback((id: string, medir: () => Promise<Retangulo | null>) => {
    alvos.current.set(id, medir)
  }, [])
  const registrarRolagem = useCallback((fn: (y: number) => void) => {
    rolar.current = fn
  }, [])
  const abrir = useCallback(() => setAberto(true), [])

  const valor = useMemo(
    () => ({ registrarAlvo, registrarRolagem, abrir }),
    [registrarAlvo, registrarRolagem, abrir],
  )

  return (
    <Ctx.Provider value={valor}>
      {children}
      <Assistente
        aberto={aberto}
        setAberto={setAberto}
        alvos={alvos}
        rolar={rolar}
      />
    </Ctx.Provider>
  )
}

type Msg = { autor: 'alu' | 'voce'; linhas: string[] }

function Assistente({ aberto, setAberto, alvos, rolar }: {
  aberto: boolean
  setAberto: (v: boolean) => void
  alvos: RefObject<Map<string, () => Promise<Retangulo | null>>>
  rolar: RefObject<((y: number) => void) | null>
}) {
  const insets = useSafeAreaInsets()
  const rota = usePathname()

  const [msgs, setMsgs] = useState<Msg[]>([MSG_BOAS_VINDAS])
  const [passos, setPassos] = useState<PassoTour[]>([])
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState<Retangulo | null>(null)
  const [proxima, setProxima] = useState<{ rota: string; label: string } | null>(null)

  const emTour = passos.length > 0
  const passo = passos[idx]
  // A ALU é a assistente do portal do proprietário: não aparece no login, nas
  // boas-vindas nem na área da equipe.
  const noPortal = rota === '/proprietario' || rota === '/rentabilidade' || rota === '/historico'

  const posicionar = useCallback(async (p: PassoTour | undefined) => {
    if (!p?.alvo) { setRect(null); return }
    const medir = alvos.current?.get(p.alvo)
    if (!medir) { setRect(null); return }

    let r = await medir()
    const tela = Dimensions.get('window')

    // Se o alvo está fora da área visível, rola até ele e mede de novo.
    if (r && (r.y < 80 || r.y + r.altura > tela.height - 160) && rolar.current) {
      rolar.current(Math.max(0, r.y))
      await new Promise(res => setTimeout(res, 380))
      r = await medir()
    }
    setRect(r)
  }, [alvos, rolar])

  const irPara = useCallback(async (novo: number, lista: PassoTour[]) => {
    setIdx(novo)
    await posicionar(lista[novo])
  }, [posicionar])

  async function iniciarTour() {
    const config = TOURS[rota]
    if (!config) {
      setMsgs(m => [...m, {
        autor: 'alu',
        linhas: ['Ainda não tenho um tour para esta tela. Abra a aba Início que eu te mostro tudo desde o começo. 😊'],
      }])
      return
    }
    setAberto(false)
    setProxima(config.proxima ?? null)
    setPassos(config.passos)
    setIdx(0)
    // Aguarda o modal fechar antes de medir, senão as coordenadas saem erradas.
    setTimeout(() => posicionar(config.passos[0]), 260)
  }

  function encerrarTour() {
    setPassos([])
    setIdx(0)
    setRect(null)
    setProxima(null)
  }

  function continuarNaProxima() {
    const destino = proxima?.rota
    encerrarTour()
    if (destino) router.replace(destino as never)
  }

  function responder(faq: Faq) {
    setMsgs(m => [
      ...m,
      { autor: 'voce', linhas: [faq.pergunta] },
      { autor: 'alu', linhas: faq.resposta },
    ])
  }

  return (
    <>
      {/* Botão flutuante — some durante o tour para não cobrir o destaque */}
      {!emTour && noPortal && (
        <Pressable
          onPress={() => setAberto(true)}
          style={[e.fab, { bottom: insets.bottom + 74 }]}
          accessibilityLabel="Abrir a assistente ALU"
        >
          <Image source={avatarAlu} style={e.fabImagem} alt="ALU, assistente AlugEasy" />
        </Pressable>
      )}

      {/* ─── Painel de conversa ─── */}
      <Modal visible={aberto} animationType="slide" transparent onRequestClose={() => setAberto(false)}>
        <View style={e.fundoModal}>
          <Pressable style={{ flex: 1 }} onPress={() => setAberto(false)} />

          <View style={[e.painel, { paddingBottom: insets.bottom + 12 }]}>
            <View style={e.painelTopo}>
              <Image source={avatarAlu} style={e.painelAvatar} alt="" />
              <View style={{ flex: 1 }}>
                <Text style={e.painelNome}>ALU</Text>
                <Text style={e.painelPapel}>Assistente AlugEasy</Text>
              </View>
              <Pressable onPress={() => setAberto(false)} hitSlop={12}>
                <Text style={e.fechar}>×</Text>
              </Pressable>
            </View>

            <ScrollView style={e.conversa} contentContainerStyle={{ paddingVertical: 14 }}>
              {msgs.map((m, i) => (
                <View
                  key={i}
                  style={[e.balao, m.autor === 'voce' ? e.balaoVoce : e.balaoAlu]}
                >
                  {m.linhas.map((linha, j) => (
                    <Text
                      key={j}
                      style={[
                        e.balaoTexto,
                        m.autor === 'voce' && { color: CORES.branco },
                        j > 0 && { marginTop: 6 },
                      ]}
                    >
                      {linha}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>

            <View style={e.acoes}>
              <Pressable style={e.botaoTour} onPress={iniciarTour}>
                <Text style={e.botaoTourTexto}>▶  Fazer o tour desta tela</Text>
              </Pressable>

              <Text style={e.tituloFaq}>Dúvidas frequentes</Text>
              <ScrollView style={{ maxHeight: 168 }} nestedScrollEnabled>
                {FAQS.map(f => (
                  <Pressable key={f.id} style={e.chipFaq} onPress={() => responder(f)}>
                    <Text style={e.chipFaqTexto}>{f.pergunta}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Tour guiado ─── */}
      {emTour && passo && (
        <Modal visible transparent animationType="fade" onRequestClose={encerrarTour}>
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {/* Escurece a tela ao redor do alvo. Em vez de recortar um buraco —
                que exigiria máscara SVG — desenhamos quatro retângulos em volta. */}
            {rect ? (
              <>
                <View style={[e.veu, { top: 0, left: 0, right: 0, height: Math.max(0, rect.y - 6) }]} />
                <View style={[e.veu, { top: rect.y + rect.altura + 6, left: 0, right: 0, bottom: 0 }]} />
                <View style={[e.veu, { top: rect.y - 6, left: 0, width: Math.max(0, rect.x - 6), height: rect.altura + 12 }]} />
                <View style={[e.veu, { top: rect.y - 6, left: rect.x + rect.largura + 6, right: 0, height: rect.altura + 12 }]} />
                <View
                  pointerEvents="none"
                  style={[e.destaque, {
                    top: rect.y - 6, left: rect.x - 6,
                    width: rect.largura + 12, height: rect.altura + 12,
                  }]}
                />
              </>
            ) : (
              <View style={[e.veu, StyleSheet.absoluteFill]} />
            )}

            <View
              style={[
                e.cartaoTour,
                posicaoDoCartao(rect, insets.bottom),
              ]}
            >
              <View style={e.cartaoTopo}>
                <Image source={avatarAlu} style={e.cartaoAvatar} alt="" />
                <Text style={e.cartaoPasso}>{idx + 1} de {passos.length}</Text>
                <Pressable onPress={encerrarTour} hitSlop={12}>
                  <Text style={e.cartaoPular}>Pular</Text>
                </Pressable>
              </View>

              <Text style={e.cartaoTitulo}>{passo.titulo}</Text>
              <Text style={e.cartaoTexto}>{passo.texto}</Text>

              <View style={e.pontos}>
                {passos.map((_, i) => (
                  <View key={i} style={[e.ponto, i === idx && e.pontoAtivo]} />
                ))}
              </View>

              <View style={e.cartaoBotoes}>
                {idx > 0 && (
                  <Pressable style={e.botaoSec} onPress={() => irPara(idx - 1, passos)}>
                    <Text style={e.botaoSecTexto}>Voltar</Text>
                  </Pressable>
                )}

                {idx < passos.length - 1 ? (
                  <Pressable style={e.botaoPri} onPress={() => irPara(idx + 1, passos)}>
                    <Text style={e.botaoPriTexto}>Próximo</Text>
                  </Pressable>
                ) : proxima ? (
                  <Pressable style={e.botaoPri} onPress={continuarNaProxima}>
                    <Text style={e.botaoPriTexto}>{proxima.label}</Text>
                  </Pressable>
                ) : (
                  <Pressable style={e.botaoPri} onPress={encerrarTour}>
                    <Text style={e.botaoPriTexto}>Concluir</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  )
}

/** Coloca o cartão do lado com mais espaço livre, para não tapar o destaque. */
function posicaoDoCartao(rect: Retangulo | null, base: number): object {
  const tela = Dimensions.get('window')
  if (!rect) {
    return { top: tela.height / 2 - 150, left: 20, right: 20 }
  }
  const espacoAbaixo = tela.height - (rect.y + rect.altura)
  return espacoAbaixo > 280
    ? { top: rect.y + rect.altura + 16, left: 16, right: 16 }
    : { bottom: Math.max(base + 16, tela.height - rect.y + 16), left: 16, right: 16 }
}

const e = StyleSheet.create({
  fab: {
    position: 'absolute', right: 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: CORES.branco,
    borderWidth: 2, borderColor: CORES.azul,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#0f2647', shadowOpacity: 0.25, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabImagem: { width: 56, height: 56, resizeMode: 'cover' },

  fundoModal: { flex: 1, backgroundColor: 'rgba(15,26,46,0.45)' },
  painel: {
    backgroundColor: CORES.branco,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 18, paddingTop: 16, maxHeight: '82%',
  },
  painelTopo: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: CORES.borda,
  },
  painelAvatar: { width: 42, height: 42, borderRadius: 21 },
  painelNome: { fontFamily: FONTES.bold, fontSize: 16, color: CORES.texto },
  painelPapel: { fontFamily: FONTES.regular, fontSize: 12, color: CORES.textoApagado },
  fechar: { fontSize: 26, color: CORES.textoApagado, lineHeight: 28 },

  conversa: { maxHeight: 260 },
  balao: { borderRadius: 14, padding: 13, marginBottom: 10, maxWidth: '92%' },
  balaoAlu: { backgroundColor: CORES.fundo, alignSelf: 'flex-start' },
  balaoVoce: { backgroundColor: CORES.azul, alignSelf: 'flex-end' },
  balaoTexto: { fontFamily: FONTES.regular, fontSize: 13.5, color: CORES.texto, lineHeight: 20 },

  acoes: { borderTopWidth: 1, borderTopColor: CORES.borda, paddingTop: 14 },
  botaoTour: {
    backgroundColor: CORES.azul, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', marginBottom: 16,
  },
  botaoTourTexto: { fontFamily: FONTES.bold, fontSize: 14, color: CORES.branco },
  tituloFaq: {
    fontFamily: FONTES.bold, fontSize: 10.5, letterSpacing: 0.7,
    textTransform: 'uppercase', color: CORES.textoApagado, marginBottom: 8,
  },
  chipFaq: {
    borderWidth: 1, borderColor: CORES.borda, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 7,
    backgroundColor: '#fbfcfd',
  },
  chipFaqTexto: { fontFamily: FONTES.media, fontSize: 13, color: CORES.texto },

  veu: { position: 'absolute', backgroundColor: 'rgba(15,26,46,0.72)' },
  destaque: {
    position: 'absolute', borderRadius: 14,
    borderWidth: 2, borderColor: '#facc15',
  },

  cartaoTour: {
    position: 'absolute',
    backgroundColor: CORES.branco, borderRadius: 18, padding: 20,
    shadowColor: '#0f2647', shadowOpacity: 0.3, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  cartaoAvatar: { width: 30, height: 30, borderRadius: 15 },
  cartaoPasso: { flex: 1, fontFamily: FONTES.bold, fontSize: 11, color: CORES.textoApagado, letterSpacing: 0.4 },
  cartaoPular: { fontFamily: FONTES.media, fontSize: 12.5, color: CORES.textoFraco },
  cartaoTitulo: { fontFamily: FONTES.bold, fontSize: 16.5, color: CORES.texto, marginBottom: 8 },
  cartaoTexto: { fontFamily: FONTES.regular, fontSize: 13.5, color: CORES.textoFraco, lineHeight: 21 },

  pontos: { flexDirection: 'row', gap: 5, marginTop: 16, marginBottom: 14 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: CORES.borda },
  pontoAtivo: { backgroundColor: CORES.azul, width: 18 },

  cartaoBotoes: { flexDirection: 'row', gap: 10 },
  botaoSec: {
    flex: 1, borderWidth: 1, borderColor: CORES.borda, borderRadius: 11,
    paddingVertical: 12, alignItems: 'center',
  },
  botaoSecTexto: { fontFamily: FONTES.semi, fontSize: 13.5, color: CORES.textoFraco },
  botaoPri: {
    flex: 2, backgroundColor: CORES.azul, borderRadius: 11,
    paddingVertical: 12, alignItems: 'center',
  },
  botaoPriTexto: { fontFamily: FONTES.bold, fontSize: 13.5, color: CORES.branco },
})

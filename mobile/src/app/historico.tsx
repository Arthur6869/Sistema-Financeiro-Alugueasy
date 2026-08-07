import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth, ehProprietarioAtivo } from '@/lib/auth'
import { CORES, FONTES, moeda, MESES, MESES_ABREV } from '@/constants/tema'
import { BottomNav } from '@/components/bottom-nav'
import { Painel } from '@/components/painel'
import { AlvoAlu, useAlu } from '@/components/alu'

type MesLinha = {
  mes: number
  ano: number
  faturamento: number
  custos: number
  lucro: number
  repasse: number
  valorProprietario: number
  ehAtual: boolean
  semDados: boolean
}

type SerieImovel = {
  id: string
  nome: string
  meses: { label: string; faturamento: number; custos: number; lucro: number }[]
}

export default function Historico() {
  const { perfil, carregando: carregandoAuth } = useAuth()
  const insets = useSafeAreaInsets()
  const { registrarRolagem } = useAlu()
  const scrollRef = useRef<ScrollView>(null)

  const [linhas, setLinhas] = useState<MesLinha[]>([])
  const [porImovel, setPorImovel] = useState<SerieImovel[]>([])
  const [imovelSelecionado, setImovelSelecionado] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehProprietarioAtivo(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      const agora = new Date()
      const mesAtual = agora.getMonth() + 1
      const anoAtual = agora.getFullYear()

      // 12 meses, do mais antigo para o mês corrente
      const periodos = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(anoAtual, agora.getMonth() - i, 1)
        return { m: d.getMonth() + 1, a: d.getFullYear() }
      }).reverse()

      const { data: vinculos, error: erroVinculos } = await supabase
        .from('proprietario_apartamentos')
        .select('apartamentos(id, numero, taxa_repasse, tipo_repasse, empreendimentos(nome))')
        .eq('ativo', true)
      if (erroVinculos) throw erroVinculos

      type Bruto = {
        apartamentos: {
          id: string; numero: string
          taxa_repasse: number | null
          tipo_repasse: 'lucro' | 'faturamento' | null
          empreendimentos: { nome: string } | null
        } | null
      }

      const apartamentos = ((vinculos ?? []) as unknown as Bruto[])
        .map(v => v.apartamentos)
        .filter((a): a is NonNullable<Bruto['apartamentos']> => a !== null)

      const aptIds = apartamentos.map(a => a.id)
      const inicioJanela = `${periodos[0].a}-${String(periodos[0].m).padStart(2, '0')}-01`
      const ultimo = periodos[periodos.length - 1]
      const fimJanela = new Date(ultimo.a, ultimo.m, 0).toISOString().slice(0, 10)

      // O portal web dispara 24 requisições (duas por mês). No celular isso pesa,
      // então buscamos a janela inteira de uma vez e agregamos por mês aqui.
      const [diariasRes, custosRes] = aptIds.length === 0
        ? [{ data: [], error: null }, { data: [], error: null }]
        : await Promise.all([
            supabase.from('diarias').select('apartamento_id, valor, data')
              .in('apartamento_id', aptIds).gte('data', inicioJanela).lte('data', fimJanela),
            supabase.from('custos_proprietario').select('apartamento_id, valor, mes, ano')
              .in('apartamento_id', aptIds)
              .gte('ano', periodos[0].a).lte('ano', ultimo.a),
          ])
      if (diariasRes.error) throw diariasRes.error

      const diarias = (diariasRes.data ?? []) as { apartamento_id: string; valor: number | null; data: string }[]
      const custos = (custosRes.data ?? []) as { apartamento_id: string; valor: number | null; mes: number; ano: number }[]

      // Mesma regra do portal: taxa e tipo vêm do PRIMEIRO imóvel e valem para a
      // carteira inteira. Mudar isso aqui faria os números divergirem do site.
      const taxa = Number(apartamentos[0]?.taxa_repasse ?? 0) / 100
      const tipoRepasse = apartamentos[0]?.tipo_repasse ?? 'lucro'

      const montadas: MesLinha[] = periodos.map(({ m, a }) => {
        const chave = `${a}-${String(m).padStart(2, '0')}`
        const faturamento = diarias
          .filter(d => (d.data ?? '').startsWith(chave))
          .reduce((s, d) => s + Number(d.valor ?? 0), 0)
        const custosMes = custos
          .filter(c => c.mes === m && c.ano === a)
          .reduce((s, c) => s + Number(c.valor ?? 0), 0)
        const lucro = faturamento - custosMes
        const base = tipoRepasse === 'faturamento' ? faturamento : lucro
        const repasse = base * taxa
        return {
          mes: m, ano: a, faturamento, custos: custosMes, lucro, repasse,
          valorProprietario: lucro - repasse,
          ehAtual: m === mesAtual && a === anoAtual,
          semDados: faturamento === 0 && custosMes === 0,
        }
      })

      setLinhas(montadas)

      setPorImovel(apartamentos.map(apt => ({
        id: apt.id,
        nome: apt.empreendimentos?.nome
          ? `${apt.empreendimentos.nome} · ${apt.numero}`
          : `Apto ${apt.numero}`,
        meses: periodos.map(({ m, a }) => {
          const chave = `${a}-${String(m).padStart(2, '0')}`
          const faturamento = diarias
            .filter(d => d.apartamento_id === apt.id && (d.data ?? '').startsWith(chave))
            .reduce((s, d) => s + Number(d.valor ?? 0), 0)
          const custosMes = custos
            .filter(c => c.apartamento_id === apt.id && c.mes === m && c.ano === a)
            .reduce((s, c) => s + Number(c.valor ?? 0), 0)
          return {
            label: `${MESES_ABREV[m - 1]}/${String(a).slice(2)}`,
            faturamento, custos: custosMes, lucro: faturamento - custosMes,
          }
        }),
      })))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o histórico.')
    } finally {
      setCarregando(false)
      setAtualizando(false)
    }
  }, [])

  useEffect(() => {
    if (ehProprietarioAtivo(perfil)) { setCarregando(true); buscar() }
  }, [perfil, buscar])

  useEffect(() => {
    registrarRolagem(y => scrollRef.current?.scrollTo({ y: Math.max(0, y - 140), animated: true }))
  }, [registrarRolagem])

  const temRepasse = linhas.some(l => !l.semDados && l.valorProprietario > 0)
  const maxRepasse = Math.max(...linhas.map(l => Math.max(l.valorProprietario, 0)), 1)

  const imovel = porImovel[imovelSelecionado]
  const totais = useMemo(() => {
    if (!imovel) return { faturamento: 0, custos: 0, lucro: 0 }
    return imovel.meses.reduce(
      (acc, m) => ({
        faturamento: acc.faturamento + m.faturamento,
        custos: acc.custos + m.custos,
        lucro: acc.lucro + m.lucro,
      }),
      { faturamento: 0, custos: 0, lucro: 0 },
    )
  }, [imovel])

  return (
    <View style={e.tela}>
      <View style={[e.barraTopo, { paddingTop: insets.top + 12 }]}>
        <Text style={e.marca}>Histórico</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => { setAtualizando(true); buscar() }}
            tintColor={CORES.azul}
          />
        }
      >
        <View style={e.saudacaoBloco}>
          <Text style={e.saudacao}>Histórico</Text>
          <Text style={e.saudacaoSub}>
            Últimos 12 meses — toque no mês para ver a rentabilidade completa
          </Text>
        </View>

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : (
          <>
            <AlvoAlu id="his-grafico">
            <Painel titulo="Carteira mensal" subtitulo="Evolução do valor recebido mês a mês">
              {!temRepasse ? (
                <View style={e.vazioGrafico}>
                  <Text style={e.vazioGraficoTexto}>
                    Nenhum repasse registrado ainda nos últimos 12 meses
                  </Text>
                </View>
              ) : (
                <View style={e.grafico}>
                  {linhas.map(l => (
                    <View key={`${l.ano}-${l.mes}`} style={e.coluna}>
                      <View
                        style={[e.barraRepasse, {
                          height: Math.max(2, (Math.max(l.valorProprietario, 0) / maxRepasse) * 130),
                        }]}
                      />
                      <Text style={e.colunaLabel}>{MESES_ABREV[l.mes - 1].slice(0, 1)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Painel>
            </AlvoAlu>

            {porImovel.length > 0 && imovel && (
              <AlvoAlu id="his-imovel">
              <Painel
                titulo="Desempenho por imóvel"
                subtitulo="Faturamento × custos de cada imóvel, mês a mês"
              >
                {porImovel.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={e.chips}
                  >
                    {porImovel.map((im, i) => (
                      <Pressable
                        key={im.id}
                        onPress={() => setImovelSelecionado(i)}
                        style={[e.chip, i === imovelSelecionado && e.chipAtivo]}
                      >
                        <Text style={[e.chipTexto, i === imovelSelecionado && e.chipTextoAtivo]}>
                          {im.nome}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}

                <View style={e.tiles}>
                  <Tile cor="#1e5aa8" rotulo="Faturamento 12m" valor={moeda(totais.faturamento)} />
                  <Tile cor="#dc2626" rotulo="Custos 12m" valor={moeda(totais.custos)} />
                  <Tile
                    cor="#15803d"
                    rotulo="Lucro 12m"
                    valor={moeda(totais.lucro)}
                    corValor={totais.lucro >= 0 ? '#14532d' : '#b91c1c'}
                  />
                </View>

                {totais.faturamento === 0 && totais.custos === 0 ? (
                  <View style={e.vazioGrafico}>
                    <Text style={e.vazioGraficoTexto}>
                      Este imóvel ainda não registrou faturamento nem custos nos últimos 12 meses
                    </Text>
                  </View>
                ) : (
                  <GraficoImovel meses={imovel.meses} />
                )}
              </Painel>
              </AlvoAlu>
            )}

            <AlvoAlu id="his-tabela">
            <Painel titulo="Resumo detalhado">
              <View style={e.tabelaCabecalho}>
                <Text style={[e.th, { flex: 1.3 }]}>Mês</Text>
                <Text style={[e.th, { flex: 1 }]}>Status</Text>
                <Text style={[e.th, e.thNum, { flex: 1.2 }]}>Seu valor</Text>
              </View>

              {linhas.map((l, i) => {
                const conteudo = (
                  <View style={[e.tr, i === linhas.length - 1 && { borderBottomWidth: 0 }]}>
                    <Text style={[e.tdMes, { flex: 1.3 }]}>{MESES[l.mes - 1]} {l.ano}</Text>
                    <View style={{ flex: 1 }}>
                      <Pill
                        texto={l.semDados ? (l.ehAtual ? 'Em andamento' : 'Sem dados') : 'Disponível'}
                        variante={l.semDados ? (l.ehAtual ? 'atual' : 'sem') : 'ok'}
                      />
                    </View>
                    {l.semDados
                      ? <Text style={[e.tdNum, e.tdDim, { flex: 1.2 }]}>—</Text>
                      : <Text style={[e.tdNum, e.tdRepasse, { flex: 1.2 }]}>{moeda(l.valorProprietario)}</Text>}
                  </View>
                )

                // Só meses com dados navegam — igual ao portal, onde a linha sem
                // dados não é clicável.
                return l.semDados ? (
                  <View key={`${l.ano}-${l.mes}`}>{conteudo}</View>
                ) : (
                  <Pressable
                    key={`${l.ano}-${l.mes}`}
                    onPress={() => router.push(`/rentabilidade?mes=${l.mes}&ano=${l.ano}` as never)}
                    android_ripple={{ color: '#f8f6f1' }}
                  >
                    {conteudo}
                  </Pressable>
                )
              })}
            </Painel>
            </AlvoAlu>
          </>
        )}
      </ScrollView>

      <BottomNav />
    </View>
  )
}

function Tile({ cor, rotulo, valor, corValor }: {
  cor: string; rotulo: string; valor: string; corValor?: string
}) {
  return (
    <View style={e.tile}>
      <View style={e.tileEsquerda}>
        <View style={[e.tilePonto, { backgroundColor: cor }]} />
        <Text style={e.tileRotulo}>{rotulo}</Text>
      </View>
      <Text style={[e.tileValor, corValor ? { color: corValor } : null]}>{valor}</Text>
    </View>
  )
}

function Pill({ texto, variante }: { texto: string; variante: 'ok' | 'sem' | 'atual' }) {
  const estilo = variante === 'ok' ? e.pillOk : variante === 'atual' ? e.pillAtual : e.pillSem
  const cor = variante === 'ok' ? '#14532d' : variante === 'atual' ? '#0c447c' : '#94a3b8'
  return (
    <View style={[e.pill, estilo]}>
      <Text style={[e.pillTexto, { color: cor }]}>{texto}</Text>
    </View>
  )
}

function GraficoImovel({ meses }: { meses: { label: string; faturamento: number; custos: number }[] }) {
  const max = Math.max(...meses.map(m => Math.max(m.faturamento, m.custos)), 1)
  return (
    <View>
      <View style={e.legenda}>
        <View style={e.legendaItem}>
          <View style={[e.legendaCor, { backgroundColor: '#1e5aa8' }]} />
          <Text style={e.legendaTexto}>Faturamento</Text>
        </View>
        <View style={e.legendaItem}>
          <View style={[e.legendaCor, { backgroundColor: '#dc2626' }]} />
          <Text style={e.legendaTexto}>Custos</Text>
        </View>
      </View>
      <View style={e.grafico}>
        {meses.map((m, i) => (
          <View key={`${m.label}-${i}`} style={e.coluna}>
            <View style={e.parBarras}>
              <View style={[e.barraFina, { height: Math.max(2, (m.faturamento / max) * 120), backgroundColor: '#1e5aa8' }]} />
              <View style={[e.barraFina, { height: Math.max(2, (m.custos / max) * 120), backgroundColor: '#dc2626' }]} />
            </View>
            <Text style={e.colunaLabel}>{m.label.slice(0, 1)}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  barraTopo: {
    backgroundColor: CORES.branco, paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: CORES.borda,
  },
  marca: { fontFamily: FONTES.bold, fontSize: 18, color: CORES.azul },

  saudacaoBloco: { marginBottom: 20 },
  saudacao: { fontFamily: FONTES.serifada, fontSize: 28, color: CORES.texto, marginBottom: 4 },
  saudacaoSub: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco, lineHeight: 19 },

  grafico: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160 },
  coluna: { flex: 1, alignItems: 'center' },
  barraRepasse: { width: 12, backgroundColor: '#15803d', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  parBarras: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 122 },
  barraFina: { width: 6, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  colunaLabel: { fontFamily: FONTES.media, fontSize: 10, color: CORES.textoApagado, marginTop: 8 },

  vazioGrafico: { height: 160, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  vazioGraficoTexto: {
    fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoApagado,
    textAlign: 'center', lineHeight: 19,
  },

  chips: { gap: 8, paddingBottom: 16 },
  chip: {
    borderWidth: 1, borderColor: CORES.borda, backgroundColor: CORES.branco,
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 7,
  },
  chipAtivo: { backgroundColor: CORES.azul, borderColor: CORES.azul },
  chipTexto: { fontFamily: FONTES.semi, fontSize: 12, color: CORES.textoFraco },
  chipTextoAtivo: { color: CORES.branco },

  tiles: { gap: 8, marginBottom: 18 },
  tile: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f8f9fb', borderWidth: 1, borderColor: '#f0f1f4',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  tileEsquerda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tilePonto: { width: 8, height: 8, borderRadius: 2 },
  tileRotulo: {
    fontFamily: FONTES.bold, fontSize: 10, letterSpacing: 0.5,
    textTransform: 'uppercase', color: CORES.textoApagado,
  },
  tileValor: { fontFamily: FONTES.bold, fontSize: 14, color: CORES.texto },

  legenda: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendaCor: { width: 9, height: 9, borderRadius: 2 },
  legendaTexto: { fontFamily: FONTES.regular, fontSize: 11.5, color: '#374151' },

  tabelaCabecalho: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: CORES.borda,
  },
  th: {
    fontFamily: FONTES.bold, fontSize: 10.5, letterSpacing: 0.6,
    textTransform: 'uppercase', color: CORES.textoApagado,
  },
  thNum: { textAlign: 'right' },
  tr: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f1f2f5',
  },
  tdMes: { fontFamily: FONTES.semi, fontSize: 13.5, color: CORES.texto },
  tdNum: { fontFamily: FONTES.semi, fontSize: 14, color: CORES.texto, textAlign: 'right' },
  tdDim: { color: CORES.textoApagado, fontFamily: FONTES.media },
  tdRepasse: { color: '#14532d', fontFamily: FONTES.bold },

  pill: { alignSelf: 'flex-start', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  pillOk: { backgroundColor: '#f0fdf4' },
  pillSem: { backgroundColor: '#f1f2f5' },
  pillAtual: { backgroundColor: '#e6f1fb' },
  pillTexto: { fontFamily: FONTES.bold, fontSize: 10, letterSpacing: 0.3 },

  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
})

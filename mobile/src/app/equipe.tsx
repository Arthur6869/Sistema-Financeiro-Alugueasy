import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, FONTES, moeda, MESES } from '@/constants/tema'
import { KpiCard } from '@/components/kpi-card'
import { Painel, Vazio } from '@/components/painel'

/**
 * Painel da equipe interna, no mesmo visual do dashboard web.
 *
 * Analista e admin leem tudo; a diferença entre eles é escrita, e o app hoje só
 * lê. Quando entrar edição, lembrar que `admin` é somente leitura por desenho —
 * a RLS bloqueia a escrita dele em silêncio (sem erro, zero linhas afetadas).
 */
export default function Equipe() {
  const { perfil, carregando: carregandoAuth, sair } = useAuth()
  const insets = useSafeAreaInsets()

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  const [kpis, setKpis] = useState({ faturamento: 0, diarias: 0, imoveis: 0, reservas: 0 })
  const [porEmpreendimento, setPorEmpreendimento] = useState<{ nome: string; valor: number }[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehEquipe(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const fim = new Date(ano, mes, 0).toISOString().slice(0, 10)

      const [aptsRes, diariasRes, reservasRes] = await Promise.all([
        supabase.from('apartamentos').select('id, numero, empreendimentos(nome)'),
        supabase.from('diarias').select('apartamento_id, valor').gte('data', inicio).lte('data', fim),
        supabase.from('amenitiz_reservas').select('id', { count: 'exact', head: true })
          .gte('checkin', inicio).lte('checkin', fim),
      ])
      if (aptsRes.error) throw aptsRes.error
      if (diariasRes.error) throw diariasRes.error

      type Apt = { id: string; numero: string; empreendimentos: { nome: string } | null }
      const apts = (aptsRes.data ?? []) as unknown as Apt[]
      const nomePorApt = new Map(apts.map(a => [a.id, a.empreendimentos?.nome ?? '—']))

      let faturamento = 0
      const porEmp = new Map<string, number>()
      for (const d of diariasRes.data ?? []) {
        const v = Number(d.valor) || 0
        faturamento += v
        const nome = nomePorApt.get(d.apartamento_id) ?? '—'
        porEmp.set(nome, (porEmp.get(nome) ?? 0) + v)
      }

      setKpis({
        faturamento,
        diarias: diariasRes.data?.length ?? 0,
        imoveis: apts.length,
        reservas: reservasRes.count ?? 0,
      })
      setPorEmpreendimento(
        [...porEmp.entries()].map(([nome, valor]) => ({ nome, valor }))
          .sort((a, b) => b.valor - a.valor)
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os dados.')
    } finally {
      setCarregando(false)
      setAtualizando(false)
    }
  }, [mes, ano])

  useEffect(() => {
    if (ehEquipe(perfil)) { setCarregando(true); buscar() }
  }, [perfil, buscar])

  function mudarMes(delta: number) {
    let m = mes + delta, a = ano
    if (m < 1) { m = 12; a -= 1 }
    if (m > 12) { m = 1; a += 1 }
    setMes(m); setAno(a)
  }

  const periodo = `${MESES[mes - 1]} ${ano}`
  const totalEmp = porEmpreendimento.reduce((s, x) => s + x.valor, 0)

  return (
    <View style={e.tela}>
      <View style={[e.barraTopo, { paddingTop: insets.top + 12 }]}>
        <Text style={e.marca}>AlugEasy</Text>
        <Pressable onPress={() => sair().then(() => router.replace('/login'))} hitSlop={10}>
          <Text style={e.sair}>Sair</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => { setAtualizando(true); buscar() }}
            tintColor={CORES.azul}
          />
        }
      >
        <View style={e.saudacaoBloco}>
          <Text style={e.saudacao}>Painel de gestão</Text>
          <Text style={e.saudacaoSub}>
            {perfil?.full_name} · {perfil?.role === 'admin' ? 'Admin (somente leitura)' : 'Analista'}
          </Text>
        </View>

        <View style={e.seletor}>
          <Pressable onPress={() => mudarMes(-1)} hitSlop={12} style={e.seta}>
            <Text style={e.setaTexto}>‹</Text>
          </Pressable>
          <Text style={e.periodoTexto}>{periodo}</Text>
          <Pressable onPress={() => mudarMes(1)} hitSlop={12} style={e.seta}>
            <Text style={e.setaTexto}>›</Text>
          </Pressable>
        </View>

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : (
          <>
            <KpiCard
              rotulo="Faturamento do mês"
              valor={moeda(kpis.faturamento)}
              rodape={periodo}
              corBarra={CORES.barraFaturamento}
              icone="↗"
              corIconeFundo={CORES.iconeFaturamentoFundo}
              estilo={{ marginBottom: 14 }}
            />

            <View style={e.grade}>
              <KpiCard
                rotulo="Diárias"
                valor={String(kpis.diarias)}
                rodape="lançadas no mês"
                corBarra={CORES.barraLucro}
                icone="▤"
                corIconeFundo={CORES.iconeLucroFundo}
                estilo={e.meia}
              />
              <KpiCard
                rotulo="Reservas"
                valor={String(kpis.reservas)}
                rodape="check-in no mês"
                corBarra={CORES.barraRepasse}
                icone="◈"
                corIconeFundo={CORES.iconeRepasseFundo}
                estilo={e.meia}
              />
            </View>

            <KpiCard
              rotulo="Imóveis cadastrados"
              valor={String(kpis.imoveis)}
              rodape="na carteira"
              corBarra={CORES.barraCustos}
              icone="⌂"
              corIconeFundo={CORES.iconeCustosFundo}
              estilo={{ marginBottom: 16 }}
            />

            <Painel titulo="Por empreendimento" subtitulo="Faturamento do período">
              {porEmpreendimento.length === 0 ? (
                <Vazio
                  titulo="Nenhuma diária no período"
                  descricao="Não há diárias lançadas para este mês ainda."
                />
              ) : porEmpreendimento.map((x, i) => (
                <View key={x.nome} style={[e.linha, i === porEmpreendimento.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={e.linhaNome} numberOfLines={1}>{x.nome}</Text>
                    <View style={e.trilho}>
                      <View style={[e.preenchimento, { width: `${totalEmp > 0 ? (x.valor / totalEmp) * 100 : 0}%` }]} />
                    </View>
                  </View>
                  <Text style={e.linhaValor}>{moeda(x.valor)}</Text>
                </View>
              ))}
            </Painel>

            <Text style={e.rodapePagina}>Puxe a tela para baixo para atualizar</Text>
          </>
        )}
      </ScrollView>
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  barraTopo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: CORES.branco, paddingHorizontal: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: CORES.borda,
  },
  marca: { fontFamily: FONTES.bold, fontSize: 18, color: CORES.azul },
  sair: { fontFamily: FONTES.media, fontSize: 13.5, color: CORES.textoFraco },

  saudacaoBloco: { marginBottom: 18 },
  saudacao: { fontFamily: FONTES.serifada, fontSize: 28, color: CORES.texto, marginBottom: 4 },
  saudacaoSub: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco },

  seletor: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18,
    backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.borda,
    borderRadius: 9, paddingVertical: 9, marginBottom: 20,
  },
  seta: { paddingHorizontal: 10 },
  setaTexto: { fontSize: 22, color: CORES.azul, lineHeight: 26 },
  periodoTexto: { fontFamily: FONTES.media, fontSize: 13, color: CORES.texto, minWidth: 130, textAlign: 'center' },

  grade: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  meia: { flex: 1 },

  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: CORES.borda,
  },
  linhaNome: { fontFamily: FONTES.media, fontSize: 13.5, color: CORES.texto },
  trilho: { height: 5, backgroundColor: CORES.areia, borderRadius: 100, marginTop: 7, overflow: 'hidden' },
  preenchimento: { height: '100%', backgroundColor: CORES.azul, borderRadius: 100 },
  linhaValor: { fontFamily: FONTES.bold, fontSize: 13.5, color: CORES.texto },

  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
  rodapePagina: {
    fontFamily: FONTES.regular, textAlign: 'center',
    color: CORES.textoApagado, fontSize: 11.5, marginTop: 6,
  },
})

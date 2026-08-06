import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, Pressable, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth, ehProprietarioAtivo } from '@/lib/auth'
import { CORES, moeda, MESES } from '@/constants/tema'

type Imovel = {
  id: string
  numero: string
  tipo_gestao: string | null
  empreendimento: string
  diarias: number
  faturamento: number
}

export default function Proprietario() {
  const { perfil, carregando: carregandoAuth, sair } = useAuth()

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  // Protege a tela mesmo se alguém chegar aqui por link direto.
  useEffect(() => {
    if (!carregandoAuth && !ehProprietarioAtivo(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      // A RLS já limita tudo aos imóveis deste proprietário — não é preciso (nem
      // seguro) filtrar por id do usuário aqui no cliente. O banco decide.
      const { data: vinculos, error: erroVinculos } = await supabase
        .from('proprietario_apartamentos')
        .select('apartamentos(id, numero, tipo_gestao, empreendimentos(nome))')
        .eq('ativo', true)

      if (erroVinculos) throw erroVinculos

      type Linha = {
        apartamentos: {
          id: string; numero: string; tipo_gestao: string | null
          empreendimentos: { nome: string } | null
        } | null
      }

      const apts = ((vinculos ?? []) as unknown as Linha[])
        .map(v => v.apartamentos)
        .filter((a): a is NonNullable<Linha['apartamentos']> => a !== null)

      if (apts.length === 0) { setImoveis([]); return }

      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const fim = new Date(ano, mes, 0).toISOString().slice(0, 10)

      const { data: diarias, error: erroDiarias } = await supabase
        .from('diarias')
        .select('apartamento_id, valor')
        .gte('data', inicio)
        .lte('data', fim)

      if (erroDiarias) throw erroDiarias

      const porApt = new Map<string, { qtd: number; total: number }>()
      for (const d of diarias ?? []) {
        const atual = porApt.get(d.apartamento_id) ?? { qtd: 0, total: 0 }
        atual.qtd += 1
        atual.total += Number(d.valor) || 0
        porApt.set(d.apartamento_id, atual)
      }

      setImoveis(apts.map(a => {
        const agg = porApt.get(a.id) ?? { qtd: 0, total: 0 }
        return {
          id: a.id,
          numero: a.numero,
          tipo_gestao: a.tipo_gestao,
          empreendimento: a.empreendimentos?.nome ?? '—',
          diarias: agg.qtd,
          faturamento: agg.total,
        }
      }).sort((x, y) => y.faturamento - x.faturamento))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar seus dados.')
    } finally {
      setCarregando(false)
      setAtualizando(false)
    }
  }, [mes, ano])

  useEffect(() => {
    if (ehProprietarioAtivo(perfil)) { setCarregando(true); buscar() }
  }, [perfil, buscar])

  function mudarMes(delta: number) {
    let m = mes + delta
    let a = ano
    if (m < 1) { m = 12; a -= 1 }
    if (m > 12) { m = 1; a += 1 }
    setMes(m); setAno(a)
  }

  const totalFaturamento = imoveis.reduce((s, i) => s + i.faturamento, 0)
  const totalDiarias = imoveis.reduce((s, i) => s + i.diarias, 0)
  const primeiroNome = perfil?.full_name?.split(' ')[0] ?? ''

  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.ola}>Olá, {primeiroNome}</Text>
          <Text style={estilos.marca}>AlugEasy</Text>
        </View>
        <Pressable onPress={() => sair().then(() => router.replace('/login'))} hitSlop={10}>
          <Text style={estilos.sair}>Sair</Text>
        </Pressable>
      </View>

      <View style={estilos.seletorMes}>
        <Pressable onPress={() => mudarMes(-1)} hitSlop={12} style={estilos.seta}>
          <Text style={estilos.setaTexto}>‹</Text>
        </Pressable>
        <Text style={estilos.mesTexto}>{MESES[mes - 1]} {ano}</Text>
        <Pressable onPress={() => mudarMes(1)} hitSlop={12} style={estilos.seta}>
          <Text style={estilos.setaTexto}>›</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => { setAtualizando(true); buscar() }}
            tintColor={CORES.azul}
          />
        }
      >
        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={estilos.caixaErro}><Text style={estilos.textoErro}>{erro}</Text></View>
        ) : (
          <>
            <View style={estilos.resumo}>
              <View style={estilos.blocoResumo}>
                <Text style={estilos.rotuloResumo}>Faturamento do mês</Text>
                <Text style={estilos.valorResumo}>{moeda(totalFaturamento)}</Text>
              </View>
              <View style={estilos.divisor} />
              <View style={estilos.blocoResumo}>
                <Text style={estilos.rotuloResumo}>Diárias</Text>
                <Text style={estilos.valorResumo}>{totalDiarias}</Text>
              </View>
            </View>

            <Text style={estilos.tituloSecao}>
              {imoveis.length === 1 ? 'Seu imóvel' : `Seus imóveis (${imoveis.length})`}
            </Text>

            {imoveis.length === 0 ? (
              <View style={estilos.vazio}>
                <Text style={estilos.textoVazio}>
                  Nenhum imóvel vinculado à sua conta ainda.
                </Text>
              </View>
            ) : imoveis.map(i => (
              <View key={i.id} style={estilos.cartao}>
                <View style={{ flex: 1 }}>
                  <Text style={estilos.nomeImovel}>{i.empreendimento} {i.numero}</Text>
                  <Text style={estilos.detalheImovel}>
                    {i.diarias} {i.diarias === 1 ? 'diária' : 'diárias'}
                    {i.tipo_gestao ? ` · ${i.tipo_gestao.toUpperCase()}` : ''}
                  </Text>
                </View>
                <Text style={estilos.valorImovel}>{moeda(i.faturamento)}</Text>
              </View>
            ))}

            <Text style={estilos.rodape}>
              Puxe a tela para baixo para atualizar
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  cabecalho: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CORES.azul, paddingHorizontal: 20, paddingVertical: 16,
  },
  ola: { color: '#c6d3e6', fontSize: 13 },
  marca: { color: CORES.branco, fontSize: 20, fontWeight: '700' },
  sair: { color: '#c6d3e6', fontSize: 13.5, fontWeight: '600' },
  seletorMes: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 20, backgroundColor: CORES.branco,
    borderBottomWidth: 1, borderBottomColor: CORES.borda, paddingVertical: 12,
  },
  seta: { paddingHorizontal: 10 },
  setaTexto: { fontSize: 26, color: CORES.azul, lineHeight: 30 },
  mesTexto: { fontSize: 15.5, fontWeight: '700', color: CORES.texto, minWidth: 150, textAlign: 'center' },
  resumo: {
    flexDirection: 'row', backgroundColor: CORES.azul,
    borderRadius: 16, padding: 20, marginBottom: 22,
  },
  blocoResumo: { flex: 1 },
  divisor: { width: 1, backgroundColor: 'rgba(255,255,255,.18)', marginHorizontal: 16 },
  rotuloResumo: { color: '#c6d3e6', fontSize: 12, marginBottom: 6 },
  valorResumo: { color: CORES.branco, fontSize: 21, fontWeight: '700' },
  tituloSecao: { fontSize: 13, fontWeight: '700', color: CORES.textoFraco, marginBottom: 10, letterSpacing: 0.3 },
  cartao: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: CORES.branco,
    borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: CORES.borda,
  },
  nomeImovel: { fontSize: 15, fontWeight: '600', color: CORES.texto },
  detalheImovel: { fontSize: 12.5, color: CORES.textoApagado, marginTop: 3 },
  valorImovel: { fontSize: 15.5, fontWeight: '700', color: CORES.verde },
  vazio: { backgroundColor: CORES.branco, borderRadius: 14, padding: 24, alignItems: 'center' },
  textoVazio: { color: CORES.textoApagado, fontSize: 13.5, textAlign: 'center' },
  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
  rodape: { textAlign: 'center', color: CORES.textoApagado, fontSize: 11.5, marginTop: 18 },
})

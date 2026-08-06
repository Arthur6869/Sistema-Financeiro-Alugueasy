import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, Pressable, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, moeda, MESES } from '@/constants/tema'

/**
 * Painel da equipe interna.
 *
 * Analista e admin leem tudo; a diferença entre eles é escrita, e o app hoje só
 * lê. Quando entrar edição, lembrar que `admin` é somente leitura por desenho —
 * a RLS bloqueia a escrita dele em silêncio (sem erro, zero linhas afetadas).
 */
export default function Equipe() {
  const { perfil, carregando: carregandoAuth, sair } = useAuth()

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
    let m = mes + delta
    let a = ano
    if (m < 1) { m = 12; a -= 1 }
    if (m > 12) { m = 1; a += 1 }
    setMes(m); setAno(a)
  }

  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <View style={{ flex: 1 }}>
          <Text style={estilos.ola}>
            {perfil?.full_name} · {perfil?.role === 'admin' ? 'Admin (leitura)' : 'Analista'}
          </Text>
          <Text style={estilos.marca}>Painel AlugEasy</Text>
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
            <View style={estilos.faturamentoCartao}>
              <Text style={estilos.rotuloGrande}>Faturamento do mês</Text>
              <Text style={estilos.valorGrande}>{moeda(kpis.faturamento)}</Text>
            </View>

            <View style={estilos.grade}>
              <Kpi rotulo="Diárias" valor={String(kpis.diarias)} />
              <Kpi rotulo="Reservas" valor={String(kpis.reservas)} />
              <Kpi rotulo="Imóveis" valor={String(kpis.imoveis)} />
            </View>

            <Text style={estilos.tituloSecao}>Por empreendimento</Text>
            {porEmpreendimento.length === 0 ? (
              <View style={estilos.vazio}>
                <Text style={estilos.textoVazio}>Nenhuma diária lançada neste mês.</Text>
              </View>
            ) : porEmpreendimento.map(e => (
              <View key={e.nome} style={estilos.linha}>
                <Text style={estilos.nomeLinha} numberOfLines={1}>{e.nome}</Text>
                <Text style={estilos.valorLinha}>{moeda(e.valor)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Kpi({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={estilos.kpi}>
      <Text style={estilos.kpiValor}>{valor}</Text>
      <Text style={estilos.kpiRotulo}>{rotulo}</Text>
    </View>
  )
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  cabecalho: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: CORES.azul, paddingHorizontal: 20, paddingVertical: 16,
  },
  ola: { color: '#c6d3e6', fontSize: 12.5 },
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
  faturamentoCartao: { backgroundColor: CORES.azul, borderRadius: 16, padding: 20, marginBottom: 12 },
  rotuloGrande: { color: '#c6d3e6', fontSize: 12, marginBottom: 6 },
  valorGrande: { color: CORES.branco, fontSize: 26, fontWeight: '700' },
  grade: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  kpi: {
    flex: 1, backgroundColor: CORES.branco, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: CORES.borda,
  },
  kpiValor: { fontSize: 19, fontWeight: '700', color: CORES.texto },
  kpiRotulo: { fontSize: 11.5, color: CORES.textoApagado, marginTop: 3 },
  tituloSecao: { fontSize: 13, fontWeight: '700', color: CORES.textoFraco, marginBottom: 10, letterSpacing: 0.3 },
  linha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, backgroundColor: CORES.branco, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 8,
    borderWidth: 1, borderColor: CORES.borda,
  },
  nomeLinha: { flex: 1, fontSize: 14, color: CORES.texto, fontWeight: '500' },
  valorLinha: { fontSize: 14.5, fontWeight: '700', color: CORES.texto },
  vazio: { backgroundColor: CORES.branco, borderRadius: 14, padding: 24, alignItems: 'center' },
  textoVazio: { color: CORES.textoApagado, fontSize: 13.5 },
  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
})

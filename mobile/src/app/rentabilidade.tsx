import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth, ehProprietarioAtivo } from '@/lib/auth'
import { CORES, FONTES, formatBRL, MESES } from '@/constants/tema'
import { BottomNav } from '@/components/bottom-nav'
import { ExtratoCard, type CustoCategoria } from '@/components/extrato-card'
import { AlvoAlu, useAlu } from '@/components/alu'

type Apartamento = {
  id: string
  numero: string
  tipo_gestao: 'adm' | 'sub' | null
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  modelo_contrato: 'administracao' | 'sublocacao' | null
  empreendimento: string
}

type Linha = {
  apt: Apartamento
  faturamento: number
  totalCustos: number
  lucro: number
  repasse: number
  valorFinal: number
  categorias: CustoCategoria[]
  semCustos: boolean
}

/** Mesma fórmula de `extrato/page.tsx:30-38`. */
function calcularRepasse(
  faturamento: number, lucro: number, taxa: number, tipo: 'lucro' | 'faturamento',
): number {
  const base = tipo === 'faturamento' ? faturamento : lucro
  return base * (taxa / 100)
}

export default function Rentabilidade() {
  const { perfil, carregando: carregandoAuth } = useAuth()
  const insets = useSafeAreaInsets()
  const { registrarRolagem } = useAlu()
  const scrollRef = useRef<ScrollView>(null)

  // O Histórico navega para cá com o mês escolhido na tabela.
  const params = useLocalSearchParams<{ mes?: string; ano?: string }>()
  const hoje = new Date()
  const [mes, setMes] = useState(Number(params.mes) || hoje.getMonth() + 1)
  const [ano, setAno] = useState(Number(params.ano) || hoje.getFullYear())

  const [linhas, setLinhas] = useState<Linha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehProprietarioAtivo(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      const { data: vinculos, error: erroVinculos } = await supabase
        .from('proprietario_apartamentos')
        .select('apartamentos(id, numero, tipo_gestao, taxa_repasse, tipo_repasse, modelo_contrato, empreendimentos(nome))')
        .eq('ativo', true)
      if (erroVinculos) throw erroVinculos

      type Bruto = {
        apartamentos: {
          id: string; numero: string
          tipo_gestao: 'adm' | 'sub' | null
          taxa_repasse: number | null
          tipo_repasse: 'lucro' | 'faturamento' | null
          modelo_contrato: 'administracao' | 'sublocacao' | null
          empreendimentos: { nome: string } | null
        } | null
      }

      const apartamentos: Apartamento[] = ((vinculos ?? []) as unknown as Bruto[])
        .map(v => v.apartamentos)
        .filter((a): a is NonNullable<Bruto['apartamentos']> => a !== null)
        .map(a => ({
          id: a.id, numero: a.numero,
          tipo_gestao: a.tipo_gestao,
          taxa_repasse: a.taxa_repasse,
          tipo_repasse: a.tipo_repasse,
          modelo_contrato: a.modelo_contrato,
          empreendimento: a.empreendimentos?.nome ?? '—',
        }))

      if (apartamentos.length === 0) { setLinhas([]); return }

      const aptIds = apartamentos.map(a => a.id)
      const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

      // Esta tela NÃO usa reservas Amenitiz nem calcularKPIs — o portal web
      // também não. Aqui o faturamento vem só das diárias conferidas, e é por
      // isso que os números podem diferir da aba Início no mês corrente (lá as
      // reservas entram como fonte ao vivo). Manter igual ao site é proposital.
      const [diariasRes, custosRes] = await Promise.all([
        supabase.from('diarias').select('apartamento_id, valor')
          .in('apartamento_id', aptIds).gte('data', dataInicio).lte('data', dataFim),
        // O site lê a tabela `custos` inteira com a chave de serviço, o que traz
        // também categorias não repassáveis. O app fala direto com o banco e a
        // RLS entrega apenas as repassáveis — que são justamente as que entram
        // no cálculo do lucro. Na prática o extrato do app fica mais coerente:
        // no site, "Faturamento − Custos" não bate com o "Lucro" exibido.
        supabase.from('custos_proprietario').select('apartamento_id, valor, categoria')
          .in('apartamento_id', aptIds).eq('mes', mes).eq('ano', ano)
          .order('categoria'),
      ])
      if (diariasRes.error) throw diariasRes.error

      const diarias = diariasRes.data ?? []
      const custos = (custosRes.data ?? []) as { apartamento_id: string; valor: number | null; categoria: string | null }[]

      const montadas: Linha[] = apartamentos.map(apt => {
        const faturamento = diarias
          .filter(d => d.apartamento_id === apt.id)
          .reduce((s, d) => s + Number(d.valor ?? 0), 0)

        const doApt = custos.filter(c => c.apartamento_id === apt.id)
        const porCategoria = new Map<string, number>()
        for (const c of doApt) {
          const nome = c.categoria ?? 'Outros'
          porCategoria.set(nome, (porCategoria.get(nome) ?? 0) + Number(c.valor ?? 0))
        }
        const totalCustos = doApt.reduce((s, c) => s + Number(c.valor ?? 0), 0)

        const lucro = faturamento - totalCustos
        const taxa = Number(apt.taxa_repasse ?? 0)
        const tipo = apt.tipo_repasse ?? 'lucro'
        const repasse = calcularRepasse(faturamento, lucro, taxa, tipo)

        return {
          apt, faturamento, totalCustos, lucro, repasse,
          valorFinal: lucro - repasse,
          categorias: [...porCategoria.entries()].map(([categoria, valor]) => ({ categoria, valor })),
          semCustos: doApt.length === 0,
        }
      })

      setLinhas(montadas)
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

  useEffect(() => {
    registrarRolagem(y => scrollRef.current?.scrollTo({ y: Math.max(0, y - 140), animated: true }))
  }, [registrarRolagem])

  function mudarMes(delta: number) {
    let m = mes + delta, a = ano
    if (m < 1) { m = 12; a -= 1 }
    if (m > 12) { m = 1; a += 1 }
    setMes(m); setAno(a)
  }

  const periodo = `${MESES[mes - 1]} ${ano}`
  const totalGeral = linhas.reduce(
    (acc, l) => ({
      faturamento: acc.faturamento + l.faturamento,
      custos: acc.custos + l.totalCustos,
      valorFinal: acc.valorFinal + l.valorFinal,
    }),
    { faturamento: 0, custos: 0, valorFinal: 0 },
  )

  return (
    <View style={e.tela}>
      <View style={[e.barraTopo, { paddingTop: insets.top + 12 }]}>
        <Text style={e.marca}>Rentabilidade</Text>
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
          <Text style={e.saudacao}>Rentabilidade — {periodo}</Text>
          <Text style={e.saudacaoSub}>Demonstrativo completo de faturamento, custos e repasse</Text>
        </View>

        <AlvoAlu id="ext-periodo">
        <View style={e.seletor}>
          <Pressable onPress={() => mudarMes(-1)} hitSlop={12} style={e.seta}>
            <Text style={e.setaTexto}>‹</Text>
          </Pressable>
          <Text style={e.periodoTexto}>{periodo}</Text>
          <Pressable onPress={() => mudarMes(1)} hitSlop={12} style={e.seta}>
            <Text style={e.setaTexto}>›</Text>
          </Pressable>
        </View>
        </AlvoAlu>

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : linhas.length === 0 ? (
          <View style={e.paginaVazia}>
            <Text style={e.paginaVaziaTitulo}>Nenhum dado disponível</Text>
            <Text style={e.paginaVaziaSub}>Não há lançamentos para {periodo} ainda.</Text>
          </View>
        ) : (
          <>
            <AlvoAlu id="ext-total" style={{ marginBottom: 18 }}>
            <View style={[e.resumo, { marginBottom: 0 }]}>
              <Text style={e.resumoRotulo}>Total a receber em {periodo}</Text>
              <Text style={e.resumoValor}>R$ {formatBRL(totalGeral.valorFinal)}</Text>
              <View style={e.resumoLinha}>
                <Text style={e.resumoDetalhe}>Faturamento R$ {formatBRL(totalGeral.faturamento)}</Text>
                <Text style={e.resumoDetalhe}>Custos R$ {formatBRL(totalGeral.custos)}</Text>
              </View>
            </View>
            </AlvoAlu>

            {linhas.map((l, iLinha) => (
              <ExtratoCard
                key={l.apt.id}
                marcarTour={iLinha === 0}
                aptId={l.apt.id}
                numero={l.apt.numero}
                empreendimento={l.apt.empreendimento}
                tipoGestao={l.apt.tipo_gestao}
                faturamento={l.faturamento}
                totalCustos={l.totalCustos}
                lucro={l.lucro}
                repasse={l.repasse}
                valorFinal={l.valorFinal}
                taxaRepasse={Number(l.apt.taxa_repasse ?? 0)}
                tipoRepasse={l.apt.tipo_repasse ?? 'lucro'}
                custosPorCategoria={l.categorias}
                semCustos={l.semCustos}
                mes={mes}
                ano={ano}
              />
            ))}
          </>
        )}
      </ScrollView>

      <BottomNav />
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

  saudacaoBloco: { marginBottom: 18 },
  saudacao: { fontFamily: FONTES.serifada, fontSize: 28, color: CORES.texto, marginBottom: 4 },
  saudacaoSub: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco },

  seletor: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18,
    backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.borda,
    borderRadius: 9, paddingVertical: 9, marginBottom: 18,
  },
  seta: { paddingHorizontal: 10 },
  setaTexto: { fontSize: 22, color: CORES.azul, lineHeight: 26 },
  periodoTexto: { fontFamily: FONTES.media, fontSize: 13, color: CORES.texto, minWidth: 130, textAlign: 'center' },

  resumo: {
    backgroundColor: CORES.repasseFundo, borderWidth: 1, borderColor: CORES.repasseBorda,
    borderRadius: 16, padding: 20, marginBottom: 18,
  },
  resumoRotulo: {
    fontFamily: FONTES.bold, fontSize: 10.5, letterSpacing: 0.6,
    textTransform: 'uppercase', color: CORES.textoApagado, marginBottom: 8,
  },
  resumoValor: { fontFamily: FONTES.bold, fontSize: 32, color: CORES.repasseTexto },
  resumoLinha: { flexDirection: 'row', gap: 16, marginTop: 10 },
  resumoDetalhe: { fontFamily: FONTES.regular, fontSize: 12, color: CORES.textoFraco },

  paginaVazia: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 64, paddingHorizontal: 20,
    borderWidth: 1, borderColor: CORES.borda, borderRadius: 18, backgroundColor: CORES.branco,
  },
  paginaVaziaTitulo: { fontFamily: FONTES.semi, fontSize: 14, color: CORES.texto, marginBottom: 4 },
  paginaVaziaSub: { fontFamily: FONTES.regular, fontSize: 12.5, color: CORES.textoApagado, textAlign: 'center' },

  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
})

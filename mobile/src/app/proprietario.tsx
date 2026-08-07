import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, Pressable,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAtualizarAoFocar } from '@/lib/usar-atualizacao'
import { useAuth, ehProprietarioAtivo } from '@/lib/auth'
import { CORES, FONTES, moeda, MESES, MESES_ABREV } from '@/constants/tema'
import { KpiCard, KpiRepasseHero } from '@/components/kpi-card'
import { Painel, Vazio, GraficoEvolucao } from '@/components/painel'
import { BottomNav } from '@/components/bottom-nav'
import { PainelOcupacao, type ReservaOcupacao, type AptoOcupacao } from '@/components/ocupacao'
import { SyncButton, BadgeAtualizacao } from '@/components/sync-button'
import { RealtimeReservas } from '@/components/realtime-reservas'
import { AlvoAlu, useAlu } from '@/components/alu'
// Mesma função que gera os números do portal e do PDF de prestação de contas.
// Não é uma cópia: o Metro resolve `@sistema` para a pasta lib/ do sistema web
// (ver metro.config.js). Se a regra de repasse mudar lá, o app acompanha.
import { calcularKPIs, somarKPIs, type KPIsResult } from '@sistema/calcular-kpis'

type Apartamento = {
  id: string
  numero: string
  tipo_gestao: 'adm' | 'sub' | null
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  modelo_contrato: 'administracao' | 'sublocacao' | null
  empreendimento: string
}

type LinhaImovel = { apt: Apartamento; kpis: KPIsResult }
type PontoHistorico = { label: string; faturamento: number; repasse: number }

export default function Proprietario() {
  const { perfil, carregando: carregandoAuth, sair } = useAuth()
  const insets = useSafeAreaInsets()
  const { registrarRolagem } = useAlu()
  const scrollRef = useRef<ScrollView>(null)

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  const [kpis, setKpis] = useState<KPIsResult | null>(null)
  const [imoveis, setImoveis] = useState<LinhaImovel[]>([])
  const [historico, setHistorico] = useState<PontoHistorico[]>([])
  const [reservasPainel, setReservasPainel] = useState<ReservaOcupacao[]>([])
  const [aptosPainel, setAptosPainel] = useState<AptoOcupacao[]>([])
  const [mesSincronizado, setMesSincronizado] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)
  const [semDados, setSemDados] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehProprietarioAtivo(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      // Data nova a cada busca, em vez de depender do `hoje` do primeiro render:
      // o app pode ficar aberto atravessando a virada do mês.
      const agora = new Date()
      const ehMesCorrente = mes === agora.getMonth() + 1 && ano === agora.getFullYear()

      // A RLS limita tudo aos imóveis deste proprietário — sem filtro por id aqui.
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

      if (apartamentos.length === 0) {
        setImoveis([]); setKpis(null); setHistorico([]); setSemDados(true)
        return
      }

      const aptIds = apartamentos.map(a => a.id)
      const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

      const [diariasRes, custosRes, reservasRes] = await Promise.all([
        supabase.from('diarias').select('apartamento_id, valor, tipo_gestao')
          .in('apartamento_id', aptIds).gte('data', dataInicio).lte('data', dataFim),
        supabase.from('custos_proprietario').select('apartamento_id, valor, tipo_gestao')
          .in('apartamento_id', aptIds).eq('mes', mes).eq('ano', ano),
        supabase.from('amenitiz_reservas')
          .select('booking_id, apartamento_id, checkin, checkout, valor_liquido, status, plataforma_normalizada, nome_hospede')
          .in('apartamento_id', aptIds).lte('checkin', dataFim).gte('checkout', dataInicio)
          .order('checkin', { ascending: true }),
      ])
      if (diariasRes.error) throw diariasRes.error
      if (reservasRes.error) throw reservasRes.error

      // Proration idêntica à do portal: uma reserva que cruza a virada do mês
      // entra apenas com as noites daquele mês. Ex.: 11/05→11/06 conta 10 de 31
      // noites em junho, e o valor é ajustado na mesma proporção.
      const primeiroDiaMs = new Date(dataInicio + 'T00:00:00').getTime()
      const proximoMesMs = new Date(ano, mes, 1).getTime()

      const reservas = (reservasRes.data ?? []).flatMap(r => {
        let valor = r.valor_liquido
        let checkin = r.checkin
        let checkout = r.checkout
        if (r.checkin && r.checkout && r.valor_liquido != null) {
          const ci = new Date(r.checkin + 'T00:00:00').getTime()
          const co = new Date(r.checkout + 'T00:00:00').getTime()
          const noitesTotais = (co - ci) / 86400000
          const noitesNoMes = (Math.min(co, proximoMesMs) - Math.max(ci, primeiroDiaMs)) / 86400000
          if (noitesNoMes <= 0) return []
          if (noitesTotais > 0 && noitesNoMes < noitesTotais) {
            valor = (noitesNoMes / noitesTotais) * r.valor_liquido
            // Recorta as datas ao mês para a grade de ocupação não vazar
            if (ci < primeiroDiaMs) checkin = dataInicio
            if (co > proximoMesMs) checkout = dataFim
          }
        }
        return [{ ...r, checkin, checkout, valor_liquido: valor }]
      })

      // Painel de ocupação: só reservas ativas, com datas já recortadas ao mês.
      setReservasPainel(reservas
        .filter(r => !['cancelled', 'canceled', 'no_show'].includes(String(r.status ?? '').toLowerCase()))
        .map(r => ({
          booking_id: r.booking_id ?? '',
          apartamento_id: r.apartamento_id ?? '',
          checkin: r.checkin,
          checkout: r.checkout,
          plataforma_normalizada: r.plataforma_normalizada,
          valor_liquido: r.valor_liquido,
          nome_hospede: r.nome_hospede,
        })))
      setAptosPainel(apartamentos.map(a => ({
        id: a.id, numero: a.numero, empreendimento: a.empreendimento,
      })))

      const [{ data: sincronizado }, { data: ultimoIngest }] = await Promise.all([
        supabase.rpc('periodo_sincronizado', { p_mes: mes, p_ano: ano }),
        // Leitura via SECURITY DEFINER: o proprietário não acessa ingest_status
        // diretamente (a tabela é restrita a interno pela RLS).
        supabase.rpc('ultimo_ingest_timestamp'),
      ])
      setMesSincronizado(sincronizado === true)
      setAtualizadoEm(ultimoIngest ? new Date(ultimoIngest as string) : null)

      const diarias = diariasRes.data ?? []
      const custos = custosRes.data ?? []

      const linhas: LinhaImovel[] = apartamentos.map(apt => ({
        apt,
        kpis: calcularKPIs(
          diarias.filter(d => d.apartamento_id === apt.id),
          custos.filter(c => c.apartamento_id === apt.id),
          reservas.filter(r => r.apartamento_id === apt.id),
          apt,
          // Mês corrente: reservas Amenitiz são a fonte mais fresca (cron de
          // 5 min) e o faturamento acompanha cada reserva nova.
          { preferirReservas: ehMesCorrente },
        ),
      }))

      setImoveis(linhas.sort((a, b) => b.kpis.receitaTotal - a.kpis.receitaTotal))
      setKpis(somarKPIs(linhas.map(l => l.kpis)))
      setSemDados(diarias.length === 0 && custos.length === 0 && reservas.length === 0)

      // Evolução dos últimos 6 meses (diárias + custos repassáveis, como no portal)
      const periodos = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(ano, mes - 1 - (5 - i), 1)
        return { m: d.getMonth() + 1, a: d.getFullYear(), label: MESES_ABREV[d.getMonth()] }
      })

      const taxa = Number(apartamentos[0]?.taxa_repasse ?? 0) / 100
      const tipoRepasse = apartamentos[0]?.tipo_repasse ?? 'lucro'

      const serie = await Promise.all(periodos.map(async ({ m, a, label }) => {
        const di = `${a}-${String(m).padStart(2, '0')}-01`
        const df = new Date(a, m, 0).toISOString().slice(0, 10)
        const [fat, cus] = await Promise.all([
          supabase.from('diarias').select('valor').in('apartamento_id', aptIds).gte('data', di).lte('data', df),
          supabase.from('custos_proprietario').select('valor').in('apartamento_id', aptIds).eq('mes', m).eq('ano', a),
        ])
        const faturamento = (fat.data ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0)
        const custosMes = (cus.data ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0)
        const lucro = faturamento - custosMes
        const base = tipoRepasse === 'faturamento' ? faturamento : lucro
        return { label, faturamento, repasse: lucro - base * taxa }
      }))

      setHistorico(serie)
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

  // Planilha importada no sistema web não dispara Realtime — só amenitiz_reservas
  // é publicada. Rebuscar ao voltar para a tela cobre esse caso.
  useAtualizarAoFocar(buscar, ehProprietarioAtivo(perfil))

  useEffect(() => {
    // Permite que a ALU role a tela até o elemento que está explicando.
    registrarRolagem(y => scrollRef.current?.scrollTo({ y: Math.max(0, y - 140), animated: true }))
  }, [registrarRolagem])

  function mudarMes(delta: number) {
    let m = mes + delta, a = ano
    if (m < 1) { m = 12; a -= 1 }
    if (m > 12) { m = 1; a += 1 }
    setMes(m); setAno(a)
  }

  const primeiroNome = perfil?.full_name?.split(' ')[0] ?? ''
  const periodo = `${MESES[mes - 1]} ${ano}`
  const ehMesCorrente = mes === hoje.getMonth() + 1 && ano === hoje.getFullYear()
  const mesesComDados = historico.filter(h => h.faturamento > 0 || h.repasse !== 0).length

  return (
    <View style={e.tela}>
      <View style={[e.barraTopo, { paddingTop: insets.top + 12 }]}>
        <Text style={e.marca}>AlugEasy</Text>
        <Pressable onPress={() => sair().then(() => router.replace('/login'))} hitSlop={10}>
          <Text style={e.sair}>Sair</Text>
        </Pressable>
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
        {/* Saudação — `.pg-head` do portal */}
        <View style={e.saudacaoBloco}>
          <Text style={e.saudacao}>Olá, {primeiroNome}</Text>
          <Text style={e.saudacaoSub}>
            Resumo dos seus imóveis em <Text style={e.saudacaoForte}>{periodo}</Text>
          </Text>
        </View>

        {/* Seletor de período */}
        <AlvoAlu id="periodo">
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

        <View style={e.linhaSync}>
          <SyncButton mes={mes} ano={ano} aoConcluir={buscar} />
          <BadgeAtualizacao em={atualizadoEm} />
        </View>

        {/* Reservas que chegaram enquanto a tela está aberta */}
        <RealtimeReservas
          apartamentoIds={aptosPainel.map(a => a.id)}
          aoAtualizar={() => { setAtualizadoEm(new Date()); buscar() }}
        />

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : semDados || !kpis ? (
          <Painel titulo="">
            <Vazio
              titulo={`Nenhuma diária em ${periodo}`}
              descricao="Seus imóveis não registraram receita neste período, ou os dados ainda não foram importados."
            />
          </Painel>
        ) : (
          <>
            {/* Repasse em destaque — no portal isso é o hero de mobile */}
            <AlvoAlu id="repasse">
              <KpiRepasseHero
                valor={moeda(kpis.valorLiquidoProprietario)}
                rodape="Valor líquido ao proprietário"
              />
            </AlvoAlu>

            <AlvoAlu id="kpis">
            <View style={e.grade}>
              <KpiCard
                rotulo="Faturamento"
                valor={moeda(kpis.receitaTotal)}
                rodape={ehMesCorrente ? `${periodo} · ao vivo` : periodo}
                corBarra={CORES.barraFaturamento}
                icone="↗"
                corIconeFundo={CORES.iconeFaturamentoFundo}
                estilo={e.meia}
              />
              <KpiCard
                rotulo="Custos"
                valor={moeda(kpis.custosTotal)}
                rodape={periodo}
                corBarra={CORES.barraCustos}
                icone="▤"
                corIconeFundo={CORES.iconeCustosFundo}
                estilo={e.meia}
              />
            </View>

            <KpiCard
              rotulo="Lucro líquido"
              valor={moeda(kpis.lucroLiquido)}
              rodape={`Margem de ${kpis.margemLiquida.toFixed(0)}% no período`}
              corBarra={CORES.barraLucro}
              corValor={CORES.repasseTexto}
              icone="↗"
              corIconeFundo={CORES.iconeLucroFundo}
              estilo={{ marginBottom: 16 }}
            />
            </AlvoAlu>

            <AlvoAlu id="ocupacao">
            <PainelOcupacao
              apartamentos={aptosPainel}
              reservas={reservasPainel}
              mes={mes}
              ano={ano}
              nomeMes={MESES[mes - 1]}
              sincronizado={mesSincronizado}
            />
            </AlvoAlu>

            <AlvoAlu id="evolucao">
            <Painel titulo="Evolução dos últimos 6 meses" subtitulo="Faturamento e repasse mês a mês">
              {mesesComDados >= 2 ? (
                <GraficoEvolucao dados={historico} />
              ) : (
                <Vazio
                  titulo="Histórico em construção"
                  descricao="O gráfico fica disponível depois de 2 meses de operação contínua."
                />
              )}
            </Painel>
            </AlvoAlu>

            <Painel
              titulo={imoveis.length === 1 ? 'Seu imóvel' : `Seus imóveis (${imoveis.length})`}
              subtitulo="Faturamento e repasse por unidade"
            >
              {imoveis.map(({ apt, kpis: k }, i) => (
                <View key={apt.id} style={[e.imovel, i === imoveis.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={e.imovelNome}>{apt.empreendimento} {apt.numero}</Text>
                    <Text style={e.imovelSub}>
                      {apt.tipo_gestao ? apt.tipo_gestao.toUpperCase() : '—'}
                      {k.custosTotal > 0 ? ` · custos ${moeda(k.custosTotal)}` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={e.imovelValor}>{moeda(k.receitaTotal)}</Text>
                    <Text style={e.imovelRepasse}>repasse {moeda(k.valorLiquidoProprietario)}</Text>
                  </View>
                </View>
              ))}
            </Painel>

            <Text style={e.rodapePagina}>Puxe a tela para baixo para atualizar</Text>
          </>
        )}
      </ScrollView>

      <AlvoAlu id="navegacao">
        <BottomNav />
      </AlvoAlu>
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
  saudacaoForte: { fontFamily: FONTES.semi, color: CORES.texto },

  seletor: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18,
    backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.borda,
    borderRadius: 9, paddingVertical: 9, marginBottom: 20,
  },
  seta: { paddingHorizontal: 10 },
  setaTexto: { fontSize: 22, color: CORES.azul, lineHeight: 26 },
  periodoTexto: { fontFamily: FONTES.media, fontSize: 13, color: CORES.texto, minWidth: 130, textAlign: 'center' },

  linhaSync: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 10, marginBottom: 18,
  },

  grade: { flexDirection: 'row', gap: 12, marginTop: 14, marginBottom: 14 },
  meia: { flex: 1 },

  imovel: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: CORES.borda,
  },
  imovelNome: { fontFamily: FONTES.semi, fontSize: 14, color: CORES.texto },
  imovelSub: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado, marginTop: 2 },
  imovelValor: { fontFamily: FONTES.bold, fontSize: 14.5, color: CORES.texto },
  imovelRepasse: { fontFamily: FONTES.regular, fontSize: 11, color: CORES.repasseTexto, marginTop: 2 },

  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
  rodapePagina: {
    fontFamily: FONTES.regular, textAlign: 'center',
    color: CORES.textoApagado, fontSize: 11.5, marginTop: 6,
  },
})

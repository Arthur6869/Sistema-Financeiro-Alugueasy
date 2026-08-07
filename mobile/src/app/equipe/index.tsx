import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth, ehEquipe } from '@/lib/auth'
import { CORES, FONTES, formatBRL, MESES } from '@/constants/tema'
import { EquipeNav, EquipeTopo } from '@/components/equipe-nav'
import { FiltroPeriodo } from '@/components/filtro-periodo'
import { KpiCard } from '@/components/kpi-card'
import { Painel, Vazio } from '@/components/painel'
import { LinhaRegistro } from '@/components/tabela'

// Constantes do dashboard do site (`app/(dashboard)/page.tsx:156-167`).
// Ficam no código lá também — não vêm do banco.
const CUSTO_OP_FIXO = 43509.92
const CUSTO_DIARIA_OP = 250.0

type LinhaEmp = { nome: string; faturamento: number; custos: number; lucro: number }
type LinhaApt = { numero: string; emp: string; tipo: string; faturamento: number; custos: number; lucro: number }

export default function PainelEquipe() {
  const { perfil, carregando: carregandoAuth } = useAuth()

  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  const [kpis, setKpis] = useState({ faturamento: 0, custosReservas: 0, custosOp: 0, lucro: 0 })
  const [conferido, setConferido] = useState(false)
  const [porEmp, setPorEmp] = useState<LinhaEmp[]>([])
  const [porApt, setPorApt] = useState<LinhaApt[]>([])
  const [qtdEmpreendimentos, setQtd] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!carregandoAuth && !ehEquipe(perfil)) router.replace('/')
  }, [carregandoAuth, perfil])

  const buscar = useCallback(async () => {
    setErro('')
    try {
      const agora = new Date()
      const ehMesCorrente = mes === agora.getMonth() + 1 && ano === agora.getFullYear()
      const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

      const [empRes, diariasRes, custosRes, aptsRes, opRes] = await Promise.all([
        supabase.from('empreendimentos').select('id, nome').order('nome'),
        supabase.from('diarias')
          .select('apartamento_id, valor')
          .gte('data', dataInicio).lte('data', dataFim).limit(50000),
        supabase.from('custos')
          .select('apartamento_id, valor')
          .eq('mes', mes).eq('ano', ano).limit(50000),
        supabase.from('apartamentos')
          .select('id, numero, tipo_gestao, empreendimento_id, empreendimentos(nome)'),
        supabase.from('custos_operacionais_variaveis')
          .select('diarias').eq('mes', mes).eq('ano', ano).maybeSingle(),
      ])
      if (empRes.error) throw empRes.error
      if (diariasRes.error) throw diariasRes.error
      if (aptsRes.error) throw aptsRes.error

      type Apt = {
        id: string; numero: string; tipo_gestao: string | null
        empreendimento_id: string; empreendimentos: { nome: string } | null
      }
      const apts = (aptsRes.data ?? []) as unknown as Apt[]
      const diarias = diariasRes.data ?? []
      const custos = custosRes.data ?? []

      // Receita por apartamento: diárias conferidas têm prioridade, exceto no
      // mês corrente — ali as reservas Amenitiz são a fonte ao vivo (cron de
      // 5 min) e já vêm líquidas de taxa. Mesma regra de `page.tsx:117-148`.
      const receitaPorApt = new Map<string, number>()
      for (const d of diarias) {
        receitaPorApt.set(d.apartamento_id, (receitaPorApt.get(d.apartamento_id) ?? 0) + Number(d.valor ?? 0))
      }
      let usouDiarias = diarias.length > 0

      if (!usouDiarias || ehMesCorrente) {
        const { data: reservas } = await supabase.from('amenitiz_reservas')
          .select('apartamento_id, valor_liquido, checkin, checkout')
          .lte('checkin', dataFim).gte('checkout', dataInicio)
          .not('status', 'in', '(cancelled,canceled,no_show)')

        const primeiroMs = new Date(dataInicio + 'T00:00:00').getTime()
        const proximoMs = new Date(ano, mes, 1).getTime()
        const porAptReserva = new Map<string, number>()

        for (const r of reservas ?? []) {
          if (!r.apartamento_id || r.valor_liquido == null) continue
          let valor = Number(r.valor_liquido)
          if (r.checkin && r.checkout) {
            const ci = new Date(r.checkin + 'T00:00:00').getTime()
            const co = new Date(r.checkout + 'T00:00:00').getTime()
            const totais = (co - ci) / 86400000
            const noMes = (Math.min(co, proximoMs) - Math.max(ci, primeiroMs)) / 86400000
            if (noMes <= 0) continue
            if (totais > 0 && noMes < totais) valor = (noMes / totais) * valor
          }
          porAptReserva.set(r.apartamento_id, (porAptReserva.get(r.apartamento_id) ?? 0) + valor)
        }

        const totalReservas = [...porAptReserva.values()].reduce((s, v) => s + v, 0)
        if (totalReservas > 0 && (!usouDiarias || ehMesCorrente)) {
          receitaPorApt.clear()
          for (const [k, v] of porAptReserva) receitaPorApt.set(k, v)
          usouDiarias = false
        }
      }

      const custoPorApt = new Map<string, number>()
      for (const c of custos) {
        custoPorApt.set(c.apartamento_id, (custoPorApt.get(c.apartamento_id) ?? 0) + Number(c.valor ?? 0))
      }

      const faturamento = [...receitaPorApt.values()].reduce((s, v) => s + v, 0)
      const custosReservas = [...custoPorApt.values()].reduce((s, v) => s + v, 0)
      const diariasOp = Number(opRes.data?.diarias ?? 0)
      const custosOp = CUSTO_OP_FIXO + diariasOp * CUSTO_DIARIA_OP

      setKpis({
        faturamento,
        custosReservas,
        custosOp,
        lucro: faturamento - (custosReservas + custosOp),
      })
      setConferido(usouDiarias)
      setQtd((empRes.data ?? []).length)

      // Agregação por apartamento e por empreendimento
      const linhasApt: LinhaApt[] = apts.map(a => {
        const f = receitaPorApt.get(a.id) ?? 0
        const c = custoPorApt.get(a.id) ?? 0
        return {
          numero: a.numero,
          emp: a.empreendimentos?.nome ?? '—',
          tipo: (a.tipo_gestao ?? '—').toUpperCase(),
          faturamento: f, custos: c, lucro: f - c,
        }
      }).filter(l => l.faturamento > 0 || l.custos > 0)

      const mapaEmp = new Map<string, LinhaEmp>()
      for (const l of linhasApt) {
        const atual = mapaEmp.get(l.emp) ?? { nome: l.emp, faturamento: 0, custos: 0, lucro: 0 }
        atual.faturamento += l.faturamento
        atual.custos += l.custos
        atual.lucro += l.lucro
        mapaEmp.set(l.emp, atual)
      }

      setPorApt(linhasApt.sort((a, b) => b.faturamento - a.faturamento))
      setPorEmp([...mapaEmp.values()].sort((a, b) => b.faturamento - a.faturamento))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o painel.')
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
  const pct = (v: number) => kpis.faturamento > 0 ? `${Math.round((v / kpis.faturamento) * 100)}%` : '—'
  const margem = kpis.faturamento > 0 ? Math.round((kpis.lucro / kpis.faturamento) * 100) : 0

  return (
    <View style={e.tela}>
      <EquipeTopo titulo="Painel" papel={perfil?.role} />

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={atualizando} tintColor={CORES.azul}
            onRefresh={() => { setAtualizando(true); buscar() }} />
        }
      >
        <View style={e.cabecalho}>
          <Text style={e.titulo}>Visão geral</Text>
          <Text style={e.subtitulo}>{periodo}</Text>
        </View>

        <FiltroPeriodo mes={mes} ano={ano} aoMudar={mudarMes} />

        {carregando ? (
          <ActivityIndicator color={CORES.azul} style={{ marginTop: 48 }} />
        ) : erro !== '' ? (
          <View style={e.caixaErro}><Text style={e.textoErro}>{erro}</Text></View>
        ) : (
          <>
            <KpiCard
              rotulo={conferido ? 'Faturamento · conferido' : 'Faturamento'}
              valor={`R$ ${formatBRL(kpis.faturamento)}`}
              rodape={conferido ? `${periodo} · planilha` : `${periodo} · Amenitiz ao vivo`}
              corBarra={CORES.barraFaturamento}
              icone="↗"
              corIconeFundo={CORES.iconeFaturamentoFundo}
              estilo={{ marginBottom: 12 }}
            />

            <View style={e.grade}>
              <KpiCard
                rotulo="Custos reservas"
                valor={`R$ ${formatBRL(kpis.custosReservas)}`}
                rodape={`${pct(kpis.custosReservas)} do faturamento`}
                corBarra="#fb923c"
                icone="▤"
                corIconeFundo="#fff7ed"
                estilo={e.meia}
              />
              <KpiCard
                rotulo="Custos operacionais"
                valor={`R$ ${formatBRL(kpis.custosOp)}`}
                rodape={`${pct(kpis.custosOp)} do faturamento`}
                corBarra="#f87171"
                icone="▤"
                corIconeFundo="#fef2f2"
                estilo={e.meia}
              />
            </View>

            <KpiCard
              rotulo="Lucro líquido"
              valor={`R$ ${formatBRL(kpis.lucro)}`}
              rodape={`Margem de ${margem}% sobre o faturamento`}
              corBarra={kpis.lucro >= 0 ? CORES.barraLucro : CORES.barraCustos}
              corValor={kpis.lucro >= 0 ? '#16a34a' : '#dc2626'}
              icone={kpis.lucro >= 0 ? '↗' : '↘'}
              corIconeFundo={kpis.lucro >= 0 ? '#f0fdf4' : '#fef2f2'}
              estilo={{ marginTop: 12, marginBottom: 16 }}
            />

            <Painel
              titulo="Resultado por empreendimento"
              subtitulo={`${qtdEmpreendimentos} empreendimento${qtdEmpreendimentos === 1 ? '' : 's'} cadastrado${qtdEmpreendimentos === 1 ? '' : 's'}`}
            >
              {porEmp.length === 0 ? (
                <Vazio
                  titulo="Nenhum dado disponível"
                  descricao="Importe as planilhas do período no sistema web para ver os números aqui."
                />
              ) : porEmp.map((x, i) => (
                <LinhaRegistro
                  key={x.nome}
                  titulo={x.nome}
                  subtitulo={`Custos R$ ${formatBRL(x.custos)}`}
                  valor={`R$ ${formatBRL(x.faturamento)}`}
                  valorCor={i < 0 ? undefined : CORES.texto}
                  acoes={
                    <View style={[e.selo, x.lucro >= 0 ? e.seloLucro : e.seloPrejuizo]}>
                      <Text style={[e.seloTexto, { color: x.lucro >= 0 ? '#15803d' : '#b91c1c' }]}>
                        {x.lucro >= 0 ? '▲' : '▼'} {formatBRL(Math.abs(x.lucro))}
                      </Text>
                    </View>
                  }
                />
              ))}
            </Painel>

            <Painel titulo="Resultado por apartamento" subtitulo={`${porApt.length} com movimento no período`}>
              {porApt.length === 0 ? (
                <Vazio titulo="Nenhum apartamento com movimento" descricao="Nada lançado neste período." />
              ) : porApt.map(x => (
                <LinhaRegistro
                  key={`${x.emp}-${x.numero}`}
                  titulo={`${x.emp} ${x.numero}`}
                  subtitulo={`${x.tipo} · custos R$ ${formatBRL(x.custos)}`}
                  valor={`R$ ${formatBRL(x.faturamento)}`}
                  acoes={
                    <View style={[e.selo, x.lucro >= 0 ? e.seloLucro : e.seloPrejuizo]}>
                      <Text style={[e.seloTexto, { color: x.lucro >= 0 ? '#15803d' : '#b91c1c' }]}>
                        {x.lucro >= 0 ? '+' : '−'}{formatBRL(Math.abs(x.lucro))}
                      </Text>
                    </View>
                  }
                />
              ))}
            </Painel>
          </>
        )}
      </ScrollView>

      <EquipeNav />
    </View>
  )
}

const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: CORES.fundo },
  cabecalho: { marginBottom: 18 },
  titulo: { fontFamily: FONTES.serifada, fontSize: 28, color: CORES.texto, marginBottom: 4 },
  subtitulo: { fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoFraco },

  grade: { flexDirection: 'row', gap: 12 },
  meia: { flex: 1 },

  selo: { borderRadius: 100, paddingHorizontal: 9, paddingVertical: 3, marginLeft: 8 },
  seloLucro: { backgroundColor: '#dcfce7' },
  seloPrejuizo: { backgroundColor: '#fee2e2' },
  seloTexto: { fontFamily: FONTES.bold, fontSize: 10.5 },

  caixaErro: { backgroundColor: '#fdf2f2', borderRadius: 12, padding: 16, marginTop: 20 },
  textoErro: { fontFamily: FONTES.regular, color: CORES.vermelho, fontSize: 13, lineHeight: 19 },
})

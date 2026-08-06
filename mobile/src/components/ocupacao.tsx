import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { CORES, FONTES, formatBRL, plataforma, nomeCurto, iniciais, diaDoMes } from '@/constants/tema'
// Mesma tabela de taxas do site — Booking por empreendimento, Airbnb com a
// vigência histórica (0% até mai/2026) e AlugEasy fixo em 10%.
import { getTaxasPlataforma } from '@sistema/amenitiz'

export type ReservaOcupacao = {
  booking_id: string
  checkin: string | null
  checkout: string | null
  plataforma_normalizada: string | null
  valor_liquido: number | null
  nome_hospede: string | null
  apartamento_id: string
}

export type AptoOcupacao = { id: string; numero: string; empreendimento: string | null }

const MES_ABR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const ORDEM_LEGENDA = ['airbnb', 'booking', 'alugueasy', 'expedia']

function pct(v: number): string {
  return `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

/**
 * Painel de ocupação — espelha `components/proprietario/occupancy-panel.tsx`.
 * Grade de dias do mês, barra de ocupação e cartões de reserva por plataforma.
 */
export function PainelOcupacao({
  apartamentos, reservas, mes, ano, nomeMes, sincronizado,
}: {
  apartamentos: AptoOcupacao[]
  reservas: ReservaOcupacao[]
  mes: number
  ano: number
  nomeMes: string
  sincronizado: boolean
}) {
  const totalDias = mes > 0 ? new Date(ano, mes, 0).getDate() : 30
  const mostrarGrade = mes > 0
  const totalFat = reservas.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)

  if (reservas.length === 0) {
    return (
      <View style={e.painelVazio}>
        <Text style={e.tituloPainel}>Ocupação de {nomeMes || ano}</Text>
        <Text style={e.textoVazio}>
          {sincronizado
            ? 'Nenhuma reserva neste período.'
            : 'Toque em Atualizar dados para sincronizar as reservas deste mês.'}
        </Text>
      </View>
    )
  }

  const porApt = new Map<string, ReservaOcupacao[]>()
  for (const r of reservas) {
    const lista = porApt.get(r.apartamento_id) ?? []
    lista.push(r)
    porApt.set(r.apartamento_id, lista)
  }

  const presentes = new Set(reservas.map(r => (r.plataforma_normalizada ?? '').toLowerCase().trim()))
  const legenda = ORDEM_LEGENDA.filter(p => presentes.has(p))

  return (
    <View style={e.painel}>
      <View style={e.cabecalho}>
        <View style={e.cabecalhoTopo}>
          <Text style={e.tituloPainel}>Ocupação de {nomeMes || ano}</Text>
          <View style={e.pillContagem}>
            <Text style={e.pillContagemTexto}>{reservas.length} reservas</Text>
          </View>
        </View>
        <View style={e.cabecalhoBaixo}>
          <View style={e.legenda}>
            {legenda.map(p => {
              const cfg = plataforma(p)
              return (
                <View key={p} style={e.legendaItem}>
                  <View style={[e.legendaPonto, { backgroundColor: cfg.destaque }]} />
                  <Text style={e.legendaTexto}>{cfg.label}</Text>
                </View>
              )
            })}
          </View>
          <Text style={e.totalGeral}>R$ {formatBRL(totalFat)}</Text>
        </View>
      </View>

      {apartamentos.map((apt, indice) => {
        const doApt = porApt.get(apt.id) ?? []
        // Igual ao site: com mais de um imóvel, esconde os que não têm reserva.
        if (doApt.length === 0 && apartamentos.length > 1) return null

        const mapaDias: Record<number, { plat: string | null; hospede: string | null; entrada: boolean }> = {}
        for (const r of doApt) {
          const ci = diaDoMes(r.checkin)
          const co = diaDoMes(r.checkout)
          if (ci == null) continue
          const fim = co ?? ci + 1
          for (let d = ci; d < fim && d <= totalDias; d++) {
            mapaDias[d] = { plat: r.plataforma_normalizada, hospede: r.nome_hospede, entrada: d === ci }
          }
        }

        const noites = mostrarGrade
          ? Object.keys(mapaDias).length
          : doApt.reduce((s, r) => {
              const ci = diaDoMes(r.checkin), co = diaDoMes(r.checkout)
              return s + Math.max(0, (co ?? 0) - (ci ?? 0))
            }, 0)
        const ocupacao = Math.round((noites / totalDias) * 100)
        const fatApt = doApt.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)
        const taxas = getTaxasPlataforma(apt.empreendimento ?? '', apt.numero, { mes, ano })

        return (
          <View key={apt.id} style={indice > 0 ? e.separadorApt : undefined}>
            <View style={e.cabecalhoApt}>
              <View style={e.aptEsquerda}>
                <View style={e.avatar}><Text style={e.avatarTexto}>{apt.numero}</Text></View>
                <View>
                  <Text style={e.aptNome}>Apto {apt.numero}</Text>
                  {apt.empreendimento ? <Text style={e.aptEmp}>{apt.empreendimento}</Text> : null}
                </View>
              </View>

              <View style={e.stats}>
                <Stat rotulo="RESERVAS" valor={String(doApt.length)} />
                <Stat rotulo="NOITES" valor={String(noites)} />
                {mostrarGrade && <Stat rotulo="OCUPAÇÃO" valor={`${ocupacao}%`} cor="#16a34a" />}
                <Stat rotulo="FATURAMENTO" valor={`R$ ${formatBRL(fatApt)}`} />
              </View>
            </View>

            <View style={e.taxasLinha}>
              <Text style={e.statRotulo}>TAXAS</Text>
              <View style={e.taxasBadges}>
                <BadgeTaxa nome="Booking" valor={pct(taxas.booking)} chave="booking" />
                <BadgeTaxa nome="Airbnb" valor={pct(taxas.airbnb)} chave="airbnb" />
                <BadgeTaxa nome="AlugEasy" valor={pct(taxas.alugueasy)} chave="alugueasy" />
              </View>
            </View>

            {mostrarGrade && (
              <View style={e.blocoGrade}>
                <View style={e.grade}>
                  {Array.from({ length: totalDias }, (_, i) => i + 1).map(d => {
                    const ocupado = mapaDias[d]
                    const cfg = ocupado ? plataforma(ocupado.plat) : null
                    return (
                      <View
                        key={d}
                        style={[
                          e.celula,
                          cfg
                            ? { backgroundColor: cfg.bg, borderColor: cfg.borda }
                            : { backgroundColor: CORES.fundo, borderColor: CORES.borda },
                        ]}
                      >
                        <Text style={[e.celulaTexto, cfg ? { color: cfg.texto, fontFamily: FONTES.semi } : null]}>
                          {d}
                        </Text>
                        {ocupado?.entrada && cfg && (
                          <View style={[e.marcadorEntrada, { backgroundColor: cfg.destaque }]} />
                        )}
                      </View>
                    )
                  })}
                </View>

                <View style={e.barraLinha}>
                  <View style={e.trilho}>
                    <View style={[e.preenchimento, { width: `${ocupacao}%` }]} />
                  </View>
                  <Text style={e.barraRotulo}>{noites} de {totalDias} noites</Text>
                </View>
              </View>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={e.carrossel}
            >
              {doApt.map(r => {
                const cfg = plataforma(r.plataforma_normalizada)
                const ci = diaDoMes(r.checkin), co = diaDoMes(r.checkout)
                const n = Math.max(0, (co ?? 0) - (ci ?? 0))
                const mesCi = Number((r.checkin ?? '').split('-')[1] ?? 0)
                const mesCo = Number((r.checkout ?? '').split('-')[1] ?? 0)

                return (
                  <View key={r.booking_id} style={[e.cartaoReserva, { borderColor: cfg.borda }]}>
                    <View style={[e.cartaoTopo, { backgroundColor: cfg.bg, borderBottomColor: cfg.borda }]}>
                      <Text style={[e.cartaoPlat, { color: cfg.texto }]}>{cfg.label}</Text>
                      <View style={e.pillNoites}>
                        <Text style={[e.pillNoitesTexto, { color: cfg.texto }]}>{n}n</Text>
                      </View>
                    </View>

                    <View style={e.cartaoCorpo}>
                      <View style={e.hospede}>
                        <View style={[e.hospedeAvatar, { backgroundColor: cfg.destaque }]}>
                          <Text style={e.hospedeIniciais}>{iniciais(r.nome_hospede)}</Text>
                        </View>
                        <Text style={e.hospedeNome} numberOfLines={1}>{nomeCurto(r.nome_hospede)}</Text>
                      </View>

                      <View style={e.datas}>
                        <View>
                          <Text style={e.dataRotulo}>ENTRADA</Text>
                          <Text style={e.dataDia}>{String(ci ?? '?').padStart(2, '0')}</Text>
                          <Text style={e.dataMes}>{MES_ABR[mesCi - 1] ?? ''}</Text>
                        </View>
                        <View style={e.conector}>
                          <View style={[e.conectorPonto, { backgroundColor: cfg.destaque }]} />
                          <View style={[e.conectorLinha, { backgroundColor: cfg.destaque }]} />
                          <View style={[e.conectorPonto, { backgroundColor: cfg.destaque }]} />
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={e.dataRotulo}>SAÍDA</Text>
                          <Text style={e.dataDia}>{String(co ?? '?').padStart(2, '0')}</Text>
                          <Text style={e.dataMes}>{MES_ABR[mesCo - 1] ?? ''}</Text>
                        </View>
                      </View>

                      <Text style={e.cartaoValor}>R$ {formatBRL(Number(r.valor_liquido ?? 0))}</Text>
                    </View>
                  </View>
                )
              })}
            </ScrollView>
          </View>
        )
      })}
    </View>
  )
}

function Stat({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={e.statRotulo}>{rotulo}</Text>
      <Text style={[e.statValor, cor ? { color: cor } : null]}>{valor}</Text>
    </View>
  )
}

function BadgeTaxa({ nome, valor, chave }: { nome: string; valor: string; chave: string }) {
  const cfg = plataforma(chave)
  return (
    <View style={[e.badgeTaxa, { backgroundColor: cfg.bg, borderColor: cfg.borda }]}>
      <View style={[e.badgePonto, { backgroundColor: cfg.destaque }]} />
      <Text style={[e.badgeTexto, { color: cfg.texto }]}>{nome} {valor}</Text>
    </View>
  )
}

const e = StyleSheet.create({
  painel: {
    backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.borda,
    borderRadius: 18, marginBottom: 16, overflow: 'hidden',
  },
  painelVazio: {
    backgroundColor: CORES.branco, borderWidth: 1, borderColor: CORES.borda,
    borderRadius: 18, padding: 24, marginBottom: 16,
  },
  tituloPainel: { fontFamily: FONTES.semi, fontSize: 15, color: CORES.texto },
  textoVazio: {
    fontFamily: FONTES.regular, fontSize: 13, color: CORES.textoApagado,
    textAlign: 'center', paddingVertical: 24, paddingHorizontal: 20,
  },

  cabecalho: { paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: CORES.borda },
  cabecalhoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  pillContagem: { backgroundColor: '#e6f1fb', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 2 },
  pillContagemTexto: { fontFamily: FONTES.bold, fontSize: 11, color: '#0c447c', letterSpacing: 0.4 },
  cabecalhoBaixo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  legenda: { flexDirection: 'row', gap: 14, flexWrap: 'wrap', flexShrink: 1 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendaPonto: { width: 8, height: 8, borderRadius: 4 },
  legendaTexto: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoFraco },
  totalGeral: { fontFamily: FONTES.bold, fontSize: 15, color: CORES.texto },

  separadorApt: { borderTopWidth: 8, borderTopColor: CORES.fundo },
  cabecalhoApt: {
    paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fafbfc',
    borderBottomWidth: 1, borderBottomColor: '#f1f2f5',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap', gap: 16,
  },
  aptEsquerda: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: CORES.texto,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTexto: { fontFamily: FONTES.bold, fontSize: 12, color: CORES.branco },
  aptNome: { fontFamily: FONTES.bold, fontSize: 15, color: CORES.texto },
  aptEmp: { fontFamily: FONTES.regular, fontSize: 11.5, color: CORES.textoApagado, marginTop: 1 },

  stats: { flexDirection: 'row', gap: 20, flexWrap: 'wrap' },
  statRotulo: {
    fontFamily: FONTES.bold, fontSize: 9, color: CORES.textoApagado,
    letterSpacing: 0.7, marginBottom: 2,
  },
  statValor: { fontFamily: FONTES.bold, fontSize: 14, color: CORES.texto },

  taxasLinha: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
    backgroundColor: '#fafbfc',
  },
  taxasBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 3 },
  badgeTaxa: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
  },
  badgePonto: { width: 5, height: 5, borderRadius: 2.5 },
  badgeTexto: { fontFamily: FONTES.bold, fontSize: 10 },

  blocoGrade: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  celula: {
    width: 26, height: 26, borderRadius: 6, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  celulaTexto: { fontFamily: FONTES.regular, fontSize: 10, color: '#c4ccd8' },
  marcadorEntrada: { position: 'absolute', top: 2, right: 2, width: 5, height: 5, borderRadius: 2.5 },

  barraLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 12 },
  trilho: { flex: 1, height: 5, backgroundColor: '#f1f2f5', borderRadius: 100, overflow: 'hidden' },
  preenchimento: { height: '100%', backgroundColor: '#16a34a', borderRadius: 100 },
  barraRotulo: { fontFamily: FONTES.regular, fontSize: 10.5, color: CORES.textoFraco },

  carrossel: { gap: 12, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20 },
  cartaoReserva: {
    width: 210, borderWidth: 1, borderRadius: 14,
    overflow: 'hidden', backgroundColor: CORES.branco,
  },
  cartaoTopo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1,
  },
  cartaoPlat: { fontFamily: FONTES.bold, fontSize: 11.5 },
  pillNoites: { backgroundColor: 'rgba(255,255,255,0.65)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  pillNoitesTexto: { fontFamily: FONTES.bold, fontSize: 10.5 },

  cartaoCorpo: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 12 },
  hospede: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 16 },
  hospedeAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  hospedeIniciais: { fontFamily: FONTES.bold, fontSize: 11.5, color: CORES.branco },
  hospedeNome: { fontFamily: FONTES.semi, fontSize: 13, color: CORES.texto, flexShrink: 1 },

  datas: { flexDirection: 'row', alignItems: 'flex-end' },
  dataRotulo: { fontFamily: FONTES.bold, fontSize: 8, color: CORES.textoApagado, letterSpacing: 0.6, marginBottom: 3 },
  dataDia: { fontFamily: FONTES.bold, fontSize: 22, color: CORES.texto },
  dataMes: { fontFamily: FONTES.regular, fontSize: 10, color: CORES.textoApagado, marginTop: 2 },
  conector: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10 },
  conectorPonto: { width: 5, height: 5, borderRadius: 2.5 },
  conectorLinha: { flex: 1, height: 1.5, opacity: 0.4 },

  cartaoValor: {
    fontFamily: FONTES.bold, fontSize: 15, color: '#166534', textAlign: 'right',
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f2f5',
  },
})

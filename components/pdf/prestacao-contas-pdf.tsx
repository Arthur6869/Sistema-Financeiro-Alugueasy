/**
 * AlugEasy - Prestacao de Contas PDF v2.0
 * Design System: Premium Financial Report
 * Renderer: @react-pdf/renderer
 */

import {
  Document, Page, View, Text, Image, StyleSheet,
  Svg, Rect, Line, Circle, Path,
} from '@react-pdf/renderer'

const COLOR = {
  azulEscuro: '#193660',
  azulPrimario: '#1E4A7A',
  azulClaro: '#EBF2FB',
  azulXClaro: '#F4F8FD',
  azulAccent: '#2563EB',
  verde: '#16A34A',
  verdeBg: '#F0FDF4',
  verdeBorda: '#BBF7D0',
  verdeLight: '#DCFCE7',
  vermelho: '#DC2626',
  vermelhoBg: '#FEF2F2',
  vermelhoBorda: '#FECACA',
  amarelo: '#D97706',
  amareloBg: '#FFFBEB',
  amareloBorda: '#FDE68A',
  branco: '#FFFFFF',
  cinzaBg: '#F8FAFC',
  cinzaClaro: '#F1F5F9',
  cinzaMed: '#CBD5E1',
  cinzaBorda: '#E2E8F0',
  cinzaTexto: '#64748B',
  cinzaDark: '#475569',
  texto: '#0F172A',
  textoDark: '#1E293B',
} as const

const FONT = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
}

const CHART_COLORS = [
  '#2563EB',
  '#16A34A',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
  '#DB2777',
  '#475569',
]

const BRL = (valor: number) => {
  const sign = valor < 0 ? '-' : ''
  const fixed = Math.abs(valor || 0).toFixed(2)
  const [int, dec] = fixed.split('.')
  const groups: string[] = []
  for (let i = int.length; i > 0; i -= 3) groups.unshift(int.slice(Math.max(0, i - 3), i))
  return `${sign}R$ ${groups.join('.')},${dec}`
}

const pct = (v: number | undefined, showSign = false) => {
  if (v === undefined || Number.isNaN(v)) return '-'
  const sign = showSign && v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1).replace('.', ',')}%`
}

const tendencia = (atual: number, anterior: number) => {
  if (atual > anterior) return '▲'
  if (atual < anterior) return '▼'
  return '■'
}

const corTendencia = (t: string) => {
  if (t === '▲') return COLOR.verde
  if (t === '▼') return COLOR.vermelho
  return COLOR.cinzaTexto
}

const calcMedia = (arr: number[]) => {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

export interface PrestacaoContasPdfProps {
  logoBase64: string
  empreendimento: string
  apartamento: string
  mesNome: string
  ano: string
  nomeProprietario: string
  modeloContrato: string
  taxaRepasse: number
  tipoRepasse: string
  receitaTotal: number
  custosTotal: number
  lucroLiquido: number
  valorRepasse: number
  valorLiquidoProprietario: number
  receitaAdm: number
  receitaSub: number
  custosAdm: number
  custosSub: number
  custosDetalhados: Array<{ categoria: string; tipoGestao: string; valor: number }>
  numReservas: number
  totalDiarias: number
  taxaOcupacao?: number
  valorMedioDiaria: number
  mediaDiariasPorReserva: number
  usandoDiarias: boolean
  reservas: Array<{
    checkin: string
    checkout: string
    nome_hospede: string | null
    plataforma: string | null
    valor_liquido: number
    noites: number
  }>
  historicoMeses: Array<{ label: string; faturamento: number; custos: number; lucro: number }>
  porPlataforma: Array<{ plataforma: string; valor: number; percentual: number }>
}

const S = StyleSheet.create({
  page: { padding: 34, fontFamily: FONT.regular, fontSize: 9, color: COLOR.texto, backgroundColor: COLOR.branco },
  coverHeader: { margin: -34, marginBottom: 24, padding: 34, height: 170, backgroundColor: COLOR.azulEscuro, flexDirection: 'row', justifyContent: 'space-between' },
  coverHeaderLeft: { width: '68%' },
  coverLogo: { width: 94, height: 32, objectFit: 'contain', marginBottom: 22 },
  coverTitle: { fontFamily: FONT.bold, fontSize: 31, color: COLOR.branco, lineHeight: 1.1 },
  coverSub: { marginTop: 8, color: COLOR.azulClaro, fontSize: 11 },
  coverBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 3, backgroundColor: COLOR.azulAccent },
  coverBadgeText: { color: COLOR.branco, fontFamily: FONT.bold, fontSize: 9 },
  coverStripe: { height: 6, marginHorizontal: -34, marginTop: -24, marginBottom: 20, backgroundColor: COLOR.azulAccent },
  pageHeader: { marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: COLOR.cinzaBorda, flexDirection: 'row', justifyContent: 'space-between' },
  pageHeaderLeft: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  pageHeaderLogo: { width: 58, height: 20, objectFit: 'contain' },
  pageHeaderTitle: { fontFamily: FONT.bold, fontSize: 12, color: COLOR.azulEscuro },
  pageHeaderSub: { fontSize: 8, color: COLOR.cinzaTexto, marginTop: 2 },
  pageHeaderRight: { alignItems: 'flex-end' },
  pageHeaderBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3, backgroundColor: COLOR.azulClaro },
  pageHeaderBadgeText: { fontFamily: FONT.bold, color: COLOR.azulPrimario, fontSize: 8 },
  pageHeaderPag: { marginTop: 5, color: COLOR.cinzaTexto, fontSize: 8 },
  infoStrip: { flexDirection: 'row', borderWidth: 1, borderColor: COLOR.cinzaBorda, borderRadius: 6, backgroundColor: COLOR.cinzaBg, marginBottom: 14 },
  infoStripItem: { flex: 1, padding: 10 },
  infoStripItemBorder: { flex: 1, padding: 10, borderLeftWidth: 1, borderLeftColor: COLOR.cinzaBorda },
  infoStripLabel: { color: COLOR.cinzaTexto, fontSize: 7, textTransform: 'uppercase', marginBottom: 4 },
  infoStripValue: { color: COLOR.textoDark, fontFamily: FONT.bold, fontSize: 10 },
  heroCard: { backgroundColor: COLOR.azulEscuro, borderRadius: 7, padding: 20, marginBottom: 14 },
  heroLabel: { color: COLOR.azulClaro, fontSize: 8, textTransform: 'uppercase' },
  heroValue: { color: COLOR.branco, fontFamily: FONT.bold, fontSize: 32, marginTop: 7 },
  heroSub: { color: COLOR.azulClaro, marginTop: 6, fontSize: 10 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  heroRight: { alignItems: 'flex-end' },
  heroBadge: { backgroundColor: COLOR.branco, borderRadius: 3, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 12 },
  heroBadgeText: { fontFamily: FONT.bold, color: COLOR.azulEscuro, fontSize: 8 },
  heroMetaLabel: { color: COLOR.azulClaro, fontSize: 7, textAlign: 'right' },
  heroMetaValue: { color: COLOR.branco, fontFamily: FONT.bold, fontSize: 13, marginTop: 3 },
  kpiGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  kpiCard: { flex: 1, borderWidth: 1, borderColor: COLOR.cinzaBorda, borderRadius: 6, padding: 11, backgroundColor: COLOR.branco },
  kpiCardGreen: { flex: 1, borderWidth: 1, borderColor: COLOR.verdeBorda, borderRadius: 6, padding: 11, backgroundColor: COLOR.verdeBg },
  kpiCardRed: { flex: 1, borderWidth: 1, borderColor: COLOR.vermelhoBorda, borderRadius: 6, padding: 11, backgroundColor: COLOR.vermelhoBg },
  kpiLabel: { color: COLOR.cinzaTexto, fontSize: 7, textTransform: 'uppercase', marginBottom: 5 },
  kpiValue: { color: COLOR.textoDark, fontFamily: FONT.bold, fontSize: 15 },
  kpiValueGreen: { color: COLOR.verde, fontFamily: FONT.bold, fontSize: 15 },
  kpiValueRed: { color: COLOR.vermelho, fontFamily: FONT.bold, fontSize: 15 },
  kpiSub: { color: COLOR.cinzaTexto, fontSize: 8, marginTop: 4 },
  kpiTrend: { fontFamily: FONT.bold, fontSize: 10, marginTop: 5 },
  kpiBar: { height: 4, borderRadius: 2, backgroundColor: COLOR.cinzaClaro, marginTop: 9 },
  kpiBarFill: { height: 4, borderRadius: 2, backgroundColor: COLOR.azulAccent },
  sectionTitle: { fontFamily: FONT.bold, fontSize: 13, color: COLOR.azulEscuro, marginTop: 4, marginBottom: 7 },
  sectionDivider: { height: 2, width: 42, backgroundColor: COLOR.azulAccent, marginBottom: 10 },
  narrativaCard: { borderLeftWidth: 4, borderLeftColor: COLOR.azulAccent, backgroundColor: COLOR.azulXClaro, padding: 12, borderRadius: 5, marginBottom: 14 },
  narrativaLabel: { fontFamily: FONT.bold, color: COLOR.azulPrimario, fontSize: 8, marginBottom: 5, textTransform: 'uppercase' },
  narrativaText: { color: COLOR.textoDark, fontSize: 10, lineHeight: 1.35 },
  repasseBox: { borderWidth: 1, borderColor: COLOR.cinzaBorda, borderRadius: 6, overflow: 'hidden', marginBottom: 14 },
  repasseBoxHeader: { backgroundColor: COLOR.azulPrimario, padding: 9 },
  repasseBoxHeaderText: { color: COLOR.branco, fontFamily: FONT.bold, fontSize: 10 },
  repasseBoxRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10 },
  repasseBoxRowAlt: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: COLOR.cinzaBg },
  repasseBoxLabel: { color: COLOR.cinzaDark, fontSize: 9 },
  repasseBoxValue: { fontFamily: FONT.bold, color: COLOR.textoDark, fontSize: 9 },
  repasseBoxFinal: { flexDirection: 'row', justifyContent: 'space-between', padding: 11, backgroundColor: COLOR.verdeBg, borderTopWidth: 1, borderTopColor: COLOR.verdeBorda },
  repasseBoxFinalLabel: { color: COLOR.verde, fontFamily: FONT.bold, fontSize: 10 },
  repasseBoxFinalValue: { color: COLOR.verde, fontFamily: FONT.bold, fontSize: 14 },
  table: { borderWidth: 1, borderColor: COLOR.cinzaBorda, borderRadius: 5, overflow: 'hidden', marginBottom: 12 },
  tableHead: { flexDirection: 'row', backgroundColor: COLOR.azulEscuro },
  tableHeadCell: { flex: 1, padding: 7, color: COLOR.branco, fontFamily: FONT.bold, fontSize: 8 },
  tableRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLOR.cinzaBorda },
  tableRowAlt: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLOR.cinzaBorda, backgroundColor: COLOR.cinzaBg },
  tableCell: { flex: 1, padding: 7, fontSize: 8, color: COLOR.textoDark },
  tableCellR: { flex: 1, padding: 7, fontSize: 8, color: COLOR.textoDark, textAlign: 'right' },
  tableCellBold: { flex: 1, padding: 7, fontSize: 8, color: COLOR.textoDark, fontFamily: FONT.bold },
  tableCellRBold: { flex: 1, padding: 7, fontSize: 8, color: COLOR.textoDark, textAlign: 'right', fontFamily: FONT.bold },
  tableFooter: { flexDirection: 'row', backgroundColor: COLOR.azulClaro, borderTopWidth: 1, borderTopColor: COLOR.cinzaBorda },
  tableFooterCell: { flex: 1, padding: 7, fontFamily: FONT.bold, color: COLOR.azulEscuro, fontSize: 8 },
  tableFooterCellR: { flex: 1, padding: 7, fontFamily: FONT.bold, color: COLOR.azulEscuro, fontSize: 8, textAlign: 'right' },
  chartContainer: { borderWidth: 1, borderColor: COLOR.cinzaBorda, borderRadius: 6, padding: 12, marginBottom: 12 },
  chartTitle: { fontFamily: FONT.bold, color: COLOR.azulEscuro, fontSize: 11, marginBottom: 9 },
  chartLegend: { flexDirection: 'row', gap: 12, marginTop: 8 },
  chartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chartLegendDot: { width: 7, height: 7, borderRadius: 4 },
  chartLegendText: { color: COLOR.cinzaTexto, fontSize: 8 },
  donutContainer: { flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 12 },
  donutLegend: { flex: 1 },
  donutLegendItem: { marginBottom: 8 },
  donutLegendBar: { height: 5, borderRadius: 3, backgroundColor: COLOR.cinzaClaro, marginTop: 3 },
  donutLegendLabel: { fontFamily: FONT.bold, color: COLOR.textoDark, fontSize: 8 },
  donutLegendPct: { color: COLOR.cinzaTexto, fontSize: 7 },
  donutLegendVal: { color: COLOR.textoDark, fontSize: 8, textAlign: 'right' },
  indicGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  indicCard: { flex: 1, borderWidth: 1, borderColor: COLOR.cinzaBorda, borderRadius: 6, padding: 10, backgroundColor: COLOR.branco },
  indicLabel: { color: COLOR.cinzaTexto, textTransform: 'uppercase', fontSize: 7, marginBottom: 5 },
  indicValue: { color: COLOR.azulEscuro, fontFamily: FONT.bold, fontSize: 15 },
  indicSub: { color: COLOR.cinzaTexto, fontSize: 8, marginTop: 4 },
  plataformaRow: { marginBottom: 8 },
  plataformaName: { fontFamily: FONT.bold, color: COLOR.textoDark, fontSize: 8 },
  plataformaBar: { height: 6, borderRadius: 3, backgroundColor: COLOR.cinzaClaro, marginTop: 4 },
  plataformaBarFill: { height: 6, borderRadius: 3, backgroundColor: COLOR.azulAccent },
  plataformaPct: { color: COLOR.cinzaTexto, fontSize: 7, marginTop: 2 },
  plataformaVal: { color: COLOR.textoDark, fontFamily: FONT.bold, fontSize: 8, textAlign: 'right', marginTop: -10 },
  insightCard: { flexDirection: 'row', borderWidth: 1, borderColor: COLOR.cinzaBorda, borderRadius: 6, overflow: 'hidden', marginBottom: 9 },
  insightCardAccent: { width: 6 },
  insightCardBody: { flex: 1, padding: 10 },
  insightCardTitle: { fontFamily: FONT.bold, color: COLOR.textoDark, fontSize: 10, marginBottom: 4 },
  insightCardText: { color: COLOR.cinzaDark, fontSize: 8.5, lineHeight: 1.3 },
  insightCardBadge: { alignSelf: 'flex-start', borderRadius: 3, paddingHorizontal: 6, paddingVertical: 3, marginTop: 6 },
  insightCardBadgeText: { color: COLOR.branco, fontFamily: FONT.bold, fontSize: 7 },
  historStats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  historStatsStatCard: { flex: 1, backgroundColor: COLOR.cinzaBg, borderWidth: 1, borderColor: COLOR.cinzaBorda, borderRadius: 6, padding: 10 },
  historStatsStatLabel: { color: COLOR.cinzaTexto, fontSize: 7, textTransform: 'uppercase', marginBottom: 5 },
  historStatsStatValue: { color: COLOR.azulEscuro, fontFamily: FONT.bold, fontSize: 13 },
  emptyState: { padding: 18, borderWidth: 1, borderColor: COLOR.cinzaBorda, borderRadius: 6, backgroundColor: COLOR.cinzaBg, alignItems: 'center', marginBottom: 12 },
  emptyStateTitle: { fontFamily: FONT.bold, color: COLOR.cinzaDark, fontSize: 10, marginBottom: 4 },
  emptyStateText: { color: COLOR.cinzaTexto, fontSize: 8, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 18, left: 34, right: 34, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLOR.cinzaBorda, flexDirection: 'row', justifyContent: 'space-between' },
  footerBrand: { fontFamily: FONT.bold, color: COLOR.azulEscuro, fontSize: 8 },
  footerSub: { color: COLOR.cinzaTexto, fontSize: 7 },
  footerPage: { color: COLOR.cinzaTexto, fontSize: 7, textAlign: 'right' },
  footerDate: { color: COLOR.cinzaTexto, fontSize: 7, textAlign: 'right', marginTop: 2 },
})

function PageHeader({ logoBase64, empreendimento, apartamento, mesNome, ano, pageNum, totalPages, pageTitle }: {
  logoBase64: string
  empreendimento: string
  apartamento: string
  mesNome: string
  ano: string
  pageNum: number
  totalPages: number
  pageTitle: string
}) {
  return (
    <View style={S.pageHeader}>
      <View style={S.pageHeaderLeft}>
        <Image src={logoBase64} style={S.pageHeaderLogo} />
        <View>
          <Text style={S.pageHeaderTitle}>{pageTitle}</Text>
          <Text style={S.pageHeaderSub}>{empreendimento} - Apt {apartamento}</Text>
        </View>
      </View>
      <View style={S.pageHeaderRight}>
        <View style={S.pageHeaderBadge}><Text style={S.pageHeaderBadgeText}>{mesNome} {ano}</Text></View>
        <Text style={S.pageHeaderPag}>Pagina {pageNum} de {totalPages}</Text>
      </View>
    </View>
  )
}

function PageFooter({ dataGeracao, pageNum }: { dataGeracao: string; pageNum: number }) {
  return (
    <View style={S.footer} fixed>
      <View>
        <Text style={S.footerBrand}>AlugEasy</Text>
        <Text style={S.footerSub}>Prestacao de contas gerada automaticamente</Text>
      </View>
      <View>
        <Text style={S.footerPage}>Pagina {pageNum}</Text>
        <Text style={S.footerDate}>{dataGeracao}</Text>
      </View>
    </View>
  )
}

function BarChart({ dados, width, height }: {
  dados: Array<{ label: string; faturamento: number; custos: number; lucro: number }>
  width: number
  height: number
}) {
  const pad = 24
  const max = Math.max(1, ...dados.flatMap(d => [d.faturamento, d.custos, d.lucro]).map(Math.abs))
  const plotW = width - pad * 2
  const plotH = height - pad * 2
  const groupW = plotW / Math.max(1, dados.length)
  const barW = Math.min(9, groupW / 4)
  const y = (v: number) => pad + plotH - (Math.max(0, v) / max) * plotH
  return (
    <View>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <Line key={g} x1={pad} y1={pad + plotH * g} x2={width - pad} y2={pad + plotH * g} stroke={COLOR.cinzaBorda} strokeWidth={0.6} />
        ))}
        {dados.map((d, i) => {
          const x = pad + i * groupW + groupW / 2 - barW * 1.5
          const hf = pad + plotH - y(d.faturamento)
          const hc = pad + plotH - y(d.custos)
          const hl = pad + plotH - y(d.lucro)
          return (
            <View key={d.label}>
              <Rect x={x} y={y(d.faturamento)} width={barW} height={hf} fill={CHART_COLORS[0]} />
              <Rect x={x + barW + 2} y={y(d.custos)} width={barW} height={hc} fill={CHART_COLORS[3]} />
              <Rect x={x + (barW + 2) * 2} y={y(d.lucro)} width={barW} height={hl} fill={CHART_COLORS[1]} />
            </View>
          )
        })}
      </Svg>
      <View style={S.chartLegend}>
        <View style={S.chartLegendItem}><View style={[S.chartLegendDot, { backgroundColor: CHART_COLORS[0] }]} /><Text style={S.chartLegendText}>Faturamento</Text></View>
        <View style={S.chartLegendItem}><View style={[S.chartLegendDot, { backgroundColor: CHART_COLORS[3] }]} /><Text style={S.chartLegendText}>Custos</Text></View>
        <View style={S.chartLegendItem}><View style={[S.chartLegendDot, { backgroundColor: CHART_COLORS[1] }]} /><Text style={S.chartLegendText}>Lucro</Text></View>
      </View>
    </View>
  )
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const s = (start - 90) * Math.PI / 180
  const e = (end - 90) * Math.PI / 180
  const x1 = cx + r * Math.cos(s)
  const y1 = cy + r * Math.sin(s)
  const x2 = cx + r * Math.cos(e)
  const y2 = cy + r * Math.sin(e)
  const large = end - start > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
}

function DonutChart({ dados, size }: { dados: Array<{ label: string; valor: number }>; size: number }) {
  const total = dados.reduce((s, d) => s + d.valor, 0)
  let cursor = 0
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4
  if (total <= 0) return <Circle cx={cx} cy={cy} r={r} fill={COLOR.cinzaClaro} />
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {dados.map((d, i) => {
        const start = cursor
        const end = cursor + (d.valor / total) * 360
        cursor = end
        return <Path key={d.label} d={arcPath(cx, cy, r, start, end)} fill={CHART_COLORS[i % CHART_COLORS.length]} />
      })}
      <Circle cx={cx} cy={cy} r={r * 0.58} fill={COLOR.branco} />
    </Svg>
  )
}

function InsightCard({ cor, titulo, texto, badge, badgeCor }: {
  cor: string
  titulo: string
  texto: string
  badge?: string
  badgeCor?: string
}) {
  return (
    <View style={S.insightCard}>
      <View style={[S.insightCardAccent, { backgroundColor: cor }]} />
      <View style={S.insightCardBody}>
        <Text style={S.insightCardTitle}>{titulo}</Text>
        <Text style={S.insightCardText}>{texto}</Text>
        {badge ? <View style={[S.insightCardBadge, { backgroundColor: badgeCor ?? cor }]}><Text style={S.insightCardBadgeText}>{badge}</Text></View> : null}
      </View>
    </View>
  )
}

function widthPct(v: number) {
  return `${Math.max(2, Math.min(100, v))}%`
}

function shortDate(date: string) {
  if (!date) return '-'
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

function chunk<T>(arr: T[], max: number) {
  return arr.slice(0, max)
}

export function PrestacaoContasPdf(props: PrestacaoContasPdfProps) {
  const {
    logoBase64, empreendimento, apartamento, mesNome, ano, nomeProprietario, modeloContrato,
    taxaRepasse, tipoRepasse, receitaTotal, custosTotal, lucroLiquido, valorRepasse,
    valorLiquidoProprietario, receitaAdm, receitaSub, custosAdm, custosSub, custosDetalhados,
    numReservas, totalDiarias, taxaOcupacao, valorMedioDiaria, mediaDiariasPorReserva,
    usandoDiarias, reservas, historicoMeses, porPlataforma,
  } = props

  const dataGeracao = new Date().toLocaleDateString('pt-BR')
  const margemPct = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0
  const historFat = historicoMeses.map(h => h.faturamento)
  const historLucro = historicoMeses.map(h => h.lucro)
  const mediaMensal = calcMedia(historFat)
  const mesAtualVsMedia = mediaMensal > 0 ? ((receitaTotal - mediaMensal) / mediaMensal) * 100 : 0
  const ultimos = historicoMeses.slice(-3)
  const tendFatValor = ultimos.length >= 2 ? ultimos[ultimos.length - 1].faturamento - ultimos[0].faturamento : 0
  const tendFat = tendencia(ultimos.at(-1)?.faturamento ?? 0, ultimos[0]?.faturamento ?? 0)
  const topCustos = Object.values(custosDetalhados.reduce<Record<string, { label: string; valor: number }>>((acc, c) => {
    acc[c.categoria] = acc[c.categoria] ?? { label: c.categoria, valor: 0 }
    acc[c.categoria].valor += c.valor
    return acc
  }, {})).sort((a, b) => b.valor - a.valor)
  const principalCusto = topCustos[0]
  const ticketMedioReserva = numReservas > 0 ? receitaTotal / numReservas : 0
  const contratoLabel = modeloContrato === 'sublocacao' ? 'Sublocacao' : 'Administracao'
  const repasseBase = tipoRepasse === 'faturamento' ? receitaTotal : lucroLiquido
  const narrativa = `${nomeProprietario} tem ${BRL(valorLiquidoProprietario)} a receber referente a ${mesNome}/${ano}. O periodo registrou ${BRL(receitaTotal)} em faturamento, ${BRL(custosTotal)} em custos e margem de ${pct(margemPct)}. A taxa de repasse aplicada foi de ${pct(taxaRepasse)} sobre ${tipoRepasse === 'faturamento' ? 'o faturamento' : 'o lucro liquido'}.`
  const margemCor = margemPct >= 40 ? COLOR.verde : margemPct >= 20 ? COLOR.amarelo : COLOR.vermelho
  const margemBadge = margemPct >= 40 ? 'Margem forte' : margemPct >= 20 ? 'Atencao' : 'Margem critica'
  const maxCusto = Math.max(1, ...topCustos.map(c => c.valor))
  const maxPlat = Math.max(1, ...porPlataforma.map(p => p.percentual))
  const hasAdm = receitaAdm > 0 || custosAdm > 0
  const hasSub = receitaSub > 0 || custosSub > 0
  const hasAmbosOsTipos = hasAdm && hasSub
  const tipoUnico = !hasAdm ? 'SUB' : !hasSub ? 'ADM' : null
  const lucroAdm = receitaAdm - custosAdm
  const lucroSub = receitaSub - custosSub
  const lucroNeg = lucroLiquido < 0

  return (
    <Document title={`Prestacao de Contas - ${empreendimento} ${apartamento}`}>
      <Page size="A4" style={S.page}>
        <View style={S.coverHeader}>
          <View style={S.coverHeaderLeft}>
            <Image src={logoBase64} style={S.coverLogo} />
            <Text style={S.coverTitle}>Prestacao de Contas</Text>
            <Text style={S.coverSub}>{empreendimento} - Apartamento {apartamento}</Text>
          </View>
          <View style={S.coverBadge}><Text style={S.coverBadgeText}>{mesNome} {ano}</Text></View>
        </View>
        <View style={S.coverStripe} />
        <View style={S.infoStrip}>
          <View style={S.infoStripItem}><Text style={S.infoStripLabel}>Proprietario</Text><Text style={S.infoStripValue}>{nomeProprietario}</Text></View>
          <View style={S.infoStripItemBorder}><Text style={S.infoStripLabel}>Contrato</Text><Text style={S.infoStripValue}>{contratoLabel}</Text></View>
          <View style={S.infoStripItemBorder}><Text style={S.infoStripLabel}>Fonte Receita</Text><Text style={S.infoStripValue}>{usandoDiarias ? 'Diarias' : 'Reservas'}</Text></View>
        </View>
        <View style={S.heroCard}>
          <View style={S.heroRow}>
            <View>
              <Text style={S.heroLabel}>Valor liquido ao proprietario</Text>
              <Text style={S.heroValue}>{BRL(valorLiquidoProprietario)}</Text>
              <Text style={S.heroSub}>Resultado apos custos e repasse AlugEasy</Text>
            </View>
            <View style={S.heroRight}>
              <View style={S.heroBadge}><Text style={S.heroBadgeText}>{margemBadge}</Text></View>
              <Text style={S.heroMetaLabel}>Margem do mes</Text>
              <Text style={S.heroMetaValue}>{pct(margemPct)}</Text>
            </View>
          </View>
        </View>
        <View style={S.kpiGrid}>
          <View style={S.kpiCardGreen}><Text style={S.kpiLabel}>Faturamento</Text><Text style={S.kpiValueGreen}>{BRL(receitaTotal)}</Text><Text style={[S.kpiTrend, { color: corTendencia(tendFat) }]}>{tendFat} {BRL(Math.abs(tendFatValor))}</Text></View>
          <View style={S.kpiCardRed}><Text style={S.kpiLabel}>Custos</Text><Text style={S.kpiValueRed}>{BRL(custosTotal)}</Text><Text style={S.kpiSub}>{pct(receitaTotal > 0 ? custosTotal / receitaTotal * 100 : 0)} da receita</Text></View>
          <View style={S.kpiCard}><Text style={S.kpiLabel}>Lucro liquido</Text><Text style={S.kpiValue}>{BRL(lucroLiquido)}</Text><View style={S.kpiBar}><View style={[S.kpiBarFill, { width: widthPct(margemPct), backgroundColor: margemCor }]} /></View></View>
        </View>
        <Text style={S.sectionTitle}>Calculo de Repasse</Text>
        <View style={S.sectionDivider} />
        <View style={S.repasseBox}>
          <View style={S.repasseBoxHeader}><Text style={S.repasseBoxHeaderText}>Memoria de calculo</Text></View>
          <View style={S.repasseBoxRow}><Text style={S.repasseBoxLabel}>Receita total</Text><Text style={S.repasseBoxValue}>{BRL(receitaTotal)}</Text></View>
          <View style={S.repasseBoxRowAlt}><Text style={S.repasseBoxLabel}>Custos totais</Text><Text style={S.repasseBoxValue}>- {BRL(custosTotal)}</Text></View>
          <View style={S.repasseBoxRow}><Text style={S.repasseBoxLabel}>Base do repasse ({tipoRepasse})</Text><Text style={S.repasseBoxValue}>{BRL(repasseBase)}</Text></View>
          <View style={S.repasseBoxRowAlt}><Text style={S.repasseBoxLabel}>Repasse AlugEasy ({pct(taxaRepasse)})</Text><Text style={S.repasseBoxValue}>- {BRL(valorRepasse)}</Text></View>
          <View style={S.repasseBoxFinal}><Text style={S.repasseBoxFinalLabel}>Total ao proprietario</Text><Text style={S.repasseBoxFinalValue}>{BRL(valorLiquidoProprietario)}</Text></View>
        </View>
        <View style={S.narrativaCard}><Text style={S.narrativaLabel}>Resumo executivo</Text><Text style={S.narrativaText}>{narrativa}</Text></View>
        <PageFooter dataGeracao={dataGeracao} pageNum={1} />
      </Page>

      <Page size="A4" style={S.page}>
        <PageHeader logoBase64={logoBase64} empreendimento={empreendimento} apartamento={apartamento} mesNome={mesNome} ano={ano} pageNum={2} totalPages={5} pageTitle="Analise Financeira" />
        <View style={S.chartContainer}><Text style={S.chartTitle}>Historico financeiro - 6 meses</Text><BarChart dados={historicoMeses} width={500} height={170} /></View>
        <View style={S.historStats}>
          <View style={S.historStatsStatCard}><Text style={S.historStatsStatLabel}>Media mensal</Text><Text style={S.historStatsStatValue}>{BRL(mediaMensal)}</Text></View>
          <View style={S.historStatsStatCard}><Text style={S.historStatsStatLabel}>Atual vs media</Text><Text style={S.historStatsStatValue}>{pct(mesAtualVsMedia, true)}</Text></View>
          <View style={S.historStatsStatCard}><Text style={S.historStatsStatLabel}>Melhor lucro</Text><Text style={S.historStatsStatValue}>{BRL(Math.max(0, ...historLucro))}</Text></View>
        </View>
        <Text style={S.sectionTitle}>ADM / SUB</Text><View style={S.sectionDivider} />
        <View style={S.table}>
          <View style={S.tableHead}><Text style={S.tableHeadCell}>Gestao</Text><Text style={S.tableHeadCell}>Receita</Text><Text style={S.tableHeadCell}>Custos</Text><Text style={S.tableHeadCell}>Resultado</Text></View>
          {hasAmbosOsTipos ? (
            <>
              {hasAdm && <View style={S.tableRow}><Text style={S.tableCellBold}>ADM</Text><Text style={S.tableCellR}>{BRL(receitaAdm)}</Text><Text style={S.tableCellR}>{BRL(custosAdm)}</Text><Text style={S.tableCellRBold}>{BRL(lucroAdm)}</Text></View>}
              {hasSub && <View style={S.tableRowAlt}><Text style={S.tableCellBold}>SUB</Text><Text style={S.tableCellR}>{BRL(receitaSub)}</Text><Text style={S.tableCellR}>{BRL(custosSub)}</Text><Text style={S.tableCellRBold}>{BRL(lucroSub)}</Text></View>}
              <View style={S.tableFooter}><Text style={S.tableFooterCell}>Total</Text><Text style={S.tableFooterCellR}>{BRL(receitaTotal)}</Text><Text style={S.tableFooterCellR}>{BRL(custosTotal)}</Text><Text style={S.tableFooterCellR}>{BRL(lucroLiquido)}</Text></View>
            </>
          ) : tipoUnico ? (
            <>
              <View style={S.tableRow}>
                <Text style={S.tableCell}>{tipoUnico === 'ADM' ? 'Administracao' : 'Sublocacao'}</Text>
                <Text style={S.tableCellR}>{BRL(receitaTotal)}</Text>
                <Text style={[S.tableCellR, { color: COLOR.vermelho }]}>{BRL(custosTotal)}</Text>
                <Text style={[S.tableCellR, { color: lucroNeg ? COLOR.vermelho : COLOR.verde }]}>{BRL(lucroLiquido)} ({pct(margemPct)})</Text>
              </View>
              <View style={S.tableFooter}>
                <Text style={S.tableFooterCell}>Total</Text>
                <Text style={S.tableFooterCellR}>{BRL(receitaTotal)}</Text>
                <Text style={S.tableFooterCellR}>{BRL(custosTotal)}</Text>
                <Text style={S.tableFooterCellR}>{BRL(lucroLiquido)} ({pct(margemPct)})</Text>
              </View>
            </>
          ) : (
            <View style={S.tableFooter}><Text style={S.tableFooterCell}>Total</Text><Text style={S.tableFooterCellR}>{BRL(receitaTotal)}</Text><Text style={S.tableFooterCellR}>{BRL(custosTotal)}</Text><Text style={S.tableFooterCellR}>{BRL(lucroLiquido)}</Text></View>
          )}
        </View>
        <Text style={S.sectionTitle}>Plataformas</Text><View style={S.sectionDivider} />
        {porPlataforma.length ? porPlataforma.map((p, i) => (
          <View key={p.plataforma} style={S.plataformaRow}>
            <Text style={S.plataformaName}>{p.plataforma}</Text>
            <View style={S.plataformaBar}><View style={[S.plataformaBarFill, { width: widthPct((p.percentual / maxPlat) * 100), backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} /></View>
            <Text style={S.plataformaPct}>{pct(p.percentual)}</Text><Text style={S.plataformaVal}>{BRL(p.valor)}</Text>
          </View>
        )) : <View style={S.emptyState}><Text style={S.emptyStateTitle}>Sem plataformas no periodo</Text><Text style={S.emptyStateText}>Nao houve reservas validas para compor esta analise.</Text></View>}
        <PageFooter dataGeracao={dataGeracao} pageNum={2} />
      </Page>

      <Page size="A4" style={S.page}>
        <PageHeader logoBase64={logoBase64} empreendimento={empreendimento} apartamento={apartamento} mesNome={mesNome} ano={ano} pageNum={3} totalPages={5} pageTitle="Composicao de Custos" />
        <View style={S.donutContainer}>
          <DonutChart dados={chunk(topCustos, 5)} size={155} />
          <View style={S.donutLegend}>
            {chunk(topCustos, 5).map((c, i) => (
              <View key={c.label} style={S.donutLegendItem}>
                <Text style={S.donutLegendLabel}>{c.label}</Text>
                <View style={S.donutLegendBar}><View style={[S.plataformaBarFill, { width: widthPct((c.valor / maxCusto) * 100), backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }]} /></View>
                <Text style={S.donutLegendPct}>{pct(custosTotal > 0 ? c.valor / custosTotal * 100 : 0)}</Text><Text style={S.donutLegendVal}>{BRL(c.valor)}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={S.sectionTitle}>Detalhamento</Text><View style={S.sectionDivider} />
        <View style={S.table}>
          <View style={S.tableHead}><Text style={S.tableHeadCell}>Categoria</Text><Text style={S.tableHeadCell}>Gestao</Text><Text style={S.tableHeadCell}>Participacao</Text><Text style={S.tableHeadCell}>Valor</Text></View>
          {chunk(custosDetalhados, 17).map((c, i) => (
            <View key={`${c.categoria}-${i}`} style={i % 2 ? S.tableRowAlt : S.tableRow}>
              <Text style={S.tableCell}>{c.categoria}</Text><Text style={S.tableCell}>{c.tipoGestao}</Text><Text style={S.tableCellR}>{pct(custosTotal > 0 ? c.valor / custosTotal * 100 : 0)}</Text><Text style={S.tableCellRBold}>{BRL(c.valor)}</Text>
            </View>
          ))}
          <View style={S.tableFooter}><Text style={S.tableFooterCell}>Total</Text><Text style={S.tableFooterCell} /><Text style={S.tableFooterCellR}>100,0%</Text><Text style={S.tableFooterCellR}>{BRL(custosTotal)}</Text></View>
        </View>
        {!custosDetalhados.length ? <View style={S.emptyState}><Text style={S.emptyStateTitle}>Sem custos lancados</Text><Text style={S.emptyStateText}>Nao foram encontrados custos para esta competencia.</Text></View> : null}
        <PageFooter dataGeracao={dataGeracao} pageNum={3} />
      </Page>

      <Page size="A4" style={S.page}>
        <PageHeader logoBase64={logoBase64} empreendimento={empreendimento} apartamento={apartamento} mesNome={mesNome} ano={ano} pageNum={4} totalPages={5} pageTitle="Reservas e Operacao" />
        <View style={S.indicGrid}>
          <View style={S.indicCard}><Text style={S.indicLabel}>Reservas</Text><Text style={S.indicValue}>{numReservas}</Text><Text style={S.indicSub}>validas no periodo</Text></View>
          <View style={S.indicCard}><Text style={S.indicLabel}>Diarias</Text><Text style={S.indicValue}>{totalDiarias}</Text><Text style={S.indicSub}>noites vendidas</Text></View>
          <View style={S.indicCard}><Text style={S.indicLabel}>Diaria media</Text><Text style={S.indicValue}>{BRL(valorMedioDiaria)}</Text><Text style={S.indicSub}>por noite</Text></View>
          <View style={S.indicCard}><Text style={S.indicLabel}>Media por reserva</Text><Text style={S.indicValue}>{mediaDiariasPorReserva.toFixed(1).replace('.', ',')}</Text><Text style={S.indicSub}>noites</Text></View>
        </View>
        {taxaOcupacao !== undefined ? <View style={S.narrativaCard}><Text style={S.narrativaLabel}>Taxa de ocupacao</Text><Text style={S.narrativaText}>A ocupacao estimada do mes foi de {pct(taxaOcupacao)}, calculada sobre {totalDiarias} diarias vendidas.</Text></View> : null}
        <Text style={S.sectionTitle}>Reservas</Text><View style={S.sectionDivider} />
        {reservas.length ? (
          <View style={S.table}>
            <View style={S.tableHead}><Text style={S.tableHeadCell}>Hospede</Text><Text style={S.tableHeadCell}>Periodo</Text><Text style={S.tableHeadCell}>Canal</Text><Text style={S.tableHeadCell}>Noites</Text><Text style={S.tableHeadCell}>Valor</Text></View>
            {chunk(reservas, 15).map((r, i) => (
              <View key={`${r.checkin}-${i}`} style={i % 2 ? S.tableRowAlt : S.tableRow}>
                <Text style={S.tableCell}>{r.nome_hospede ?? 'Hospede'}</Text><Text style={S.tableCell}>{shortDate(r.checkin)} a {shortDate(r.checkout)}</Text><Text style={S.tableCell}>{r.plataforma ?? 'Outros'}</Text><Text style={S.tableCellR}>{r.noites}</Text><Text style={S.tableCellRBold}>{BRL(r.valor_liquido)}</Text>
              </View>
            ))}
          </View>
        ) : <View style={S.emptyState}><Text style={S.emptyStateTitle}>Sem reservas validas</Text><Text style={S.emptyStateText}>Nao houve reservas validas para a competencia selecionada.</Text></View>}
        <PageFooter dataGeracao={dataGeracao} pageNum={4} />
      </Page>

      <Page size="A4" style={S.page}>
        <PageHeader logoBase64={logoBase64} empreendimento={empreendimento} apartamento={apartamento} mesNome={mesNome} ano={ano} pageNum={5} totalPages={5} pageTitle="Inteligencia AlugEasy" />
        <InsightCard cor={margemCor} titulo="Margem operacional" texto={`A margem do periodo foi de ${pct(margemPct)}. ${margemPct >= 40 ? 'O desempenho esta acima do patamar saudavel para operacao.' : margemPct >= 20 ? 'O resultado e positivo, mas merece acompanhamento dos principais custos.' : 'O resultado exige revisao de custos, precificacao ou ocupacao.'}`} badge={margemBadge} />
        <InsightCard cor={corTendencia(tendFat)} titulo="Tendencia de faturamento" texto={`Nos ultimos tres meses, a variacao acumulada de faturamento foi de ${BRL(tendFatValor)}. O movimento atual esta sinalizado como ${tendFat}.`} />
        <InsightCard cor={mesAtualVsMedia >= 0 ? COLOR.verde : COLOR.vermelho} titulo="Comparativo com media" texto={`O mes atual ficou ${pct(mesAtualVsMedia, true)} em relacao a media de ${BRL(mediaMensal)} dos meses analisados.`} />
        <InsightCard cor={COLOR.amarelo} titulo="Principal custo" texto={principalCusto ? `${principalCusto.label} concentrou ${BRL(principalCusto.valor)}, equivalente a ${pct(custosTotal > 0 ? principalCusto.valor / custosTotal * 100 : 0)} dos custos.` : 'Nao ha custos registrados para identificar concentracao de despesas.'} />
        <InsightCard cor={COLOR.azulAccent} titulo="Ticket medio por reserva" texto={`O ticket medio foi de ${BRL(ticketMedioReserva)} por reserva, com diaria media de ${BRL(valorMedioDiaria)}.`} />
        <View style={S.repasseBox}>
          <View style={S.repasseBoxHeader}><Text style={S.repasseBoxHeaderText}>Resumo final</Text></View>
          <View style={S.repasseBoxRow}><Text style={S.repasseBoxLabel}>Resultado liquido do imovel</Text><Text style={S.repasseBoxValue}>{BRL(lucroLiquido)}</Text></View>
          <View style={S.repasseBoxRowAlt}><Text style={S.repasseBoxLabel}>Repasse AlugEasy</Text><Text style={S.repasseBoxValue}>{BRL(valorRepasse)}</Text></View>
          <View style={S.repasseBoxFinal}><Text style={S.repasseBoxFinalLabel}>Valor final ao proprietario</Text><Text style={S.repasseBoxFinalValue}>{BRL(valorLiquidoProprietario)}</Text></View>
        </View>
        <View style={S.narrativaCard}><Text style={S.narrativaLabel}>Assinatura</Text><Text style={S.narrativaText}>Relatorio preparado pela AlugEasy com base nos dados financeiros e operacionais registrados no sistema para a competencia indicada.</Text></View>
        <PageFooter dataGeracao={dataGeracao} pageNum={5} />
      </Page>
    </Document>
  )
}

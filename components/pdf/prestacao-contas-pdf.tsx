import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

// ── Paleta ───────────────────────────────────────────────────────────────────
const AZUL        = '#193660'
const AZUL_CLARO  = '#dbeafe'
const AZUL_XCLARO = '#eff6ff'
const BRANCO      = '#FFFFFF'
const CINZA_BG    = '#f8fafc'
const CINZA_BORDA = '#e2e8f0'
const CINZA_MED   = '#94a3b8'
const CINZA_TEXTO = '#64748b'
const PRETO       = '#0f172a'
const VERDE       = '#16a34a'
const VERDE_BG    = '#f0fdf4'
const VERDE_BORDA = '#bbf7d0'
const VERMELHO    = '#dc2626'
const VERMELHO_BG = '#fef2f2'
const AMBAR       = '#b45309'
const AMBAR_BG    = '#fffbeb'
const AMBAR_BORDA = '#fde68a'
const LARANJA     = '#ea580c'

// ── Formatação BRL segura (sem toLocaleString — funciona em qualquer Node) ────
function formatBRL(valor: number): string {
  const neg = valor < 0
  const abs = Math.abs(valor)
  const inteiro = Math.floor(abs)
  const centavos = Math.round((abs - inteiro) * 100)
  const inteiroStr = inteiro.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${neg ? '−' : ''}R$ ${inteiroStr},${centavos.toString().padStart(2, '0')}`
}

function pct(v: number) {
  const s = Math.abs(v).toFixed(1).replace('.', ',')
  return `${v < 0 ? '−' : ''}${s}%`
}

function fmtDate(s: string) {
  if (!s) return '—'
  const parts = s.split('-')
  if (parts.length !== 3) return s
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    paddingHorizontal: 36,
    paddingTop: 28,
    paddingBottom: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: BRANCO,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: AZUL,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 80, height: 40 },
  docTitle: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: AZUL, marginBottom: 2 },
  docSub: { fontSize: 9, color: CINZA_TEXTO },
  headerRight: { alignItems: 'flex-end' },
  badge: {
    backgroundColor: AZUL,
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 4,
  },
  badgeText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BRANCO },
  headerLabel: { fontSize: 7.5, color: CINZA_TEXTO },

  // InfoBar
  infoBar: {
    backgroundColor: CINZA_BG,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: CINZA_BORDA,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoItem: { flexDirection: 'column', flex: 1, marginRight: 6 },
  infoLabel: { fontSize: 6.5, color: CINZA_TEXTO, textTransform: 'uppercase', marginBottom: 2 },
  infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: PRETO },

  // Section title
  secTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: AZUL,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 7,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: AZUL_CLARO,
  },

  // KPI cards
  kpiRow: { flexDirection: 'row', gap: 7, marginBottom: 16 },
  kpiCard: { flex: 1, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  kpiAccent: { height: 4 },
  kpiBody: { padding: 9 },
  kpiLabel: { fontSize: 6.5, color: CINZA_TEXTO, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.3 },
  kpiValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  kpiSub: { fontSize: 7, color: CINZA_TEXTO },
  kpiBar: { height: 4, borderRadius: 2, marginTop: 5, overflow: 'hidden' },
  kpiBarFill: { height: 4, borderRadius: 2 },

  // Indicadores grid 2x2
  indicGrid: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  indicCard: {
    flex: 1,
    backgroundColor: CINZA_BG,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: CINZA_BORDA,
    padding: 10,
  },
  indicLabel: { fontSize: 7, color: CINZA_TEXTO, textTransform: 'uppercase', marginBottom: 4 },
  indicValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: AZUL, marginBottom: 2 },
  indicSub: { fontSize: 7, color: CINZA_TEXTO },

  // Repasse box
  repasseBox: {
    borderWidth: 1,
    borderColor: AMBAR_BORDA,
    backgroundColor: AMBAR_BG,
    borderRadius: 9,
    overflow: 'hidden',
    marginBottom: 16,
  },
  repasseHead: { backgroundColor: AMBAR, paddingHorizontal: 14, paddingVertical: 7 },
  repasseHeadText: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: BRANCO },
  repasseBody: { paddingHorizontal: 14, paddingVertical: 11 },
  repasseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  repasseLabel: { fontSize: 8.5, color: CINZA_TEXTO, flex: 3 },
  repasseValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: PRETO, flex: 1.5, textAlign: 'right' },
  repasseSep: { height: 1, backgroundColor: AMBAR_BORDA, marginVertical: 7 },
  repasseFinal: {
    backgroundColor: AZUL,
    borderRadius: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  repasseFinalLabel: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: BRANCO },
  repasseFinalValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: BRANCO },

  // Gráfico de barras
  chartWrapper: { marginBottom: 16 },
  chartLegend: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  chartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chartLegendDot: { width: 7, height: 7, borderRadius: 3 },
  chartLegendText: { fontSize: 7, color: CINZA_TEXTO },
  chartBarsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  chartColWrapper: { alignItems: 'center', flex: 1 },
  chartBarGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  chartBar: { width: 13, borderRadius: 2 },
  chartColLabel: { fontSize: 6, color: CINZA_TEXTO, marginTop: 4, textAlign: 'center' },
  chartEmpty: { fontSize: 8, color: CINZA_MED, textAlign: 'center', paddingVertical: 20 },

  // Tabela padrão
  table: { borderRadius: 7, borderWidth: 1, borderColor: CINZA_BORDA, overflow: 'hidden', marginBottom: 14 },
  tableHead: { flexDirection: 'row', backgroundColor: AZUL, paddingVertical: 6, paddingHorizontal: 11 },
  tableHeadCell: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: BRANCO },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: CINZA_BORDA },
  tableRowAlt: { backgroundColor: CINZA_BG },
  tableCell: { fontSize: 8.5, color: PRETO },
  tableCellR: { fontSize: 8.5, color: PRETO, textAlign: 'right' },
  tableTotalRow: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 11, backgroundColor: AZUL_XCLARO },
  tableTotalLabel: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: AZUL },
  tableTotalValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: AZUL, textAlign: 'right' },
  tableNote: { fontSize: 7.5, color: CINZA_TEXTO, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: CINZA_BG },

  // Barra horizontal de plataforma
  platRow: { marginBottom: 8 },
  platLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  platName: { fontSize: 8.5, color: PRETO },
  platPct: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: AZUL },
  platBarBg: { height: 8, backgroundColor: CINZA_BORDA, borderRadius: 4, overflow: 'hidden' },
  platBarFill: { height: 8, borderRadius: 4 },

  // Disclaimer
  disclaimer: {
    backgroundColor: CINZA_BG,
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: AZUL,
  },
  disclaimerText: { fontSize: 7, color: CINZA_TEXTO, lineHeight: 1.5 },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: CINZA_BORDA,
    paddingTop: 9,
  },
  footerBrand: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: AZUL },
  footerSub: { fontSize: 6.5, color: CINZA_TEXTO, marginTop: 1 },
  footerPage: { fontSize: 7.5, color: CINZA_TEXTO },

  // Vazio
  empty: { padding: 10, fontSize: 8, color: CINZA_TEXTO, textAlign: 'center' },
})

// ── Props ────────────────────────────────────────────────────────────────────
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

// ── Sub-componentes ───────────────────────────────────────────────────────────

function PageHeader({
  logoBase64, empreendimento, apartamento, mesNome, ano, pageNum, totalPages,
}: {
  logoBase64: string; empreendimento: string; apartamento: string
  mesNome: string; ano: string; pageNum: number; totalPages: number
}) {
  return (
    <View style={S.header}>
      <View style={S.headerLeft}>
        <Image src={logoBase64} style={S.logo} />
        <View>
          <Text style={S.docTitle}>Prestação de Contas</Text>
          <Text style={S.docSub}>Relatório Mensal — {empreendimento}, Apt {apartamento}</Text>
        </View>
      </View>
      <View style={S.headerRight}>
        <View style={S.badge}>
          <Text style={S.badgeText}>{mesNome} / {ano}</Text>
        </View>
        <Text style={S.headerLabel}>Página {pageNum} de {totalPages}</Text>
      </View>
    </View>
  )
}

function PageFooter({ dataGeracao }: { dataGeracao: string }) {
  return (
    <View style={S.footer}>
      <View>
        <Text style={S.footerBrand}>AlugEasy — Facilitadora de Aluguel por Temporada</Text>
        <Text style={S.footerSub}>Gerado em {dataGeracao} · Documento confidencial</Text>
      </View>
      <Text style={S.footerPage}>alugueasy.com.br</Text>
    </View>
  )
}

// Gráfico de barras históricas com retângulos (sem SVG externo)
const CHART_H = 55
function BarChart({ meses }: { meses: Array<{ label: string; faturamento: number; lucro: number }> }) {
  const hasData = meses.some(m => m.faturamento > 0 || m.lucro !== 0)
  if (!hasData) {
    return (
      <View style={S.chartWrapper}>
        <Text style={S.chartEmpty}>Sem dados históricos disponíveis para o período</Text>
      </View>
    )
  }

  const maxVal = Math.max(...meses.map(m => Math.max(m.faturamento, Math.abs(m.lucro))), 1)

  return (
    <View style={S.chartWrapper}>
      <View style={S.chartLegend}>
        <View style={S.chartLegendItem}>
          <View style={[S.chartLegendDot, { backgroundColor: AZUL }]} />
          <Text style={S.chartLegendText}>Faturamento</Text>
        </View>
        <View style={S.chartLegendItem}>
          <View style={[S.chartLegendDot, { backgroundColor: VERDE }]} />
          <Text style={S.chartLegendText}>Lucro</Text>
        </View>
        <View style={S.chartLegendItem}>
          <View style={[S.chartLegendDot, { backgroundColor: VERMELHO }]} />
          <Text style={S.chartLegendText}>Prejuízo</Text>
        </View>
      </View>

      {/* Barras */}
      <View style={[S.chartBarsRow, { height: CHART_H + 18 }]}>
        {meses.map((m, i) => {
          const fatH = Math.max(2, (m.faturamento / maxVal) * CHART_H)
          const lucroH = Math.max(2, (Math.abs(m.lucro) / maxVal) * CHART_H)
          const lucroNeg = m.lucro < 0
          return (
            <View key={i} style={S.chartColWrapper}>
              <View style={[S.chartBarGroup, { height: CHART_H, alignItems: 'flex-end' }]}>
                <View style={[S.chartBar, { height: fatH, backgroundColor: AZUL }]} />
                <View style={[S.chartBar, { height: lucroH, backgroundColor: lucroNeg ? VERMELHO : VERDE }]} />
              </View>
              <Text style={S.chartColLabel}>{m.label}</Text>
            </View>
          )
        })}
      </View>

      {/* Valores do mês atual */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 }}>
        <Text style={{ fontSize: 6.5, color: CINZA_TEXTO }}>
          Mês atual: Fat. {formatBRL(meses[meses.length - 1]?.faturamento ?? 0)} · Lucro {formatBRL(meses[meses.length - 1]?.lucro ?? 0)}
        </Text>
      </View>
    </View>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function PrestacaoContasPdf({
  logoBase64,
  empreendimento,
  apartamento,
  mesNome,
  ano,
  nomeProprietario,
  modeloContrato,
  taxaRepasse,
  tipoRepasse,
  receitaTotal,
  custosTotal,
  lucroLiquido,
  valorRepasse,
  valorLiquidoProprietario,
  receitaAdm,
  receitaSub,
  custosAdm,
  custosSub,
  custosDetalhados,
  numReservas,
  totalDiarias,
  valorMedioDiaria,
  mediaDiariasPorReserva,
  usandoDiarias,
  reservas,
  historicoMeses,
  porPlataforma,
}: PrestacaoContasPdfProps) {
  const lucroNeg = lucroLiquido < 0
  const margemPct = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0
  const custosPctNum = receitaTotal > 0 ? (custosTotal / receitaTotal) * 100 : 0
  const modeloLabel = modeloContrato === 'sublocacao' ? 'Sublocação' : 'Administração'
  const repasseBaseLabel = tipoRepasse === 'faturamento' ? 'faturamento bruto' : 'lucro líquido'
  const hasAdm = receitaAdm > 0 || custosAdm > 0
  const hasSub = receitaSub > 0 || custosSub > 0

  // Limitar reservas exibidas a 20
  const RESERVAS_LIMIT = 20
  const reservasExibidas = reservas.slice(0, RESERVAS_LIMIT)
  const reservasTruncadas = reservas.length > RESERVAS_LIMIT

  const dataGeracao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <Document>

      {/* ══════════════════════════════════════════════════════════════════════
          PÁGINA 1 — RESUMO EXECUTIVO
      ══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={S.page}>
        <PageHeader
          logoBase64={logoBase64}
          empreendimento={empreendimento}
          apartamento={apartamento}
          mesNome={mesNome}
          ano={ano}
          pageNum={1}
          totalPages={2}
        />

        {/* InfoBar */}
        <View style={S.infoBar}>
          <View style={S.infoItem}>
            <Text style={S.infoLabel}>Proprietário</Text>
            <Text style={S.infoValue}>{nomeProprietario || 'Não configurado'}</Text>
          </View>
          <View style={S.infoItem}>
            <Text style={S.infoLabel}>Empreendimento</Text>
            <Text style={S.infoValue}>{empreendimento}</Text>
          </View>
          <View style={S.infoItem}>
            <Text style={S.infoLabel}>Unidade</Text>
            <Text style={S.infoValue}>Apt {apartamento}</Text>
          </View>
          <View style={S.infoItem}>
            <Text style={S.infoLabel}>Contrato</Text>
            <Text style={S.infoValue}>{modeloLabel}</Text>
          </View>
          <View style={[S.infoItem, { marginRight: 0 }]}>
            <Text style={S.infoLabel}>Competência</Text>
            <Text style={S.infoValue}>{mesNome}/{ano}</Text>
          </View>
        </View>

        {/* KPI Cards */}
        <Text style={S.secTitle}>Resumo Financeiro</Text>
        <View style={S.kpiRow}>
          {/* Receita */}
          <View style={[S.kpiCard, { borderColor: '#bfdbfe' }]}>
            <View style={[S.kpiAccent, { backgroundColor: AZUL }]} />
            <View style={[S.kpiBody, { backgroundColor: AZUL_XCLARO }]}>
              <Text style={S.kpiLabel}>Receita Bruta</Text>
              <Text style={[S.kpiValue, { color: AZUL }]}>{formatBRL(receitaTotal)}</Text>
              <Text style={S.kpiSub}>Faturamento do período</Text>
            </View>
          </View>

          {/* Custos */}
          <View style={[S.kpiCard, { borderColor: '#fecaca' }]}>
            <View style={[S.kpiAccent, { backgroundColor: VERMELHO }]} />
            <View style={[S.kpiBody, { backgroundColor: VERMELHO_BG }]}>
              <Text style={S.kpiLabel}>Custos Totais</Text>
              <Text style={[S.kpiValue, { color: VERMELHO }]}>{formatBRL(custosTotal)}</Text>
              <Text style={S.kpiSub}>{pct(Math.min(100, custosPctNum))} da receita</Text>
              <View style={[S.kpiBar, { backgroundColor: '#fecaca' }]}>
                <View style={[S.kpiBarFill, { backgroundColor: VERMELHO, width: `${Math.min(100, Math.max(0, custosPctNum))}%` }]} />
              </View>
            </View>
          </View>

          {/* Lucro */}
          <View style={[S.kpiCard, { borderColor: lucroNeg ? '#fecaca' : VERDE_BORDA }]}>
            <View style={[S.kpiAccent, { backgroundColor: lucroNeg ? VERMELHO : VERDE }]} />
            <View style={[S.kpiBody, { backgroundColor: lucroNeg ? VERMELHO_BG : VERDE_BG }]}>
              <Text style={S.kpiLabel}>Lucro Líquido</Text>
              <Text style={[S.kpiValue, { color: lucroNeg ? VERMELHO : VERDE }]}>
                {formatBRL(lucroLiquido)}
              </Text>
              <Text style={S.kpiSub}>Margem: {pct(margemPct)}</Text>
              <View style={[S.kpiBar, { backgroundColor: lucroNeg ? '#fecaca' : VERDE_BORDA }]}>
                <View style={[S.kpiBarFill, { backgroundColor: lucroNeg ? VERMELHO : VERDE, width: `${Math.max(0, Math.min(100, Math.abs(margemPct)))}%` }]} />
              </View>
            </View>
          </View>

          {/* Ao proprietário */}
          <View style={[S.kpiCard, { borderColor: AMBAR_BORDA }]}>
            <View style={[S.kpiAccent, { backgroundColor: AMBAR }]} />
            <View style={[S.kpiBody, { backgroundColor: AMBAR_BG }]}>
              <Text style={S.kpiLabel}>Ao Proprietário</Text>
              <Text style={[S.kpiValue, { color: AMBAR }]}>{formatBRL(valorLiquidoProprietario)}</Text>
              <Text style={S.kpiSub}>Após taxa de {pct(taxaRepasse)}</Text>
            </View>
          </View>
        </View>

        {/* Indicadores Operacionais */}
        <Text style={S.secTitle}>Indicadores Operacionais</Text>
        <View style={S.indicGrid}>
          <View style={S.indicCard}>
            <Text style={S.indicLabel}>Reservas confirmadas</Text>
            <Text style={S.indicValue}>{numReservas}</Text>
            <Text style={S.indicSub}>hospedagens no período</Text>
          </View>
          <View style={S.indicCard}>
            <Text style={S.indicLabel}>Total de diárias</Text>
            <Text style={S.indicValue}>{totalDiarias}</Text>
            <Text style={S.indicSub}>noites ocupadas</Text>
          </View>
          <View style={S.indicCard}>
            <Text style={S.indicLabel}>Ticket médio / diária</Text>
            <Text style={[S.indicValue, { fontSize: 11 }]}>{formatBRL(valorMedioDiaria)}</Text>
            <Text style={S.indicSub}>valor líquido médio</Text>
          </View>
          <View style={S.indicCard}>
            <Text style={S.indicLabel}>Diárias / reserva</Text>
            <Text style={S.indicValue}>{mediaDiariasPorReserva.toFixed(1).replace('.', ',')}</Text>
            <Text style={S.indicSub}>média de noites por hóspede</Text>
          </View>
        </View>

        {/* Gráfico Histórico */}
        <Text style={S.secTitle}>Evolução dos Últimos 6 Meses</Text>
        <BarChart meses={historicoMeses} />

        {/* Demonstrativo de Repasse */}
        <Text style={S.secTitle}>Demonstrativo de Repasse</Text>
        <View style={S.repasseBox}>
          <View style={S.repasseHead}>
            <Text style={S.repasseHeadText}>Cálculo do Valor a Receber pelo Proprietário</Text>
          </View>
          <View style={S.repasseBody}>
            <View style={S.repasseRow}>
              <Text style={S.repasseLabel}>Receita bruta do período:</Text>
              <Text style={S.repasseValue}>{formatBRL(receitaTotal)}</Text>
            </View>
            <View style={S.repasseRow}>
              <Text style={S.repasseLabel}>(−) Custos operacionais totais:</Text>
              <Text style={[S.repasseValue, { color: VERMELHO }]}>− {formatBRL(custosTotal)}</Text>
            </View>
            <View style={S.repasseSep} />
            <View style={S.repasseRow}>
              <Text style={[S.repasseLabel, { fontFamily: 'Helvetica-Bold', color: PRETO }]}>(=) Lucro líquido:</Text>
              <Text style={[S.repasseValue, { color: lucroNeg ? VERMELHO : VERDE, fontSize: 10 }]}>
                {formatBRL(lucroLiquido)}
              </Text>
            </View>
            <View style={S.repasseRow}>
              <Text style={S.repasseLabel}>(−) Taxa AlugEasy — {pct(taxaRepasse)} s/ {repasseBaseLabel}:</Text>
              <Text style={[S.repasseValue, { color: AMBAR }]}>− {formatBRL(valorRepasse)}</Text>
            </View>
            <View style={S.repasseFinal}>
              <Text style={S.repasseFinalLabel}>VALOR LÍQUIDO AO PROPRIETÁRIO</Text>
              <Text style={S.repasseFinalValue}>{formatBRL(valorLiquidoProprietario)}</Text>
            </View>
          </View>
        </View>

        <PageFooter dataGeracao={dataGeracao} />
      </Page>

      {/* ══════════════════════════════════════════════════════════════════════
          PÁGINA 2 — DETALHAMENTO COMPLETO
      ══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={S.page}>
        <PageHeader
          logoBase64={logoBase64}
          empreendimento={empreendimento}
          apartamento={apartamento}
          mesNome={mesNome}
          ano={ano}
          pageNum={2}
          totalPages={2}
        />

        {/* ADM vs SUB */}
        {(hasAdm || hasSub) && (
          <View>
            <Text style={S.secTitle}>Faturamento por Tipo de Gestão</Text>
            <View style={S.table}>
              <View style={S.tableHead}>
                <Text style={[S.tableHeadCell, { flex: 2 }]}>Tipo</Text>
                <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>Receita</Text>
                <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>Custos</Text>
                <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>Lucro</Text>
                <Text style={[S.tableHeadCell, { flex: 1.5, textAlign: 'right' }]}>Margem</Text>
              </View>
              {hasAdm && (
                <View style={S.tableRow}>
                  <Text style={[S.tableCell, { flex: 2 }]}>Administração</Text>
                  <Text style={[S.tableCellR, { flex: 2 }]}>{formatBRL(receitaAdm)}</Text>
                  <Text style={[S.tableCellR, { flex: 2, color: VERMELHO }]}>{formatBRL(custosAdm)}</Text>
                  <Text style={[S.tableCellR, { flex: 2, color: receitaAdm - custosAdm < 0 ? VERMELHO : VERDE }]}>
                    {formatBRL(receitaAdm - custosAdm)}
                  </Text>
                  <Text style={[S.tableCellR, { flex: 1.5 }]}>
                    {receitaAdm > 0 ? pct(((receitaAdm - custosAdm) / receitaAdm) * 100) : '—'}
                  </Text>
                </View>
              )}
              {hasSub && (
                <View style={[S.tableRow, S.tableRowAlt]}>
                  <Text style={[S.tableCell, { flex: 2 }]}>Sublocação</Text>
                  <Text style={[S.tableCellR, { flex: 2 }]}>{formatBRL(receitaSub)}</Text>
                  <Text style={[S.tableCellR, { flex: 2, color: VERMELHO }]}>{formatBRL(custosSub)}</Text>
                  <Text style={[S.tableCellR, { flex: 2, color: receitaSub - custosSub < 0 ? VERMELHO : VERDE }]}>
                    {formatBRL(receitaSub - custosSub)}
                  </Text>
                  <Text style={[S.tableCellR, { flex: 1.5 }]}>
                    {receitaSub > 0 ? pct(((receitaSub - custosSub) / receitaSub) * 100) : '—'}
                  </Text>
                </View>
              )}
              <View style={S.tableTotalRow}>
                <Text style={[S.tableTotalLabel, { flex: 2 }]}>Total</Text>
                <Text style={[S.tableTotalValue, { flex: 2 }]}>{formatBRL(receitaTotal)}</Text>
                <Text style={[S.tableTotalValue, { flex: 2 }]}>{formatBRL(custosTotal)}</Text>
                <Text style={[S.tableTotalValue, { flex: 2, color: lucroNeg ? VERMELHO : VERDE }]}>
                  {formatBRL(lucroLiquido)}
                </Text>
                <Text style={[S.tableTotalValue, { flex: 1.5 }]}>{pct(margemPct)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Custos Detalhados */}
        <Text style={S.secTitle}>Custos Detalhados</Text>
        <View style={S.table}>
          <View style={S.tableHead}>
            <Text style={[S.tableHeadCell, { flex: 3.5 }]}>Categoria</Text>
            <Text style={[S.tableHeadCell, { flex: 1 }]}>Gestão</Text>
            <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>Valor</Text>
            <Text style={[S.tableHeadCell, { flex: 1.5, textAlign: 'right' }]}>% Total</Text>
          </View>
          {custosDetalhados.length === 0 ? (
            <Text style={S.empty}>Nenhum custo registrado neste período</Text>
          ) : custosDetalhados.map((c, i) => (
            <View key={i} style={[S.tableRow, i % 2 !== 0 ? S.tableRowAlt : {}]}>
              <Text style={[S.tableCell, { flex: 3.5 }]}>{c.categoria}</Text>
              <Text style={[S.tableCell, { flex: 1 }]}>{c.tipoGestao}</Text>
              <Text style={[S.tableCellR, { flex: 2 }]}>{formatBRL(c.valor)}</Text>
              <Text style={[S.tableCellR, { flex: 1.5, color: CINZA_TEXTO }]}>
                {custosTotal > 0 ? pct((c.valor / custosTotal) * 100) : '0,0%'}
              </Text>
            </View>
          ))}
          {custosDetalhados.length > 0 && (
            <View style={S.tableTotalRow}>
              <Text style={[S.tableTotalLabel, { flex: 3.5 }]}>Total</Text>
              <Text style={[S.tableTotalLabel, { flex: 1 }]} />
              <Text style={[S.tableTotalValue, { flex: 2 }]}>{formatBRL(custosTotal)}</Text>
              <Text style={[S.tableTotalValue, { flex: 1.5 }]}>100%</Text>
            </View>
          )}
        </View>

        {/* Breakdown por Plataforma */}
        {porPlataforma.length > 0 && (
          <View>
            <Text style={S.secTitle}>Receita por Plataforma</Text>
            <View style={{ marginBottom: 14 }}>
              {porPlataforma.map((p, i) => (
                <View key={i} style={S.platRow}>
                  <View style={S.platLabel}>
                    <Text style={S.platName}>{p.plataforma}</Text>
                    <Text style={S.platPct}>{formatBRL(p.valor)} · {pct(p.percentual)}</Text>
                  </View>
                  <View style={S.platBarBg}>
                    <View style={[
                      S.platBarFill,
                      {
                        width: `${Math.min(100, Math.max(0, p.percentual))}%`,
                        backgroundColor: i === 0 ? AZUL : i === 1 ? LARANJA : CINZA_MED,
                      },
                    ]} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Reservas do período */}
        <Text style={S.secTitle}>Reservas do Período</Text>
        <View style={[S.table]} wrap>
          <View style={S.tableHead}>
            <Text style={[S.tableHeadCell, { flex: 1.3 }]}>Check-in</Text>
            <Text style={[S.tableHeadCell, { flex: 1.3 }]}>Check-out</Text>
            <Text style={[S.tableHeadCell, { flex: 2.4 }]}>Hóspede</Text>
            <Text style={[S.tableHeadCell, { flex: 1.8 }]}>Plataforma</Text>
            <Text style={[S.tableHeadCell, { flex: 0.8, textAlign: 'right' }]}>Nts</Text>
            <Text style={[S.tableHeadCell, { flex: 1.9, textAlign: 'right' }]}>Valor Líq.</Text>
          </View>
          {reservasExibidas.length === 0 ? (
            <Text style={S.empty}>Nenhuma reserva confirmada neste período</Text>
          ) : reservasExibidas.map((r, i) => (
            <View key={i} style={[S.tableRow, i % 2 !== 0 ? S.tableRowAlt : {}]} minPresenceAhead={20}>
              <Text style={[S.tableCell, { flex: 1.3 }]}>{fmtDate(r.checkin)}</Text>
              <Text style={[S.tableCell, { flex: 1.3 }]}>{fmtDate(r.checkout)}</Text>
              <Text style={[S.tableCell, { flex: 2.4, color: CINZA_TEXTO }]}>{r.nome_hospede ?? '—'}</Text>
              <Text style={[S.tableCell, { flex: 1.8 }]}>{r.plataforma ?? '—'}</Text>
              <Text style={[S.tableCellR, { flex: 0.8 }]}>{r.noites}</Text>
              <Text style={[S.tableCellR, { flex: 1.9, color: VERDE }]}>{formatBRL(r.valor_liquido)}</Text>
            </View>
          ))}
          {reservasExibidas.length > 0 && (
            <View style={S.tableTotalRow}>
              <Text style={[S.tableTotalLabel, { flex: 1.3 }]} />
              <Text style={[S.tableTotalLabel, { flex: 1.3 }]} />
              <Text style={[S.tableTotalLabel, { flex: 2.4 }]}>{numReservas} reserva(s)</Text>
              <Text style={[S.tableTotalLabel, { flex: 1.8 }]} />
              <Text style={[S.tableTotalValue, { flex: 0.8 }]}>{totalDiarias}</Text>
              <Text style={[S.tableTotalValue, { flex: 1.9 }]}>
                {formatBRL(reservasExibidas.reduce((s, r) => s + r.valor_liquido, 0))}
              </Text>
            </View>
          )}
        </View>
        {reservasTruncadas && (
          <Text style={S.tableNote}>
            Exibindo {RESERVAS_LIMIT} de {reservas.length} reservas — {mesNome}/{ano}
          </Text>
        )}

        {/* Disclaimer */}
        <View style={S.disclaimer}>
          <Text style={S.disclaimerText}>
            Este documento é gerado automaticamente pelo sistema AlugEasy com base nos dados financeiros do período {mesNome}/{ano}.
            Os valores refletem as receitas e custos processados até a data de emissão.
            Fonte de faturamento: {usandoDiarias ? 'diárias conferidas internamente' : 'reservas Amenitiz (fallback)'}.
            Para esclarecimentos, entre em contato com a equipe AlugEasy.
          </Text>
        </View>

        <PageFooter dataGeracao={dataGeracao} />
      </Page>

    </Document>
  )
}

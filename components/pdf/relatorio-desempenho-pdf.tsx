import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

const C = {
  primary: '#1e3a5f',
  secondary: '#2563eb',
  success: '#16a34a',
  danger: '#dc2626',
  successBg: '#f0fdf4',
  dangerBg: '#fef2f2',
  successBorder: '#bbf7d0',
  dangerBorder: '#fecaca',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray600: '#4b5563',
  gray800: '#1f2937',
  white: '#ffffff',
  azulClaro: '#dbeafe',
  azulXClaro: '#eff6ff',
}

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

const S = StyleSheet.create({
  page: {
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 32,
    fontSize: 8,
    fontFamily: 'Helvetica',
    backgroundColor: C.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.primary,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 80, height: 40 },
  docTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.primary, marginBottom: 2 },
  docSub: { fontSize: 8, color: C.gray600 },
  headerRight: { alignItems: 'flex-end' },
  badge: { backgroundColor: C.primary, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 3 },
  badgeText: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.white },
  headerDate: { fontSize: 7, color: C.gray600 },

  secTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.azulClaro,
    marginTop: 12,
  },

  kpiRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  kpiCard: { flex: 1, borderRadius: 6, borderWidth: 1, overflow: 'hidden' },
  kpiAccent: { height: 3 },
  kpiBody: { padding: 8 },
  kpiLabel: { fontSize: 6, color: C.gray600, textTransform: 'uppercase', marginBottom: 3, letterSpacing: 0.3 },
  kpiValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  kpiSub: { fontSize: 6.5, color: C.gray600 },

  table: { borderRadius: 5, borderWidth: 1, borderColor: C.gray200, overflow: 'hidden', marginBottom: 10 },
  tableHead: { flexDirection: 'row', backgroundColor: C.primary, paddingVertical: 5, paddingHorizontal: 8 },
  tableHeadCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.white },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.gray200 },
  tableRowAlt: { backgroundColor: C.gray100 },
  tableRowSuccess: { backgroundColor: C.successBg },
  tableRowDanger: { backgroundColor: C.dangerBg },
  tableCell: { fontSize: 7.5, color: C.gray800 },
  tableCellR: { fontSize: 7.5, color: C.gray800, textAlign: 'right' },
  tableTotalRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, backgroundColor: C.azulXClaro },
  tableTotalLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.primary },
  tableTotalValue: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.primary, textAlign: 'right' },

  highlightBox: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  highlightCol: { flex: 1, borderRadius: 5, borderWidth: 1, overflow: 'hidden' },
  highlightHead: { paddingHorizontal: 8, paddingVertical: 5 },
  highlightHeadText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.white },
  highlightBody: { padding: 8 },
  highlightRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  highlightLabel: { fontSize: 7.5, color: C.gray800, flex: 3 },
  highlightValue: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', flex: 1.5, textAlign: 'right' },

  empHeader: { marginTop: 10, marginBottom: 6, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: C.azulClaro },
  empName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.primary, marginBottom: 3 },
  empKpiRow: { flexDirection: 'row', gap: 5 },
  empKpiItem: { flex: 1, backgroundColor: C.gray100, borderRadius: 4, padding: 6 },
  empKpiLabel: { fontSize: 6, color: C.gray600, textTransform: 'uppercase', marginBottom: 2 },
  empKpiValue: { fontSize: 9, fontFamily: 'Helvetica-Bold' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.gray300,
    paddingTop: 7,
    marginTop: 10,
  },
  footerBrand: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.primary },
  footerSub: { fontSize: 6, color: C.gray600, marginTop: 1 },
  footerPage: { fontSize: 7, color: C.gray600 },
})

export interface ApartamentoDesempenho {
  id: string
  numero: string
  empreendimentoId: string
  empreendimentoNome: string
  faturamento: number
  custos: number
  lucroLiquido: number
  margemLucro: number
  status: 'lucro' | 'prejuizo'
}

export interface EmpreendimentoDesempenho {
  id: string
  nome: string
  totalFaturamento: number
  totalCustos: number
  totalLucro: number
  margemEmpreendimento: number
  aptsLucro: number
  aptsPrejuizo: number
  status: 'lucro' | 'prejuizo'
  apartamentos: ApartamentoDesempenho[]
}

export interface RelatorioDesempenhoPdfProps {
  logoBase64: string
  mesNome: string
  ano: number
  dataGeracao: string
  empreendimentos: EmpreendimentoDesempenho[]
  totalFaturamento: number
  totalCustos: number
  totalLucro: number
  margemMedia: number
}

function PageHeader({ logoBase64, mesNome, ano, page, total }: {
  logoBase64: string; mesNome: string; ano: number; page: number; total: number
}) {
  return (
    <View style={S.header}>
      <View style={S.headerLeft}>
        <Image src={logoBase64} style={S.logo} />
        <View>
          <Text style={S.docTitle}>Relatório de Desempenho de Empreendimentos</Text>
          <Text style={S.docSub}>Referência: {mesNome} / {ano}</Text>
        </View>
      </View>
      <View style={S.headerRight}>
        <View style={S.badge}>
          <Text style={S.badgeText}>{mesNome} / {ano}</Text>
        </View>
        <Text style={S.headerDate}>Página {page} de {total}</Text>
      </View>
    </View>
  )
}

function PageFooter({ dataGeracao, page, total }: { dataGeracao: string; page: number; total: number }) {
  return (
    <View style={S.footer}>
      <View>
        <Text style={S.footerBrand}>AlugEasy — Relatório Confidencial</Text>
        <Text style={S.footerSub}>Gerado em {dataGeracao}</Text>
      </View>
      <Text style={S.footerPage}>Página {page} de {total}</Text>
    </View>
  )
}

export function RelatorioDesempenhoPdf({
  logoBase64,
  mesNome,
  ano,
  dataGeracao,
  empreendimentos,
  totalFaturamento,
  totalCustos,
  totalLucro,
  margemMedia,
}: RelatorioDesempenhoPdfProps) {
  const totalPages = 2

  const rankingOrdenado = [...empreendimentos].sort((a, b) => b.totalLucro - a.totalLucro)

  const todosApts = empreendimentos.flatMap((e) => e.apartamentos)
  const top3 = [...todosApts].sort((a, b) => b.lucroLiquido - a.lucroLiquido).slice(0, 3)
  const prejuizo = todosApts.filter((a) => a.lucroLiquido < 0).sort((a, b) => a.lucroLiquido - b.lucroLiquido)

  return (
    <Document>
      {/* ── PÁGINA 1 — RESUMO EXECUTIVO ── */}
      <Page size="A4" orientation="landscape" style={S.page}>
        <PageHeader logoBase64={logoBase64} mesNome={mesNome} ano={ano} page={1} total={totalPages} />

        {/* KPIs */}
        <Text style={[S.secTitle, { marginTop: 0 }]}>KPIs Gerais do Mês</Text>
        <View style={S.kpiRow}>
          <View style={[S.kpiCard, { borderColor: C.azulClaro }]}>
            <View style={[S.kpiAccent, { backgroundColor: C.secondary }]} />
            <View style={[S.kpiBody, { backgroundColor: C.azulXClaro }]}>
              <Text style={S.kpiLabel}>Faturamento Total</Text>
              <Text style={[S.kpiValue, { color: C.secondary }]}>{formatBRL(totalFaturamento)}</Text>
              <Text style={S.kpiSub}>Receita bruta do período</Text>
            </View>
          </View>
          <View style={[S.kpiCard, { borderColor: C.dangerBorder }]}>
            <View style={[S.kpiAccent, { backgroundColor: C.danger }]} />
            <View style={[S.kpiBody, { backgroundColor: C.dangerBg }]}>
              <Text style={S.kpiLabel}>Custos Totais</Text>
              <Text style={[S.kpiValue, { color: C.danger }]}>{formatBRL(totalCustos)}</Text>
              <Text style={S.kpiSub}>Despesas operacionais</Text>
            </View>
          </View>
          <View style={[S.kpiCard, { borderColor: totalLucro >= 0 ? C.successBorder : C.dangerBorder }]}>
            <View style={[S.kpiAccent, { backgroundColor: totalLucro >= 0 ? C.success : C.danger }]} />
            <View style={[S.kpiBody, { backgroundColor: totalLucro >= 0 ? C.successBg : C.dangerBg }]}>
              <Text style={S.kpiLabel}>Lucro Líquido Total</Text>
              <Text style={[S.kpiValue, { color: totalLucro >= 0 ? C.success : C.danger }]}>{formatBRL(totalLucro)}</Text>
              <Text style={S.kpiSub}>Faturamento − Custos</Text>
            </View>
          </View>
          <View style={[S.kpiCard, { borderColor: C.gray200 }]}>
            <View style={[S.kpiAccent, { backgroundColor: margemMedia >= 0 ? C.success : C.danger }]} />
            <View style={[S.kpiBody, { backgroundColor: C.gray100 }]}>
              <Text style={S.kpiLabel}>Margem Média Geral</Text>
              <Text style={[S.kpiValue, { color: margemMedia >= 0 ? C.success : C.danger }]}>{pct(margemMedia)}</Text>
              <Text style={S.kpiSub}>Média ponderada</Text>
            </View>
          </View>
        </View>

        {/* Ranking */}
        <Text style={S.secTitle}>Ranking de Empreendimentos</Text>
        <View style={S.table}>
          <View style={S.tableHead}>
            <Text style={[S.tableHeadCell, { width: 20 }]}>#</Text>
            <Text style={[S.tableHeadCell, { flex: 3 }]}>Empreendimento</Text>
            <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>Faturamento</Text>
            <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>Custos</Text>
            <Text style={[S.tableHeadCell, { flex: 2, textAlign: 'right' }]}>Lucro Líquido</Text>
            <Text style={[S.tableHeadCell, { flex: 1.2, textAlign: 'right' }]}>Margem</Text>
            <Text style={[S.tableHeadCell, { flex: 1, textAlign: 'center' }]}>Lucro</Text>
            <Text style={[S.tableHeadCell, { flex: 1, textAlign: 'center' }]}>Prej.</Text>
            <Text style={[S.tableHeadCell, { flex: 1.5, textAlign: 'center' }]}>Status</Text>
          </View>
          {rankingOrdenado.map((emp, i) => {
            const isLucro = emp.totalLucro >= 0
            return (
              <View key={emp.id} style={[S.tableRow, isLucro ? S.tableRowSuccess : S.tableRowDanger]}>
                <Text style={[S.tableCell, { width: 20, fontFamily: 'Helvetica-Bold' }]}>{i + 1}</Text>
                <Text style={[S.tableCell, { flex: 3, fontFamily: 'Helvetica-Bold' }]}>{emp.nome}</Text>
                <Text style={[S.tableCellR, { flex: 2 }]}>{formatBRL(emp.totalFaturamento)}</Text>
                <Text style={[S.tableCellR, { flex: 2, color: C.danger }]}>{formatBRL(emp.totalCustos)}</Text>
                <Text style={[S.tableCellR, { flex: 2, color: isLucro ? C.success : C.danger, fontFamily: 'Helvetica-Bold' }]}>
                  {formatBRL(emp.totalLucro)}
                </Text>
                <Text style={[S.tableCellR, { flex: 1.2, color: isLucro ? C.success : C.danger }]}>{pct(emp.margemEmpreendimento)}</Text>
                <Text style={[S.tableCell, { flex: 1, textAlign: 'center', color: C.success }]}>{emp.aptsLucro}</Text>
                <Text style={[S.tableCell, { flex: 1, textAlign: 'center', color: emp.aptsPrejuizo > 0 ? C.danger : C.gray600 }]}>{emp.aptsPrejuizo}</Text>
                <Text style={[S.tableCell, { flex: 1.5, textAlign: 'center', color: isLucro ? C.success : C.danger, fontFamily: 'Helvetica-Bold' }]}>
                  {isLucro ? '✓ Lucro' : '✗ Prejuízo'}
                </Text>
              </View>
            )
          })}
        </View>

        {/* Destaques */}
        <Text style={S.secTitle}>Destaques do Período</Text>
        <View style={S.highlightBox}>
          {/* Top 3 */}
          <View style={[S.highlightCol, { borderColor: C.successBorder }]}>
            <View style={[S.highlightHead, { backgroundColor: C.success }]}>
              <Text style={S.highlightHeadText}>Melhores Desempenhos (Top 3)</Text>
            </View>
            <View style={S.highlightBody}>
              {top3.length === 0 ? (
                <Text style={{ fontSize: 7, color: C.gray600 }}>Sem dados no período</Text>
              ) : top3.map((apt, i) => (
                <View key={apt.id} style={[S.highlightRow, i < top3.length - 1 ? { borderBottomWidth: 1, borderBottomColor: C.successBorder, paddingBottom: 3, marginBottom: 3 } : {}]}>
                  <Text style={S.highlightLabel}>{apt.numero} — {apt.empreendimentoNome}</Text>
                  <Text style={[S.highlightValue, { color: C.success }]}>{formatBRL(apt.lucroLiquido)}</Text>
                </View>
              ))}
            </View>
          </View>
          {/* Prejuízo */}
          <View style={[S.highlightCol, { borderColor: C.dangerBorder }]}>
            <View style={[S.highlightHead, { backgroundColor: C.danger }]}>
              <Text style={S.highlightHeadText}>Atenção Necessária (Prejuízo)</Text>
            </View>
            <View style={S.highlightBody}>
              {prejuizo.length === 0 ? (
                <Text style={{ fontSize: 7, color: C.success }}>Nenhum imóvel em prejuízo!</Text>
              ) : prejuizo.map((apt, i) => (
                <View key={apt.id} style={[S.highlightRow, i < prejuizo.length - 1 ? { borderBottomWidth: 1, borderBottomColor: C.dangerBorder, paddingBottom: 3, marginBottom: 3 } : {}]}>
                  <Text style={S.highlightLabel}>{apt.numero} — {apt.empreendimentoNome}</Text>
                  <Text style={[S.highlightValue, { color: C.danger }]}>{formatBRL(apt.lucroLiquido)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <PageFooter dataGeracao={dataGeracao} page={1} total={totalPages} />
      </Page>

      {/* ── PÁGINA 2 — DETALHAMENTO POR EMPREENDIMENTO ── */}
      <Page size="A4" orientation="landscape" style={S.page}>
        <PageHeader logoBase64={logoBase64} mesNome={mesNome} ano={ano} page={2} total={totalPages} />

        <Text style={[S.secTitle, { marginTop: 0 }]}>Detalhamento por Empreendimento</Text>

        {empreendimentos.map((emp) => (
          <View key={emp.id} wrap={false}>
            {/* Cabeçalho do empreendimento */}
            <View style={S.empHeader}>
              <Text style={S.empName}>{emp.nome}</Text>
              <View style={S.empKpiRow}>
                <View style={S.empKpiItem}>
                  <Text style={S.empKpiLabel}>Faturamento</Text>
                  <Text style={[S.empKpiValue, { color: C.secondary }]}>{formatBRL(emp.totalFaturamento)}</Text>
                </View>
                <View style={S.empKpiItem}>
                  <Text style={S.empKpiLabel}>Custos</Text>
                  <Text style={[S.empKpiValue, { color: C.danger }]}>{formatBRL(emp.totalCustos)}</Text>
                </View>
                <View style={S.empKpiItem}>
                  <Text style={S.empKpiLabel}>Lucro</Text>
                  <Text style={[S.empKpiValue, { color: emp.totalLucro >= 0 ? C.success : C.danger }]}>{formatBRL(emp.totalLucro)}</Text>
                </View>
                <View style={S.empKpiItem}>
                  <Text style={S.empKpiLabel}>Margem</Text>
                  <Text style={[S.empKpiValue, { color: emp.margemEmpreendimento >= 0 ? C.success : C.danger }]}>{pct(emp.margemEmpreendimento)}</Text>
                </View>
                <View style={S.empKpiItem}>
                  <Text style={S.empKpiLabel}>Apts Lucro / Prej.</Text>
                  <Text style={[S.empKpiValue, { color: C.gray800 }]}>{emp.aptsLucro} / {emp.aptsPrejuizo}</Text>
                </View>
              </View>
            </View>

            {/* Tabela de apartamentos */}
            <View style={[S.table, { marginBottom: 6 }]}>
              <View style={S.tableHead}>
                <Text style={[S.tableHeadCell, { flex: 1.5 }]}>Unidade</Text>
                <Text style={[S.tableHeadCell, { flex: 1.5 }]}>Tipo Gestão</Text>
                <Text style={[S.tableHeadCell, { flex: 2.5, textAlign: 'right' }]}>Faturamento</Text>
                <Text style={[S.tableHeadCell, { flex: 2.5, textAlign: 'right' }]}>Custos</Text>
                <Text style={[S.tableHeadCell, { flex: 2.5, textAlign: 'right' }]}>Lucro Líquido</Text>
                <Text style={[S.tableHeadCell, { flex: 1.5, textAlign: 'right' }]}>Margem</Text>
                <Text style={[S.tableHeadCell, { flex: 1.5, textAlign: 'center' }]}>Status</Text>
              </View>
              {emp.apartamentos.map((apt, i) => {
                const isLucro = apt.lucroLiquido >= 0
                const semDados = apt.faturamento === 0 && apt.custos === 0
                return (
                  <View key={apt.id} style={[S.tableRow, semDados ? S.tableRowAlt : (isLucro ? S.tableRowSuccess : S.tableRowDanger)]}>
                    <Text style={[S.tableCell, { flex: 1.5, fontFamily: 'Helvetica-Bold' }]}>{apt.numero}</Text>
                    <Text style={[S.tableCell, { flex: 1.5, color: C.gray600 }]}>—</Text>
                    <Text style={[S.tableCellR, { flex: 2.5 }]}>{semDados ? 'Sem dados' : formatBRL(apt.faturamento)}</Text>
                    <Text style={[S.tableCellR, { flex: 2.5, color: semDados ? C.gray600 : C.danger }]}>{semDados ? '—' : formatBRL(apt.custos)}</Text>
                    <Text style={[S.tableCellR, { flex: 2.5, color: semDados ? C.gray600 : (isLucro ? C.success : C.danger), fontFamily: semDados ? 'Helvetica' : 'Helvetica-Bold' }]}>
                      {semDados ? '—' : formatBRL(apt.lucroLiquido)}
                    </Text>
                    <Text style={[S.tableCellR, { flex: 1.5, color: semDados ? C.gray600 : (isLucro ? C.success : C.danger) }]}>
                      {semDados ? '—' : pct(apt.margemLucro)}
                    </Text>
                    <Text style={[S.tableCell, { flex: 1.5, textAlign: 'center', color: semDados ? C.gray600 : (isLucro ? C.success : C.danger), fontFamily: 'Helvetica-Bold' }]}>
                      {semDados ? '—' : (isLucro ? '✓ Lucro' : '✗ Prej.')}
                    </Text>
                  </View>
                )
              })}
              <View style={S.tableTotalRow}>
                <Text style={[S.tableTotalLabel, { flex: 1.5 }]}>TOTAL</Text>
                <Text style={[S.tableTotalLabel, { flex: 1.5 }]} />
                <Text style={[S.tableTotalValue, { flex: 2.5 }]}>{formatBRL(emp.totalFaturamento)}</Text>
                <Text style={[S.tableTotalValue, { flex: 2.5, color: C.danger }]}>{formatBRL(emp.totalCustos)}</Text>
                <Text style={[S.tableTotalValue, { flex: 2.5, color: emp.totalLucro >= 0 ? C.success : C.danger }]}>{formatBRL(emp.totalLucro)}</Text>
                <Text style={[S.tableTotalValue, { flex: 1.5, color: emp.margemEmpreendimento >= 0 ? C.success : C.danger }]}>{pct(emp.margemEmpreendimento)}</Text>
                <Text style={[S.tableTotalLabel, { flex: 1.5, textAlign: 'center', color: emp.totalLucro >= 0 ? C.success : C.danger }]}>
                  {emp.totalLucro >= 0 ? '✓ Lucro' : '✗ Prej.'}
                </Text>
              </View>
            </View>
          </View>
        ))}

        <PageFooter dataGeracao={dataGeracao} page={2} total={totalPages} />
      </Page>
    </Document>
  )
}

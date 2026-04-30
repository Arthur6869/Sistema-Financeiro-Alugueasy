import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

// ── Paleta ─────────────────────────────────────────────────────────────────
const AZUL         = '#193660'
const AZUL_MEDIO   = '#234d8a'
const AZUL_CLARO   = '#e8f0fc'
const BRANCO       = '#FFFFFF'
const CINZA_BG     = '#f8fafc'
const CINZA_BORDA  = '#e2e8f0'
const CINZA_MEDIO  = '#cbd5e1'
const CINZA_TEXTO  = '#64748b'
const PRETO_TEXTO  = '#0f172a'
const VERDE        = '#15803d'
const VERDE_BG     = '#f0fdf4'
const VERMELHO     = '#dc2626'
const VERMELHO_BG  = '#fef2f2'
const AMBAR        = '#b45309'
const AMBAR_BG     = '#fffbeb'
const AMBAR_BORDA  = '#fde68a'

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 36,
    paddingVertical: 32,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: BRANCO,
  },

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: AZUL,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 72, height: 36 },
  headerTitles: { flexDirection: 'column' },
  docTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AZUL,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  docSubtitle: { fontSize: 10, color: CINZA_TEXTO },
  headerRight: { alignItems: 'flex-end' },
  headerRightLabel: { fontSize: 8, color: CINZA_TEXTO, marginBottom: 2 },
  headerRightValue: { fontSize: 11, fontWeight: 'bold', color: AZUL },
  competenciaBadge: {
    marginTop: 4,
    backgroundColor: AZUL_CLARO,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  competenciaText: { fontSize: 9, color: AZUL, fontWeight: 'bold' },
  competenciaLinha: {
    marginTop: 6,
    fontSize: 9,
    color: CINZA_TEXTO,
  },

  // ── Faixa de informações do imóvel ─────────────────────────────────────
  infoBar: {
    backgroundColor: CINZA_BG,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CINZA_BORDA,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  infoBarItem: { flexDirection: 'column' },
  infoBarLabel: { fontSize: 7, color: CINZA_TEXTO, textTransform: 'uppercase', marginBottom: 2 },
  infoBarValue: { fontSize: 10, color: PRETO_TEXTO, fontWeight: 'bold' },

  // ── Linha divisória ────────────────────────────────────────────────────
  divider: { height: 1, backgroundColor: CINZA_BORDA, marginVertical: 14 },

  // ── Section title ──────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: AZUL,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: AZUL_CLARO,
  },

  // ── KPI Cards (4 em linha) ─────────────────────────────────────────────
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  kpiAccent: { height: 3 },
  kpiBody: { padding: 10 },
  kpiLabel: { fontSize: 7, color: CINZA_TEXTO, textTransform: 'uppercase', marginBottom: 5, letterSpacing: 0.3 },
  kpiValue: { fontSize: 13, fontWeight: 'bold', marginBottom: 3 },
  kpiNote: { fontSize: 7, color: CINZA_TEXTO },

  // ── Tabela padrão ──────────────────────────────────────────────────────
  table: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CINZA_BORDA,
    overflow: 'hidden',
    marginBottom: 16,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: AZUL,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  tableHeadCell: { fontSize: 8, color: BRANCO, fontWeight: 'bold' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: CINZA_BORDA,
  },
  tableRowAlt: { backgroundColor: CINZA_BG },
  tableCell: { fontSize: 9, color: PRETO_TEXTO },
  tableCellRight: { fontSize: 9, color: PRETO_TEXTO, textAlign: 'right' },
  tableTotalRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: AZUL_CLARO,
  },
  tableTotalLabel: { fontSize: 9, fontWeight: 'bold', color: AZUL },
  tableTotalValue: { fontSize: 9, fontWeight: 'bold', color: AZUL, textAlign: 'right' },

  // ── Caixa de repasse ───────────────────────────────────────────────────
  repasseBox: {
    borderWidth: 1,
    borderColor: AMBAR_BORDA,
    backgroundColor: AMBAR_BG,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
  },
  repasseHeader: {
    backgroundColor: AMBAR,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  repasseHeaderText: { fontSize: 10, fontWeight: 'bold', color: BRANCO, letterSpacing: 0.3 },
  repasseBody: { paddingHorizontal: 14, paddingVertical: 12 },
  repasseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  repasseLabel: { fontSize: 9, color: CINZA_TEXTO },
  repasseValue: { fontSize: 9, fontWeight: 'bold', color: PRETO_TEXTO },
  repasseSeparator: { height: 1, backgroundColor: AMBAR_BORDA, marginVertical: 8 },
  repasseFinalBox: {
    backgroundColor: AZUL,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  repasseFinalLabel: { fontSize: 10, fontWeight: 'bold', color: BRANCO },
  repasseFinalValue: { fontSize: 14, fontWeight: 'bold', color: BRANCO },

  // ── Barra visual de margem ─────────────────────────────────────────────
  progressBarBg: {
    height: 6,
    backgroundColor: CINZA_MEDIO,
    borderRadius: 3,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: { height: 6, borderRadius: 3 },

  // ── Footer ─────────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: CINZA_BORDA,
    paddingTop: 10,
    marginTop: 14,
  },
  footerLeft: { flexDirection: 'column' },
  footerBrand: { fontSize: 8, fontWeight: 'bold', color: AZUL },
  footerSub: { fontSize: 7, color: CINZA_TEXTO, marginTop: 1 },
  footerPage: { fontSize: 8, color: CINZA_TEXTO },

  // ── Nota / Disclaimer ──────────────────────────────────────────────────
  disclaimer: {
    backgroundColor: CINZA_BG,
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: AZUL,
  },
  disclaimerText: { fontSize: 7.5, color: CINZA_TEXTO, lineHeight: 1.5 },
  emptyState: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 8.5,
    color: CINZA_TEXTO,
    textAlign: 'center',
  },
})

interface DetalheCusto {
  categoria: string
  tipoGestao: string
  valor: string
}

export interface PrestacaoContasPdfProps {
  logoBase64: string
  empreendimento: string
  apartamento: string
  mesNome: string
  ano: string
  nomeProprietario: string
  modeloContrato?: string
  receitaBruta: string
  custosTotais: string
  lucroLiquido: string
  repasse: string
  baseCalculoLabel: string
  valorLiquidoProprietario: string
  margemLiquida: string
  percentualCustos: string
  receitaAdm: string
  custosAdm: string
  lucroAdm: string
  receitaSub: string
  custosSub: string
  lucroSub: string
  detalheCustos: DetalheCusto[]
  receitaReservas: string
  somaDiarias: number
  valorMedioDiaria: string
  mediaDiariasPorReserva: string
  usandoDiarias: boolean
  // valores numéricos para barra visual
  receitaTotal?: number
  custosTotal?: number
  lucroLiquidoNum?: number
  valorRepasseNum?: number
}

export function PrestacaoContasPdf({
  logoBase64,
  empreendimento,
  apartamento,
  mesNome,
  ano,
  nomeProprietario,
  modeloContrato,
  receitaBruta,
  custosTotais,
  lucroLiquido,
  repasse,
  baseCalculoLabel,
  valorLiquidoProprietario,
  margemLiquida,
  percentualCustos,
  receitaAdm,
  custosAdm,
  lucroAdm,
  receitaSub,
  custosSub,
  lucroSub,
  detalheCustos,
  receitaReservas,
  somaDiarias,
  valorMedioDiaria,
  mediaDiariasPorReserva,
  usandoDiarias,
  receitaTotal = 0,
  custosTotal = 0,
  lucroLiquidoNum = 0,
}: PrestacaoContasPdfProps) {
  const lucroNegativo = lucroLiquido.startsWith('-')
  const hasAdm = receitaAdm !== '' || custosAdm !== ''
  const hasSub = receitaSub !== '' || custosSub !== ''

  // Porcentagem da barra de margem (clamp 0-100)
  const margemNum = parseFloat(margemLiquida) || 0
  const margemPct = Math.max(0, Math.min(100, margemNum))
  const custosPctNum = receitaTotal > 0 ? (custosTotal / receitaTotal) * 100 : 0
  const custosPct = Math.max(0, Math.min(100, custosPctNum))

  const dataGeracao = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
  const horaGeracao = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })

  const modeloLabel = modeloContrato === 'sublocacao' ? 'Sublocação' : 'Administração'
  const periodoRef = `${mesNome}/${ano}`

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src={logoBase64} style={styles.logo} />
            <View style={styles.headerTitles}>
              <Text style={styles.docTitle}>Prestação de Contas</Text>
              <Text style={styles.docSubtitle}>Relatório Mensal Financeiro</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerRightLabel}>Competência</Text>
            <Text style={styles.headerRightValue}>{mesNome} de {ano}</Text>
            <View style={styles.competenciaBadge}>
              <Text style={styles.competenciaText}>{empreendimento} — Apt {apartamento}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.competenciaLinha}>
          Competência: {periodoRef} — {nomeProprietario || 'Proprietário não configurado'}
        </Text>

        {/* ── FAIXA INFO ─────────────────────────────────────────────────── */}
        <View style={styles.infoBar}>
          <View style={styles.infoBarItem}>
            <Text style={styles.infoBarLabel}>Proprietário</Text>
            <Text style={styles.infoBarValue}>{nomeProprietario || 'Não configurado'}</Text>
          </View>
          <View style={styles.infoBarItem}>
            <Text style={styles.infoBarLabel}>Empreendimento</Text>
            <Text style={styles.infoBarValue}>{empreendimento}</Text>
          </View>
          <View style={styles.infoBarItem}>
            <Text style={styles.infoBarLabel}>Unidade</Text>
            <Text style={styles.infoBarValue}>Apt {apartamento}</Text>
          </View>
          <View style={styles.infoBarItem}>
            <Text style={styles.infoBarLabel}>Modelo de Contrato</Text>
            <Text style={styles.infoBarValue}>{modeloLabel}</Text>
          </View>
          <View style={styles.infoBarItem}>
            <Text style={styles.infoBarLabel}>Período</Text>
            <Text style={styles.infoBarValue}>{mesNome}/{ano}</Text>
          </View>
        </View>

        {/* ── KPI CARDS ──────────────────────────────────────────────────── */}
        <View style={styles.kpiRow}>
          {/* Receita */}
          <View style={[styles.kpiCard, { borderColor: '#bfdbfe' }]}>
            <View style={[styles.kpiAccent, { backgroundColor: AZUL }]} />
            <View style={[styles.kpiBody, { backgroundColor: AZUL_CLARO }]}>
              <Text style={styles.kpiLabel}>Receita Bruta</Text>
              <Text style={[styles.kpiValue, { color: AZUL }]}>{receitaBruta}</Text>
              <Text style={styles.kpiNote}>Faturamento no período</Text>
            </View>
          </View>

          {/* Custos */}
          <View style={[styles.kpiCard, { borderColor: '#fecaca' }]}>
            <View style={[styles.kpiAccent, { backgroundColor: VERMELHO }]} />
            <View style={[styles.kpiBody, { backgroundColor: VERMELHO_BG }]}>
              <Text style={styles.kpiLabel}>Custos Totais</Text>
              <Text style={[styles.kpiValue, { color: VERMELHO }]}>{custosTotais}</Text>
              <Text style={styles.kpiNote}>{percentualCustos} do faturamento bruto</Text>
              {/* Barra visual de custos */}
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { backgroundColor: VERMELHO, width: `${custosPct}%` }]} />
              </View>
            </View>
          </View>

          {/* Lucro */}
          <View style={[styles.kpiCard, { borderColor: lucroNegativo ? '#fecaca' : '#bbf7d0' }]}>
            <View style={[styles.kpiAccent, { backgroundColor: lucroNegativo ? VERMELHO : VERDE }]} />
            <View style={[styles.kpiBody, { backgroundColor: lucroNegativo ? VERMELHO_BG : VERDE_BG }]}>
              <Text style={styles.kpiLabel}>Lucro Líquido</Text>
              <Text style={[styles.kpiValue, { color: lucroNegativo ? VERMELHO : VERDE }]}>{lucroLiquido}</Text>
              <Text style={styles.kpiNote}>Margem: {margemLiquida}</Text>
              {/* Barra visual de margem */}
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { backgroundColor: lucroNegativo ? VERMELHO : VERDE, width: `${margemPct}%` }]} />
              </View>
            </View>
          </View>

          {/* Repasse */}
          <View style={[styles.kpiCard, { borderColor: AMBAR_BORDA }]}>
            <View style={[styles.kpiAccent, { backgroundColor: AMBAR }]} />
            <View style={[styles.kpiBody, { backgroundColor: AMBAR_BG }]}>
              <Text style={styles.kpiLabel}>Repasse</Text>
              <Text style={[styles.kpiValue, { color: AMBAR }]}>{repasse}</Text>
              <Text style={styles.kpiNote}>{baseCalculoLabel}</Text>
            </View>
          </View>
        </View>

        {/* ── RESUMO OPERACIONAL (MODELO PDF) ───────────────────────────── */}
        <Text style={styles.sectionTitle}>Indicadores Operacionais</Text>
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, { flex: 2.4 }]}>Indicador</Text>
            <Text style={[styles.tableHeadCell, { flex: 1.6, textAlign: 'right' }]}>Valor</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2.4 }]}>Receita das Reservas</Text>
            <Text style={[styles.tableCellRight, { flex: 1.6 }]}>{receitaReservas}</Text>
          </View>
          <View style={[styles.tableRow, styles.tableRowAlt]}>
            <Text style={[styles.tableCell, { flex: 2.4 }]}>Soma de Diárias</Text>
            <Text style={[styles.tableCellRight, { flex: 1.6 }]}>{somaDiarias}</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 2.4 }]}>Valor Médio da Diária</Text>
            <Text style={[styles.tableCellRight, { flex: 1.6 }]}>{valorMedioDiaria}</Text>
          </View>
          <View style={[styles.tableRow, styles.tableRowAlt]}>
            <Text style={[styles.tableCell, { flex: 2.4 }]}>Média de Diárias por Reserva</Text>
            <Text style={[styles.tableCellRight, { flex: 1.6 }]}>{mediaDiariasPorReserva}</Text>
          </View>
          <View style={styles.tableTotalRow}>
            <Text style={[styles.tableTotalLabel, { flex: 2.4 }]}>Fonte de faturamento usada</Text>
            <Text style={[styles.tableTotalValue, { flex: 1.6 }]}>
              {usandoDiarias ? 'Diárias conferidas' : 'Amenitiz (fallback)'}
            </Text>
          </View>
        </View>

        {/* ── ADM vs SUB ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>ADM vs SUB</Text>
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, { flex: 2 }]}>Tipo</Text>
            <Text style={[styles.tableHeadCell, { flex: 1.5, textAlign: 'right' }]}>Faturamento</Text>
            <Text style={[styles.tableHeadCell, { flex: 1.5, textAlign: 'right' }]}>Custos</Text>
            <Text style={[styles.tableHeadCell, { flex: 1.5, textAlign: 'right' }]}>Lucro</Text>
          </View>
          {hasAdm && (
            <View style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 2 }]}>ADM</Text>
              <Text style={[styles.tableCellRight, { flex: 1.5 }]}>{receitaAdm || '—'}</Text>
              <Text style={[styles.tableCellRight, { flex: 1.5 }]}>{custosAdm || '—'}</Text>
              <Text style={[styles.tableCellRight, { flex: 1.5, color: lucroAdm?.startsWith('-') ? VERMELHO : VERDE }]}>{lucroAdm || '—'}</Text>
            </View>
          )}
          {hasSub && (
            <View style={[styles.tableRow, styles.tableRowAlt]}>
              <Text style={[styles.tableCell, { flex: 2 }]}>SUB</Text>
              <Text style={[styles.tableCellRight, { flex: 1.5 }]}>{receitaSub || '—'}</Text>
              <Text style={[styles.tableCellRight, { flex: 1.5 }]}>{custosSub || '—'}</Text>
              <Text style={[styles.tableCellRight, { flex: 1.5, color: lucroSub?.startsWith('-') ? VERMELHO : VERDE }]}>{lucroSub || '—'}</Text>
            </View>
          )}
          <View style={styles.tableTotalRow}>
            <Text style={[styles.tableTotalLabel, { flex: 2 }]}>Total</Text>
            <Text style={[styles.tableTotalValue, { flex: 1.5 }]}>{receitaBruta}</Text>
            <Text style={[styles.tableTotalValue, { flex: 1.5 }]}>{custosTotais}</Text>
            <Text style={[styles.tableTotalValue, { flex: 1.5, color: lucroNegativo ? VERMELHO : VERDE }]}>{lucroLiquido}</Text>
          </View>
        </View>

        {/* ── CUSTOS DETALHADOS ──────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Custos Detalhados</Text>
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableHeadCell, { flex: 3 }]}>Categoria</Text>
            <Text style={[styles.tableHeadCell, { flex: 1 }]}>Gestão</Text>
            <Text style={[styles.tableHeadCell, { flex: 1.5, textAlign: 'right' }]}>Valor</Text>
          </View>
          {detalheCustos.length > 0 ? (
            detalheCustos.map((item, i) => (
              <View key={i} style={[styles.tableRow, i % 2 !== 0 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { flex: 3 }]}>{item.categoria}</Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{item.tipoGestao}</Text>
                <Text style={[styles.tableCellRight, { flex: 1.5 }]}>{item.valor}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyState}>Nenhum custo cadastrado para este período</Text>
          )}
          <View style={styles.tableTotalRow}>
            <Text style={[styles.tableTotalLabel, { flex: 3 }]}>Total</Text>
            <Text style={[styles.tableTotalLabel, { flex: 1 }]} />
            <Text style={[styles.tableTotalValue, { flex: 1.5 }]}>{custosTotais}</Text>
          </View>
        </View>

        {/* ── CÁLCULO DO REPASSE ─────────────────────────────────────────── */}
        <View style={styles.repasseBox}>
          <View style={styles.repasseHeader}>
            <Text style={styles.repasseHeaderText}>Demonstrativo de Repasse ao Proprietário</Text>
          </View>
          <View style={styles.repasseBody}>
            <View style={styles.repasseRow}>
              <Text style={styles.repasseLabel}>Receita Bruta do período:</Text>
              <Text style={styles.repasseValue}>{receitaBruta}</Text>
            </View>
            <View style={styles.repasseRow}>
              <Text style={styles.repasseLabel}>(−) Custos operacionais totais:</Text>
              <Text style={[styles.repasseValue, { color: VERMELHO }]}>− {custosTotais}</Text>
            </View>
            <View style={styles.repasseSeparator} />
            <View style={styles.repasseRow}>
              <Text style={[styles.repasseLabel, { fontWeight: 'bold', color: PRETO_TEXTO }]}>(=) Lucro Líquido:</Text>
              <Text style={[styles.repasseValue, { color: lucroNegativo ? VERMELHO : VERDE, fontSize: 10 }]}>{lucroLiquido}</Text>
            </View>
            <View style={styles.repasseRow}>
              <Text style={styles.repasseLabel}>(−) Taxa Alugueasy ({baseCalculoLabel}):</Text>
              <Text style={[styles.repasseValue, { color: AMBAR }]}>− {repasse}</Text>
            </View>
            <View style={[styles.repasseFinalBox, { marginTop: 8 }]}>
              <Text style={styles.repasseFinalLabel}>VALOR LÍQUIDO AO PROPRIETÁRIO</Text>
              <Text style={styles.repasseFinalValue}>{valorLiquidoProprietario}</Text>
            </View>
          </View>
        </View>

        {/* ── DISCLAIMER ─────────────────────────────────────────────────── */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Este documento é gerado automaticamente pelo sistema AlugEasy com base nos dados financeiros registrados no período informado.
            Os valores apresentados são referentes ao mês de competência {mesNome}/{ano} e incluem apenas as receitas e custos
            processados até a data de emissão. Para esclarecimentos, entre em contato com a equipe AlugEasy.
          </Text>
        </View>

        {/* ── FOOTER ─────────────────────────────────────────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.footerBrand}>AlugEasy — Facilitadora de Aluguel por Temporada</Text>
            <Text style={styles.footerSub}>Gerado em {dataGeracao} às {horaGeracao}</Text>
          </View>
          <Text style={styles.footerPage}>Página 1 de 1</Text>
        </View>

      </Page>
    </Document>
  )
}

/**
 * AlugEasy — Prestação de Contas (modelo oficial do gerador de planilhas)
 *
 * Réplica fiel do PDF `Prestacao_<EMPREENDIMENTO>_Apt-<N>_<Mes>-<Ano>.pdf`:
 * mesma paleta, mesma ordem de seções e mesmo visual. Os dados vêm do banco
 * do sistema financeiro via `app/api/prestacao-contas-pdf/route.tsx`.
 *
 * Renderer: @react-pdf/renderer com Helvetica nativa (a mesma família de
 * fontes do gerador original em pdfmake).
 */

import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer'
import { MESES } from '@/lib/constants'

// Sem hifenização: rótulos como "PROPRIETÁRIO" não podem quebrar no meio.
Font.registerHyphenationCallback(word => [word])

// ── Paleta do modelo (hex exatos) ────────────────────────────────────────────
const COR = {
  marinho: '#1F3864',
  verde: '#00B050',
  vermelho: '#C00000',
  cinza: '#6b7280',
  azulClaro: '#EBF3FB',      // fundo de linhas de TOTAL
  borda: '#d5dbe6',
  zebra: '#f5f8fc',
  boxBg: '#fafbfd',
  verdeBg: '#f0faf4',
  verdeBorda: '#bfe3cc',
  vermelhoBg: '#fdecec',
  texto: '#1c2333',
  headerSub: '#c3c9d4',
  headerMeta: '#8f9bb3',
  vago: '#ececf0',
  vagoNum: '#9aa1ad',
  branco: '#FFFFFF',
} as const

export type CanalKey = 'booking' | 'airbnb' | 'alugueasy'

const CANAL_LABEL: Record<CanalKey, string> = {
  booking: 'Booking', airbnb: 'Airbnb', alugueasy: 'Alugueasy',
}
const CANAL_COR: Record<CanalKey, string> = {
  booking: '#0070C0', airbnb: '#FF6B35', alugueasy: '#00B050',
}

const BOLD = 'Helvetica-Bold'
const ITALICO = 'Helvetica-Oblique'

// ── Formatação pt-BR ─────────────────────────────────────────────────────────
const BRL = (valor: number) => {
  const sinal = valor < 0 ? '-' : ''
  const [int, dec] = Math.abs(valor || 0).toFixed(2).split('.')
  const grupos: string[] = []
  for (let i = int.length; i > 0; i -= 3) grupos.unshift(int.slice(Math.max(0, i - 3), i))
  return `${sinal}R$ ${grupos.join('.')},${dec}`
}
const pct1 = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
const num1 = (v: number) => v.toFixed(1).replace('.', ',')
const dd = (dia: number) => String(dia).padStart(2, '0')
const dataBr = (iso: string) => {
  const [a, m, d] = iso.split('-')
  return d && m && a ? `${d}/${m}/${a}` : iso
}
// 15 → "15%" · 12.5 → "12,5%"
const taxaFmt = (t: number) => Number.isInteger(t) ? `${t}%` : pct1(t)

// ── Tipos de dados (montados pela rota) ──────────────────────────────────────
export interface CanalResumo {
  canal: CanalKey
  reservas: number
  noites: number
  receita: number               // líquida no mês (com rateio)
  taxaEfetivaPct: number | null // null = sem valor bruto conhecido no canal
}

export interface ReservaLinha {
  hospede: string               // já anonimizado (LGPD) pela rota
  checkin: string               // YYYY-MM-DD, clipado ao mês
  checkout: string
  noites: number                // noites dentro do mês
  canal: CanalKey
  valor: number                 // líquido proporcional às noites no mês
  cruzaMes: boolean
}

export interface CustoLinha { categoria: string; recorrente: boolean; valor: number }

export interface ProximoMesResumo {
  mes: number
  ano: number
  noites: number
  diasDoMes: number
  reservas: number
  receitaPrevista: number
}

export interface PrestacaoContasPdfProps {
  logoBase64: string
  empreendimento: string
  apartamento: string
  mes: number
  ano: number
  nomeProprietario: string
  contratoLabel: string         // 'Administração' | 'Sublocação'
  taxaRepasse: number           // percentual (15 = 15%)
  tipoRepasse: string           // 'lucro' | 'faturamento'
  documento: string             // PC-ADM-202607-APT117
  emitidoEm: string             // DD/MM/AAAA
  geradoEm: string              // DD/MM/AAAA HH:mm

  receita: number
  custosTotal: number
  lucro: number
  repasse: number
  valorProprietario: number

  numReservas: number | null    // null = mês sem reservas Amenitiz (só diárias)
  noites: number                // noites ocupadas dentro do mês
  mediaNoitesReserva: number | null

  ocupacaoDias: Array<CanalKey | null>  // índice 0 = dia 1 do mês

  receitaBruta: number          // 0 = seção "do bruto ao líquido" omitida
  taxasPlataforma: number
  ajusteManual: number          // residual que fecha na receita líquida

  canais: CanalResumo[]
  reservas: ReservaLinha[]
  custos: CustoLinha[]
  mediaCustosHistorica: number | null

  proximoMes: ProximoMesResumo | null
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    paddingTop: 96, paddingBottom: 52, paddingHorizontal: 40,
    fontFamily: 'Helvetica', fontSize: 9, color: COR.texto, backgroundColor: COR.branco,
  },

  // Cabeçalho — faixa azul-marinho de largura total em todas as páginas
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 82,
    backgroundColor: COR.marinho, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 40,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerLogo: { width: 44, height: 44, objectFit: 'contain' },
  headerTitulo: { fontFamily: BOLD, fontSize: 15, color: COR.branco },
  headerSub: { fontSize: 10, color: COR.headerSub, marginTop: 3 },
  headerRight: { alignItems: 'flex-end' },
  headerMes: { fontFamily: BOLD, fontSize: 13, color: COR.branco },
  headerMeta: { fontSize: 8, color: COR.headerSub, marginTop: 2 },
  headerDoc: { fontSize: 7, color: COR.headerMeta, marginTop: 3 },

  // Rodapé
  footer: { position: 'absolute', bottom: 16, left: 40, right: 40 },
  footerLinha: { flexDirection: 'row', justifyContent: 'space-between' },
  footerTexto: { fontSize: 7, color: COR.cinza },
  footerTexto2: { fontSize: 7, color: COR.cinza, marginTop: 2 },

  // Títulos de seção
  secaoTitulo: {
    fontFamily: BOLD, fontSize: 11, color: COR.marinho,
    borderBottomWidth: 1.2, borderBottomColor: COR.marinho,
    paddingBottom: 3, marginBottom: 8, marginTop: 4,
  },
  tituloDetalhamento: { fontFamily: BOLD, fontSize: 13, color: COR.marinho, marginBottom: 10 },

  // Grade de caixas (resumo / indicadores / próximo mês)
  grid: { flexDirection: 'row', marginBottom: 12 },
  box: {
    flex: 1, borderWidth: 0.75, borderColor: COR.borda,
    backgroundColor: COR.boxBg, paddingVertical: 8, paddingHorizontal: 7,
  },
  boxColado: { marginLeft: -0.75 },
  // minHeight de 2 linhas alinha os valores mesmo quando um rótulo quebra
  boxLabel: { fontSize: 7, color: COR.cinza, textTransform: 'uppercase', marginBottom: 4, minHeight: 16 },
  boxValor: { fontFamily: BOLD, fontSize: 11, color: COR.texto },

  // Calendário
  calColunas: { flexDirection: 'row', marginBottom: 12 },
  calEsquerda: { width: 165 },
  calDireita: { flex: 1, paddingLeft: 14 },
  calSemana: { flexDirection: 'row' },
  calDiaSemana: {
    width: 22, marginRight: 1.5, marginBottom: 2, textAlign: 'center',
    fontSize: 6.5, fontFamily: BOLD, color: COR.cinza,
  },
  calCelula: {
    width: 22, height: 19, marginRight: 1.5, marginBottom: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  calNumOcupado: { fontSize: 7, fontFamily: BOLD, color: COR.branco },
  calNumVago: { fontSize: 7, color: COR.vagoNum },
  calLegenda: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  calLegendaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 8, marginBottom: 2 },
  calLegendaCor: { width: 6, height: 6, marginRight: 3 },
  calLegendaTexto: { fontSize: 6.5, color: COR.cinza },
  vagasTexto: { fontSize: 8.5, lineHeight: 1.4, color: COR.texto },
  leituraTitulo: { fontFamily: BOLD, fontSize: 9, color: COR.marinho, marginTop: 9, marginBottom: 4 },
  leituraBullet: { flexDirection: 'row', marginBottom: 3 },
  leituraMarcador: { fontSize: 8.5, color: COR.marinho, width: 9 },
  leituraTexto: { flex: 1, fontSize: 8.5, lineHeight: 1.35, color: COR.texto },

  // Tabela estilo DRE (apuração e bruto→líquido)
  dreLinha: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 5, paddingHorizontal: 6,
    borderBottomWidth: 0.75, borderBottomColor: COR.borda,
  },
  dreLabel: { fontSize: 9, color: COR.texto },
  dreValor: { fontSize: 9, color: COR.texto },

  // Bloco de repasse
  repasseBox: {
    borderWidth: 1, borderColor: COR.verdeBorda, backgroundColor: COR.verdeBg,
    padding: 10, marginTop: 10, marginBottom: 12,
  },
  repasseLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  repasseLabel: { fontSize: 7.5, color: COR.cinza, textTransform: 'uppercase' },
  repasseValor: { fontFamily: BOLD, fontSize: 12, color: COR.verde },
  repasseNota: { fontSize: 7.5, color: COR.cinza, marginTop: 4 },

  // Tabelas de dados
  thLeve: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COR.borda,
    paddingVertical: 4, paddingHorizontal: 4,
  },
  thLeveCel: { fontFamily: BOLD, fontSize: 7.5, color: COR.marinho },
  thEscuro: { flexDirection: 'row', backgroundColor: COR.marinho, paddingVertical: 5, paddingHorizontal: 4 },
  thEscuroCel: { fontFamily: BOLD, fontSize: 7.5, color: COR.branco },
  tr: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: COR.borda },
  trZebra: { backgroundColor: COR.zebra },
  trTotal: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, backgroundColor: COR.azulClaro },
  td: { fontSize: 8, color: COR.texto },
  tdBold: { fontFamily: BOLD, fontSize: 8, color: COR.texto },
  notaTabela: { fontSize: 7, color: COR.cinza, marginTop: 3, marginBottom: 10, lineHeight: 1.35 },
  vazioItalico: { fontFamily: ITALICO, fontSize: 8.5, color: COR.cinza, marginBottom: 10 },

  // Barra de participação por canal
  barraTrilho: { flex: 1, justifyContent: 'center', paddingLeft: 6 },
  barra: { height: 5 },

  // Glossário
  glossarioTitulo: { fontFamily: BOLD, fontSize: 8, color: COR.cinza, marginTop: 14, marginBottom: 3 },
  glossarioTexto: { fontSize: 6.5, color: COR.cinza, lineHeight: 1.5 },
})

// Larguras fixas das colunas
const W = {
  canal: { canal: 58, reservas: 42, noites: 36, diaria: 52, taxa: 50, receita: 66, part: 36 },
  reserva: { checkin: 52, checkout: 52, noites: 36, plataforma: 56, valor: 68 },
  custo: { tipo: 70, valor: 78, pctReceita: 62 },
}

// ── Cálculo das janelas vagas ────────────────────────────────────────────────
function janelasVagas(ocupacaoDias: Array<CanalKey | null>) {
  const janelas: Array<{ ini: number; fim: number; len: number }> = []
  let atual: { ini: number; fim: number; len: number } | null = null
  ocupacaoDias.forEach((canal, i) => {
    if (canal === null) {
      if (atual) { atual.fim = i + 1; atual.len++ }
      else { atual = { ini: i + 1, fim: i + 1, len: 1 }; janelas.push(atual) }
    } else atual = null
  })
  const noitesVagas = janelas.reduce((s, j) => s + j.len, 0)
  const maior = janelas.reduce<typeof janelas[number] | null>(
    (m, j) => (!m || j.len > m.len ? j : m), null)
  return { noitesVagas, janelas, maior }
}

// ── Componentes de estrutura ─────────────────────────────────────────────────
function Cabecalho(p: {
  logoBase64: string; empreendimento: string; apartamento: string
  mesNome: string; ano: number; nomeProprietario: string
  contratoLabel: string; taxaRepasse: number; tipoRepasse: string
  documento: string; emitidoEm: string
}) {
  return (
    <View fixed style={S.header}>
      <View style={S.headerLeft}>
        <Image src={p.logoBase64} style={S.headerLogo} />
        <View>
          <Text style={S.headerTitulo}>PRESTAÇÃO DE CONTAS</Text>
          <Text style={S.headerSub}>{p.empreendimento} — Apartamento {p.apartamento}</Text>
        </View>
      </View>
      <View style={S.headerRight}>
        <Text style={S.headerMes}>{p.mesNome}/{p.ano}</Text>
        <Text style={S.headerMeta}>Proprietário: {p.nomeProprietario}</Text>
        <Text style={S.headerMeta}>
          {p.contratoLabel} · Repasse {taxaFmt(p.taxaRepasse)} sobre {p.tipoRepasse === 'faturamento' ? 'faturamento' : 'lucro'}
        </Text>
        <Text style={S.headerDoc}>Documento {p.documento} · Emitido em {p.emitidoEm}</Text>
      </View>
    </View>
  )
}

function Rodape({ geradoEm }: { geradoEm: string }) {
  return (
    <View fixed style={S.footer}>
      <View style={S.footerLinha}>
        <Text style={S.footerTexto}>Gerado pelo sistema financeiro AlugEasy em {geradoEm}</Text>
        <Text style={S.footerTexto} render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`} />
      </View>
      <Text style={S.footerTexto2}>Dúvidas sobre este relatório: AlugEasy · alugueasy@gmail.com</Text>
    </View>
  )
}

function CaixaGrid({ itens }: {
  itens: Array<{ label: string; valor: string; corValor?: string; bg?: string; bordaCor?: string }>
}) {
  return (
    <View style={S.grid} wrap={false}>
      {itens.map((item, i) => (
        <View
          key={item.label}
          style={[
            S.box,
            ...(i > 0 ? [S.boxColado] : []),
            ...(item.bg ? [{ backgroundColor: item.bg }] : []),
            ...(item.bordaCor ? [{ borderColor: item.bordaCor }] : []),
          ]}
        >
          <Text style={S.boxLabel}>{item.label}</Text>
          <Text style={[S.boxValor, ...(item.corValor ? [{ color: item.corValor }] : [])]}>{item.valor}</Text>
        </View>
      ))}
    </View>
  )
}

function LinhaDre(p: {
  label: string; valor: string; corValor?: string; bold?: boolean
  bg?: string; tamanho?: number
}) {
  return (
    <View style={[S.dreLinha, ...(p.bg ? [{ backgroundColor: p.bg, borderBottomWidth: 0 }] : [])]} wrap={false}>
      <Text style={[
        S.dreLabel,
        ...(p.bold ? [{ fontFamily: BOLD }] : []),
        ...(p.tamanho ? [{ fontSize: p.tamanho }] : []),
      ]}>{p.label}</Text>
      <Text style={[
        S.dreValor,
        ...(p.bold ? [{ fontFamily: BOLD }] : []),
        ...(p.tamanho ? [{ fontSize: p.tamanho }] : []),
        ...(p.corValor ? [{ color: p.corValor }] : []),
      ]}>{p.valor}</Text>
    </View>
  )
}

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function Calendario({ mes, ano, ocupacaoDias }: {
  mes: number; ano: number; ocupacaoDias: Array<CanalKey | null>
}) {
  const primeiroDow = new Date(ano, mes - 1, 1).getDay()
  const celulas: Array<{ dia: number; canal: CanalKey | null } | null> = [
    ...Array.from({ length: primeiroDow }, () => null),
    ...ocupacaoDias.map((canal, i) => ({ dia: i + 1, canal })),
  ]
  while (celulas.length % 7 !== 0) celulas.push(null)
  const semanas: Array<typeof celulas> = []
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7))

  return (
    <View>
      <View style={S.calSemana}>
        {DIAS_SEMANA.map((d, i) => <Text key={i} style={S.calDiaSemana}>{d}</Text>)}
      </View>
      {semanas.map((semana, si) => (
        <View key={si} style={S.calSemana}>
          {semana.map((cel, ci) => cel === null
            ? <View key={ci} style={S.calCelula} />
            : (
              <View key={ci} style={[S.calCelula, { backgroundColor: cel.canal ? CANAL_COR[cel.canal] : COR.vago }]}>
                <Text style={cel.canal ? S.calNumOcupado : S.calNumVago}>{cel.dia}</Text>
              </View>
            ))}
        </View>
      ))}
      <View style={S.calLegenda}>
        {(['booking', 'airbnb', 'alugueasy'] as CanalKey[]).map(c => (
          <View key={c} style={S.calLegendaItem}>
            <View style={[S.calLegendaCor, { backgroundColor: CANAL_COR[c] }]} />
            <Text style={S.calLegendaTexto}>{CANAL_LABEL[c]}</Text>
          </View>
        ))}
        <View style={S.calLegendaItem}>
          <View style={[S.calLegendaCor, { backgroundColor: COR.vago }]} />
          <Text style={S.calLegendaTexto}>Vago</Text>
        </View>
      </View>
    </View>
  )
}

// ── Documento ────────────────────────────────────────────────────────────────
export function PrestacaoContasPdf(props: PrestacaoContasPdfProps) {
  const {
    logoBase64, empreendimento, apartamento, mes, ano, nomeProprietario,
    contratoLabel, taxaRepasse, tipoRepasse, documento, emitidoEm, geradoEm,
    receita, custosTotal, lucro, repasse, valorProprietario,
    numReservas, noites, mediaNoitesReserva, ocupacaoDias,
    receitaBruta, taxasPlataforma, ajusteManual,
    canais, reservas, custos, mediaCustosHistorica, proximoMes,
  } = props

  const mesNome = MESES[mes - 1] ?? String(mes)
  const mesNomeMin = mesNome.toLowerCase()
  const diasDoMes = ocupacaoDias.length
  const negativo = valorProprietario < 0

  // KPIs derivados (fórmulas do modelo)
  const ocupacaoPct = diasDoMes > 0 ? (noites / diasDoMes) * 100 : 0
  const diariaMedia = noites > 0 ? receita / noites : null
  const revpar = diasDoMes > 0 ? receita / diasDoMes : 0

  // Janelas vagas
  const vagas = janelasVagas(ocupacaoDias)
  const resumoVagas = vagas.noitesVagas === 0
    ? 'Nenhuma noite vaga no mês.'
    : `${vagas.noitesVagas} ${vagas.noitesVagas === 1 ? 'noite vaga' : 'noites vagas'} em ` +
      `${vagas.janelas.length} ${vagas.janelas.length === 1 ? 'janela' : 'janelas'} · ` +
      `maior janela ociosa: ${vagas.maior!.len} ${vagas.maior!.len === 1 ? 'noite' : 'noites'} ` +
      `(${dd(vagas.maior!.ini)} a ${dd(vagas.maior!.fim)})`

  // "Leitura do mês" — bullets 100% determinísticos (regras fixas, sem IA)
  const bullets: string[] = []
  bullets.push(`Ocupação de ${pct1(ocupacaoPct)} (${noites} de ${diasDoMes} noites).`)
  if (diariaMedia !== null)
    bullets.push(`Diária média de ${BRL(diariaMedia)} e RevPAR de ${BRL(revpar)}.`)
  bullets.push(vagas.noitesVagas === 0
    ? 'Mês cheio: nenhuma noite vaga.'
    : `${vagas.noitesVagas} ${vagas.noitesVagas === 1 ? 'noite vaga' : 'noites vagas'} em ` +
      `${vagas.janelas.length} ${vagas.janelas.length === 1 ? 'janela' : 'janelas'} — a maior de ` +
      `${vagas.maior!.len} ${vagas.maior!.len === 1 ? 'noite' : 'noites'} (${dd(vagas.maior!.ini)} a ${dd(vagas.maior!.fim)}).`)
  const variacaoCustos = mediaCustosHistorica !== null && mediaCustosHistorica > 0
    ? ((custosTotal - mediaCustosHistorica) / mediaCustosHistorica) * 100
    : null
  if (custosTotal > 0 && receita > 0) {
    let frase = `Custos de ${BRL(custosTotal)} consumiram ${pct1((custosTotal / receita) * 100)} da receita`
    if (variacaoCustos !== null && Math.abs(variacaoCustos) >= 5)
      frase += `, ${pct1(Math.abs(variacaoCustos))} ${variacaoCustos > 0 ? 'acima' : 'abaixo'} da média dos meses anteriores`
    bullets.push(frase + '.')
  }
  const receitaCanais = canais.reduce((s, c) => s + c.receita, 0)
  const canalPrincipal = canais.length > 0
    ? canais.reduce((m, c) => (c.receita > m.receita ? c : m), canais[0])
    : null
  if (canalPrincipal && receitaCanais > 0) {
    const part = (canalPrincipal.receita / receitaCanais) * 100
    if (part >= 34)
      bullets.push(`${CANAL_LABEL[canalPrincipal.canal]} foi o principal canal do mês: ${pct1(part)} da receita (${canalPrincipal.noites} noites).`)
  }

  // Custos
  const custosOrdenados = [...custos].sort((a, b) => b.valor - a.valor)
  const custosRecorrentes = custos.filter(c => c.recorrente).reduce((s, c) => s + c.valor, 0)
  const custosEventuais = custos.filter(c => !c.recorrente).reduce((s, c) => s + c.valor, 0)

  // Reservas
  const algumaCruzaMes = reservas.some(r => r.cruzaMes)
  const totalNoitesReservas = reservas.reduce((s, r) => s + r.noites, 0)
  const totalValorReservas = reservas.reduce((s, r) => s + r.valor, 0)

  const taxaPctSobreBruto = receitaBruta > 0 ? (taxasPlataforma / receitaBruta) * 100 : 0
  const baseRepasseLabel = tipoRepasse === 'faturamento' ? 'o faturamento' : 'o lucro'

  const cabecalho = (
    <Cabecalho
      logoBase64={logoBase64} empreendimento={empreendimento} apartamento={apartamento}
      mesNome={mesNome} ano={ano} nomeProprietario={nomeProprietario}
      contratoLabel={contratoLabel} taxaRepasse={taxaRepasse} tipoRepasse={tipoRepasse}
      documento={documento} emitidoEm={emitidoEm}
    />
  )

  return (
    <Document
      title={`Prestação de Contas ${empreendimento} ${apartamento} ${mesNome}/${ano}`}
      author="AlugEasy"
    >
      {/* ═══════════════ Página 1 — visão executiva ═══════════════ */}
      <Page size="A4" style={S.page}>
        {cabecalho}

        <Text style={S.secaoTitulo}>Resumo financeiro do mês</Text>
        <CaixaGrid itens={[
          { label: 'Receita líquida', valor: BRL(receita) },
          { label: 'Custos do mês', valor: BRL(custosTotal) },
          { label: 'Lucro líquido', valor: BRL(lucro), corValor: lucro < 0 ? COR.vermelho : undefined },
          { label: `Administração AlugEasy (${taxaFmt(taxaRepasse)})`, valor: BRL(repasse) },
          {
            label: 'Valor do proprietário', valor: BRL(valorProprietario),
            corValor: negativo ? COR.vermelho : COR.verde,
            bg: negativo ? COR.vermelhoBg : COR.verdeBg,
          },
        ]} />

        <Text style={S.secaoTitulo}>Indicadores de desempenho</Text>
        <CaixaGrid itens={[
          { label: 'Reservas', valor: numReservas === null ? '—' : String(numReservas) },
          { label: 'Noites ocupadas', valor: `${noites} de ${diasDoMes}` },
          { label: 'Ocupação', valor: pct1(ocupacaoPct) },
          { label: 'Diária média', valor: diariaMedia === null ? '—' : BRL(diariaMedia) },
          { label: 'RevPAR', valor: BRL(revpar) },
          { label: 'Média noites/reserva', valor: mediaNoitesReserva === null ? '—' : num1(mediaNoitesReserva) },
        ]} />

        <Text style={S.secaoTitulo}>Calendário de ocupação — {mesNomeMin}/{ano}</Text>
        <View style={S.calColunas} wrap={false}>
          <View style={S.calEsquerda}>
            <Calendario mes={mes} ano={ano} ocupacaoDias={ocupacaoDias} />
          </View>
          <View style={S.calDireita}>
            <Text style={S.vagasTexto}>{resumoVagas}</Text>
            <Text style={S.leituraTitulo}>Leitura do mês</Text>
            {bullets.slice(0, 5).map((b, i) => (
              <View key={i} style={S.leituraBullet}>
                <Text style={S.leituraMarcador}>•</Text>
                <Text style={S.leituraTexto}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={S.secaoTitulo}>Apuração do resultado</Text>
        <View wrap={false}>
          <LinhaDre label="Receita líquida das reservas" valor={BRL(receita)} />
          <LinhaDre label="(-) Custos do imóvel no mês" valor={BRL(custosTotal)} corValor={custosTotal > 0 ? COR.vermelho : undefined} />
          <LinhaDre label="(=) Lucro líquido" valor={BRL(lucro)} bold corValor={lucro < 0 ? COR.vermelho : undefined} />
          <LinhaDre
            label={`(-) Administração AlugEasy — ${taxaFmt(taxaRepasse)} sobre ${baseRepasseLabel}`}
            valor={BRL(repasse)} corValor={repasse > 0 ? COR.vermelho : undefined}
          />
          <LinhaDre
            label="(=) VALOR LÍQUIDO DO PROPRIETÁRIO" valor={BRL(valorProprietario)}
            bold tamanho={10} bg={negativo ? COR.vermelhoBg : COR.verdeBg}
            corValor={negativo ? COR.vermelho : COR.verde}
          />
        </View>

        <View
          style={[S.repasseBox, ...(negativo ? [{ backgroundColor: COR.vermelhoBg, borderColor: COR.vermelho }] : [])]}
          wrap={false}
        >
          <View style={S.repasseLinha}>
            <Text style={S.repasseLabel}>Repasse ao proprietário</Text>
            <Text style={[S.repasseValor, ...(negativo ? [{ color: COR.vermelho }] : [])]}>{BRL(valorProprietario)}</Text>
          </View>
          <Text style={S.repasseNota}>
            Crédito em conta do proprietário conforme condições do contrato de administração.
          </Text>
        </View>

        <Rodape geradoEm={geradoEm} />
      </Page>

      {/* ═══════════════ Página 2+ — detalhamento do mês ═══════════════ */}
      <Page size="A4" style={S.page}>
        {cabecalho}

        <Text style={S.tituloDetalhamento}>Detalhamento do mês</Text>

        {receitaBruta > 0 && (
          <View wrap={false}>
            <Text style={S.secaoTitulo}>Receita do mês — do bruto ao líquido</Text>
            <LinhaDre label="Receita bruta das reservas" valor={BRL(receitaBruta)} />
            <LinhaDre
              label={`(-) Taxas de plataforma (${pct1(taxaPctSobreBruto)} do bruto)`}
              valor={BRL(taxasPlataforma)} corValor={COR.vermelho}
            />
            {Math.abs(ajusteManual) >= 0.01 && (
              <LinhaDre
                label={ajusteManual > 0 ? '(+) Lançamentos manuais (sem taxa de plataforma)' : '(-) Ajustes de conferência'}
                valor={BRL(Math.abs(ajusteManual))}
                corValor={ajusteManual < 0 ? COR.vermelho : undefined}
              />
            )}
            <LinhaDre label="(=) Receita líquida das reservas" valor={BRL(receita)} bold corValor={COR.marinho} />
            <View style={{ marginBottom: 12 }} />
          </View>
        )}

        {canais.length > 0 && (
          <View wrap={false}>
            <Text style={S.secaoTitulo}>Receita por canal</Text>
            <View style={S.thLeve}>
              <Text style={[S.thLeveCel, { width: W.canal.canal }]}>Canal</Text>
              <Text style={[S.thLeveCel, { width: W.canal.reservas, textAlign: 'right' }]}>Reservas</Text>
              <Text style={[S.thLeveCel, { width: W.canal.noites, textAlign: 'right' }]}>Noites</Text>
              <Text style={[S.thLeveCel, { width: W.canal.diaria, textAlign: 'right' }]}>Diária líq.</Text>
              <Text style={[S.thLeveCel, { width: W.canal.taxa, textAlign: 'right' }]}>Taxa efetiva</Text>
              <Text style={[S.thLeveCel, { width: W.canal.receita, textAlign: 'right' }]}>Receita líquida</Text>
              <Text style={[S.thLeveCel, { width: W.canal.part, textAlign: 'right' }]}>Part. (%)</Text>
              <Text style={[S.thLeveCel, { flex: 1 }]} />
            </View>
            {canais.map((c, i) => {
              const part = receitaCanais > 0 ? (c.receita / receitaCanais) * 100 : 0
              return (
                <View key={c.canal} style={[S.tr, ...(i % 2 ? [S.trZebra] : [])]}>
                  <Text style={[S.tdBold, { width: W.canal.canal }]}>{CANAL_LABEL[c.canal]}</Text>
                  <Text style={[S.td, { width: W.canal.reservas, textAlign: 'right' }]}>{c.reservas}</Text>
                  <Text style={[S.td, { width: W.canal.noites, textAlign: 'right' }]}>{c.noites}</Text>
                  <Text style={[S.td, { width: W.canal.diaria, textAlign: 'right' }]}>
                    {c.noites > 0 ? BRL(c.receita / c.noites) : '—'}
                  </Text>
                  <Text style={[S.td, { width: W.canal.taxa, textAlign: 'right' }]}>
                    {c.taxaEfetivaPct === null ? '—' : pct1(c.taxaEfetivaPct)}
                  </Text>
                  <Text style={[S.td, { width: W.canal.receita, textAlign: 'right' }]}>{BRL(c.receita)}</Text>
                  <Text style={[S.td, { width: W.canal.part, textAlign: 'right' }]}>{pct1(part)}</Text>
                  <View style={S.barraTrilho}>
                    <View style={[S.barra, { backgroundColor: CANAL_COR[c.canal], width: `${Math.max(2, part)}%` }]} />
                  </View>
                </View>
              )
            })}
            <Text style={S.notaTabela}>
              Diária líq. = receita líquida do canal / noites no mês. Taxa efetiva = quanto o canal
              reteve sobre o valor bruto das reservas do mês.
            </Text>
          </View>
        )}

        <Text style={S.secaoTitulo}>Reservas de {mesNomeMin} ({reservas.length})</Text>
        {reservas.length === 0 ? (
          <Text style={S.vazioItalico}>Nenhuma reserva no mês.</Text>
        ) : (
          <View>
            <View style={S.thEscuro}>
              <Text style={[S.thEscuroCel, { flex: 1 }]}>Hóspede</Text>
              <Text style={[S.thEscuroCel, { width: W.reserva.checkin }]}>Check-in</Text>
              <Text style={[S.thEscuroCel, { width: W.reserva.checkout }]}>Check-out</Text>
              <Text style={[S.thEscuroCel, { width: W.reserva.noites, textAlign: 'right' }]}>Noites*</Text>
              <Text style={[S.thEscuroCel, { width: W.reserva.plataforma, paddingLeft: 8 }]}>Plataforma</Text>
              <Text style={[S.thEscuroCel, { width: W.reserva.valor, textAlign: 'right' }]}>Valor líquido</Text>
            </View>
            {reservas.map((r, i) => (
              <View key={`${r.checkin}-${i}`} style={[S.tr, ...(i % 2 ? [S.trZebra] : [])]} wrap={false}>
                <Text style={[S.td, { flex: 1 }]}>{r.hospede}{r.cruzaMes ? ' (*)' : ''}</Text>
                <Text style={[S.td, { width: W.reserva.checkin }]}>{dataBr(r.checkin)}</Text>
                <Text style={[S.td, { width: W.reserva.checkout }]}>{dataBr(r.checkout)}</Text>
                <Text style={[S.td, { width: W.reserva.noites, textAlign: 'right' }]}>{r.noites}</Text>
                <Text style={[S.td, { width: W.reserva.plataforma, paddingLeft: 8 }]}>{CANAL_LABEL[r.canal]}</Text>
                <Text style={[S.td, { width: W.reserva.valor, textAlign: 'right' }]}>{BRL(r.valor)}</Text>
              </View>
            ))}
            <View style={S.trTotal} wrap={false}>
              <Text style={[S.tdBold, { flex: 1, color: COR.marinho }]}>TOTAL</Text>
              <Text style={[S.tdBold, { width: W.reserva.checkin }]} />
              <Text style={[S.tdBold, { width: W.reserva.checkout }]} />
              <Text style={[S.tdBold, { width: W.reserva.noites, textAlign: 'right', color: COR.marinho }]}>{totalNoitesReservas}</Text>
              <Text style={[S.tdBold, { width: W.reserva.plataforma }]} />
              <Text style={[S.tdBold, { width: W.reserva.valor, textAlign: 'right', color: COR.marinho }]}>{BRL(totalValorReservas)}</Text>
            </View>
            <Text style={S.notaTabela}>
              {algumaCruzaMes
                ? '(*) Reserva que cruza a virada do mês — valor proporcional apenas às noites dentro do mês. Coluna Noites = noites dentro do mês.'
                : '* Noites dentro do mês de referência.'}
            </Text>
          </View>
        )}

        <Text style={S.secaoTitulo}>Custos do imóvel</Text>
        {custos.length === 0 ? (
          <Text style={S.vazioItalico}>Nenhum custo informado para este mês.</Text>
        ) : (
          <View>
            <View style={S.thEscuro}>
              <Text style={[S.thEscuroCel, { flex: 1 }]}>Categoria</Text>
              <Text style={[S.thEscuroCel, { width: W.custo.tipo }]}>Tipo</Text>
              <Text style={[S.thEscuroCel, { width: W.custo.valor, textAlign: 'right' }]}>Valor</Text>
              <Text style={[S.thEscuroCel, { width: W.custo.pctReceita, textAlign: 'right' }]}>% da receita</Text>
            </View>
            {custosOrdenados.map((c, i) => (
              <View key={`${c.categoria}-${i}`} style={[S.tr, ...(i % 2 ? [S.trZebra] : [])]} wrap={false}>
                <Text style={[S.td, { flex: 1 }]}>{c.categoria}</Text>
                <Text style={[S.td, { width: W.custo.tipo }]}>{c.recorrente ? 'Recorrente' : 'Eventual'}</Text>
                <Text style={[S.td, { width: W.custo.valor, textAlign: 'right' }]}>{BRL(c.valor)}</Text>
                <Text style={[S.td, { width: W.custo.pctReceita, textAlign: 'right' }]}>
                  {receita > 0 ? pct1((c.valor / receita) * 100) : '—'}
                </Text>
              </View>
            ))}
            <View style={S.trTotal} wrap={false}>
              <Text style={[S.tdBold, { flex: 1, color: COR.marinho }]}>TOTAL DE CUSTOS</Text>
              <Text style={[S.tdBold, { width: W.custo.tipo }]} />
              <Text style={[S.tdBold, { width: W.custo.valor, textAlign: 'right', color: COR.marinho }]}>{BRL(custosTotal)}</Text>
              <Text style={[S.tdBold, { width: W.custo.pctReceita, textAlign: 'right', color: COR.marinho }]}>
                {receita > 0 ? pct1((custosTotal / receita) * 100) : '—'}
              </Text>
            </View>
            <Text style={S.notaTabela}>
              Recorrentes (mensalidades e serviços contínuos): {BRL(custosRecorrentes)} · Eventuais: {BRL(custosEventuais)}.
              {variacaoCustos !== null && (
                Math.abs(variacaoCustos) < 0.05
                  ? ` Total em linha com a média dos meses anteriores em operação (${BRL(mediaCustosHistorica!)}/mês).`
                  : ` Total ${pct1(Math.abs(variacaoCustos))} ${variacaoCustos > 0 ? 'acima' : 'abaixo'} da média dos meses anteriores em operação (${BRL(mediaCustosHistorica!)}/mês).`
              )}
            </Text>
          </View>
        )}

        {proximoMes && proximoMes.reservas > 0 && (
          <View wrap={false}>
            <Text style={S.secaoTitulo}>
              Próximo mês — reservas já confirmadas para {(MESES[proximoMes.mes - 1] ?? '').toLowerCase()}/{proximoMes.ano}
            </Text>
            <CaixaGrid itens={[
              { label: 'Noites já reservadas', valor: `${proximoMes.noites} de ${proximoMes.diasDoMes}` },
              { label: 'Reservas', valor: String(proximoMes.reservas) },
              { label: 'Receita líquida prevista', valor: BRL(proximoMes.receitaPrevista) },
            ]} />
            <Text style={[S.notaTabela, { marginTop: -8 }]}>
              Posição no fechamento deste relatório — previsão sujeita a cancelamentos e a novas reservas.
            </Text>
          </View>
        )}

        <View wrap={false}>
          <Text style={S.glossarioTitulo}>Glossário</Text>
          <Text style={S.glossarioTexto}>
            Ocupação: percentual das noites do mês em que o imóvel esteve reservado.
          </Text>
          <Text style={S.glossarioTexto}>
            Diária média: receita líquida do mês dividida pelas noites ocupadas.
          </Text>
          <Text style={S.glossarioTexto}>
            RevPAR (receita por diária disponível): receita líquida dividida por todos os dias do mês,
            ocupados ou não — mede ocupação e preço ao mesmo tempo.
          </Text>
        </View>

        <Rodape geradoEm={geradoEm} />
      </Page>
    </Document>
  )
}

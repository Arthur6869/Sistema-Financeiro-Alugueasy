/**
 * Tokens visuais copiados do portal web (`app/(proprietario)/proprietario/page.tsx`).
 * Manter em sincronia: se a paleta mudar lá, muda aqui — é o mesmo produto.
 */
export const CORES = {
  // Marca
  azul: '#193660',
  azulEscuro: '#0f2647',

  // Superfícies
  fundo: '#f4f5f7',
  branco: '#ffffff',
  borda: '#e7e9ee',
  areia: '#f8f6f1',

  // Texto
  texto: '#0f1a2e',
  textoFraco: '#5a6a82',
  textoApagado: '#94a3b8',

  // KPIs — barra superior de cada cartão
  barraFaturamento: '#0f2647',
  barraCustos: '#dc2626',
  barraLucro: '#15803d',
  barraRepasse: '#d97706',

  // KPIs — fundo do ícone
  iconeFaturamentoFundo: '#e6f1fb',
  iconeFaturamento: '#0c447c',
  iconeCustosFundo: '#fef2f2',
  iconeCustos: '#dc2626',
  iconeLucroFundo: '#eaf3de',
  iconeLucro: '#27500a',
  iconeRepasseFundo: '#f0fdf4',
  iconeRepasse: '#166534',

  // Destaque do repasse (hero no mobile)
  repasseFundo: '#f0fdf4',
  repasseBorda: '#bbf7d0',
  repasseTexto: '#166534',

  vermelho: '#e5484d',
  alerta: '#b45309',
}

export const FONTES = {
  serifada: 'InstrumentSerif_400Regular',
  regular: 'DMSans_400Regular',
  media: 'DMSans_500Medium',
  semi: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
}

/** Mesmo formato do portal: `formatBRL` gera "1.234,56" e o "R$ " vem separado. */
export function formatBRL(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function moeda(valor: number): string {
  return `R$ ${formatBRL(valor)}`
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

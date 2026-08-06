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

/** Cores por plataforma — iguais às de `components/proprietario/occupancy-panel.tsx`. */
export type ConfigPlataforma = { label: string; bg: string; borda: string; destaque: string; texto: string }

const PLATAFORMAS: Record<string, ConfigPlataforma> = {
  airbnb:    { label: 'Airbnb',      bg: '#fff0f0', borda: '#fcc5ce', destaque: '#e31c5f', texto: '#9f1239' },
  booking:   { label: 'Booking.com', bg: '#dbeafe', borda: '#93c5fd', destaque: '#1d4ed8', texto: '#1e40af' },
  expedia:   { label: 'Expedia',     bg: '#fef3c7', borda: '#fde68a', destaque: '#d97706', texto: '#92400e' },
  alugueasy: { label: 'AlugEasy',    bg: '#e6edf5', borda: '#c3d5e8', destaque: '#193660', texto: '#0f2647' },
}

const PLATAFORMA_PADRAO: ConfigPlataforma = {
  label: 'Outro', bg: '#f1f2f5', borda: '#e7e9ee', destaque: '#64748b', texto: '#475569',
}

export function plataforma(nome: string | null): ConfigPlataforma {
  return PLATAFORMAS[(nome ?? '').toLowerCase().trim()] ?? PLATAFORMA_PADRAO
}

/** "Maria Silva Santos" -> "Maria S." — mesma regra do painel de ocupação. */
export function nomeCurto(bruto: string | null): string {
  const partes = (bruto ?? '').split(' — ')[0].trim().split(' ').filter(Boolean)
  if (!partes.length) return 'Hóspede'
  const primeiro = partes[0].charAt(0).toUpperCase() + partes[0].slice(1).toLowerCase()
  return partes.length > 1 ? `${primeiro} ${partes[partes.length - 1].charAt(0).toUpperCase()}.` : primeiro
}

export function iniciais(bruto: string | null): string {
  const partes = (bruto ?? '').split(' — ')[0].trim().split(' ').filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || 'H'
}

/** Dia do mês a partir de "2026-06-11". */
export function diaDoMes(data: string | null): number | null {
  if (!data) return null
  const n = parseInt(data.split('-')[2] ?? '0')
  return isNaN(n) ? null : n
}

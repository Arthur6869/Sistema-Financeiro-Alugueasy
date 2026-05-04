export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

const _anoAtual = new Date().getFullYear()
export const ANOS = Array.from({ length: 3 }, (_, i) => _anoAtual - 1 + i) // ano anterior, atual, próximo

export const formatCurrency = (value: number, decimals = 2): string =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: decimals })}`

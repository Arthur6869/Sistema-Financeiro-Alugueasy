export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const MESES_ABREV = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
]

export const ANOS = [2024, 2025, 2026, 2027]

export const formatCurrency = (value: number, decimals = 2): string =>
  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: decimals })}`

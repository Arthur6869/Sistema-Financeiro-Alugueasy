/** Paleta do portal do proprietário no sistema web, para o app parecer o mesmo produto. */
export const CORES = {
  azul: '#193660',
  azulClaro: '#2b5490',
  fundo: '#f4f5f7',
  branco: '#ffffff',
  borda: '#e7e9ee',
  texto: '#0f1a2e',
  textoFraco: '#5a6a82',
  textoApagado: '#94a3b8',
  verde: '#0f9960',
  vermelho: '#e5484d',
}

export function moeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

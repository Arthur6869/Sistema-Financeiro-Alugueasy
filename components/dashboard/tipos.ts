// Formatos que app/(dashboard)/page.tsx entrega ao dashboard. Os números já
// chegam calculados pelo servidor — nenhum componente daqui recalcula
// faturamento, custo ou lucro; só agrupa, ordena e filtra para exibir.

export interface EmpreendimentoCard {
  nome: string
  fat: number
  luc: number
}

export interface ApartamentoCard {
  numero: string
  empNome: string
  tipo: string // 'adm' | 'sub'
  fat: number
  custos: number
  luc: number
}

/** De onde veio o faturamento do período (regra em page.tsx). */
export type FonteFaturamento = 'diarias' | 'amenitiz-ao-vivo' | 'amenitiz'

export type FiltroGestao = 'todos' | 'adm' | 'sub'

/** Linha do ranking: o que a página manda + o que se deriva dos apartamentos. */
export interface EmpreendimentoLinha extends EmpreendimentoCard {
  custos: number
  apartamentos: number
}

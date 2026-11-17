// Números ILUSTRATIVOS do extrato de exemplo, usados na landing ("Como
// funciona") e na tela de login do proprietário. Nada aqui vem do banco.
//
// A conta segue a mesma ordem da prestação de contas real
// (components/pdf/prestacao-contas-pdf.tsx):
//   receita − custos = lucro;  lucro − administração AlugEasy = repasse.

export const EXEMPLO = { receita: 8420, custos: 2180, taxaAdm: 15 }

export const lucroExemplo = EXEMPLO.receita - EXEMPLO.custos
export const administracaoExemplo = (lucroExemplo * EXEMPLO.taxaAdm) / 100
export const repasseExemplo = lucroExemplo - administracaoExemplo

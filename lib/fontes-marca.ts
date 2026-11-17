import { Instrument_Serif, Geist_Mono } from 'next/font/google'

// Fontes da identidade pública (landing e telas de login), definidas uma vez
// só: cada chamada do next/font vira uma instância hospedada, então quem
// precisar delas importa daqui em vez de declarar de novo.
//
// Vêm pelo next/font (arquivos servidos do próprio domínio) porque a CSP do
// next.config.ts bloqueia o @import do Google Fonts.

export const serifa = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--lp-serif',
  display: 'swap',
})

export const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--lp-mono',
  display: 'swap',
})

/** Classe que expõe `--lp-serif` e `--lp-mono` para os descendentes. */
export const fontesMarca = `${serifa.variable} ${mono.variable}`

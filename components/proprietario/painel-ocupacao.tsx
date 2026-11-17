'use client'

import { Meter } from '@base-ui/react/meter'
import { ScrollArea } from '@base-ui/react/scroll-area'
import { CalendarDays, MoonStar } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { moeda } from '@/components/dashboard/valor'

export type ReservaOcupacao = {
  booking_id: string
  checkin: string | null
  checkout: string | null
  plataforma_normalizada: string | null
  valor_liquido: number | null
  nome_hospede: string | null
  apartamento_id: string
}

export type AptoOcupacao = {
  id: string
  numero: string
  empreendimento: string | null
  tipo_gestao: 'adm' | 'sub' | null
  /** Taxas de plataforma vigentes no período; `alugueasy` nula em sublocação (não paga) */
  taxas: { booking: number; airbnb: number; alugueasy: number | null }
}

/* Cada plataforma com a própria cor (identidade de marca); o nome vai sempre
   escrito ao lado, então a cor nunca é a única pista. */
type Plataforma = { rotulo: string; fundo: string; borda: string; forte: string; texto: string }
const PLATAFORMAS: Record<string, Plataforma> = {
  airbnb:    { rotulo: 'Airbnb',      fundo: '#fdeef1', borda: '#f7c4cf', forte: '#d11a55', texto: '#9f1239' },
  booking:   { rotulo: 'Booking.com', fundo: '#e7eefc', borda: '#bcd0f5', forte: '#1d4ed8', texto: '#1e3a8a' },
  expedia:   { rotulo: 'Expedia',     fundo: '#fdf3df', borda: '#f5dfa6', forte: '#c27803', texto: '#7c4a03' },
  alugueasy: { rotulo: 'AlugEasy',    fundo: '#e9eef6', borda: '#c6d3e6', forte: '#193660', texto: '#0f2647' },
}
const OUTRA: Plataforma = { rotulo: 'Outra', fundo: '#f1f2f5', borda: '#dfe3ea', forte: '#64748b', texto: '#475569' }
const ORDEM_LEGENDA = ['airbnb', 'booking', 'alugueasy', 'expedia']
const plataforma = (p: string | null) => PLATAFORMAS[(p ?? '').toLowerCase().trim()] ?? OUTRA

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const MES_ABR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// LGPD: primeiro nome + inicial do sobrenome ("Nome Sobrenome — +55…" vira "Nome S.")
function nomeCurto(raw: string | null): string {
  const s = (raw ?? '').split(' — ')[0].trim().split(' ').filter(Boolean)
  if (!s.length) return 'Hóspede'
  const n = s[0].charAt(0).toUpperCase() + s[0].slice(1).toLowerCase()
  return s.length > 1 ? `${n} ${s[s.length - 1].charAt(0).toUpperCase()}.` : n
}
function iniciais(raw: string | null): string {
  const s = (raw ?? '').split(' — ')[0].trim().split(' ').filter(Boolean)
  return ((s[0]?.[0] ?? '') + (s[1]?.[0] ?? '')).toUpperCase() || 'H'
}

// Dia dentro do mês exibido. Data em mês posterior vale totalDias + 1 (saída
// depois do fim do mês — a última noite do mês conta); em mês anterior, 1.
function diaNoMes(d: string | null, mes: number, ano: number, totalDias: number): number | null {
  if (!d) return null
  const [y, m, dia] = d.slice(0, 10).split('-').map(p => parseInt(p))
  if (isNaN(y) || isNaN(m) || isNaN(dia)) return null
  if (y > ano || (y === ano && m > mes)) return totalDias + 1
  if (y < ano || (y === ano && m < mes)) return 1
  return dia
}

// Noites entre duas datas ISO — pela data completa, não pelo dia do mês
function noitesEntre(ci: string | null, co: string | null): number {
  if (!ci || !co) return 0
  const n = Math.round((Date.parse(co.slice(0, 10) + 'T00:00:00Z') - Date.parse(ci.slice(0, 10) + 'T00:00:00Z')) / 86400000)
  return isNaN(n) ? 0 : Math.max(0, n)
}

const fPct = (v: number) => `${(v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
const fDia = (d: string | null) => {
  if (!d) return { d: '?', m: '' }
  const [, mm, dd] = d.split('-')
  return { d: dd ?? '?', m: MES_ABR[parseInt(mm ?? '1') - 1] ?? '' }
}

/**
 * Ocupação do mês, imóvel a imóvel: um calendário com os dias ocupados (cor
 * da plataforma, ponto no dia de entrada), a taxa de ocupação e as reservas
 * do período em cartões.
 */
export function PainelOcupacao({ apartamentos, reservas, mes, ano, nomeMes, sincronizado }: {
  apartamentos: AptoOcupacao[]
  reservas: ReservaOcupacao[]
  mes: number
  ano: number
  nomeMes: string
  sincronizado: boolean
}) {
  const totalDias = mes > 0 ? new Date(ano, mes, 0).getDate() : 30
  const temCalendario = mes > 0
  const primeiroDiaSemana = mes > 0 ? new Date(ano, mes - 1, 1).getDay() : 0
  const totalFat = reservas.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)

  const porApto = new Map<string, ReservaOcupacao[]>()
  for (const r of reservas) porApto.set(r.apartamento_id, [...(porApto.get(r.apartamento_id) ?? []), r])
  const usadas = new Set(reservas.map(r => (r.plataforma_normalizada ?? '').toLowerCase().trim()))
  const legenda = ORDEM_LEGENDA.filter(p => usadas.has(p))

  if (reservas.length === 0) {
    return (
      <section data-entrada aria-labelledby="titulo-ocupacao" className="rounded-2xl border border-linha bg-white p-5">
        <h2 id="titulo-ocupacao" className="flex items-center gap-2 text-[15px] font-semibold text-tinta">
          <CalendarDays size={16} aria-hidden="true" className="text-marca-700" />
          Ocupação de {nomeMes || ano}
        </h2>
        <p className="mt-6 text-center text-sm text-apagado">
          {sincronizado ? 'Nenhuma reserva neste período.' : 'Toque em “Atualizar dados” para buscar as reservas deste mês.'}
        </p>
      </section>
    )
  }

  return (
    <section data-entrada aria-labelledby="titulo-ocupacao" className="overflow-hidden rounded-2xl border border-linha bg-white">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-linha px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h2 id="titulo-ocupacao" className="flex items-center gap-2 text-[15px] font-semibold text-tinta">
            <CalendarDays size={16} aria-hidden="true" className="text-marca-700" />
            Ocupação de {nomeMes || ano}
          </h2>
          <span className="rounded-full bg-marca-50 px-2.5 py-0.5 text-xs font-semibold text-marca-700">
            {reservas.length} {reservas.length === 1 ? 'reserva' : 'reservas'}
          </span>
        </div>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tinta-suave">
          {legenda.map(p => (
            <li key={p} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: PLATAFORMAS[p].forte }} />
              {PLATAFORMAS[p].rotulo}
            </li>
          ))}
        </ul>
        <span className="text-[15px] font-semibold tabular-nums text-tinta">{moeda(totalFat)}</span>
      </div>

      {apartamentos.map((apt, idx) => {
        const doApto = porApto.get(apt.id) ?? []
        if (doApto.length === 0 && apartamentos.length > 1) return null

        // dia → reserva que o ocupa (e se é o dia de entrada)
        const dias: Record<number, { plat: string; hospede: string; entrada: boolean }> = {}
        if (temCalendario) {
          for (const r of doApto) {
            const ci = diaNoMes(r.checkin, mes, ano, totalDias) ?? 1
            const co = diaNoMes(r.checkout, mes, ano, totalDias) ?? (totalDias + 1)
            for (let d = ci; d < co && d <= totalDias; d++) {
              dias[d] = { plat: r.plataforma_normalizada ?? '', hospede: r.nome_hospede ?? '', entrada: d === ci }
            }
          }
        }
        const noites = temCalendario ? Object.keys(dias).length : doApto.reduce((s, r) => s + noitesEntre(r.checkin, r.checkout), 0)
        const pct = temCalendario ? Math.round((noites / totalDias) * 100) : 0
        const fatApto = doApto.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)
        const taxas = [
          { chave: 'booking', nome: 'Booking', pct: apt.taxas.booking },
          { chave: 'airbnb', nome: 'Airbnb', pct: apt.taxas.airbnb },
          ...(apt.taxas.alugueasy === null ? [] : [{ chave: 'alugueasy', nome: 'AlugEasy', pct: apt.taxas.alugueasy }]),
        ]

        return (
          <article key={apt.id} aria-label={`Apartamento ${apt.numero}`} className={cn(idx > 0 && 'border-t-8 border-creme')}>
            {/* cabeçalho do imóvel */}
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-creme/50 px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca-800 text-[13px] font-bold text-white">{apt.numero}</span>
                <div>
                  <p className="text-[15px] font-semibold text-tinta">Apto {apt.numero}</p>
                  {apt.empreendimento && <p className="text-xs text-apagado">{apt.empreendimento}</p>}
                </div>
              </div>
              <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-right">
                {[
                  ['Reservas', String(doApto.length)],
                  ['Noites', String(noites)],
                  ...(temCalendario ? [['Ocupação', `${pct}%`]] : []),
                  ['Faturamento', moeda(fatApto)],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo}>
                    <dt className="font-rotulo text-[10px] font-semibold uppercase tracking-[0.12em] text-apagado">{rotulo}</dt>
                    <dd className="text-sm font-semibold tabular-nums text-tinta">{valor}</dd>
                  </div>
                ))}
                <div>
                  <dt className="font-rotulo text-[10px] font-semibold uppercase tracking-[0.12em] text-apagado">Taxas</dt>
                  <dd className="mt-0.5 flex flex-wrap justify-end gap-1.5">
                    {taxas.map(t => {
                      const c = PLATAFORMAS[t.chave] ?? OUTRA
                      return (
                        <span
                          key={t.chave} title={`Taxa ${c.rotulo}: ${fPct(t.pct)}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                          style={{ background: c.fundo, borderColor: c.borda, color: c.texto }}
                        >
                          <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: c.forte }} />
                          {t.nome} {fPct(t.pct)}
                        </span>
                      )
                    })}
                  </dd>
                </div>
              </dl>
            </div>

            <div className={cn('grid gap-5 p-5', temCalendario && 'md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]')}>
              {/* calendário do mês */}
              {temCalendario && (
                <div>
                  <div className="grid grid-cols-7 gap-1 text-center font-rotulo text-[10px] font-semibold uppercase text-apagado" aria-hidden="true">
                    {DIAS_SEMANA.map((d, i) => <span key={i}>{d}</span>)}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label={`Dias ocupados em ${nomeMes}`}>
                    {Array.from({ length: primeiroDiaSemana }, (_, i) => <span key={`v${i}`} aria-hidden="true" />)}
                    {Array.from({ length: totalDias }, (_, i) => {
                      const d = i + 1
                      const info = dias[d]
                      const c = info ? plataforma(info.plat) : null
                      const descricao = info ? `Dia ${d}: ${plataforma(info.plat).rotulo}, ${nomeCurto(info.hospede)}${info.entrada ? ' (entrada)' : ''}` : `Dia ${d}: livre`
                      return (
                        <Tooltip key={d}>
                          <TooltipTrigger
                            render={<span role="gridcell" tabIndex={0} aria-label={descricao} />}
                            className={cn(
                              'relative grid aspect-square place-items-center rounded-lg border text-xs tabular-nums transition-[filter] hover:brightness-95',
                              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700',
                              !info && 'border-linha/70 bg-creme/60 text-apagado/60',
                            )}
                            style={c ? { background: c.fundo, borderColor: c.borda, color: c.texto, fontWeight: 600 } : undefined}
                          >
                            {d}
                            {info?.entrada && <span aria-hidden="true" className="absolute right-1 top-1 size-1.5 rounded-full" style={{ background: c?.forte }} />}
                          </TooltipTrigger>
                          <TooltipContent>{descricao}</TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>

                  <Meter.Root value={pct} min={0} max={100} aria-label={`Ocupação de ${nomeMes}`} className="mt-3">
                    <div className="flex items-center justify-between text-xs text-apagado">
                      <Meter.Label>Ocupação do mês</Meter.Label>
                      <span className="tabular-nums"><Meter.Value /> · {noites} de {totalDias} noites</span>
                    </div>
                    <Meter.Track className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-creme-escuro">
                      <Meter.Indicator className="h-full rounded-full bg-marca-700 transition-[width] duration-500" />
                    </Meter.Track>
                  </Meter.Root>
                </div>
              )}

              {/* reservas do período */}
              <div className="min-w-0">
                <p className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-tinta-suave">
                  <MoonStar size={14} aria-hidden="true" className="text-apagado" />
                  {doApto.length === 1 ? '1 reserva no período' : `${doApto.length} reservas no período`}
                </p>
                <ScrollArea.Root className="relative">
                  <ScrollArea.Viewport className="overscroll-x-contain pb-3">
                    <ScrollArea.Content className="flex snap-x snap-mandatory gap-3">
                      {doApto.map(r => {
                        const c = plataforma(r.plataforma_normalizada)
                        const n = noitesEntre(r.checkin, r.checkout)
                        const ent = fDia(r.checkin)
                        const sai = fDia(r.checkout)
                        return (
                          <div key={r.booking_id} className="w-[13rem] shrink-0 snap-start overflow-hidden rounded-2xl border bg-white" style={{ borderColor: c.borda }}>
                            <div className="flex items-center justify-between px-3.5 py-2 text-xs font-semibold" style={{ background: c.fundo, color: c.texto }}>
                              <span>{c.rotulo}</span>
                              <span className="rounded-full bg-white/70 px-2 py-0.5 tabular-nums">{n} {n === 1 ? 'noite' : 'noites'}</span>
                            </div>
                            <div className="p-3.5">
                              <div className="flex items-center gap-2.5">
                                <span className="grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: c.forte }}>{iniciais(r.nome_hospede)}</span>
                                <span className="truncate text-sm font-semibold text-tinta">{nomeCurto(r.nome_hospede)}</span>
                              </div>
                              <div className="mt-3.5 flex items-end">
                                <div>
                                  <p className="font-rotulo text-[9px] font-semibold uppercase tracking-[0.12em] text-apagado">Entrada</p>
                                  <p className="text-xl font-semibold leading-none tabular-nums text-tinta">{ent.d}<span className="ml-1 text-xs font-normal text-apagado">{ent.m}</span></p>
                                </div>
                                <span aria-hidden="true" className="mx-2 mb-2 flex flex-1 items-center">
                                  <span className="size-1.5 rounded-full" style={{ background: c.forte }} />
                                  <span className="h-px flex-1 opacity-40" style={{ background: c.forte }} />
                                  <span className="size-1.5 rounded-full" style={{ background: c.forte }} />
                                </span>
                                <div className="text-right">
                                  <p className="font-rotulo text-[9px] font-semibold uppercase tracking-[0.12em] text-apagado">Saída</p>
                                  <p className="text-xl font-semibold leading-none tabular-nums text-tinta">{sai.d}<span className="ml-1 text-xs font-normal text-apagado">{sai.m}</span></p>
                                </div>
                              </div>
                              <p className="mt-3 border-t border-linha pt-2.5 text-right text-[15px] font-semibold tabular-nums text-tinta">{moeda(r.valor_liquido ?? 0)}</p>
                            </div>
                          </div>
                        )
                      })}
                    </ScrollArea.Content>
                  </ScrollArea.Viewport>
                  <ScrollArea.Scrollbar orientation="horizontal" className="flex h-1.5 rounded-full bg-creme-escuro opacity-0 transition-opacity data-hovering:opacity-100 data-scrolling:opacity-100">
                    <ScrollArea.Thumb className="rounded-full bg-apagado/50" />
                  </ScrollArea.Scrollbar>
                </ScrollArea.Root>
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}

'use client'

import { Collapsible } from '@base-ui/react/collapsible'
import { Building2, ChevronDown, CircleAlert, CornerDownRight, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PaginaInterna } from '@/components/painel/pagina'
import { moeda } from '@/components/dashboard/valor'

export type ItemRentabilidade = {
  aptId: string
  numero: string
  empreendimento: string | null
  tipoGestao: 'adm' | 'sub' | null
  faturamento: number
  /** Soma de todos os custos lançados na planilha (exibição) */
  totalCustos: number
  semCustos: boolean
  lucro: number
  /** Taxa AlugEasy do mês (valor) */
  taxa: number
  /** O que fica com o proprietário */
  valorFinal: number
  taxaPct: number
  tipoRepasse: 'lucro' | 'faturamento'
  custosPorCategoria: { categoria: string; valor: number }[]
}

function Linha({ rotulo, valor, tour, negativo, destaque, classeValor }: {
  rotulo: React.ReactNode
  valor: number
  tour?: string
  /** Mostra com sinal de menos (é uma dedução) */
  negativo?: boolean
  destaque?: boolean
  classeValor?: string
}) {
  return (
    <div data-tour={tour} className="flex items-center justify-between gap-4 py-3.5">
      <dt className={cn('text-sm', destaque ? 'font-medium text-tinta' : 'text-tinta-suave')}>{rotulo}</dt>
      <dd className={cn('whitespace-nowrap text-sm tabular-nums', destaque ? 'font-semibold text-tinta' : 'font-medium text-tinta', classeValor)}>
        {negativo ? `− ${moeda(valor)}` : moeda(valor)}
      </dd>
    </div>
  )
}

/**
 * Rentabilidade: a prestação de contas do mês, imóvel a imóvel — faturamento,
 * custos (com cada categoria), lucro, taxa e o que fica com o proprietário.
 * Os números chegam prontos do servidor; aqui só se mostra.
 */
export function Rentabilidade({ labelPeriodo, mes, ano, itens }: {
  labelPeriodo: string
  mes: number
  ano: number
  itens: ItemRentabilidade[]
}) {
  return (
    <PaginaInterna
      estreita
      rotulo="Prestação de contas"
      titulo="Rentabilidade"
      sub={<>Faturamento, custos e repasse de cada imóvel em <strong className="font-semibold text-tinta-suave">{labelPeriodo}</strong></>}
      periodo={{ mes, ano, permitirTodos: 'meses' }}
      tourPeriodo="ext-periodo"
    >
      {itens.length === 0 ? (
        <section data-entrada className="flex flex-col items-center rounded-2xl border border-linha bg-white px-5 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-creme text-apagado"><Building2 size={22} aria-hidden="true" /></span>
          <h2 className="mt-4 font-semibold text-tinta">Nenhum imóvel vinculado à sua conta</h2>
          <p className="mt-1 max-w-md text-sm text-apagado">Assim que a AlugEasy vincular seus imóveis, a rentabilidade de cada um aparece aqui.</p>
        </section>
      ) : (
        itens.map((it, idx) => {
          const primeiro = idx === 0
          const titulo = `Apto ${it.numero}${it.empreendimento ? ` — ${it.empreendimento}` : ''}`
          return (
            <article key={it.aptId} data-entrada aria-label={titulo} className="overflow-hidden rounded-2xl border border-linha bg-white">
              {/* cabeçalho do imóvel */}
              <div data-tour={primeiro ? 'ext-card-head' : undefined} className="flex flex-wrap items-center justify-between gap-3 border-b border-linha px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca-800 text-[13px] font-bold text-white">{it.numero}</span>
                  <h2 className="text-[15px] font-semibold text-tinta">{titulo}</h2>
                </div>
                <span className="rounded-full border border-linha bg-creme px-3 py-1 font-rotulo text-[11px] font-semibold uppercase tracking-wide text-tinta-suave">
                  {it.tipoGestao === 'adm' ? 'Administração' : 'Sublocação'}
                </span>
              </div>

              <dl className="divide-y divide-linha/70 px-5">
                <Linha rotulo="Faturamento" valor={it.faturamento} tour={primeiro ? 'ext-faturamento' : undefined} destaque />

                {/* custos: a linha abre e fecha as categorias */}
                <Collapsible.Root defaultOpen>
                  <div data-tour={primeiro ? 'ext-custos' : undefined}>
                    <Collapsible.Trigger
                      disabled={it.semCustos}
                      className="group flex w-full items-center justify-between gap-4 py-3.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca-700 disabled:cursor-default"
                    >
                      <dt className="flex items-center gap-1.5 text-sm text-tinta-suave">
                        Custos
                        {!it.semCustos && (
                          <>
                            <span className="text-xs text-apagado">({it.custosPorCategoria.length} {it.custosPorCategoria.length === 1 ? 'lançamento' : 'lançamentos'})</span>
                            <ChevronDown size={15} aria-hidden="true" className="text-apagado transition-transform group-data-panel-open:rotate-180" />
                          </>
                        )}
                      </dt>
                      <dd className="whitespace-nowrap text-sm font-medium tabular-nums text-tinta">
                        {it.semCustos ? <span className="font-normal italic text-apagado">não disponível</span> : `− ${moeda(it.totalCustos)}`}
                      </dd>
                    </Collapsible.Trigger>
                    {!it.semCustos && (
                      <Collapsible.Panel className="overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
                        <ul className="mb-3 rounded-xl bg-creme/60 px-3 py-1.5">
                          {it.custosPorCategoria.map((c, i) => (
                            <li key={i} className="flex items-center justify-between gap-4 py-1.5 text-[13px]">
                              <span className="flex items-center gap-1.5 text-tinta-suave"><CornerDownRight size={13} aria-hidden="true" className="text-apagado" />{c.categoria}</span>
                              <span className="tabular-nums text-tinta">{moeda(c.valor)}</span>
                            </li>
                          ))}
                        </ul>
                      </Collapsible.Panel>
                    )}
                    {it.semCustos && (
                      <p className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-900">
                        <CircleAlert size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
                        <span>Os custos deste período ainda não foram lançados. Lucro e repasse são <strong>estimados</strong> e podem mudar quando os custos entrarem.</span>
                      </p>
                    )}
                  </div>
                </Collapsible.Root>

                <Linha rotulo="Lucro" valor={it.lucro} tour={primeiro ? 'ext-lucro' : undefined} destaque classeValor={it.lucro < 0 ? 'text-negativo' : undefined} />
                <Linha
                  rotulo={<>Taxa AlugEasy <span className="text-apagado">({it.taxaPct}% sobre o {it.tipoRepasse === 'lucro' ? 'lucro' : 'faturamento'})</span></>}
                  valor={it.taxa} negativo tour={primeiro ? 'ext-taxa' : undefined}
                />
              </dl>

              {/* o que fica com o proprietário + PDF */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-linha bg-creme/50 px-5 py-4">
                <div data-tour={primeiro ? 'ext-repasse' : undefined}>
                  <p className="flex items-center gap-2 font-rotulo text-[11px] font-semibold uppercase tracking-[0.14em] text-apagado">
                    Seu repasse
                    {it.semCustos && <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-900">Estimado</span>}
                  </p>
                  <p className={cn('mt-1 text-2xl font-semibold tabular-nums tracking-[-0.01em]', it.valorFinal < 0 ? 'text-negativo' : 'text-positivo')}>
                    {moeda(it.valorFinal)}
                  </p>
                </div>
                {mes > 0 && (
                  <a
                    href={`/api/prestacao-contas-pdf?apartamento_id=${it.aptId}&mes=${mes}&ano=${ano}`}
                    target="_blank" rel="noopener noreferrer"
                    data-tour={primeiro ? 'ext-pdf' : undefined}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-marca-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
                  >
                    <Download size={16} aria-hidden="true" />
                    Baixar PDF
                  </a>
                )}
              </div>
            </article>
          )
        })
      )}
    </PaginaInterna>
  )
}

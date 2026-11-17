'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BedDouble, FilterX, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PaginaInterna } from '@/components/painel/pagina'
import { CriarApartamentoModal } from '@/components/modals/criar-apartamento-modal'
import { EditarApartamentoRepasseModal } from '@/components/modals/editar-apartamento-repasse-modal'
import { DeleteButton } from '@/components/shared/delete-button'
import { Cartao, Numero } from '@/components/dashboard/kpis'
import { Segmentado, margemDe, moeda, moedaComSinal, porcento } from '@/components/dashboard/valor'
import { formatCurrency } from '@/lib/constants'
import {
  AlternarVisao, BarrasFatCusto, Lucro, Margem, QuebraGestao, SeloGestao, SeloResultado,
  campoBusca, lucroDe, temMovimento, type Fin, type Visao,
} from './fin'
import { RankingFinanceiro } from './ranking-financeiro'

/** O que o modal de repasse precisa + os totais do período. */
export type ApartamentoItem = {
  id: string
  numero: string
  tipo_gestao: 'adm' | 'sub' | null
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  nome_proprietario: string | null
  modelo_contrato: 'administracao' | 'sublocacao' | null
  fin: Fin | null
}

type Gestao = 'todos' | 'adm' | 'sub'

const GESTAO: { valor: Gestao; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'adm', rotulo: 'ADM' },
  { valor: 'sub', rotulo: 'SUB' },
]

/** Faturamento, custos e lucro de um item — reaproveitado no nível do apartamento. */
export function IndicadoresFin({ fin, periodo }: { fin: Fin; periodo: string }) {
  const lucro = lucroDe(fin)
  const margem = margemDe(fin.fat, lucro)
  return (
    // 3 colunas só a partir de xl — é onde o cartão "linha inteira" volta a ocupar uma coluna
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
      <Cartao
        linhaInteira
        rotulo="Faturamento"
        cor="bg-serie-faturamento"
        numero={<Numero texto={formatCurrency(fin.fat)} max={30} className="text-tinta">{moeda(fin.fat)}</Numero>}
        rodape={periodo}
      />
      <Cartao
        rotulo="Custos"
        cor="bg-serie-custo-reservas"
        numero={<Numero texto={formatCurrency(fin.custos)} max={30} className="text-tinta">{moeda(fin.custos)}</Numero>}
        rodape={fin.fat > 0 ? `${porcento((fin.custos / fin.fat) * 100)} do faturamento` : 'Sem faturamento no período'}
      />
      <Cartao
        rotulo="Lucro líquido"
        cor="bg-serie-lucro"
        selo={<SeloResultado lucro={lucro} />}
        numero={
          <Numero texto={moedaComSinal(lucro)} max={30} className={lucro >= 0 ? 'text-positivo' : 'text-negativo'}>
            {moedaComSinal(lucro)}
          </Numero>
        }
        rodape={margem === null ? 'Sem faturamento no período' : `Margem de ${porcento(margem)}`}
      />
    </div>
  )
}

/** Administração × Sublocação lado a lado, com o total — só quando existem os dois. */
function TabelaGestao({ fin }: { fin: Fin }) {
  const temAdm = fin.fatAdm > 0 || fin.custosAdm > 0
  const temSub = fin.fatSub > 0 || fin.custosSub > 0
  if (!temAdm || !temSub) return null

  const linhas = [
    { nome: 'Administração', tipo: 'adm', fat: fin.fatAdm, custos: fin.custosAdm },
    { nome: 'Sublocação', tipo: 'sub', fat: fin.fatSub, custos: fin.custosSub },
  ]
  return (
    <section data-entrada aria-labelledby="titulo-gestao-emp" className="rounded-2xl border border-linha bg-white">
      <h2 id="titulo-gestao-emp" className="px-5 pt-5 text-[15px] font-semibold text-tinta">Resultado por tipo de gestão</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-linha text-[13px] text-apagado">
              <th scope="col" className="px-3 py-2.5 pl-5 text-left font-medium">Gestão</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Faturamento</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Custos</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Lucro</th>
              <th scope="col" className="px-3 py-2.5 pr-5 text-right font-medium">Margem</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => (
              <tr key={l.tipo} className="border-b border-linha/70">
                <th scope="row" className="px-3 py-3 pl-5 text-left font-medium text-tinta">
                  <span className="inline-flex items-center gap-2">{l.nome} <SeloGestao tipo={l.tipo} /></span>
                </th>
                <td className="px-3 py-3 text-right tabular-nums text-tinta">{moeda(l.fat)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-tinta-suave">{moeda(l.custos)}</td>
                <td className="px-3 py-3 text-right tabular-nums"><Lucro valor={l.fat - l.custos} className="font-semibold" /></td>
                <td className="px-3 py-3 pr-5 text-right tabular-nums text-tinta-suave"><Margem fat={l.fat} lucro={l.fat - l.custos} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-creme/60 text-[13px]">
              <th scope="row" className="px-3 py-3 pl-5 text-left font-semibold text-tinta">Total</th>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-tinta">{moeda(fin.fat)}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-tinta">{moeda(fin.custos)}</td>
              <td className="px-3 py-3 text-right tabular-nums"><Lucro valor={lucroDe(fin)} className="font-semibold" /></td>
              <td className="px-3 py-3 pr-5 text-right font-semibold tabular-nums text-tinta"><Margem fat={fin.fat} lucro={lucroDe(fin)} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

/** Nível 2 da aba: um empreendimento e seus apartamentos. */
export function DetalheEmpreendimento({ mes, ano, periodo, visao, role, emp, fin, apartamentos }: {
  mes: number
  ano: number
  periodo: string
  visao: Visao
  /** Vai inteiro para o modal de repasse, que decide o que cada papel pode fazer */
  role: string
  emp: { id: string; nome: string }
  /** Total do empreendimento (inclui o que veio das reservas Amenitiz) */
  fin: Fin
  apartamentos: ApartamentoItem[]
}) {
  const podeEditar = role === 'analista'
  const [busca, setBusca] = useState('')
  const [gestao, setGestao] = useState<Gestao>('todos')

  const base = `emp=${emp.id}&mes=${mes}&ano=${ano}`
  const hrefDe = (aptId: string) => `/empreendimentos?${base}&apt=${aptId}&view=${visao}`

  const comMovimento = apartamentos.filter(a => temMovimento(a.fin))
  const maior = Math.max(1, ...comMovimento.map(a => Math.max(a.fin!.fat, a.fin!.custos)))
  const temAsDuasGestoes = new Set(apartamentos.map(a => a.tipo_gestao).filter(Boolean)).size > 1

  const termo = busca.trim().toLowerCase()
  const visiveis = useMemo(() => apartamentos.filter(a =>
    (gestao === 'todos' || a.tipo_gestao === gestao) &&
    (!termo || `${a.numero} ${a.nome_proprietario ?? ''}`.toLowerCase().includes(termo))
  ), [apartamentos, gestao, termo])
  const filtroAtivo = !!termo || gestao !== 'todos'

  return (
    <PaginaInterna
      rotulo="Empreendimento"
      titulo={emp.nome}
      sub={`${apartamentos.length} ${apartamentos.length === 1 ? 'apartamento' : 'apartamentos'} · ${periodo}`}
      voltar={{ href: `/empreendimentos?mes=${mes}&ano=${ano}&view=${visao}`, rotulo: 'Todos os empreendimentos' }}
      periodo={{ mes, ano, permitirTodos: false }}
      acoes={podeEditar && <CriarApartamentoModal empreendimentoId={emp.id} empreendimentoNome={emp.nome} />}
    >
      {temMovimento(fin) && (
        <>
          <IndicadoresFin fin={fin} periodo={periodo} />
          <TabelaGestao fin={fin} />
        </>
      )}

      {comMovimento.length > 1 && (
        <RankingFinanceiro
          titulo="Faturamento × custos por apartamento"
          sub={`${comMovimento.length} de ${apartamentos.length} com movimento em ${periodo} · clique para abrir`}
          itens={comMovimento.map(a => ({
            id: a.id, nome: a.numero, detalhe: a.nome_proprietario ?? undefined, href: hrefDe(a.id),
            fat: a.fin!.fat, custos: a.fin!.custos,
          }))}
        />
      )}

      {apartamentos.length === 0 ? (
        <div data-entrada className="flex flex-col items-center rounded-2xl border-2 border-dashed border-linha bg-white px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-creme text-apagado"><BedDouble size={26} aria-hidden="true" /></span>
          <p className="mt-4 font-semibold text-tinta">Nenhum apartamento cadastrado</p>
          {podeEditar && <p className="mt-1 text-sm text-apagado">Use “Criar Apartamento” para adicionar o primeiro.</p>}
        </div>
      ) : (
        <section data-entrada aria-label="Apartamentos" className="rounded-2xl border border-linha bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-linha p-4 sm:p-5">
            <label className="relative min-w-[11rem] flex-1 sm:max-w-xs">
              <span className="sr-only">Buscar por número ou proprietário</span>
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-apagado" />
              <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Número ou proprietário" className={campoBusca} />
            </label>
            {temAsDuasGestoes && <Segmentado rotulo="Tipo de gestão" opcoes={GESTAO} valor={gestao} onMudar={setGestao} />}
            <div className="ml-auto">
              <AlternarVisao visao={visao} hrefDe={v => `/empreendimentos?${base}&view=${v}`} />
            </div>
          </div>

          {visiveis.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-creme text-apagado"><FilterX size={22} aria-hidden="true" /></span>
              <p className="mt-4 font-semibold text-tinta">Nenhum apartamento com esses filtros</p>
              <button
                type="button" onClick={() => { setBusca(''); setGestao('todos') }}
                className="mt-5 h-10 rounded-full bg-marca-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <>
              {/* ── Linhas (a partir do tablet) ── */}
              {visao === 'list' && (
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[860px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-linha text-left text-[13px] text-apagado">
                        <th scope="col" className="px-3 py-2.5 pl-5 font-medium">Apartamento</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">Faturamento</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">Custos</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">Lucro</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-medium">Margem</th>
                        <th scope="col" className="px-3 py-2.5 font-medium">Repasse</th>
                        <th scope="col" className="px-3 py-2.5 pr-5"><span className="sr-only">Ações</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiveis.map(a => (
                        <tr key={a.id} className="group/linha border-b border-linha/70 transition-colors last:border-0 hover:bg-creme/70">
                          <th scope="row" className="px-3 py-3 pl-5 text-left font-normal">
                            <Link href={hrefDe(a.id)} className="inline-flex items-center gap-3 rounded-lg hover:text-marca-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700">
                              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-marca-50 text-marca-700"><BedDouble size={15} aria-hidden="true" /></span>
                              <span>
                                <span className="flex items-center gap-2 font-semibold text-tinta">{a.numero} <SeloGestao tipo={a.tipo_gestao} /></span>
                                {a.nome_proprietario && <span className="block text-xs text-apagado">{a.nome_proprietario}</span>}
                              </span>
                            </Link>
                          </th>
                          {temMovimento(a.fin) ? (
                            <>
                              <td className="px-3 py-3 text-right font-medium tabular-nums text-tinta">{moeda(a.fin.fat)}</td>
                              <td className="px-3 py-3 text-right tabular-nums text-tinta-suave">{moeda(a.fin.custos)}</td>
                              <td className="px-3 py-3 text-right tabular-nums"><Lucro valor={lucroDe(a.fin)} className="font-semibold" /></td>
                              <td className="px-3 py-3 text-right tabular-nums text-tinta-suave"><Margem fat={a.fin.fat} lucro={lucroDe(a.fin)} /></td>
                            </>
                          ) : (
                            <td colSpan={4} className="px-3 py-3 text-right text-[13px] text-apagado/70">Sem movimento no período</td>
                          )}
                          <td className="px-3 py-3"><EditarApartamentoRepasseModal apartamento={a} role={role} /></td>
                          <td className="px-3 py-3 pr-5 text-right">
                            {podeEditar && (
                              <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/linha:opacity-100 [@media(hover:none)]:opacity-100">
                                <DeleteButton table="apartamentos" id={a.id} label={`Apartamento ${a.numero}`} />
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Cards (sempre no celular) ── */}
              <ul className={cn('grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 2xl:grid-cols-4', visao === 'list' && 'md:hidden')}>
                {visiveis.map(a => (
                  <li key={a.id} className="group/cartao relative flex flex-col rounded-2xl border border-linha bg-white p-4 transition-[border-color,box-shadow,translate] duration-300 hover:-translate-y-0.5 hover:border-marca-700/30 hover:shadow-[0_18px_40px_-24px_rgba(15,38,71,0.35)]">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-marca-50 text-marca-700"><BedDouble size={16} aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1">
                        <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-tinta">
                          <Link href={hrefDe(a.id)} className="rounded-sm after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-marca-700">
                            {a.numero}
                          </Link>
                          <SeloGestao tipo={a.tipo_gestao} />
                        </h3>
                        {a.nome_proprietario && <p className="mt-0.5 truncate text-[13px] text-apagado">{a.nome_proprietario}</p>}
                      </div>
                      {temMovimento(a.fin) && <SeloResultado lucro={lucroDe(a.fin)} />}
                    </div>

                    {temMovimento(a.fin) ? (
                      <>
                        <div className="mt-4 flex items-baseline justify-between gap-3">
                          <Lucro valor={lucroDe(a.fin)} className="text-xl font-semibold leading-none tracking-[-0.02em] tabular-nums" />
                          {margemDe(a.fin.fat, lucroDe(a.fin)) !== null && (
                            <span className="text-[13px] text-apagado">margem <Margem fat={a.fin.fat} lucro={lucroDe(a.fin)} /></span>
                          )}
                        </div>
                        <BarrasFatCusto fat={a.fin.fat} custos={a.fin.custos} maior={maior} className="mt-3" />
                        <dl className="mt-2.5 space-y-0.5 text-[13px] tabular-nums">
                          <div className="flex justify-between gap-3"><dt className="text-apagado">Faturamento</dt><dd className="font-medium text-tinta">{moeda(a.fin.fat)}</dd></div>
                          <div className="flex justify-between gap-3"><dt className="text-apagado">Custos</dt><dd className="text-tinta-suave">{moeda(a.fin.custos)}</dd></div>
                        </dl>
                        <div className="mt-3"><QuebraGestao fin={a.fin} /></div>
                      </>
                    ) : (
                      <p className="mt-4 text-[13px] text-apagado/80">Sem movimento em {periodo}</p>
                    )}

                    {/* repasse e exclusão ficam por cima do link que cobre o cartão */}
                    <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t border-linha pt-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-apagado">Repasse</p>
                        <EditarApartamentoRepasseModal apartamento={a} role={role} />
                      </div>
                      {podeEditar && (
                        <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/cartao:opacity-100 [@media(hover:none)]:opacity-100">
                          <DeleteButton table="apartamentos" id={a.id} label={`Apartamento ${a.numero}`} />
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {filtroAtivo && (
                <p className="border-t border-linha px-5 py-3 text-center text-[13px] text-apagado" aria-live="polite">
                  {visiveis.length} de {apartamentos.length} apartamentos
                </p>
              )}
            </>
          )}
        </section>
      )}
    </PaginaInterna>
  )
}

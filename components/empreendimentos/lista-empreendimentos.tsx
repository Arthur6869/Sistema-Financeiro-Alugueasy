'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { BedDouble, Building2, ChevronDown, FileBarChart, FilterX, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PaginaInterna } from '@/components/painel/pagina'
import { CriarEmpreendimentoModal } from '@/components/modals/criar-empreendimento-modal'
import { DeleteButton } from '@/components/shared/delete-button'
import { margemDe, moeda } from '@/components/dashboard/valor'
import {
  AlternarVisao, BarrasFatCusto, Lucro, Margem, QuebraGestao, SeloResultado,
  botaoSecundario, campoBusca, lucroDe, temMovimento, type Fin, type Visao,
} from './fin'
import { RankingFinanceiro } from './ranking-financeiro'

export type EmpreendimentoItem = {
  id: string
  nome: string
  apartamentos: number
  fin: Fin | null
}

type Situacao = 'todos' | 'lucro' | 'prejuizo' | 'sem-movimento'
type Ordem = 'nome' | 'fat' | 'luc-desc' | 'luc-asc'

const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'nome', rotulo: 'Nome (A–Z)' },
  { valor: 'fat', rotulo: 'Maior faturamento' },
  { valor: 'luc-desc', rotulo: 'Maior lucro' },
  { valor: 'luc-asc', rotulo: 'Menor lucro' },
]

const aptos = (n: number) => `${n} ${n === 1 ? 'apartamento' : 'apartamentos'}`

const situacaoDe = (e: EmpreendimentoItem): Exclude<Situacao, 'todos'> =>
  !temMovimento(e.fin) ? 'sem-movimento' : lucroDe(e.fin) >= 0 ? 'lucro' : 'prejuizo'

/** Nível 1 da aba: todos os empreendimentos no período. */
export function ListaEmpreendimentos({ mes, ano, periodo, visao, podeEditar, empreendimentos }: {
  mes: number
  ano: number
  /** "Setembro 2026" */
  periodo: string
  visao: Visao
  /** Analista cria e exclui; admin só consulta */
  podeEditar: boolean
  empreendimentos: EmpreendimentoItem[]
}) {
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<Situacao>('todos')
  const [ordem, setOrdem] = useState<Ordem>('nome')

  const base = `mes=${mes}&ano=${ano}`
  const hrefDe = (id: string) => `/empreendimentos?emp=${id}&${base}&view=${visao}`

  const contagem = useMemo(() => {
    const c = { lucro: 0, prejuizo: 0, 'sem-movimento': 0 }
    empreendimentos.forEach(e => { c[situacaoDe(e)] += 1 })
    return c
  }, [empreendimentos])

  const comMovimento = empreendimentos.filter(e => temMovimento(e.fin))
  const maior = Math.max(1, ...comMovimento.map(e => Math.max(e.fin!.fat, e.fin!.custos)))

  const termo = busca.trim().toLowerCase()
  const visiveis = useMemo(() => {
    const valor = (e: EmpreendimentoItem) =>
      !temMovimento(e.fin) ? -Infinity : ordem === 'fat' ? e.fin.fat : lucroDe(e.fin)
    return empreendimentos
      .filter(e => (situacao === 'todos' || situacaoDe(e) === situacao) && (!termo || e.nome.toLowerCase().includes(termo)))
      .sort((a, b) => {
        if (ordem === 'nome') return a.nome.localeCompare(b.nome)
        // quem não teve movimento vai sempre para o fim, em qualquer direção
        const [va, vb] = [valor(a), valor(b)]
        if (va === -Infinity || vb === -Infinity) return (vb === -Infinity ? 0 : 1) - (va === -Infinity ? 0 : 1) || a.nome.localeCompare(b.nome)
        return (ordem === 'luc-asc' ? va - vb : vb - va) || a.nome.localeCompare(b.nome)
      })
  }, [empreendimentos, situacao, termo, ordem])

  const filtroAtivo = !!termo || situacao !== 'todos'
  const recortes = ([
    { valor: 'lucro', rotulo: 'Com lucro' },
    { valor: 'prejuizo', rotulo: 'Com prejuízo' },
    { valor: 'sem-movimento', rotulo: 'Sem movimento' },
  ] as const).filter(r => contagem[r.valor] > 0)

  function limpar() { setBusca(''); setSituacao('todos') }

  return (
    <PaginaInterna
      rotulo="Portfólio"
      titulo="Empreendimentos"
      sub={`${empreendimentos.length} ${empreendimentos.length === 1 ? 'empreendimento' : 'empreendimentos'} · ${periodo}`}
      periodo={{ mes, ano, permitirTodos: false }}
      acoes={
        <>
          <Link href={`/relatorio-desempenho?${base}`} className={botaoSecundario}>
            <FileBarChart size={16} aria-hidden="true" />
            Relatório de Desempenho
          </Link>
          {podeEditar && <CriarEmpreendimentoModal />}
        </>
      }
    >
      {empreendimentos.length === 0 ? (
        <div data-entrada className="flex flex-col items-center rounded-2xl border-2 border-dashed border-linha bg-white px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-creme text-apagado"><Building2 size={26} aria-hidden="true" /></span>
          <p className="mt-4 font-semibold text-tinta">Nenhum empreendimento cadastrado</p>
          <p className="mt-1 text-sm text-apagado">Importe uma planilha para popular os dados.</p>
        </div>
      ) : (
        <>
          <RankingFinanceiro
            titulo="Faturamento × custos por empreendimento"
            sub={`${comMovimento.length} de ${empreendimentos.length} com movimento em ${periodo} · clique para abrir`}
            itens={comMovimento.map(e => ({
              id: e.id, nome: e.nome, detalhe: aptos(e.apartamentos), href: hrefDe(e.id),
              fat: e.fin!.fat, custos: e.fin!.custos,
            }))}
          />

          <section data-entrada aria-label="Todos os empreendimentos" className="rounded-2xl border border-linha bg-white">
            {/* filtros numa linha só, acima do que eles recortam */}
            <div className="flex flex-wrap items-center gap-2 border-b border-linha p-4 sm:p-5">
              <label className="relative min-w-[11rem] flex-1 sm:max-w-xs">
                <span className="sr-only">Buscar empreendimento</span>
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-apagado" />
                <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar empreendimento" className={campoBusca} />
              </label>

              <div role="group" aria-label="Situação no período" className="flex flex-wrap gap-2">
                {recortes.map(r => {
                  const ativo = situacao === r.valor
                  return (
                    <button
                      key={r.valor} type="button" aria-pressed={ativo}
                      onClick={() => setSituacao(ativo ? 'todos' : r.valor)}
                      className={cn(
                        'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700',
                        ativo ? 'border-marca-800 bg-marca-800 text-white' : 'border-linha bg-white text-tinta-suave hover:bg-creme',
                      )}
                    >
                      {r.rotulo}
                      <span className={cn('tabular-nums', ativo ? 'text-white/70' : 'text-apagado')}>{contagem[r.valor]}</span>
                    </button>
                  )
                })}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <label className="relative">
                  <span className="sr-only">Ordenar por</span>
                  <select
                    value={ordem} onChange={e => setOrdem(e.target.value as Ordem)}
                    className="h-10 cursor-pointer appearance-none rounded-full border border-linha bg-white pl-4 pr-9 text-sm text-tinta transition-colors hover:border-[#cfc8b6] focus-visible:border-marca-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-700/15"
                  >
                    {ORDENS.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
                  </select>
                  <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-apagado" />
                </label>
                <AlternarVisao visao={visao} hrefDe={v => `/empreendimentos?${base}&view=${v}`} />
              </div>
            </div>

            {visiveis.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-14 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-creme text-apagado"><FilterX size={22} aria-hidden="true" /></span>
                <p className="mt-4 font-semibold text-tinta">Nenhum empreendimento com esses filtros</p>
                <button
                  type="button" onClick={limpar}
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
                    <table className="w-full min-w-[720px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-linha text-left text-[13px] text-apagado">
                          <th scope="col" className="px-3 py-2.5 pl-5 font-medium">Empreendimento</th>
                          <th scope="col" className="px-3 py-2.5 text-right font-medium">Aptos</th>
                          <th scope="col" className="px-3 py-2.5 text-right font-medium">Faturamento</th>
                          <th scope="col" className="px-3 py-2.5 text-right font-medium">Custos</th>
                          <th scope="col" className="px-3 py-2.5 text-right font-medium">Lucro</th>
                          <th scope="col" className="px-3 py-2.5 text-right font-medium">Margem</th>
                          <th scope="col" className="px-3 py-2.5 pr-5"><span className="sr-only">Ações</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visiveis.map(e => (
                          <tr key={e.id} className="group/linha border-b border-linha/70 transition-colors last:border-0 hover:bg-creme/70">
                            <th scope="row" className="px-3 py-3 pl-5 text-left font-normal">
                              <Link href={hrefDe(e.id)} className="inline-flex items-center gap-3 rounded-lg font-semibold text-tinta hover:text-marca-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700">
                                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-marca-800 text-white"><Building2 size={15} aria-hidden="true" /></span>
                                {e.nome}
                              </Link>
                            </th>
                            <td className="px-3 py-3 text-right tabular-nums text-tinta-suave">{e.apartamentos}</td>
                            {temMovimento(e.fin) ? (
                              <>
                                <td className="px-3 py-3 text-right font-medium tabular-nums text-tinta">{moeda(e.fin.fat)}</td>
                                <td className="px-3 py-3 text-right tabular-nums text-tinta-suave">{moeda(e.fin.custos)}</td>
                                <td className="px-3 py-3 text-right tabular-nums"><Lucro valor={lucroDe(e.fin)} className="font-semibold" /></td>
                                <td className="px-3 py-3 text-right tabular-nums text-tinta-suave"><Margem fat={e.fin.fat} lucro={lucroDe(e.fin)} /></td>
                              </>
                            ) : (
                              <td colSpan={4} className="px-3 py-3 text-right text-[13px] text-apagado/70">Sem movimento no período</td>
                            )}
                            <td className="px-3 py-3 pr-5 text-right">
                              {podeEditar && (
                                <span className="opacity-0 transition-opacity focus-within:opacity-100 group-hover/linha:opacity-100 [@media(hover:none)]:opacity-100">
                                  <DeleteButton table="empreendimentos" id={e.id} label={e.nome} />
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
                <ul className={cn('grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3', visao === 'list' && 'md:hidden')}>
                  {visiveis.map(e => (
                    <li key={e.id} className="group/cartao relative flex flex-col rounded-2xl border border-linha bg-white p-5 transition-[border-color,box-shadow,translate] duration-300 hover:-translate-y-0.5 hover:border-marca-700/30 hover:shadow-[0_18px_40px_-24px_rgba(15,38,71,0.35)]">
                      <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca-800 text-white"><Building2 size={18} aria-hidden="true" /></span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-base font-semibold text-tinta">
                            {/* o link cobre o cartão inteiro; as ações ficam por cima (z-10) */}
                            <Link href={hrefDe(e.id)} className="rounded-sm after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-marca-700">
                              {e.nome}
                            </Link>
                          </h3>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-apagado">
                            <BedDouble size={13} aria-hidden="true" />
                            {aptos(e.apartamentos)}
                          </p>
                        </div>
                        {temMovimento(e.fin) && <SeloResultado lucro={lucroDe(e.fin)} />}
                        {podeEditar && (
                          // por cima do link que cobre o cartão; aparece no hover/foco (sempre, em telas de toque)
                          <span className="relative z-10 -mr-1.5 -mt-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/cartao:opacity-100 [@media(hover:none)]:opacity-100">
                            <DeleteButton table="empreendimentos" id={e.id} label={e.nome} />
                          </span>
                        )}
                      </div>

                      {temMovimento(e.fin) ? (
                        <>
                          <div className="mt-4 flex items-baseline justify-between gap-3">
                            <Lucro valor={lucroDe(e.fin)} className="text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums" />
                            {margemDe(e.fin.fat, lucroDe(e.fin)) !== null && (
                              <span className="text-[13px] text-apagado">margem <Margem fat={e.fin.fat} lucro={lucroDe(e.fin)} /></span>
                            )}
                          </div>
                          <BarrasFatCusto fat={e.fin.fat} custos={e.fin.custos} maior={maior} className="mt-3" />
                          <dl className="mt-2.5 space-y-0.5 text-[13px] tabular-nums">
                            <div className="flex justify-between gap-3"><dt className="text-apagado">Faturamento</dt><dd className="font-medium text-tinta">{moeda(e.fin.fat)}</dd></div>
                            <div className="flex justify-between gap-3"><dt className="text-apagado">Custos</dt><dd className="text-tinta-suave">{moeda(e.fin.custos)}</dd></div>
                          </dl>
                          <div className="mt-auto pt-3"><QuebraGestao fin={e.fin} /></div>
                        </>
                      ) : (
                        <p className="mt-4 text-[13px] text-apagado/80">Sem movimento em {periodo}</p>
                      )}

                    </li>
                  ))}
                </ul>

                {filtroAtivo && (
                  <p className="border-t border-linha px-5 py-3 text-center text-[13px] text-apagado" aria-live="polite">
                    {visiveis.length} de {empreendimentos.length} empreendimentos ·{' '}
                    <button type="button" onClick={limpar} className="font-semibold text-marca-700 underline underline-offset-2">Limpar filtros</button>
                  </p>
                )}
              </>
            )}
          </section>
        </>
      )}
    </PaginaInterna>
  )
}

'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarClock, CircleAlert, FileText, History, Receipt, TrendingDown, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { PaginaInterna } from '@/components/painel/pagina'
import { Cartao, Numero } from '@/components/dashboard/kpis'
import { NumeroAnimado, moeda, porcento } from '@/components/dashboard/valor'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EvolucaoRepasse, type PontoEvolucao } from './evolucao-repasse'

export type KpisProprietario = {
  faturamento: number
  custos: number
  lucro: number
  taxaAlugEasy: number
  repasse: number
  margem: number
}

/**
 * Início do portal do proprietário. Os números chegam prontos do servidor
 * (`app/(proprietario)/proprietario/page.tsx`); aqui só se mostra.
 *
 * A ordem segue o que o proprietário quer saber: quanto recebe, de onde veio,
 * como anda nos últimos meses, quem está hospedado.
 */
export function InicioProprietario({
  primeiroNome, mes, ano, labelPeriodo, isMesCorrente, kpis, rotuloTaxa, semCategoriasConfiguradas,
  semDados, mesSincronizado, historico, mesesComDados, acoes, ocupacao,
}: {
  primeiroNome: string
  mes: number
  ano: number
  labelPeriodo: string
  isMesCorrente: boolean
  kpis: KpisProprietario
  /** "15% sobre o lucro"; '' quando a carteira não tem taxa */
  rotuloTaxa: string
  semCategoriasConfiguradas: boolean
  semDados: boolean
  mesSincronizado: boolean
  historico: PontoEvolucao[]
  mesesComDados: number
  /** Botão de atualizar + selo "atualizado há X min" */
  acoes?: ReactNode
  /** Painel de ocupação (montado no servidor) */
  ocupacao?: ReactNode
}) {
  const temHistorico = mesesComDados >= 2
  const temTaxa = rotuloTaxa !== ''

  // "Para onde foi o faturamento": custos → taxa → repasse. Só faz sentido com
  // faturamento e sem prejuízo (aí não existe fatia de repasse).
  const partes = [
    { nome: 'Custos do imóvel', valor: kpis.custos, cor: 'bg-serie-custo-reservas', texto: 'text-[#0b0b0b]' },
    ...(temTaxa ? [{ nome: 'Taxa AlugEasy', valor: kpis.taxaAlugEasy, cor: 'bg-tinta-suave', texto: 'text-white' }] : []),
    { nome: 'Seu repasse', valor: kpis.repasse, cor: 'bg-serie-lucro', texto: 'text-white' },
  ].filter(p => p.valor > 0)
  const mostrarComposicao = !semDados && kpis.faturamento > 0 && kpis.repasse >= 0 && partes.length >= 2
  const fatia = (v: number) => Math.round((v / kpis.faturamento) * 100)

  return (
    <PaginaInterna
      estreita
      rotulo="Portal do proprietário"
      titulo={<>Olá, {primeiroNome}</>}
      sub={<>Resumo dos seus imóveis em <strong className="font-semibold text-tinta-suave">{labelPeriodo}</strong>{isMesCorrente && ' · números ao vivo'}</>}
      periodo={{ mes, ano, permitirTodos: 'meses' }}
      tourPeriodo="periodo"
      acoes={acoes}
    >
      {/* alvo do portal React: RealtimeReservas injeta aqui a seção "Chegaram agora" */}
      <div id="novas-reservas-portal" />

      {semDados ? (
        <section data-entrada className="flex flex-col items-center rounded-2xl border border-linha bg-white px-5 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-creme text-apagado"><CalendarClock size={22} aria-hidden="true" /></span>
          <h2 className="mt-4 font-semibold text-tinta">
            {mesSincronizado ? `Nenhuma diária em ${labelPeriodo}` : `Os dados de ${labelPeriodo} ainda não chegaram`}
          </h2>
          <p className="mt-1 max-w-md text-sm text-apagado">
            {mesSincronizado
              ? 'A sincronização foi feita, mas seus imóveis não registraram receita neste período.'
              : 'A planilha do mês ainda não foi importada e as reservas ainda não foram sincronizadas. Use “Atualizar dados” ou volte mais tarde.'}
          </p>
        </section>
      ) : (
        <>
          {/* ── o mês em quatro (ou cinco) números ── */}
          <div
            data-tour="kpis"
            className={cn(
              'grid grid-cols-2 gap-3 sm:gap-4',
              temTaxa ? 'xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]' : 'xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]',
            )}
          >
            <article
              data-entrada data-tour="repasse"
              className="relative isolate col-span-2 flex flex-col overflow-hidden rounded-2xl bg-marca-800 p-5 text-white sm:p-6 xl:col-span-1"
            >
              <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_100%_0%,rgba(74,222,128,0.28),transparent_70%)]" />
              <h2 className="flex items-center gap-2 text-[13px] font-medium text-white/70">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px] bg-serie-lucro ring-1 ring-white/50" />
                Seu repasse
              </h2>
              <div className="mt-4">
                <Numero texto={formatCurrency(kpis.repasse)} max={48}>
                  <NumeroAnimado valor={kpis.repasse} formatar={moeda} />
                </Numero>
              </div>
              <p className="mt-auto flex flex-col gap-1 pt-5 text-[13px] text-white/65">
                <span>Valor líquido para você em {labelPeriodo}</span>
                {temTaxa && <span>Já descontada a taxa AlugEasy ({rotuloTaxa})</span>}
              </p>
            </article>

            <Cartao
              rotulo="Faturamento"
              cor="bg-serie-faturamento"
              numero={
                <Numero texto={formatCurrency(kpis.faturamento)} max={28} className="text-tinta">
                  <NumeroAnimado valor={kpis.faturamento} formatar={moeda} />
                </Numero>
              }
              rodape={isMesCorrente ? 'Receita das hospedagens · ao vivo' : 'Receita das hospedagens no período'}
            />

            <Cartao
              rotulo="Custos"
              cor="bg-serie-custo-reservas"
              numero={
                <Numero texto={formatCurrency(kpis.custos)} max={28} className="text-tinta">
                  <NumeroAnimado valor={kpis.custos} formatar={moeda} />
                </Numero>
              }
              rodape={semCategoriasConfiguradas
                ? <span className="inline-flex items-center gap-1 text-amber-800"><CircleAlert size={13} aria-hidden="true" />Categorias de custo ainda não configuradas</span>
                : kpis.faturamento > 0 ? `${porcento((kpis.custos / kpis.faturamento) * 100)} do faturamento` : 'Despesas do imóvel no período'}
            />

            {temTaxa && (
              <Cartao
                rotulo="Taxa AlugEasy"
                cor="bg-tinta-suave"
                numero={
                  <Numero texto={`− ${formatCurrency(kpis.taxaAlugEasy)}`} max={28} className="text-tinta-suave">
                    − <NumeroAnimado valor={kpis.taxaAlugEasy} formatar={moeda} />
                  </Numero>
                }
                rodape={rotuloTaxa}
              />
            )}

            <Cartao
              linhaInteira={!temTaxa}
              rotulo="Lucro"
              cor="bg-serie-lucro"
              selo={
                <span className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
                  kpis.lucro >= 0 ? 'bg-positivo/10 text-positivo' : 'bg-negativo/10 text-negativo',
                )}>
                  {kpis.lucro >= 0 ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
                  {kpis.lucro >= 0 ? 'Lucro' : 'Prejuízo'}
                </span>
              }
              numero={
                <Numero texto={formatCurrency(kpis.lucro)} max={28} className={kpis.lucro >= 0 ? 'text-tinta' : 'text-negativo'}>
                  <NumeroAnimado valor={kpis.lucro} formatar={moeda} />
                </Numero>
              }
              rodape={`Faturamento menos custos · margem de ${porcento(kpis.margem)}`}
            />
          </div>

          {/* ── para onde foi o faturamento ── */}
          {mostrarComposicao && (
            <section data-entrada aria-labelledby="titulo-composicao" className="rounded-2xl border border-linha bg-white p-5">
              <h2 id="titulo-composicao" className="text-[15px] font-semibold text-tinta">Para onde foi o faturamento</h2>
              <p className="mt-0.5 text-[13px] text-apagado">De cada R$ 100 faturados, quanto saiu em custos{temTaxa ? ', quanto foi taxa' : ''} e quanto ficou com você</p>
              <div role="group" aria-label={partes.map(p => `${p.nome}: ${fatia(p.valor)}%`).join(', ')} className="mt-4 flex h-7 gap-0.5">
                {partes.map(p => (
                  <Tooltip key={p.nome}>
                    <TooltipTrigger
                      render={<button type="button" data-barra style={{ flexGrow: p.valor }} aria-label={`${p.nome}: ${moeda(p.valor)}, ${fatia(p.valor)}%`} />}
                      className={cn('@container flex min-w-1.5 basis-0 origin-left items-center overflow-hidden rounded-[4px] transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700', p.cor)}
                    >
                      <span className={cn('hidden pl-2.5 text-xs font-semibold @[52px]:inline', p.texto)}>{fatia(p.valor)}%</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <span className="font-semibold">{moeda(p.valor)}</span>
                      <span className="opacity-75">{p.nome} · {fatia(p.valor)}%</span>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-tinta-suave">
                {partes.map(p => (
                  <li key={p.nome} className="flex items-center gap-2"><span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', p.cor)} />{p.nome}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* ── como anda: últimos 6 meses ── */}
      <section data-entrada data-tour="evolucao" aria-labelledby="titulo-evolucao" className="rounded-2xl border border-linha bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="titulo-evolucao" className="text-[15px] font-semibold text-tinta">Últimos 6 meses</h2>
          <p className="text-[13px] text-apagado">Faturamento e o que ficou com você, mês a mês</p>
        </div>
        {temHistorico ? (
          <div className="mt-4"><EvolucaoRepasse dados={historico} /></div>
        ) : (
          <div className="flex flex-col items-center px-5 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-creme text-apagado"><History size={22} aria-hidden="true" /></span>
            <p className="mt-4 font-semibold text-tinta">Histórico em construção</p>
            <p className="mt-1 max-w-xs text-sm text-apagado">O gráfico aparece depois de dois meses de operação. Por enquanto: {mesesComDados} de 2.</p>
            <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-creme-escuro" aria-hidden="true">
              <div className="h-full rounded-full bg-marca-700" style={{ width: `${Math.min(100, mesesComDados * 50)}%` }} />
            </div>
          </div>
        )}
      </section>

      {/* ── quem está hospedado ── */}
      {ocupacao && <div data-tour="ocupacao">{ocupacao}</div>}

      {/* ── atalhos ── */}
      <section data-entrada data-tour="atalhos" aria-labelledby="titulo-atalhos" className="rounded-2xl border border-linha bg-white p-5">
        <h2 id="titulo-atalhos" className="text-[15px] font-semibold text-tinta">Acesso rápido</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { href: `/proprietario/extrato?mes=${mes}&ano=${ano}`, icone: Receipt, titulo: 'Rentabilidade do mês', desc: 'Faturamento, custos e repasse de cada imóvel' },
            { href: `/proprietario/extrato?mes=${mes}&ano=${ano}`, icone: FileText, titulo: 'Prestação de contas em PDF', desc: 'Baixe o demonstrativo do mês' },
            { href: '/proprietario/historico', icone: History, titulo: 'Histórico', desc: 'Os últimos 12 meses em um lugar só' },
          ].map(a => (
            <Link
              key={a.titulo} href={a.href}
              className="group flex items-start gap-3 rounded-2xl border border-linha p-4 transition-colors hover:border-marca-700/40 hover:bg-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marca-50 text-marca-700"><a.icone size={18} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-tinta">{a.titulo}</span>
                <span className="block text-xs text-apagado">{a.desc}</span>
              </span>
              <ArrowRight size={16} aria-hidden="true" className="mt-1 shrink-0 text-apagado transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </PaginaInterna>
  )
}

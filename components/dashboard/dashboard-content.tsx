'use client'

import { useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Eye, EyeOff, Info, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LimparDadosButton } from '@/components/shared/limpar-dados-button'
import { Composicao, Indicadores } from './kpis'
import { PeriodoNav } from './periodo-nav'
import { PorGestao } from './por-gestao'
import { RankingEmpreendimentos } from './ranking-empreendimentos'
import { TabelaApartamentos } from './tabela-apartamentos'
import { CensuraProvider, semMovimento } from './valor'
import type { ApartamentoCard, EmpreendimentoCard, EmpreendimentoLinha, FiltroGestao, FonteFaturamento } from './tipos'

gsap.registerPlugin(useGSAP)

interface DashboardContentProps {
  mes: number
  ano: number
  anoMesLabel: string
  fonteFaturamento: FonteFaturamento
  faturamentoTotal: number
  custosReservas: number
  custosOperacionais: number
  lucroTotal: number
  margemPct: number
  hasData: boolean
  qtdEmpreendimentos: number
  empreendimentoCards: EmpreendimentoCard[]
  apartamentoCards: ApartamentoCard[]
  /** Analista opera o sistema; admin só lê — sem ações destrutivas nem atalhos de importação */
  podeEditar: boolean
  /** Painel de pendências, já renderizado no servidor */
  avisos?: ReactNode
}

const LIMPAR = 'transform,translate,rotate,scale,opacity'

/**
 * Dashboard da área interna. Recebe os números prontos de
 * app/(dashboard)/page.tsx e cuida só de como eles são vistos: período,
 * ocultar valores, filtros cruzados entre gráficos e tabela, animação.
 */
export function DashboardContent({
  mes, ano, anoMesLabel, fonteFaturamento,
  faturamentoTotal, custosReservas, custosOperacionais, lucroTotal, margemPct,
  hasData, qtdEmpreendimentos, empreendimentoCards, apartamentoCards, podeEditar, avisos,
}: DashboardContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const raiz = useRef<HTMLDivElement>(null)

  const [censurado, setCensurado] = useState(false)
  const [empreendimento, setEmpreendimento] = useState<string | null>(null)
  const [gestao, setGestao] = useState<FiltroGestao>('todos')
  // Trocar de período busca dados novos no servidor: enquanto chegam, a tela
  // antiga fica esmaecida no lugar — sem piscar nem pular de layout.
  const [pendente, iniciarTransicao] = useTransition()

  function irPara(novoMes: number, novoAno: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', String(novoMes))
    params.set('ano', String(novoAno))
    iniciarTransicao(() => router.push(`${pathname}?${params.toString()}`))
  }

  // A página manda faturamento e lucro por empreendimento; custo e contagem
  // de apartamentos saem do que já veio — nenhum número novo é calculado.
  const linhas: EmpreendimentoLinha[] = useMemo(() => {
    const porEmp = new Map<string, number>()
    apartamentoCards.forEach(a => porEmp.set(a.empNome, (porEmp.get(a.empNome) ?? 0) + 1))
    return empreendimentoCards.map(e => ({ ...e, custos: e.fat - e.luc, apartamentos: porEmp.get(e.nome) ?? 0 }))
  }, [empreendimentoCards, apartamentoCards])

  const nomesEmpreendimentos = useMemo(
    () => [...new Set(apartamentoCards.map(a => a.empNome))].sort((a, b) => a.localeCompare(b)),
    [apartamentoCards],
  )
  // Um filtro escolhido num mês pode não existir no seguinte
  const empAtivo = empreendimento && nomesEmpreendimentos.includes(empreendimento) ? empreendimento : null

  // Entrada: uma vez só. `opacity` (não autoAlpha) para nada ficar sem foco/clique.
  useGSAP(() => {
    if (semMovimento()) return
    gsap.from('[data-entrada]', {
      y: 14, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.05, clearProps: LIMPAR,
    })
  }, { scope: raiz })

  // Barras crescem a partir da base na entrada e a cada troca de período
  useGSAP(() => {
    const barras = raiz.current?.querySelectorAll('[data-barra]')
    if (!barras?.length || semMovimento()) return
    gsap.from(barras, {
      scaleX: 0, duration: 0.8, ease: 'power3.out', stagger: 0.012, clearProps: LIMPAR,
    })
  }, { scope: raiz, dependencies: [mes, ano] })

  const semCustosLancados = hasData && custosReservas === 0 && faturamentoTotal > 0

  return (
    <CensuraProvider value={censurado}>
      <div
        ref={raiz}
        className="min-h-[calc(100dvh-3.5rem)] bg-creme px-4 pb-16 pt-5 text-tinta sm:px-6 lg:min-h-dvh lg:px-8 lg:pt-8"
      >
        <div className="mx-auto max-w-[1400px]">
          {avisos}

          {/* ── título + controles do período (uma linha, acima de tudo que eles recortam) ── */}
          <header data-entrada className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <p className="font-rotulo text-[11px] font-semibold uppercase tracking-[0.14em] text-apagado">
                Visão geral financeira
              </p>
              <h1 className="mt-1.5 font-titulo text-[40px] leading-none tracking-[-0.02em] text-tinta sm:text-[52px]">
                Dashboard
              </h1>
              <p className="mt-2 text-sm text-apagado">{anoMesLabel}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <PeriodoNav mes={mes} ano={ano} onIr={irPara} pendente={pendente} />
              <button
                type="button"
                aria-pressed={censurado}
                onClick={() => setCensurado(v => !v)}
                className={cn(
                  'inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700',
                  censurado
                    ? 'border-marca-800 bg-marca-800 text-white hover:bg-marca-600'
                    : 'border-linha bg-white text-tinta hover:bg-creme-escuro',
                )}
              >
                {censurado ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                {censurado ? 'Valores ocultos' : 'Ocultar valores'}
              </button>
              {podeEditar && <LimparDadosButton mes={mes} ano={ano} />}
            </div>
          </header>

          <div
            aria-busy={pendente}
            className={cn('mt-6 space-y-4 transition-opacity duration-200', pendente && 'pointer-events-none opacity-50')}
          >
            <Indicadores
              faturamento={faturamentoTotal}
              custosReservas={custosReservas}
              custosOperacionais={custosOperacionais}
              lucro={lucroTotal}
              margemPct={margemPct}
              hasData={hasData}
              periodo={anoMesLabel}
              fonte={fonteFaturamento}
            />

            {semCustosLancados && (
              <p data-entrada className="flex items-start gap-2.5 rounded-2xl border border-linha bg-white px-4 py-3 text-sm leading-snug text-tinta-suave">
                <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-marca-700" />
                <span>
                  <strong className="font-semibold text-tinta">Lucro parcial.</strong>{' '}
                  Ainda não há custos de reservas lançados neste período — o resultado desconta só os custos
                  operacionais e vai mudar quando eles entrarem.
                  {podeEditar && (
                    <>
                      {' '}
                      <Link href="/importar" className="font-semibold text-marca-700 underline underline-offset-2">
                        Importar custos
                      </Link>
                    </>
                  )}
                </span>
              </p>
            )}

            {hasData && (
              <Composicao
                faturamento={faturamentoTotal}
                custosReservas={custosReservas}
                custosOperacionais={custosOperacionais}
                lucro={lucroTotal}
              />
            )}

            {linhas.length > 0 ? (
              <>
                <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
                  <RankingEmpreendimentos
                    linhas={linhas}
                    cadastrados={qtdEmpreendimentos}
                    selecionado={empAtivo}
                    onSelecionar={setEmpreendimento}
                  />
                  <PorGestao
                    apartamentos={apartamentoCards}
                    faturamentoTotal={faturamentoTotal}
                    filtro={gestao}
                    onFiltrar={setGestao}
                  />
                </div>

                {apartamentoCards.length > 0 && (
                  <TabelaApartamentos
                    apartamentos={apartamentoCards}
                    empreendimentos={nomesEmpreendimentos}
                    empreendimento={empAtivo}
                    onEmpreendimento={setEmpreendimento}
                    gestao={gestao}
                    onGestao={setGestao}
                  />
                )}
              </>
            ) : (
              <SemDados periodo={anoMesLabel} podeEditar={podeEditar} />
            )}
          </div>
        </div>
      </div>
    </CensuraProvider>
  )
}

function SemDados({ periodo, podeEditar }: { periodo: string; podeEditar: boolean }) {
  const conteudo = (
    <>
      <span className="grid size-14 place-items-center rounded-2xl bg-creme text-apagado transition-colors group-hover:bg-marca-50 group-hover:text-marca-700">
        <Upload size={26} aria-hidden="true" />
      </span>
      <p className="mt-4 font-semibold text-tinta">Nenhum dado em {periodo}</p>
      <p className="mt-1 max-w-sm text-sm text-apagado">
        {podeEditar
          ? 'Importe as planilhas do período para ver indicadores, ranking e apartamentos.'
          : 'Os indicadores aparecem aqui assim que as planilhas do período forem importadas.'}
      </p>
      {podeEditar && (
        <span className="mt-5 inline-flex h-10 items-center rounded-full bg-marca-800 px-5 text-sm font-semibold text-white transition-colors group-hover:bg-marca-600">
          Importar planilhas
        </span>
      )}
    </>
  )
  const caixa = 'group flex flex-col items-center rounded-2xl border-2 border-dashed border-linha bg-white px-6 py-16 text-center'

  return podeEditar ? (
    <Link
      href="/importar" data-entrada
      className={cn(caixa, 'transition-colors hover:border-marca-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700')}
    >
      {conteudo}
    </Link>
  ) : (
    <div data-entrada className={caixa}>{conteudo}</div>
  )
}

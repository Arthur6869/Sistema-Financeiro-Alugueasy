'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CircleAlert, FileSpreadsheet, Plus, Receipt, RefreshCw } from 'lucide-react'
import { MESES, formatCurrency } from '@/lib/constants'
import { PaginaInterna } from '@/components/painel/pagina'
import { Cartao, Numero } from '@/components/dashboard/kpis'
import { NumeroAnimado, moeda, porcento } from '@/components/dashboard/valor'
import { botaoSecundario } from '@/components/empreendimentos/fin'
import { ExportarTabelaXlsxButton } from '@/components/shared/exportar-tabela-xlsx-button'
import { GradeCustos, type CustoRow, type FiltrosCustos } from './grade-custos'
import { RankingCustos, type ItemRanking } from './ranking-custos'

const SEM_FILTRO: FiltrosCustos = { categoria: null, empreendimento: null }

const botaoPrimario =
  'inline-flex h-11 items-center gap-2 rounded-full bg-marca-800 px-5 text-sm font-semibold text-white transition-colors ' +
  'hover:bg-marca-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700'

const empreendimentoDe = (c: CustoRow) => c.apartamentos?.empreendimentos?.nome ?? '—'
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Soma por chave, do maior para o menor (empate: ordem alfabética). */
function ranking(linhas: CustoRow[], chave: (c: CustoRow) => string): ItemRanking[] {
  const soma = new Map<string, number>()
  for (const c of linhas) soma.set(chave(c), (soma.get(chave(c)) ?? 0) + c.valor)
  return [...soma].map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR'))
}

/**
 * Aba Custos: o que foi gasto no mês, onde, e os lançamentos um a um.
 *
 * O servidor entrega os lançamentos do período (`custos`); esta tela soma,
 * agrupa e filtra no navegador, e é a única dona das linhas.
 */
export function TelaCustos({ custos, mes, ano, podeEditar, categoriasSugeridas, erro }: {
  custos: CustoRow[]
  mes: number
  ano: number
  podeEditar: boolean
  categoriasSugeridas: string[]
  /** Falha ao consultar o banco — diferente de "mês sem custos" */
  erro?: string | null
}) {
  const router = useRouter()
  const [atualizando, iniciar] = useTransition()
  const periodo = `${mes}-${ano}`

  /* As linhas ficam em estado porque editar/excluir mudam a tela sem esperar o
     servidor. Mas o estado ACOMPANHA o que o servidor manda: quando chega uma
     lista nova (troca de mês, "Atualizar"), ela substitui a anterior. Era a
     falta disto que deixava a tabela vazia depois de trocar de mês. */
  const [linhas, setLinhas] = useState(custos)
  const [recebido, setRecebido] = useState(custos)
  const [filtros, setFiltros] = useState<FiltrosCustos>(SEM_FILTRO)
  const [periodoVisto, setPeriodoVisto] = useState(periodo)
  const [editados, setEditados] = useState(0)

  if (recebido !== custos) {
    setRecebido(custos)
    setLinhas(custos)
  }
  if (periodoVisto !== periodo) {
    // outro mês, outras categorias: um filtro herdado esconderia lançamentos sem motivo aparente
    setPeriodoVisto(periodo)
    setFiltros(SEM_FILTRO)
  }

  const resumo = useMemo(() => {
    const soma = (l: CustoRow[]) => l.reduce((s, c) => s + c.valor, 0)
    const adm = linhas.filter(c => c.tipo_gestao === 'adm')
    const sub = linhas.filter(c => c.tipo_gestao === 'sub')
    const manuais = linhas.filter(c => c.origem === 'manual')
    return {
      total: soma(linhas),
      adm: { valor: soma(adm), n: adm.length },
      sub: { valor: soma(sub), n: sub.length },
      manuais: { valor: soma(manuais), n: manuais.length },
      apartamentos: new Set(linhas.map(c => `${empreendimentoDe(c)}|${c.apartamentos?.numero ?? '—'}`)).size,
    }
  }, [linhas])

  // Filtro cruzado: cada ranking obedece à escolha feita no OUTRO, nunca à própria
  // (senão, ao escolher uma categoria, as demais sumiriam e não daria para trocar).
  const porCategoria = useMemo(
    () => ranking(filtros.empreendimento ? linhas.filter(c => empreendimentoDe(c) === filtros.empreendimento) : linhas, c => c.categoria),
    [linhas, filtros.empreendimento],
  )
  const porEmpreendimento = useMemo(
    () => ranking(filtros.categoria ? linhas.filter(c => c.categoria === filtros.categoria) : linhas, empreendimentoDe),
    [linhas, filtros.categoria],
  )

  // Sugestões de categoria ao editar: as do histórico + as deste mês
  const sugestoes = useMemo(
    () => [...new Set([...categoriasSugeridas, ...linhas.map(c => c.categoria)])].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [categoriasSugeridas, linhas],
  )

  async function salvar(id: string, dados: { categoria: string; valor: number }) {
    try {
      const res = await fetch(`/api/custos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) return (corpo?.error as string | undefined) ?? 'Não foi possível salvar o lançamento.'
      setLinhas(atual => atual.map(c => (c.id === id ? { ...c, ...dados } : c)))
      setEditados(n => n + 1)
      toast.success('Custo atualizado')
      return null
    } catch {
      return 'Sem resposta do servidor. Confira a conexão e tente de novo.'
    }
  }

  async function excluir(id: string) {
    try {
      const res = await fetch(`/api/custos/${id}`, { method: 'DELETE' })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) return (corpo?.error as string | undefined) ?? 'Não foi possível excluir o lançamento.'
      setLinhas(atual => atual.filter(c => c.id !== id))
      toast.success('Lançamento excluído')
      return null
    } catch {
      return 'Sem resposta do servidor. Confira a conexão e tente de novo.'
    }
  }

  const atualizar = () => iniciar(() => router.refresh())
  const doTotal = (v: number) => (resumo.total > 0 ? porcento((v / resumo.total) * 100) : '0%')
  const media = resumo.total / Math.max(1, resumo.apartamentos)
  const nomePeriodo = `${MESES[mes - 1]} ${ano}`
  const manual = `/custos/manual?mes=${mes}&ano=${ano}`

  return (
    <PaginaInterna
      rotulo="Despesas"
      titulo="Custos"
      sub={
        erro ? nomePeriodo
          : linhas.length === 0 ? `${nomePeriodo} · nenhum lançamento`
          : `${nomePeriodo} · ${plural(linhas.length, 'lançamento', 'lançamentos')} em ${plural(resumo.apartamentos, 'apartamento', 'apartamentos')}`
      }
      periodo={{ mes, ano, permitirTodos: false }}
      acoes={
        <>
          <ExportarTabelaXlsxButton tabela="custos" mes={mes} ano={ano} className={botaoSecundario} />
          {podeEditar && (
            <Link href={manual} className={botaoPrimario}>
              <Plus size={16} aria-hidden="true" />
              Lançamento manual
            </Link>
          )}
        </>
      }
    >
      {erro ? (
        <section data-entrada role="alert" className="flex flex-col items-center rounded-2xl border border-red-200 bg-white px-5 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-negativo"><CircleAlert size={22} aria-hidden="true" /></span>
          <h2 className="mt-4 font-semibold text-tinta">Não foi possível carregar os custos</h2>
          <p className="mt-1 max-w-md text-sm text-apagado">
            A consulta ao banco falhou, então nada é mostrado para não parecer que o mês está sem custos. Detalhe: {erro}
          </p>
          <button type="button" onClick={atualizar} disabled={atualizando} className={`${botaoPrimario} mt-5 disabled:opacity-60`}>
            <RefreshCw size={16} aria-hidden="true" className={atualizando ? 'animate-spin' : ''} />
            Tentar de novo
          </button>
        </section>
      ) : linhas.length === 0 ? (
        <section data-entrada className="flex flex-col items-center rounded-2xl border border-linha bg-white px-5 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-creme text-apagado"><Receipt size={22} aria-hidden="true" /></span>
          <h2 className="mt-4 font-semibold text-tinta">Nenhum custo lançado em {nomePeriodo}</h2>
          <p className="mt-1 max-w-md text-sm text-apagado">
            Os custos entram pela planilha do mês ou por lançamento manual. Use as setas do período para ver outro mês.
          </p>
          {podeEditar && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/importar" className={botaoPrimario}>
                <FileSpreadsheet size={16} aria-hidden="true" />
                Importar planilha
              </Link>
              <Link href={manual} className={botaoSecundario}>
                <Plus size={16} aria-hidden="true" />
                Lançamento manual
              </Link>
            </div>
          )}
        </section>
      ) : (
        <>
          {/* ── o mês em quatro números ── */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
            <article
              data-entrada
              className="relative isolate col-span-2 flex flex-col overflow-hidden rounded-2xl bg-marca-800 p-5 text-white sm:p-6 xl:col-span-1"
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_100%_0%,rgba(235,104,52,0.30),transparent_70%)]"
              />
              <h2 className="flex items-center gap-2 text-[13px] font-medium text-white/70">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px] bg-serie-custo-reservas ring-1 ring-white/50" />
                Total de custos
              </h2>
              <div className="mt-4">
                <Numero texto={formatCurrency(resumo.total)} max={48}>
                  <NumeroAnimado valor={resumo.total} formatar={moeda} />
                </Numero>
              </div>
              {/* de onde vieram: o que foi digitado à mão é o que mais pede conferência */}
              <p className="mt-auto pt-5 text-[13px] text-white/65">
                {resumo.manuais.n === 0
                  ? `${nomePeriodo} · tudo veio da planilha importada`
                  : `${nomePeriodo} · ${plural(resumo.manuais.n, 'lançado', 'lançados')} à mão, somando ${moeda(resumo.manuais.valor)}`}
              </p>
            </article>

            <Cartao
              rotulo="Administração"
              cor="bg-serie-custo-reservas"
              numero={
                <Numero texto={formatCurrency(resumo.adm.valor)} max={28} className="text-tinta">
                  <NumeroAnimado valor={resumo.adm.valor} formatar={moeda} />
                </Numero>
              }
              rodape={resumo.adm.n === 0 ? 'Nenhum lançamento' : `${doTotal(resumo.adm.valor)} do total · ${plural(resumo.adm.n, 'lançamento', 'lançamentos')}`}
            />

            <Cartao
              rotulo="Sublocação"
              cor="bg-serie-custo-reservas"
              numero={
                <Numero texto={formatCurrency(resumo.sub.valor)} max={28} className="text-tinta">
                  <NumeroAnimado valor={resumo.sub.valor} formatar={moeda} />
                </Numero>
              }
              rodape={resumo.sub.n === 0 ? 'Nenhum lançamento' : `${doTotal(resumo.sub.valor)} do total · ${plural(resumo.sub.n, 'lançamento', 'lançamentos')}`}
            />

            <Cartao
              linhaInteira
              rotulo="Média por apartamento"
              cor="bg-serie-custo-reservas"
              numero={
                <Numero texto={formatCurrency(media)} max={28} className="text-tinta">
                  <NumeroAnimado valor={media} formatar={moeda} />
                </Numero>
              }
              rodape={`${plural(resumo.apartamentos, 'apartamento', 'apartamentos')} com custo no mês`}
            />
          </div>

          {/* ── onde o dinheiro foi gasto ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <RankingCustos
              id="categorias" titulo="Custos por categoria" plural="categorias" feminino
              recorte={filtros.empreendimento} itens={porCategoria}
              selecionado={filtros.categoria} onSelecionar={categoria => setFiltros(f => ({ ...f, categoria }))}
            />
            <RankingCustos
              id="empreendimentos" titulo="Custos por empreendimento" plural="empreendimentos"
              recorte={filtros.categoria} itens={porEmpreendimento}
              selecionado={filtros.empreendimento} onSelecionar={empreendimento => setFiltros(f => ({ ...f, empreendimento }))}
            />
          </div>

          {/* `key`: busca, ordenação e página também recomeçam ao trocar de mês */}
          <GradeCustos
            key={periodo}
            custos={linhas}
            podeEditar={podeEditar}
            categoriasSugeridas={sugestoes}
            filtros={filtros}
            onFiltros={setFiltros}
            onSalvar={salvar}
            onExcluir={excluir}
            onAtualizar={atualizar}
            atualizando={atualizando}
            editados={editados}
          />
        </>
      )}
    </PaginaInterna>
  )
}

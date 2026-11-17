'use client'

import { useMemo, useState, useTransition, type KeyboardEvent } from 'react'
import {
  aggregationFn_sum,
  columnFilteringFeature,
  columnGroupingFeature,
  createColumnHelper,
  createExpandedRowModel,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  globalFilteringFeature,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type Row,
} from '@tanstack/react-table'
import {
  ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight,
  FilterX, Loader2, Pencil, RefreshCw, Search, Trash2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Segmentado, moeda } from '@/components/dashboard/valor'
import { CampoMoeda } from '@/components/painel/campo-moeda'
import { SeloGestao } from '@/components/empreendimentos/fin'

export interface CustoRow {
  id: string
  categoria: string
  valor: number
  tipo_gestao: 'adm' | 'sub'
  origem: 'manual' | 'importacao'
  observacao?: string | null
  mes: number
  ano: number
  apartamentos: {
    numero: string
    empreendimentos: { nome: string } | null
  } | null
}

/** Linha da grade: o custo + os campos derivados que a tabela ordena, filtra e agrupa. */
type Linha = CustoRow & { empreendimento: string; apartamento: string; imovel: string; busca: string }

export type FiltrosCustos = { categoria: string | null; empreendimento: string | null }

type Agrupar = 'nenhum' | 'empreendimento' | 'categoria'
type Gestao = 'todos' | 'adm' | 'sub'
type Origem = 'todas' | 'importacao' | 'manual'

/** Busca sem acento e sem diferença de maiúsculas: "condominio" acha "Condomínio". */
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const texto = (a: unknown, b: unknown) => String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { numeric: true })

/* ── TanStack Table (v9): o motor da grade ─────────────────────────────
   Ele ordena, filtra, agrupa, soma os grupos e pagina; o HTML é todo nosso.
   `features` e `colunas` ficam no módulo porque a tabela exige entradas
   estáveis entre renders. */
const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  columnGroupingFeature,
  groupedRowModel: createGroupedRowModel(),
  rowAggregationFeature,
  aggregationFns: { sum: aggregationFn_sum },
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})

type LinhaTabela = Row<typeof features, Linha>

const ajudante = createColumnHelper<typeof features, Linha>()
const igual = (linha: LinhaTabela, coluna: string, valor: unknown) => linha.getValue(coluna) === valor
const porTexto = (a: LinhaTabela, b: LinhaTabela, coluna: string) => texto(a.getValue(coluna), b.getValue(coluna))

const colunas = ajudante.columns([
  ajudante.accessor('imovel', {
    sortFn: porTexto,
    // a busca olha a linha inteira (imóvel, categoria, observação), não só esta coluna
    filterFn: (linha, _coluna, termo: string) => linha.original.busca.includes(termo),
  }),
  ajudante.accessor('empreendimento', { sortFn: porTexto, filterFn: igual }),
  ajudante.accessor('categoria', { sortFn: porTexto, filterFn: igual }),
  ajudante.accessor('tipo_gestao', { sortFn: porTexto, filterFn: igual }),
  ajudante.accessor('origem', { sortFn: porTexto, filterFn: igual }),
  // `sum`: é o que dá o subtotal de cada grupo e deixa ordenar os grupos por valor
  ajudante.accessor('valor', { aggregationFn: 'sum', sortDescFirst: true }),
])

const PAGINAS = [25, 50, 100]
const TUDO = 100_000 // agrupado não pagina: cada grupo já é um resumo

const GESTAO: { valor: Gestao; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' }, { valor: 'adm', rotulo: 'ADM' }, { valor: 'sub', rotulo: 'SUB' },
]
const ORIGEM: { valor: Origem; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' }, { valor: 'importacao', rotulo: 'Importado' }, { valor: 'manual', rotulo: 'Manual' },
]
const AGRUPAR: { valor: Agrupar; rotulo: string }[] = [
  { valor: 'nenhum', rotulo: 'Sem agrupar' }, { valor: 'empreendimento', rotulo: 'Empreendimento' }, { valor: 'categoria', rotulo: 'Categoria' },
]

const campo =
  'h-10 rounded-full border border-linha bg-white text-sm text-tinta transition-colors hover:border-[#cfc8b6] ' +
  'focus-visible:border-marca-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-700/15'
const botaoIcone =
  'grid size-9 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 ' +
  'focus-visible:outline-marca-700 disabled:cursor-not-allowed disabled:opacity-50'

function SeloOrigem({ origem }: { origem: CustoRow['origem'] }) {
  return (
    <span className={cn(
      'inline-block rounded-md px-1.5 py-0.5 text-[11.5px] font-medium',
      origem === 'manual' ? 'bg-marca-50 text-marca-700' : 'bg-creme text-apagado',
    )}>
      {origem === 'manual' ? 'Manual' : 'Importado'}
    </span>
  )
}

/**
 * Lançamentos de custo do período: ordenar, buscar, filtrar, agrupar com
 * subtotal e editar na própria linha.
 *
 * As linhas vêm de fora (`custos`) e esta grade NÃO guarda cópia delas — era
 * uma cópia feita só na montagem que deixava a tabela presa ao mês em que a
 * tela foi aberta. Editar e excluir sobem por `onSalvar`/`onExcluir`.
 */
export function GradeCustos({
  custos, podeEditar, categoriasSugeridas, filtros, onFiltros, onSalvar, onExcluir, onAtualizar, atualizando, editados,
}: {
  custos: CustoRow[]
  podeEditar: boolean
  categoriasSugeridas: string[]
  /** Categoria e empreendimento também são escolhidos nos gráficos acima */
  filtros: FiltrosCustos
  onFiltros: (filtros: FiltrosCustos) => void
  /** Devolve a mensagem de erro, ou `null` se salvou */
  onSalvar: (id: string, dados: { categoria: string; valor: number }) => Promise<string | null>
  onExcluir: (id: string) => Promise<string | null>
  onAtualizar: () => void
  atualizando: boolean
  editados: number
}) {
  const [busca, setBusca] = useState('')
  const [gestao, setGestao] = useState<Gestao>('todos')
  const [origem, setOrigem] = useState<Origem>('todas')
  const [agrupar, setAgrupar] = useState<Agrupar>('nenhum')
  const [tamanhoPagina, setTamanhoPagina] = useState(PAGINAS[0])
  const [, adiar] = useTransition()

  const [editando, setEditando] = useState<{ id: string; categoria: string; valor: number | null } | null>(null)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const dados = useMemo<Linha[]>(() => custos.map(c => {
    const empreendimento = c.apartamentos?.empreendimentos?.nome ?? '—'
    const apartamento = c.apartamentos?.numero ?? '—'
    return {
      ...c, empreendimento, apartamento,
      imovel: `${empreendimento} ${apartamento}`,
      busca: normalizar(`${empreendimento} ${apartamento} ${c.categoria} ${c.observacao ?? ''}`),
    }
  }), [custos])

  // Filtros controlados aqui, numa lista só: a tabela aplica do jeito que recebe
  const filtrosDeColuna = useMemo(() => {
    const lista: { id: string; value: unknown }[] = []
    if (gestao !== 'todos') lista.push({ id: 'tipo_gestao', value: gestao })
    if (origem !== 'todas') lista.push({ id: 'origem', value: origem })
    if (filtros.categoria) lista.push({ id: 'categoria', value: filtros.categoria })
    if (filtros.empreendimento) lista.push({ id: 'empreendimento', value: filtros.empreendimento })
    return lista
  }, [gestao, origem, filtros.categoria, filtros.empreendimento])
  const agrupamento = useMemo(() => (agrupar === 'nenhum' ? [] : [agrupar]), [agrupar])
  const termo = normalizar(busca.trim())

  const tabela = useTable({
    features,
    columns: colunas,
    data: dados,
    getRowId: linha => linha.id,
    state: { columnFilters: filtrosDeColuna, grouping: agrupamento, globalFilter: termo },
    initialState: { pagination: { pageIndex: 0, pageSize: PAGINAS[0] } },
    getColumnCanGlobalFilter: coluna => coluna.id === 'imovel',
    globalFilterFn: (linha, _coluna, t: string) => linha.original.busca.includes(t),
    groupedColumnMode: false,
    enableSortingRemoval: true,
    // editar uma linha muda os dados: sem isto a grade voltava para a página 1 e fechava os grupos
    autoResetPageIndex: false,
    autoResetExpanded: false,
  })

  const voltarAoInicio = () => tabela.setPageIndex(0)
  const mudarFiltros = (f: FiltrosCustos) => { onFiltros(f); voltarAoInicio() }

  function mudarAgrupamento(novo: Agrupar) {
    setAgrupar(novo)
    tabela.setExpanded({})
    tabela.setPageIndex(0)
    tabela.setPageSize(novo === 'nenhum' ? tamanhoPagina : TUDO)
    // ao agrupar, o que interessa é onde está o dinheiro: maiores subtotais primeiro
    if (novo !== 'nenhum') tabela.setSorting([{ id: 'valor', desc: true }])
  }

  const filtradas = tabela.getFilteredRowModel().rows
  const totalFiltrado = filtradas.reduce((s, l) => s + l.original.valor, 0)
  const filtroAtivo = !!termo || gestao !== 'todos' || origem !== 'todas' || !!filtros.categoria || !!filtros.empreendimento

  function limpar() {
    setBusca('')
    setGestao('todos')
    setOrigem('todas')
    mudarFiltros({ categoria: null, empreendimento: null })
  }

  const linhas = tabela.getRowModel().rows
  const pagina = tabela.state.pagination
  const grupos = agrupar !== 'nenhum' ? tabela.getGroupedRowModel().rows : []
  const todosAbertos = grupos.length > 0 && grupos.every(g => g.getIsExpanded())

  // listas dos seletores: sempre a partir do período inteiro, não do que sobrou do filtro
  const categorias = useMemo(() => [...new Set(dados.map(d => d.categoria))].sort((a, b) => texto(a, b)), [dados])
  const empreendimentos = useMemo(() => [...new Set(dados.map(d => d.empreendimento))].sort((a, b) => texto(a, b)), [dados])

  /* ── edição na linha ─────────────────────────────────────────────── */
  function comecar(linha: Linha) {
    setEditando({ id: linha.id, categoria: linha.categoria, valor: linha.valor })
    setConfirmando(null)
    setErro(null)
  }
  async function salvar() {
    if (!editando) return
    const categoria = editando.categoria.trim()
    if (categoria.length < 2 || editando.valor === null || editando.valor <= 0) {
      setErro('Informe a categoria e um valor maior que zero.')
      return
    }
    setSalvando(editando.id)
    setErro(null)
    const falha = await onSalvar(editando.id, { categoria, valor: editando.valor })
    setSalvando(null)
    if (falha) setErro(falha)
    else setEditando(null)
  }
  async function excluir(id: string) {
    setExcluindo(id)
    setErro(null)
    const falha = await onExcluir(id)
    setExcluindo(null)
    setConfirmando(null)
    if (falha) setErro(falha)
  }
  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void salvar() }
    if (e.key === 'Escape') { e.preventDefault(); setEditando(null); setErro(null) }
  }

  const cabecalho = (id: string, rotulo: string, numerico = false, classe = '') => {
    const coluna = tabela.getColumn(id)
    const ordem = coluna?.getIsSorted() ?? false
    const Icone = ordem === 'asc' ? ArrowUp : ordem === 'desc' ? ArrowDown : ArrowUpDown
    return (
      <th
        key={id} scope="col"
        aria-sort={ordem === 'asc' ? 'ascending' : ordem === 'desc' ? 'descending' : 'none'}
        className={cn('px-3 py-2.5 font-medium', numerico ? 'text-right' : 'text-left', classe)}
      >
        <button
          type="button" onClick={coluna?.getToggleSortingHandler()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-tinta',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700',
            numerico && 'flex-row-reverse', ordem ? 'text-tinta' : 'text-apagado',
          )}
        >
          {rotulo}
          <Icone size={13} aria-hidden="true" className={ordem ? '' : 'opacity-50'} />
        </button>
      </th>
    )
  }

  /** Subtotal do grupo: vem da agregação da tabela; se faltar, soma as folhas. */
  const subtotal = (grupo: LinhaTabela) => {
    const agregado = grupo.getValue<number | undefined>('valor')
    return typeof agregado === 'number' ? agregado : grupo.getLeafRows().reduce((s, l) => s + l.original.valor, 0)
  }
  const colunasVisiveis = podeEditar ? 6 : 5

  return (
    <section data-entrada aria-labelledby="titulo-lancamentos" className="rounded-2xl border border-linha bg-white">
      {/* ── filtros: acima do que eles recortam ── */}
      <div className="border-b border-linha p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="titulo-lancamentos" className="text-[15px] font-semibold text-tinta">Lançamentos</h2>
          <p className="text-[13px] text-apagado" aria-live="polite">
            <strong className="font-semibold text-tinta">{filtradas.length}</strong>
            {/* com filtro, o substantivo concorda com o total: "1 de 314 lançamentos" */}
            {filtroAtivo ? ` de ${dados.length}` : ''} {(filtroAtivo ? dados.length : filtradas.length) === 1 ? 'lançamento' : 'lançamentos'} ·{' '}
            <strong className="font-semibold tabular-nums text-tinta">{moeda(totalFiltrado)}</strong>
            {editados > 0 && <span className="ml-2 font-medium text-positivo">✓ {editados} {editados === 1 ? 'editado' : 'editados'} nesta sessão</span>}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <span className="sr-only">Buscar por imóvel, categoria ou observação</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-apagado" />
            <input
              type="search" value={busca} placeholder="Imóvel, categoria ou observação"
              // digitar atualiza o campo na hora; filtrar centenas de linhas fica em segundo plano
              onChange={e => { const v = e.target.value; setBusca(v); adiar(voltarAoInicio) }}
              className={cn(campo, 'w-full pl-10 pr-4 placeholder:text-apagado/70 [&::-webkit-search-cancel-button]:appearance-none')}
            />
          </label>

          {/* no celular cada seletor ocupa a linha inteira: lado a lado o nome era cortado */}
          <label className="relative max-sm:w-full">
            <span className="sr-only">Empreendimento</span>
            <select
              value={filtros.empreendimento ?? ''}
              onChange={e => mudarFiltros({ ...filtros, empreendimento: e.target.value || null })}
              className={cn(campo, 'w-full cursor-pointer appearance-none truncate pl-4 pr-9 sm:max-w-[16rem]')}
            >
              <option value="">Todos os empreendimentos</option>
              {empreendimentos.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-apagado" />
          </label>

          <label className="relative max-sm:w-full">
            <span className="sr-only">Categoria</span>
            <select
              value={filtros.categoria ?? ''}
              onChange={e => mudarFiltros({ ...filtros, categoria: e.target.value || null })}
              className={cn(campo, 'w-full cursor-pointer appearance-none truncate pl-4 pr-9 sm:max-w-[16rem]')}
            >
              <option value="">Todas as categorias</option>
              {categorias.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-apagado" />
          </label>

          {filtroAtivo && (
            <button
              type="button" onClick={limpar}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-marca-700 transition-colors hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
            >
              <X size={15} aria-hidden="true" />
              Limpar filtros
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-apagado">Gestão</span>
            <Segmentado rotulo="Tipo de gestão" opcoes={GESTAO} valor={gestao} onMudar={v => { setGestao(v); voltarAoInicio() }} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-apagado">Origem</span>
            <Segmentado rotulo="Origem do lançamento" opcoes={ORIGEM} valor={origem} onMudar={v => { setOrigem(v); voltarAoInicio() }} />
          </div>
          {/* no celular o controle toma a linha toda e dispensa o rótulo ("Sem agrupar" já diz o que é) */}
          <div className="flex items-center gap-2 max-sm:w-full">
            <span className="text-[13px] text-apagado max-sm:hidden">Agrupar</span>
            <Segmentado
              rotulo="Agrupar lançamentos por" opcoes={AGRUPAR} valor={agrupar} onMudar={mudarAgrupamento}
              className="max-sm:flex max-sm:w-full max-sm:[&>button]:flex-1 max-sm:[&>button]:px-2"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {grupos.length > 0 && (
              <button
                type="button" onClick={() => tabela.toggleAllRowsExpanded(!todosAbertos)}
                className="h-9 rounded-full px-3 text-[13px] font-medium text-marca-700 transition-colors hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
              >
                {todosAbertos ? 'Recolher todos' : 'Expandir todos'}
              </button>
            )}
            <button
              type="button" onClick={onAtualizar} disabled={atualizando}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-linha bg-white px-3 text-[13px] font-medium text-tinta-suave transition-colors hover:bg-creme focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700 disabled:opacity-60"
            >
              <RefreshCw size={14} aria-hidden="true" className={atualizando ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {erro && (
          <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-negativo">{erro}</p>
        )}
      </div>

      <datalist id="categorias-sugeridas">
        {categoriasSugeridas.map(c => <option key={c} value={c} />)}
      </datalist>

      {linhas.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-creme text-apagado"><FilterX size={22} aria-hidden="true" /></span>
          <p className="mt-4 font-semibold text-tinta">Nenhum lançamento com esses filtros</p>
          <p className="mt-1 text-sm text-apagado">Tente outro termo ou volte a ver todos.</p>
          <button
            type="button" onClick={limpar}
            className="mt-5 h-10 rounded-full bg-marca-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <>
          {/* ── a partir do tablet: tabela ── */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-linha text-[13px]">
                  {cabecalho('imovel', 'Imóvel', false, 'pl-5')}
                  {cabecalho('categoria', 'Categoria')}
                  {cabecalho('tipo_gestao', 'Gestão')}
                  {cabecalho('origem', 'Origem')}
                  {cabecalho('valor', 'Valor', true, podeEditar ? '' : 'pr-5')}
                  {podeEditar && <th scope="col" className="w-28 px-3 py-2.5 pr-5 text-right font-medium text-apagado">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {linhas.map(linha => {
                  if (linha.getIsGrouped()) {
                    const aberto = linha.getIsExpanded()
                    const n = linha.getLeafRows().length
                    return (
                      <tr key={linha.id} className="border-b border-linha/70 bg-creme/50">
                        <th scope="row" colSpan={4} className="px-3 py-2.5 pl-3 text-left font-normal">
                          <button
                            type="button" onClick={linha.getToggleExpandedHandler()} aria-expanded={aberto}
                            className="inline-flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-creme-escuro focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700"
                          >
                            <ChevronRight size={16} aria-hidden="true" className={cn('text-apagado transition-transform', aberto && 'rotate-90')} />
                            <span className="font-semibold text-tinta">{String(linha.groupingValue ?? '—')}</span>
                            <span className="text-[13px] text-apagado">{n} {n === 1 ? 'lançamento' : 'lançamentos'}</span>
                          </button>
                        </th>
                        <td className={cn('whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-tinta', !podeEditar && 'pr-5')}>{moeda(subtotal(linha))}</td>
                        {podeEditar && <td />}
                      </tr>
                    )
                  }

                  const c = linha.original
                  const recuo = linha.depth > 0 ? 'pl-11' : 'pl-5'

                  if (confirmando === c.id) {
                    return (
                      <tr key={linha.id} className="border-b border-red-100 bg-red-50">
                        <td colSpan={colunasVisiveis - 2} className={cn('px-3 py-3 text-sm font-medium text-negativo', recuo)}>
                          Excluir {c.categoria} de {c.empreendimento} apto {c.apartamento} ({moeda(c.valor)})?
                        </td>
                        <td colSpan={2} className="px-3 py-3 pr-5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button" onClick={() => setConfirmando(null)} disabled={excluindo === c.id}
                              className="h-9 rounded-full border border-linha bg-white px-4 text-[13px] font-medium text-tinta transition-colors hover:bg-creme disabled:opacity-60"
                            >
                              Não
                            </button>
                            <button
                              type="button" onClick={() => excluir(c.id)} disabled={excluindo === c.id}
                              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-negativo px-4 text-[13px] font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-60"
                            >
                              {excluindo === c.id && <Loader2 size={14} aria-hidden="true" className="animate-spin" />}
                              Sim, excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  const emEdicao = editando?.id === c.id
                  return (
                    <tr key={linha.id} className={cn('border-b border-linha/70 transition-colors last:border-0', emEdicao ? 'bg-marca-50/60' : 'hover:bg-creme/60')}>
                      <th scope="row" className={cn('px-3 py-2.5 text-left font-normal', recuo)}>
                        <span className="block font-medium text-tinta">{c.empreendimento}</span>
                        <span className="block text-xs text-apagado">apto {c.apartamento}</span>
                      </th>
                      <td className="min-w-[11rem] px-3 py-2.5">
                        {emEdicao ? (
                          <input
                            autoFocus list="categorias-sugeridas" aria-label="Categoria"
                            value={editando.categoria} onKeyDown={aoTeclar}
                            onChange={e => setEditando({ ...editando, categoria: e.target.value })}
                            className="h-10 w-full rounded-xl border border-linha bg-white px-3 text-sm text-tinta focus-visible:border-marca-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-700/15"
                          />
                        ) : (
                          <>
                            <span className="text-tinta">{c.categoria}</span>
                            {c.observacao && <span className="mt-0.5 block max-w-[22rem] truncate text-xs text-apagado" title={c.observacao}>{c.observacao}</span>}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><SeloGestao tipo={c.tipo_gestao} /></td>
                      <td className="px-3 py-2.5"><SeloOrigem origem={c.origem} /></td>
                      {/* o valor nunca quebra em duas linhas; se faltar largura, a tabela rola */}
                      <td className={cn('whitespace-nowrap px-3 py-2.5 text-right tabular-nums', !podeEditar && 'pr-5')}>
                        {emEdicao ? (
                          <CampoMoeda
                            aria-label="Valor" valor={editando.valor} onKeyDown={aoTeclar}
                            onMudar={v => setEditando({ ...editando, valor: v })} className="ml-auto w-36"
                          />
                        ) : (
                          <span className="font-semibold text-tinta">{moeda(c.valor)}</span>
                        )}
                      </td>
                      {podeEditar && (
                        <td className="px-3 py-2.5 pr-5">
                          <div className="flex justify-end gap-0.5">
                            {emEdicao ? (
                              <>
                                <button type="button" onClick={salvar} disabled={salvando === c.id} aria-label="Salvar" title="Salvar (Enter)" className={cn(botaoIcone, 'text-positivo hover:bg-positivo/10')}>
                                  {salvando === c.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                </button>
                                <button type="button" onClick={() => { setEditando(null); setErro(null) }} disabled={salvando === c.id} aria-label="Cancelar" title="Cancelar (Esc)" className={cn(botaoIcone, 'text-apagado hover:bg-creme-escuro')}>
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => comecar(c)} aria-label={`Editar ${c.categoria} de ${c.imovel}`} title="Editar" className={cn(botaoIcone, 'text-apagado hover:bg-marca-50 hover:text-marca-700')}>
                                  <Pencil size={15} />
                                </button>
                                <button type="button" onClick={() => { setConfirmando(c.id); setEditando(null) }} aria-label={`Excluir ${c.categoria} de ${c.imovel}`} title="Excluir" className={cn(botaoIcone, 'text-apagado hover:bg-red-50 hover:text-negativo')}>
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── celular: cartões ── */}
          <ul className="divide-y divide-linha/70 md:hidden">
            {linhas.map(linha => {
              if (linha.getIsGrouped()) {
                const aberto = linha.getIsExpanded()
                const n = linha.getLeafRows().length
                return (
                  <li key={linha.id} className="bg-creme/50">
                    <button
                      type="button" onClick={linha.getToggleExpandedHandler()} aria-expanded={aberto}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca-700"
                    >
                      <ChevronRight size={16} aria-hidden="true" className={cn('shrink-0 text-apagado transition-transform', aberto && 'rotate-90')} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-tinta">{String(linha.groupingValue ?? '—')}</span>
                        <span className="block text-xs text-apagado">{n} {n === 1 ? 'lançamento' : 'lançamentos'}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-tinta">{moeda(subtotal(linha))}</span>
                    </button>
                  </li>
                )
              }

              const c = linha.original
              const emEdicao = editando?.id === c.id
              return (
                <li key={linha.id} className={cn('px-4 py-3.5', emEdicao && 'bg-marca-50/60', confirmando === c.id && 'bg-red-50')}>
                  <div className="flex items-start justify-between gap-3">
                    {/* apartamento em linha própria: junto do nome ele era o primeiro a ser cortado */}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-tinta">{c.empreendimento}</p>
                      <p className="mt-0.5 text-sm text-tinta-suave">
                        apto {c.apartamento}{!emEdicao && <> · {c.categoria}</>}
                      </p>
                      {!emEdicao && c.observacao && <p className="mt-0.5 text-xs text-apagado">{c.observacao}</p>}
                    </div>
                    {!emEdicao && <p className="shrink-0 font-semibold tabular-nums text-tinta">{moeda(c.valor)}</p>}
                  </div>

                  {emEdicao && (
                    <div className="mt-3 grid gap-2">
                      <input
                        list="categorias-sugeridas" aria-label="Categoria" value={editando.categoria} onKeyDown={aoTeclar}
                        onChange={e => setEditando({ ...editando, categoria: e.target.value })}
                        className="h-11 w-full rounded-xl border border-linha bg-white px-3 text-base text-tinta focus-visible:border-marca-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-700/15"
                      />
                      <CampoMoeda aria-label="Valor" valor={editando.valor} onKeyDown={aoTeclar} onMudar={v => setEditando({ ...editando, valor: v })} className="h-11 text-base" />
                    </div>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><SeloGestao tipo={c.tipo_gestao} /><SeloOrigem origem={c.origem} /></span>
                    {podeEditar && (confirmando === c.id ? (
                      <span className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-negativo">Excluir?</span>
                        <button type="button" onClick={() => setConfirmando(null)} disabled={excluindo === c.id} className="h-9 rounded-full border border-linha bg-white px-3 text-[13px] font-medium text-tinta">Não</button>
                        <button type="button" onClick={() => excluir(c.id)} disabled={excluindo === c.id} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-negativo px-3 text-[13px] font-semibold text-white">
                          {excluindo === c.id && <Loader2 size={14} aria-hidden="true" className="animate-spin" />}Sim
                        </button>
                      </span>
                    ) : emEdicao ? (
                      <span className="flex items-center gap-2">
                        <button type="button" onClick={() => { setEditando(null); setErro(null) }} disabled={salvando === c.id} className="h-9 rounded-full border border-linha bg-white px-4 text-[13px] font-medium text-tinta">Cancelar</button>
                        <button type="button" onClick={salvar} disabled={salvando === c.id} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-marca-800 px-4 text-[13px] font-semibold text-white">
                          {salvando === c.id && <Loader2 size={14} aria-hidden="true" className="animate-spin" />}Salvar
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <button type="button" onClick={() => comecar(c)} aria-label={`Editar ${c.categoria} de ${c.imovel}`} className={cn(botaoIcone, 'size-10 text-apagado hover:bg-marca-50 hover:text-marca-700')}><Pencil size={16} /></button>
                        <button type="button" onClick={() => { setConfirmando(c.id); setEditando(null) }} aria-label={`Excluir ${c.categoria} de ${c.imovel}`} className={cn(botaoIcone, 'size-10 text-apagado hover:bg-red-50 hover:text-negativo')}><Trash2 size={16} /></button>
                      </span>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>

          {/* ── paginação (sem agrupamento) ── */}
          {agrupar === 'nenhum' && filtradas.length > PAGINAS[0] && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha px-4 py-3 sm:px-5">
              <p className="text-[13px] tabular-nums text-apagado">
                {pagina.pageIndex * pagina.pageSize + 1}–{Math.min((pagina.pageIndex + 1) * pagina.pageSize, filtradas.length)} de {filtradas.length}
              </p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-[13px] text-apagado">
                  Por página
                  <span className="relative">
                    <select
                      value={pagina.pageSize}
                      onChange={e => { const n = Number(e.target.value); setTamanhoPagina(n); tabela.setPageSize(n); tabela.setPageIndex(0) }}
                      className={cn(campo, 'h-9 cursor-pointer appearance-none pl-3 pr-8 text-[13px]')}
                    >
                      {PAGINAS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-apagado" />
                  </span>
                </label>
                <button type="button" onClick={() => tabela.previousPage()} disabled={!tabela.getCanPreviousPage()} aria-label="Página anterior" className={cn(botaoIcone, 'border border-linha bg-white text-tinta-suave hover:bg-creme')}>
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[3.5rem] text-center text-[13px] tabular-nums text-tinta-suave">{pagina.pageIndex + 1} / {Math.max(1, tabela.getPageCount())}</span>
                <button type="button" onClick={() => tabela.nextPage()} disabled={!tabela.getCanNextPage()} aria-label="Próxima página" className={cn(botaoIcone, 'border border-linha bg-white text-tinta-suave hover:bg-creme')}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

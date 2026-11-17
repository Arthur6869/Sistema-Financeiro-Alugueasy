'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, FilterX, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Segmentado, Valor, margemDe, moeda, moedaComSinal, porcento, useCensura } from './valor'
import type { ApartamentoCard, FiltroGestao } from './tipos'

type Coluna = 'nome' | 'fat' | 'custos' | 'luc' | 'margem'
type Direcao = 'asc' | 'desc'
type Recorte = 'todos' | 'prejuizo' | 'sem-faturamento' | 'sem-custo'

/** Linhas mostradas antes de "Mostrar todos" (sem filtro ativo). */
const LIMITE = 12

const GESTAO: { valor: FiltroGestao; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'adm', rotulo: 'ADM' },
  { valor: 'sub', rotulo: 'SUB' },
]

const ORDENACOES: { coluna: Coluna; direcao: Direcao; rotulo: string }[] = [
  { coluna: 'fat', direcao: 'desc', rotulo: 'Maior faturamento' },
  { coluna: 'luc', direcao: 'desc', rotulo: 'Maior lucro' },
  { coluna: 'luc', direcao: 'asc', rotulo: 'Menor lucro' },
  { coluna: 'margem', direcao: 'desc', rotulo: 'Maior margem' },
  { coluna: 'custos', direcao: 'desc', rotulo: 'Maior custo' },
  { coluna: 'nome', direcao: 'asc', rotulo: 'Empreendimento e número' },
]

const chaveDe = (a: ApartamentoCard) => `${a.empNome}-${a.numero}`

function SeloGestao({ tipo }: { tipo: string }) {
  if (!tipo) return null
  return (
    <span
      title={tipo === 'adm' ? 'Administração' : tipo === 'sub' ? 'Sublocação' : undefined}
      className="inline-block rounded-md border border-linha bg-creme px-1.5 py-0.5 font-rotulo text-[10.5px] font-semibold uppercase tracking-wide text-tinta-suave"
    >
      {tipo}
    </span>
  )
}

/**
 * Resultado por apartamento. Antes eram ~70 cartões em grade, na ordem do
 * cadastro; agora é uma tabela que dá para buscar, filtrar e ordenar — e que
 * vira lista de cartões compactos no celular.
 *
 * `gestao` e `empreendimento` vêm de fora porque os gráficos acima também
 * mexem neles (clicar num empreendimento ou num tipo de gestão filtra aqui).
 */
export function TabelaApartamentos({
  apartamentos, empreendimentos, empreendimento, onEmpreendimento, gestao, onGestao,
}: {
  apartamentos: ApartamentoCard[]
  empreendimentos: string[]
  empreendimento: string | null
  onEmpreendimento: (nome: string | null) => void
  gestao: FiltroGestao
  onGestao: (gestao: FiltroGestao) => void
}) {
  const censurado = useCensura()
  const [busca, setBusca] = useState('')
  const [recorte, setRecorte] = useState<Recorte>('todos')
  const [ordem, setOrdem] = useState<{ coluna: Coluna; direcao: Direcao }>({ coluna: 'fat', direcao: 'desc' })
  const [mostrarTodos, setMostrarTodos] = useState(false)

  // Recortes rápidos — só aparecem os que têm o que mostrar
  const contagem = useMemo(() => ({
    prejuizo: apartamentos.filter(a => a.luc < 0).length,
    'sem-faturamento': apartamentos.filter(a => a.fat <= 0).length,
    'sem-custo': apartamentos.filter(a => a.custos === 0).length,
  }), [apartamentos])

  const recortes = ([
    { valor: 'prejuizo', rotulo: 'Com prejuízo' },
    { valor: 'sem-faturamento', rotulo: 'Sem faturamento' },
    { valor: 'sem-custo', rotulo: 'Sem custo lançado' },
  ] as const).filter(r =>
    // "sem custo" em todos = o período inteiro ainda não tem custos; o aviso lá de cima já diz isso
    contagem[r.valor] > 0 && !(r.valor === 'sem-custo' && contagem[r.valor] === apartamentos.length)
  )
  const recorteAtivo = recortes.some(r => r.valor === recorte) ? recorte : 'todos'

  const termo = busca.trim().toLowerCase()
  const filtrados = useMemo(() => apartamentos.filter(a => {
    if (gestao !== 'todos' && a.tipo !== gestao) return false
    if (empreendimento && a.empNome !== empreendimento) return false
    if (recorteAtivo === 'prejuizo' && a.luc >= 0) return false
    if (recorteAtivo === 'sem-faturamento' && a.fat > 0) return false
    if (recorteAtivo === 'sem-custo' && a.custos !== 0) return false
    if (termo && !`${a.numero} ${a.empNome}`.toLowerCase().includes(termo)) return false
    return true
  }), [apartamentos, gestao, empreendimento, recorteAtivo, termo])

  const ordenados = useMemo(() => {
    const sinal = ordem.direcao === 'asc' ? 1 : -1
    const valor = (a: ApartamentoCard) =>
      ordem.coluna === 'fat' ? a.fat
        : ordem.coluna === 'custos' ? a.custos
        : ordem.coluna === 'luc' ? a.luc
        : margemDe(a.fat, a.luc) ?? -Infinity
    const porNome = (a: ApartamentoCard, b: ApartamentoCard) =>
      a.empNome.localeCompare(b.empNome) || a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true })
    return [...filtrados].sort((a, b) =>
      ordem.coluna === 'nome' ? sinal * porNome(a, b) : sinal * (valor(a) - valor(b)) || porNome(a, b)
    )
  }, [filtrados, ordem])

  const filtroAtivo = !!termo || gestao !== 'todos' || !!empreendimento || recorteAtivo !== 'todos'
  const visiveis = filtroAtivo || mostrarTodos ? ordenados : ordenados.slice(0, LIMITE)
  const ocultos = ordenados.length - visiveis.length

  const total = useMemo(() => filtrados.reduce(
    (t, a) => ({ fat: t.fat + a.fat, custos: t.custos + a.custos, luc: t.luc + a.luc }),
    { fat: 0, custos: 0, luc: 0 },
  ), [filtrados])
  const maiorFat = Math.max(1, ...apartamentos.map(a => a.fat))

  function limpar() {
    setBusca('')
    setRecorte('todos')
    onGestao('todos')
    onEmpreendimento(null)
  }

  // Cabeçalho clicável: 1º clique ordena do maior para o menor; o 2º inverte
  function ordenarPor(coluna: Coluna) {
    setOrdem(o => o.coluna === coluna
      ? { coluna, direcao: o.direcao === 'desc' ? 'asc' : 'desc' }
      : { coluna, direcao: coluna === 'nome' ? 'asc' : 'desc' })
  }

  // função (não componente): um componente criado dentro do render seria remontado a cada vez
  const cabecalho = (coluna: Coluna, texto: string, numerico = false) => {
    const ativa = ordem.coluna === coluna
    const Icone = !ativa ? ArrowUpDown : ordem.direcao === 'asc' ? ArrowUp : ArrowDown
    return (
      <th
        key={coluna}
        scope="col"
        aria-sort={ativa ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn('px-3 py-2.5 font-medium', numerico ? 'text-right' : 'text-left')}
      >
        <button
          type="button"
          onClick={() => ordenarPor(coluna)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md transition-colors hover:text-tinta',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700',
            numerico && 'flex-row-reverse',
            ativa ? 'text-tinta' : 'text-apagado',
          )}
        >
          {texto}
          <Icone size={13} aria-hidden="true" className={ativa ? '' : 'opacity-50'} />
        </button>
      </th>
    )
  }

  const campo =
    'h-10 rounded-full border border-linha bg-white text-sm text-tinta transition-colors hover:border-[#cfc8b6] ' +
    'focus-visible:border-marca-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-700/15'

  return (
    <section data-entrada aria-labelledby="titulo-apartamentos" className="rounded-2xl border border-linha bg-white">
      {/* ── filtros: uma linha só, acima do que eles recortam ── */}
      <div className="border-b border-linha p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="titulo-apartamentos" className="text-[15px] font-semibold text-tinta">Resultado por apartamento</h2>
          <p className="text-[13px] text-apagado" aria-live="polite">
            {filtroAtivo
              ? `${filtrados.length} de ${apartamentos.length} apartamentos`
              : `${apartamentos.length} apartamentos com movimento`}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <span className="sr-only">Buscar por número ou empreendimento</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-apagado" />
            <input
              type="search" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Número ou empreendimento"
              className={cn(campo, 'w-full pl-10 pr-4 placeholder:text-apagado/70 [&::-webkit-search-cancel-button]:appearance-none')}
            />
          </label>

          <Segmentado rotulo="Tipo de gestão" opcoes={GESTAO} valor={gestao} onMudar={onGestao} />

          <label className="relative">
            <span className="sr-only">Empreendimento</span>
            <select
              value={empreendimento ?? ''} onChange={e => onEmpreendimento(e.target.value || null)}
              className={cn(campo, 'max-w-[13rem] cursor-pointer appearance-none truncate pl-4 pr-9')}
            >
              <option value="">Todos os empreendimentos</option>
              {empreendimentos.map(nome => <option key={nome} value={nome}>{nome}</option>)}
            </select>
            <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-apagado" />
          </label>

          {/* no celular não há cabeçalho de coluna para clicar: a ordenação vem para cá */}
          <label className="relative md:hidden">
            <span className="sr-only">Ordenar por</span>
            <select
              value={`${ordem.coluna}:${ordem.direcao}`}
              onChange={e => {
                const [coluna, direcao] = e.target.value.split(':') as [Coluna, Direcao]
                setOrdem({ coluna, direcao })
              }}
              className={cn(campo, 'cursor-pointer appearance-none pl-4 pr-9')}
            >
              {ORDENACOES.map(o => (
                <option key={`${o.coluna}:${o.direcao}`} value={`${o.coluna}:${o.direcao}`}>{o.rotulo}</option>
              ))}
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

        {recortes.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Recortes rápidos">
            {recortes.map(r => {
              const ativo = recorteAtivo === r.valor
              return (
                <button
                  key={r.valor} type="button" aria-pressed={ativo}
                  onClick={() => setRecorte(ativo ? 'todos' : r.valor)}
                  className={cn(
                    'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors',
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
        )}
      </div>

      {ordenados.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-creme text-apagado"><FilterX size={22} aria-hidden="true" /></span>
          <p className="mt-4 font-semibold text-tinta">Nenhum apartamento com esses filtros</p>
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
          {/* ── desktop/tablet: tabela ── */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-linha text-[13px]">
                  {cabecalho('nome', 'Apartamento')}
                  <th scope="col" className="px-3 py-2.5 text-left font-medium text-apagado">Gestão</th>
                  {cabecalho('fat', 'Faturamento', true)}
                  {cabecalho('custos', 'Custos', true)}
                  {cabecalho('luc', 'Lucro', true)}
                  {cabecalho('margem', 'Margem', true)}
                </tr>
              </thead>
              <tbody>
                {visiveis.map(a => {
                  const margem = margemDe(a.fat, a.luc)
                  return (
                    <tr key={chaveDe(a)} className="border-b border-linha/70 transition-colors last:border-0 hover:bg-creme/70">
                      <th scope="row" className="px-3 py-2.5 pl-5 text-left font-normal">
                        <span className="block font-semibold text-tinta">{a.numero}</span>
                        <span className="block text-xs text-apagado">{a.empNome}</span>
                      </th>
                      <td className="px-3 py-2.5"><SeloGestao tipo={a.tipo} /></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <Valor className="font-medium text-tinta">{moeda(a.fat)}</Valor>
                        {/* barrinha: o faturamento deste apartamento contra o maior da lista */}
                        <span aria-hidden="true" className={cn('ml-auto mt-1.5 block h-1 w-28 overflow-hidden rounded-full bg-serie-faturamento/12', censurado && 'opacity-60 blur-[3px]')}>
                          <span className="ml-auto block h-full rounded-full bg-serie-faturamento" style={{ width: `${Math.max(0, (a.fat / maiorFat) * 100)}%` }} />
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-tinta-suave"><Valor>{moeda(a.custos)}</Valor></td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <Valor className={a.luc < 0 ? 'font-semibold text-negativo' : 'font-medium text-tinta'}>{moedaComSinal(a.luc)}</Valor>
                      </td>
                      <td className="px-3 py-2.5 pr-5 text-right tabular-nums text-tinta-suave">
                        {margem === null ? <span className="text-apagado/60">—</span> : <Valor>{porcento(margem)}</Valor>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-linha bg-creme/60 text-[13px]">
                  <th scope="row" colSpan={2} className="px-3 py-3 pl-5 text-left font-semibold text-tinta">
                    Total {filtroAtivo ? 'do filtro' : 'dos apartamentos'}
                  </th>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-tinta"><Valor>{moeda(total.fat)}</Valor></td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-tinta"><Valor>{moeda(total.custos)}</Valor></td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">
                    <Valor className={total.luc < 0 ? 'text-negativo' : 'text-tinta'}>{moedaComSinal(total.luc)}</Valor>
                  </td>
                  <td className="px-3 py-3 pr-5 text-right font-semibold tabular-nums text-tinta">
                    {margemDe(total.fat, total.luc) === null ? '—' : <Valor>{porcento(margemDe(total.fat, total.luc)!)}</Valor>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── celular: cartões compactos ── */}
          <ul className="divide-y divide-linha/70 md:hidden">
            {visiveis.map(a => (
              <li key={chaveDe(a)} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-tinta">{a.numero}</p>
                    <p className="truncate text-xs text-apagado">{a.empNome}</p>
                  </div>
                  <SeloGestao tipo={a.tipo} />
                </div>
                <dl className="mt-2.5 grid grid-cols-3 gap-2 text-[13px] tabular-nums">
                  <div>
                    <dt className="text-xs text-apagado">Faturamento</dt>
                    <dd className="mt-0.5 font-medium text-tinta"><Valor>{moeda(a.fat)}</Valor></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-apagado">Custos</dt>
                    <dd className="mt-0.5 text-tinta-suave"><Valor>{moeda(a.custos)}</Valor></dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-apagado">Lucro</dt>
                    <dd className="mt-0.5">
                      <Valor className={a.luc < 0 ? 'font-semibold text-negativo' : 'font-medium text-tinta'}>{moedaComSinal(a.luc)}</Valor>
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
            <li className="bg-creme/60 px-5 py-3.5 text-[13px]">
              <p className="font-semibold text-tinta">Total {filtroAtivo ? 'do filtro' : 'dos apartamentos'}</p>
              <p className="mt-1 tabular-nums text-tinta-suave">
                <Valor>{moeda(total.fat)}</Valor> de faturamento · lucro{' '}
                <Valor className={total.luc < 0 ? 'font-semibold text-negativo' : 'font-semibold text-tinta'}>{moedaComSinal(total.luc)}</Valor>
              </p>
            </li>
          </ul>

          {(ocultos > 0 || (mostrarTodos && !filtroAtivo && ordenados.length > LIMITE)) && (
            <div className="border-t border-linha p-3 text-center">
              <button
                type="button" onClick={() => setMostrarTodos(v => !v)}
                className="h-10 rounded-full px-5 text-sm font-semibold text-marca-700 transition-colors hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
              >
                {ocultos > 0 ? `Mostrar todos os ${ordenados.length} apartamentos` : `Mostrar só os ${LIMITE} primeiros`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

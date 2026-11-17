'use client'

import { Fragment, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronRight, FilterX, Loader2, Pencil, Plus, Search, Settings2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROTULO_TIPO, TOLERANCIA_BASE, type ContaOp } from '@/lib/custos-operacionais'
import { Segmentado, moeda, porcento } from '@/components/dashboard/valor'
import { CampoMoeda } from '@/components/painel/campo-moeda'

type Mostrar = 'todas' | 'com' | 'sem'
const MOSTRAR: { valor: Mostrar; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' }, { valor: 'com', rotulo: 'Com valor' }, { valor: 'sem', rotulo: 'Sem valor' },
]

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const centavos = (n: number) => Math.round(n * 100) / 100
const soma = (contas: ContaOp[], de: (c: ContaOp) => number) => contas.reduce((s, c) => s + de(c), 0)

const botaoIcone =
  'grid size-9 place-items-center rounded-full text-apagado transition-colors hover:bg-marca-50 hover:text-marca-700 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700'

function SeloTipo({ tipo }: { tipo: ContaOp['tipo'] }) {
  return (
    <span className={cn(
      'inline-block rounded-md px-1.5 py-0.5 text-[11.5px] font-medium',
      tipo === 'fixo' ? 'bg-marca-50 text-marca-700' : tipo === 'provisao' ? 'border border-linha bg-white text-tinta-suave' : 'bg-creme text-tinta-suave',
    )}>
      {ROTULO_TIPO[tipo]}
    </span>
  )
}

/**
 * Quanto o valor do mês fugiu do valor base. Dentro da tolerância (10%) é só um
 * número discreto; fora dela vira um aviso — com seta e sinal, nunca só pela cor.
 */
function Variacao({ valor, base }: { valor: number | undefined; base: number }) {
  if (valor === undefined || base <= 0) return <span className="text-apagado/50">—</span>
  const v = (valor - base) / base
  const arredondado = Math.round(Math.abs(v) * 100)
  const texto = `${arredondado === 0 ? '' : v > 0 ? '+' : '−'}${arredondado}%`
  if (Math.abs(v) <= TOLERANCIA_BASE) return <span className="text-apagado">{texto}</span>
  const Seta = v > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      title={`${v > 0 ? 'Acima' : 'Abaixo'} do valor base (${moeda(base)}) em mais de ${porcento(TOLERANCIA_BASE * 100)}`}
      className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900"
    >
      <Seta size={13} aria-hidden="true" />
      {texto}
      <span className="sr-only"> — fora da faixa do valor base</span>
    </span>
  )
}

/**
 * As contas do mês, grupo a grupo, com o valor de cada uma. É também onde o
 * analista lança: clicar no valor abre o campo; Enter grava e desce para a
 * conta de baixo (como preencher uma coluna de planilha), Esc desiste. Campo
 * vazio ou zero tira o valor do mês.
 *
 * Não guarda cópia dos dados: valores e contas vêm de cima e as gravações
 * sobem por `onSalvar`.
 */
export function ContasDoMes({
  contas, valores, anteriores, nomeMes, nomeMesAnterior, podeEditar, recorte, onSalvar, onEditarConta, onNovaConta, alteracoes,
}: {
  /** Contas que aparecem neste mês, já na ordem do plano */
  contas: ContaOp[]
  /** conta → valor do mês */
  valores: Map<string, number>
  /** conta → valor do mês anterior; `null` quando o mês anterior é de outro ano */
  anteriores: Map<string, number> | null
  nomeMes: string
  nomeMesAnterior: string | null
  podeEditar: boolean
  /** Filtro escolhido no gráfico ao lado (grupo, classificação ou vencimento) */
  recorte: { rotulo: string; aceita: (c: ContaOp) => boolean; limpar: () => void } | null
  /** Devolve a mensagem de erro, ou `null` se gravou */
  onSalvar: (conta: ContaOp, valor: number | null) => Promise<string | null>
  onEditarConta: (conta: ContaOp) => void
  onNovaConta: () => void
  alteracoes: number
}) {
  const [busca, setBusca] = useState('')
  const [mostrar, setMostrar] = useState<Mostrar>('todas')
  const [fechados, setFechados] = useState<Set<string>>(new Set())
  const [editando, setEditando] = useState<{ id: string; valor: number | null } | null>(null)
  const [salvando, setSalvando] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState<string | null>(null)
  // O campo que perde o foco ao ser desmontado ainda dispara "blur" com o estado
  // antigo; a referência diz qual conta está REALMENTE em edição agora.
  const emEdicao = useRef<string | null>(null)

  const termo = normalizar(busca.trim())
  const filtradas = useMemo(() => contas.filter(c =>
    (!recorte || recorte.aceita(c)) &&
    (mostrar === 'todas' || (mostrar === 'com') === valores.has(c.id)) &&
    (!termo || normalizar(`${c.codigo} ${c.nome} ${c.observacao ?? ''}`).includes(termo)),
  ), [contas, recorte, mostrar, valores, termo])

  const grupos = useMemo(() => {
    const mapa = new Map<string, ContaOp[]>()
    for (const c of filtradas) mapa.set(c.grupo, [...(mapa.get(c.grupo) ?? []), c])
    return [...mapa].map(([nome, itens]) => ({ nome, itens }))
  }, [filtradas])

  // ordem em que o Enter percorre: só o que está à vista
  const percurso = grupos.filter(g => !fechados.has(g.nome)).flatMap(g => g.itens)
  const valorDe = (c: ContaOp) => valores.get(c.id) ?? 0
  const anteriorDe = (c: ContaOp) => anteriores?.get(c.id) ?? 0
  const filtroAtivo = !!termo || mostrar !== 'todas' || !!recorte
  const totalMes = soma(filtradas, valorDe)
  const comValor = filtradas.filter(c => valores.has(c.id)).length

  function limpar() {
    setBusca('')
    setMostrar('todas')
    recorte?.limpar()
  }

  function alternarGrupo(nome: string) {
    setFechados(atual => {
      const novo = new Set(atual)
      if (!novo.delete(nome)) novo.add(nome)
      return novo
    })
  }

  /* ── lançar na linha ─────────────────────────────────────────────── */
  function abrir(c: ContaOp) {
    emEdicao.current = c.id
    setEditando({ id: c.id, valor: valores.get(c.id) ?? null })
    setErro(null)
  }
  function cancelar() {
    emEdicao.current = null
    setEditando(null)
  }
  async function gravar(conta: ContaOp, valor: number | null) {
    setSalvando(s => new Set(s).add(conta.id))
    const falha = await onSalvar(conta, valor)
    setSalvando(s => { const n = new Set(s); n.delete(conta.id); return n })
    if (falha) setErro(`${conta.codigo} ${conta.nome}: ${falha}`)
  }
  function confirmar(conta: ContaOp, digitado: number | null, descer: boolean) {
    if (emEdicao.current !== conta.id) return // "blur" atrasado de um campo que já fechou
    const novo = digitado !== null && digitado > 0 ? centavos(digitado) : null
    const proxima = descer ? percurso[percurso.findIndex(c => c.id === conta.id) + 1] : undefined
    emEdicao.current = proxima?.id ?? null
    setEditando(proxima ? { id: proxima.id, valor: valores.get(proxima.id) ?? null } : null)
    // grava em segundo plano: quem está digitando a coluna não espera a rede
    if (novo !== (valores.get(conta.id) ?? null)) void gravar(conta, novo)
  }
  const aoTeclar = (conta: ContaOp) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmar(conta, editando?.valor ?? null, true) }
    if (e.key === 'Escape') { e.preventDefault(); cancelar() }
  }

  /** A célula do valor: campo quando em edição; botão (analista) ou texto (admin) no resto do tempo. */
  const celulaValor = (c: ContaOp, classeCampo: string) => {
    const v = valores.get(c.id)
    if (editando?.id === c.id) {
      return (
        <CampoMoeda
          autoFocus aria-label={`Valor de ${c.nome} em ${nomeMes}`} valor={editando.valor}
          onMudar={valor => setEditando({ id: c.id, valor })}
          onKeyDown={aoTeclar(c)} onBlur={() => confirmar(c, editando.valor, false)}
          className={classeCampo}
        />
      )
    }
    const conteudo = (
      <>
        {salvando.has(c.id) && <Loader2 size={13} aria-label="Gravando" className="animate-spin text-apagado" />}
        {v !== undefined
          ? <span className="font-semibold text-tinta">{moeda(v)}</span>
          : <span className="text-apagado/60">{podeEditar ? 'Lançar' : '—'}</span>}
      </>
    )
    // 11px à direita nos dois casos (borda + recuo do botão): com os 12px da célula dão os 23px
    // que as linhas de subtotal e de total usam — é o que mantém a coluna alinhada
    if (!podeEditar) return <span className="inline-flex h-9 items-center justify-end gap-1.5 pr-[11px] tabular-nums">{conteudo}</span>
    return (
      <button
        type="button" onClick={() => abrir(c)}
        aria-label={`${c.nome}: ${v !== undefined ? moeda(v) : 'sem valor'} em ${nomeMes}. Editar`}
        className={cn(
          'group/valor inline-flex h-9 items-center justify-end gap-1.5 rounded-lg border border-transparent px-2.5 tabular-nums transition-colors',
          'hover:border-linha hover:bg-white focus-visible:border-marca-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-700/15',
        )}
      >
        {/* o lápis fica ANTES do número: à direita ele desalinharia a coluna */}
        <Pencil size={12} aria-hidden="true" className="text-apagado opacity-0 transition-opacity group-hover/valor:opacity-100 group-focus-visible/valor:opacity-100" />
        {conteudo}
      </button>
    )
  }

  return (
    <section data-entrada aria-labelledby="titulo-contas" className="rounded-2xl border border-linha bg-white">
      <div className="border-b border-linha p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="titulo-contas" className="text-[15px] font-semibold text-tinta">Contas de {nomeMes}</h2>
          <p className="text-[13px] text-apagado" aria-live="polite">
            <strong className="font-semibold text-tinta">{comValor}</strong> de {filtradas.length} {filtradas.length === 1 ? 'conta' : 'contas'} com valor ·{' '}
            <strong className="font-semibold tabular-nums text-tinta">{moeda(totalMes)}</strong>
            {alteracoes > 0 && <span className="ml-2 font-medium text-positivo">✓ {alteracoes} {alteracoes === 1 ? 'alteração gravada' : 'alterações gravadas'}</span>}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <span className="sr-only">Buscar conta por nome ou código</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-apagado" />
            <input
              type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Conta ou código"
              className="h-10 w-full rounded-full border border-linha bg-white pl-10 pr-4 text-sm text-tinta transition-colors placeholder:text-apagado/70 hover:border-[#cfc8b6] focus-visible:border-marca-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-700/15 [&::-webkit-search-cancel-button]:appearance-none"
            />
          </label>
          <Segmentado rotulo="Mostrar contas" opcoes={MOSTRAR} valor={mostrar} onMudar={setMostrar} />

          {recorte && (
            <span className="inline-flex h-9 items-center gap-1 rounded-full bg-marca-50 pl-3 pr-1 text-[13px] font-medium text-marca-700">
              {recorte.rotulo}
              <button
                type="button" onClick={recorte.limpar} aria-label={`Tirar o filtro ${recorte.rotulo}`}
                className="grid size-7 place-items-center rounded-full transition-colors hover:bg-marca-100 focus-visible:outline-2 focus-visible:outline-marca-700"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          )}

          {podeEditar && (
            <button
              type="button" onClick={onNovaConta}
              className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full border border-linha bg-white px-4 text-sm font-medium text-tinta transition-colors hover:bg-creme-escuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
            >
              <Plus size={16} aria-hidden="true" />
              Nova conta
            </button>
          )}
        </div>

        {podeEditar && (
          <p className="mt-3 text-[13px] text-apagado">
            Clique no valor para lançar. <kbd className="rounded border border-linha bg-creme px-1 font-sans text-xs">Enter</kbd> grava e desce para a conta de baixo;{' '}
            <kbd className="rounded border border-linha bg-creme px-1 font-sans text-xs">Esc</kbd> desiste. Campo vazio tira o valor do mês.
          </p>
        )}
        {erro && (
          <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-negativo">Não gravou — {erro}</p>
        )}
      </div>

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-creme text-apagado"><FilterX size={22} aria-hidden="true" /></span>
          <p className="mt-4 font-semibold text-tinta">{filtroAtivo ? 'Nenhuma conta com esses filtros' : 'Nenhuma conta cadastrada'}</p>
          {filtroAtivo && (
            <button
              type="button" onClick={limpar}
              className="mt-5 h-10 rounded-full bg-marca-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-marca-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── a partir do tablet: tabela ── */}
          {/* `relative`: os textos só para leitor de tela são `absolute`; sem isto eles escapam da
              área rolável e criam rolagem lateral na página inteira */}
          <div className="relative hidden overflow-x-auto md:block">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-linha text-left text-[13px] text-apagado">
                  <th scope="col" className="w-16 py-2.5 pl-5 pr-2 font-medium">Cód.</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Conta</th>
                  <th scope="col" className="hidden px-3 py-2.5 font-medium xl:table-cell">Tipo</th>
                  <th scope="col" className="hidden px-3 py-2.5 text-center font-medium xl:table-cell" title="Dia de vencimento">Venc.</th>
                  {anteriores && <th scope="col" className="hidden px-3 py-2.5 text-right font-medium xl:table-cell">{nomeMesAnterior}</th>}
                  <th scope="col" className="px-3 py-2.5 text-right font-medium" title="Valor de referência: quanto a conta costuma ser">Valor base</th>
                  <th scope="col" className="py-2.5 pl-3 pr-[23px] text-right font-medium text-tinta">{nomeMes}</th>
                  <th scope="col" className={cn('px-3 py-2.5 text-right font-medium', !podeEditar && 'pr-5')} title="Diferença entre o valor do mês e o valor base">vs. base</th>
                  {podeEditar && <th scope="col" className="w-14 py-2.5 pl-1 pr-4"><span className="sr-only">Editar conta</span></th>}
                </tr>
              </thead>
              <tbody>
                {grupos.map(g => {
                  const aberto = !fechados.has(g.nome)
                  const n = g.itens.filter(c => valores.has(c.id)).length
                  return (
                    <Fragment key={g.nome}>
                      <tr className="border-b border-linha/70 bg-creme/50">
                        <th scope="row" colSpan={2} className="px-3 py-2 text-left font-normal">
                          <button
                            type="button" onClick={() => alternarGrupo(g.nome)} aria-expanded={aberto}
                            className="inline-flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-left transition-colors hover:bg-creme-escuro focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marca-700"
                          >
                            <ChevronRight size={16} aria-hidden="true" className={cn('shrink-0 text-apagado transition-transform', aberto && 'rotate-90')} />
                            <span className="flex flex-wrap items-baseline gap-x-2">
                              <span className="font-semibold text-tinta">{g.nome}</span>
                              <span className="whitespace-nowrap text-[13px] text-apagado">{n} de {g.itens.length} com valor</span>
                            </span>
                          </button>
                        </th>
                        <td colSpan={2} className="hidden xl:table-cell" />
                        {anteriores && <td className="hidden whitespace-nowrap px-3 py-2 text-right tabular-nums text-tinta-suave xl:table-cell">{moeda(soma(g.itens, anteriorDe))}</td>}
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-tinta-suave">{moeda(soma(g.itens, c => c.valor_base))}</td>
                        <td className="whitespace-nowrap px-3 py-2 pr-[23px] text-right font-semibold tabular-nums text-tinta">{moeda(soma(g.itens, valorDe))}</td>
                        <td colSpan={podeEditar ? 2 : 1} />
                      </tr>
                      {aberto && g.itens.map(c => (
                        <tr key={c.id} className={cn('border-b border-linha/70 transition-colors', editando?.id === c.id ? 'bg-marca-50/60' : 'hover:bg-creme/60')}>
                          <td className="py-2 pl-5 pr-2 font-rotulo text-xs tabular-nums text-apagado">{c.codigo}</td>
                          <th scope="row" className="max-w-[22rem] px-3 py-2 text-left font-normal">
                            <span className="font-medium text-tinta">{c.nome}</span>
                            {!c.ativo && <span className="ml-2 rounded-md border border-linha px-1.5 py-0.5 text-[11px] text-apagado">encerrada</span>}
                            {/* em tela média, tipo e vencimento vêm aqui (em tela larga são colunas) */}
                            <span className="mt-0.5 block text-xs text-apagado xl:hidden">
                              {ROTULO_TIPO[c.tipo]}{c.dia_vencimento ? ` · vence dia ${c.dia_vencimento}` : ''}
                            </span>
                            {c.observacao && <span className="mt-0.5 block truncate text-xs text-apagado" title={c.observacao}>{c.observacao}</span>}
                          </th>
                          <td className="hidden px-3 py-2 xl:table-cell"><SeloTipo tipo={c.tipo} /></td>
                          <td className="hidden px-3 py-2 text-center tabular-nums text-tinta-suave xl:table-cell">{c.dia_vencimento ?? <span className="text-apagado/50">—</span>}</td>
                          {anteriores && (
                            <td className="hidden whitespace-nowrap px-3 py-2 text-right tabular-nums text-tinta-suave xl:table-cell">
                              {anteriores.has(c.id) ? moeda(anteriorDe(c)) : <span className="text-apagado/50">—</span>}
                            </td>
                          )}
                          <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-tinta-suave">
                            {c.valor_base > 0 ? moeda(c.valor_base) : <span className="text-apagado/50">—</span>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-right">{celulaValor(c, 'ml-auto h-9 w-36')}</td>
                          <td className={cn('whitespace-nowrap px-3 py-2 text-right tabular-nums', !podeEditar && 'pr-5')}>
                            <Variacao valor={valores.get(c.id)} base={c.valor_base} />
                          </td>
                          {podeEditar && (
                            <td className="py-1.5 pl-1 pr-4">
                              <button type="button" onClick={() => onEditarConta(c)} aria-label={`Editar a conta ${c.nome}`} title="Editar conta" className={botaoIcone}>
                                <Settings2 size={15} aria-hidden="true" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="text-[15px]">
                  <th scope="row" colSpan={2} className="py-3.5 pl-5 pr-3 text-left font-semibold text-tinta">
                    {filtroAtivo ? 'Total das contas filtradas' : 'Total do mês'}
                  </th>
                  <td colSpan={2} className="hidden xl:table-cell" />
                  {anteriores && <td className="hidden whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-tinta-suave xl:table-cell">{moeda(soma(filtradas, anteriorDe))}</td>}
                  <td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums text-tinta-suave">{moeda(soma(filtradas, c => c.valor_base))}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 pr-[23px] text-right font-semibold tabular-nums text-tinta">{moeda(totalMes)}</td>
                  <td colSpan={podeEditar ? 2 : 1} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── celular: uma conta por linha, grupo a grupo ── */}
          <div className="md:hidden">
            {grupos.map(g => {
              const aberto = !fechados.has(g.nome)
              const n = g.itens.filter(c => valores.has(c.id)).length
              return (
                <div key={g.nome}>
                  <button
                    type="button" onClick={() => alternarGrupo(g.nome)} aria-expanded={aberto}
                    className="flex w-full items-center gap-2 border-b border-linha/70 bg-creme/50 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-marca-700"
                  >
                    <ChevronRight size={16} aria-hidden="true" className={cn('shrink-0 text-apagado transition-transform', aberto && 'rotate-90')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-tinta">{g.nome}</span>
                      <span className="block text-xs text-apagado">{n} de {g.itens.length} com valor</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-tinta">{moeda(soma(g.itens, valorDe))}</span>
                  </button>
                  {aberto && (
                    <ul className="divide-y divide-linha/70 border-b border-linha/70">
                      {g.itens.map(c => (
                        // duas linhas por conta: são dezenas delas, e a lista é o formulário de lançamento
                        <li key={c.id} className={cn('px-4 py-2.5', editando?.id === c.id && 'bg-marca-50/60')}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="min-w-0 font-medium leading-snug text-tinta">
                              <span className="mr-1.5 font-rotulo text-xs font-normal text-apagado">{c.codigo}</span>{c.nome}
                            </p>
                            <div className="shrink-0">{celulaValor(c, 'h-11 w-36 text-base')}</div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-apagado">
                              <SeloTipo tipo={c.tipo} />
                              {c.dia_vencimento && <span>dia {c.dia_vencimento}</span>}
                              {c.valor_base > 0 && <span>base {moeda(c.valor_base)}</span>}
                              {!c.ativo && <span>encerrada</span>}
                            </p>
                            <span className="flex shrink-0 items-center gap-1">
                              {c.valor_base > 0 && valores.has(c.id) && (
                                <span className="text-xs tabular-nums"><Variacao valor={valores.get(c.id)} base={c.valor_base} /></span>
                              )}
                              {podeEditar && (
                                <button type="button" onClick={() => onEditarConta(c)} aria-label={`Editar a conta ${c.nome}`} className={cn(botaoIcone, 'size-10')}>
                                  <Settings2 size={16} aria-hidden="true" />
                                </button>
                              )}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
            <p className="flex items-baseline justify-between gap-3 px-4 py-4 text-[15px]">
              <span className="font-semibold text-tinta">{filtroAtivo ? 'Total filtrado' : 'Total do mês'}</span>
              <span className="font-semibold tabular-nums text-tinta">{moeda(totalMes)}</span>
            </p>
          </div>
        </>
      )}
    </section>
  )
}

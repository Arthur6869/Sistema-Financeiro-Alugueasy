'use client'

import { useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { CircleAlert, DatabaseZap, ListPlus, Plus, RefreshCw } from 'lucide-react'
import { MESES, formatCurrency } from '@/lib/constants'
import { TOLERANCIA_BASE, ordenarContas, type ContaOp, type LancamentoOp } from '@/lib/custos-operacionais'
import { cn } from '@/lib/utils'
import { PaginaInterna } from '@/components/painel/pagina'
import { Cartao, Numero } from '@/components/dashboard/kpis'
import { NumeroAnimado, Segmentado, moeda, porcento } from '@/components/dashboard/valor'
import { RankingCustos, type ItemRanking } from '@/components/custos/ranking-custos'
import { ContasDoMes } from './contas-do-mes'
import { DialogoConta } from './dialogo-conta'
import { EvolucaoAno } from './evolucao-ano'

/** `sem-estrutura`: as tabelas da migration 047 ainda não existem no banco. */
export type EstadoCustosOp = 'ok' | 'sem-estrutura' | 'erro'

type Dimensao = 'grupo' | 'classificacao' | 'vencimento'
const DIMENSOES: { valor: Dimensao; rotulo: string }[] = [
  { valor: 'grupo', rotulo: 'Grupo' }, { valor: 'classificacao', rotulo: 'DRE' }, { valor: 'vencimento', rotulo: 'Vencimento' },
]
const DIMENSAO: Record<Dimensao, { titulo: string; plural: string; feminino: boolean; etiqueta: string; chave: (c: ContaOp) => string }> = {
  grupo: { titulo: 'Custos por grupo', plural: 'grupos', feminino: false, etiqueta: 'Grupo', chave: c => c.grupo },
  classificacao: { titulo: 'Custos por classificação no DRE', plural: 'classificações', feminino: true, etiqueta: 'DRE', chave: c => c.classificacao_dre },
  vencimento: { titulo: 'Custos por dia de vencimento', plural: 'vencimentos', feminino: false, etiqueta: 'Vencimento', chave: c => (c.dia_vencimento ? `Dia ${c.dia_vencimento}` : 'Sem dia definido') },
}

const botaoPrimario =
  'inline-flex h-11 items-center gap-2 rounded-full bg-marca-800 px-5 text-sm font-semibold text-white transition-colors ' +
  'hover:bg-marca-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700 disabled:opacity-60'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/**
 * Aba Custos Operacionais: quanto a operação custou no mês, conta a conta, e
 * como isso anda ao longo do ano.
 *
 * O servidor entrega o plano de contas e os valores do ANO inteiro; a tela
 * recorta o mês, soma e compara no navegador. É a única dona das listas —
 * e elas acompanham o que o servidor manda (troca de mês/ano, atualização).
 */
export function TelaCustosOperacionais({ contas, lancamentos, mes, ano, podeEditar, estado, erro }: {
  contas: ContaOp[]
  /** Todos os valores lançados no ano */
  lancamentos: LancamentoOp[]
  mes: number
  ano: number
  podeEditar: boolean
  estado: EstadoCustosOp
  erro?: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [navegando, iniciar] = useTransition()

  const [plano, setPlano] = useState(contas)
  const [planoRecebido, setPlanoRecebido] = useState(contas)
  const [valoresAno, setValoresAno] = useState(lancamentos)
  const [valoresRecebidos, setValoresRecebidos] = useState(lancamentos)
  if (planoRecebido !== contas) { setPlanoRecebido(contas); setPlano(contas) }
  if (valoresRecebidos !== lancamentos) { setValoresRecebidos(lancamentos); setValoresAno(lancamentos) }

  const [dimensao, setDimensao] = useState<Dimensao>('grupo')
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [dialogo, setDialogo] = useState<{ conta: ContaOp | null } | null>(null)
  const [alteracoes, setAlteracoes] = useState(0)

  const nomeMes = MESES[mes - 1]
  const nomePeriodo = `${nomeMes} ${ano}`
  const porId = useMemo(() => new Map(plano.map(c => [c.id, c])), [plano])

  /* ── o ano, mês a mês ── */
  const { totais, contagem } = useMemo(() => {
    const totais = Array<number>(12).fill(0)
    const contagem = Array<number>(12).fill(0)
    for (const l of valoresAno) { totais[l.mes - 1] += l.valor; contagem[l.mes - 1] += 1 }
    return { totais, contagem }
  }, [valoresAno])

  /* ── o mês aberto ── */
  const valores = useMemo(() => new Map(valoresAno.filter(l => l.mes === mes).map(l => [l.conta_id, l.valor])), [valoresAno, mes])
  // janeiro não tem "mês anterior" aqui: dezembro é de outro ano e não foi carregado
  const anteriores = useMemo(
    () => (mes > 1 ? new Map(valoresAno.filter(l => l.mes === mes - 1).map(l => [l.conta_id, l.valor])) : null),
    [valoresAno, mes],
  )
  // conta encerrada só aparece no mês em que tem valor
  const contasDoMes = useMemo(() => ordenarContas(plano.filter(c => c.ativo || valores.has(c.id))), [plano, valores])

  const resumo = useMemo(() => {
    const porTipo = { fixo: 0, variavel: 0, provisao: 0 }
    const contasPorTipo = { fixo: 0, variavel: 0, provisao: 0 }
    for (const [id, valor] of valores) {
      const tipo = porId.get(id)?.tipo ?? 'variavel'
      porTipo[tipo] += valor
      contasPorTipo[tipo] += 1
    }
    return {
      total: totais[mes - 1],
      anterior: mes > 1 ? totais[mes - 2] : 0,
      porTipo, contasPorTipo,
      base: plano.filter(c => c.ativo).reduce((s, c) => s + c.valor_base, 0),
    }
  }, [valores, porId, totais, mes, plano])

  const ranking = useMemo<ItemRanking[]>(() => {
    const chave = DIMENSAO[dimensao].chave
    const soma = new Map<string, number>()
    for (const [id, valor] of valores) {
      const conta = porId.get(id)
      if (conta) soma.set(chave(conta), (soma.get(chave(conta)) ?? 0) + valor)
    }
    return [...soma].map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
  }, [valores, porId, dimensao])

  const recorte = selecionado
    ? {
        rotulo: `${DIMENSAO[dimensao].etiqueta}: ${selecionado}`,
        aceita: (c: ContaOp) => DIMENSAO[dimensao].chave(c) === selecionado,
        limpar: () => setSelecionado(null),
      }
    : null

  /* ── ações ── */
  function irParaMes(m: number) {
    if (m === mes) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', String(m))
    params.set('ano', String(ano))
    iniciar(() => router.push(`${pathname}?${params.toString()}`))
  }
  const atualizar = () => iniciar(() => router.refresh())

  async function salvarValor(conta: ContaOp, valor: number | null) {
    try {
      const res = await fetch('/api/custos-operacionais/lancamentos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conta_id: conta.id, mes, ano, valor }),
      })
      const corpo = await res.json().catch(() => null)
      if (!res.ok) return (corpo?.error as string | undefined) ?? 'não foi possível gravar.'
      const gravado = (corpo?.lancamento ?? null) as LancamentoOp | null
      setValoresAno(atual => [
        ...atual.filter(l => !(l.conta_id === conta.id && l.mes === mes && l.ano === ano)),
        ...(gravado ? [{ ...gravado, valor: Number(gravado.valor) }] : []),
      ])
      setAlteracoes(n => n + 1)
      return null
    } catch {
      return 'sem resposta do servidor. Confira a conexão e tente de novo.'
    }
  }

  function aoSalvarConta(conta: ContaOp, nova: boolean) {
    setPlano(atual => (nova ? [...atual, conta] : atual.map(c => (c.id === conta.id ? conta : c))))
    setDialogo(null)
    toast.success(nova ? `Conta ${conta.codigo} criada` : 'Conta atualizada')
    router.refresh()
  }

  /* ── leituras do mês ── */
  const diferenca = resumo.total - resumo.anterior
  const doTotal = (v: number) => (resumo.total > 0 ? porcento((v / resumo.total) * 100) : '0%')
  const foraDaBase = resumo.base > 0 ? (resumo.total - resumo.base) / resumo.base : 0
  const contasComValor = valores.size

  const sub =
    estado !== 'ok' ? nomePeriodo
      : plano.length === 0 ? `${nomePeriodo} · nenhuma conta cadastrada`
      : `${nomePeriodo} · ${contasComValor} de ${plural(contasDoMes.length, 'conta', 'contas')} com valor`

  return (
    <PaginaInterna
      rotulo="Despesas da operação"
      titulo="Custos operacionais"
      sub={sub}
      periodo={{ mes, ano, permitirTodos: false }}
    >
      {estado === 'sem-estrutura' ? (
        <section data-entrada className="flex flex-col items-center rounded-2xl border border-linha bg-white px-5 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-creme text-apagado"><DatabaseZap size={22} aria-hidden="true" /></span>
          <h2 className="mt-4 font-semibold text-tinta">Falta criar a estrutura no banco</h2>
          <p className="mt-1 max-w-lg text-sm text-apagado">
            Esta aba passou a guardar os custos conta a conta, mês a mês, e as duas tabelas novas ainda não existem.
            {podeEditar
              ? <> Aplique a migration <strong className="font-semibold text-tinta-suave">047_custos_operacionais_plano_de_contas.sql</strong> no SQL Editor do Supabase e, em seguida, rode a carga da planilha. Depois é só atualizar.</>
              : ' Assim que o analista aplicar a atualização, os valores aparecem aqui.'}
          </p>
          <button type="button" onClick={atualizar} disabled={navegando} className={`${botaoPrimario} mt-5`}>
            <RefreshCw size={16} aria-hidden="true" className={navegando ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </section>
      ) : estado === 'erro' ? (
        <section data-entrada role="alert" className="flex flex-col items-center rounded-2xl border border-red-200 bg-white px-5 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-negativo"><CircleAlert size={22} aria-hidden="true" /></span>
          <h2 className="mt-4 font-semibold text-tinta">Não foi possível carregar os custos operacionais</h2>
          <p className="mt-1 max-w-md text-sm text-apagado">
            A consulta ao banco falhou, então nada é mostrado para não parecer que o mês está zerado. Detalhe: {erro}
          </p>
          <button type="button" onClick={atualizar} disabled={navegando} className={`${botaoPrimario} mt-5`}>
            <RefreshCw size={16} aria-hidden="true" className={navegando ? 'animate-spin' : ''} />
            Tentar de novo
          </button>
        </section>
      ) : plano.length === 0 ? (
        <section data-entrada className="flex flex-col items-center rounded-2xl border border-linha bg-white px-5 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-creme text-apagado"><ListPlus size={22} aria-hidden="true" /></span>
          <h2 className="mt-4 font-semibold text-tinta">O plano de contas está vazio</h2>
          <p className="mt-1 max-w-md text-sm text-apagado">
            Rode a carga da planilha de custos operacionais para trazer as contas e os valores já lançados, ou crie a primeira conta aqui.
          </p>
          {podeEditar && (
            <button type="button" onClick={() => setDialogo({ conta: null })} className={`${botaoPrimario} mt-5`}>
              <Plus size={16} aria-hidden="true" />
              Nova conta
            </button>
          )}
        </section>
      ) : (
        <div className={cn('space-y-4 transition-opacity duration-200', navegando && 'pointer-events-none opacity-50')} aria-busy={navegando}>
          {/* ── o mês em quatro números ── */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
            <article
              data-entrada
              className="relative isolate col-span-2 flex flex-col overflow-hidden rounded-2xl bg-marca-800 p-5 text-white sm:p-6 xl:col-span-1"
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_100%_0%,rgba(98,80,214,0.42),transparent_70%)]"
              />
              <h2 className="flex items-center gap-2 text-[13px] font-medium text-white/70">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px] bg-serie-custo-op ring-1 ring-white/50" />
                Custo operacional do mês
              </h2>
              <div className="mt-4">
                <Numero texto={formatCurrency(resumo.total)} max={48}>
                  <NumeroAnimado valor={resumo.total} formatar={moeda} />
                </Numero>
              </div>
              <p className="mt-auto flex flex-col gap-1 pt-5 text-[13px] text-white/65">
                <span>
                  {resumo.total === 0 ? `Nenhum valor lançado em ${nomePeriodo}`
                    : !anteriores || resumo.anterior === 0 ? nomePeriodo
                    : diferenca === 0 ? `Igual a ${MESES[mes - 2].toLowerCase()}`
                    : `${moeda(Math.abs(diferenca))} ${diferenca > 0 ? 'a mais' : 'a menos'} que em ${MESES[mes - 2].toLowerCase()}`}
                </span>
                {resumo.porTipo.provisao > 0 && <span>Inclui {moeda(resumo.porTipo.provisao)} de provisões, que não saem do caixa</span>}
              </p>
            </article>

            <Cartao
              rotulo="Custos fixos"
              cor="bg-serie-custo-op"
              numero={
                <Numero texto={formatCurrency(resumo.porTipo.fixo)} max={28} className="text-tinta">
                  <NumeroAnimado valor={resumo.porTipo.fixo} formatar={moeda} />
                </Numero>
              }
              rodape={resumo.contasPorTipo.fixo === 0 ? 'Nenhuma conta fixa lançada' : `${doTotal(resumo.porTipo.fixo)} do total · ${plural(resumo.contasPorTipo.fixo, 'conta', 'contas')}`}
            />

            <Cartao
              rotulo="Custos variáveis"
              cor="bg-serie-custo-op"
              numero={
                <Numero texto={formatCurrency(resumo.porTipo.variavel)} max={28} className="text-tinta">
                  <NumeroAnimado valor={resumo.porTipo.variavel} formatar={moeda} />
                </Numero>
              }
              rodape={resumo.contasPorTipo.variavel === 0 ? 'Nenhuma conta variável lançada' : `${doTotal(resumo.porTipo.variavel)} do total · ${plural(resumo.contasPorTipo.variavel, 'conta', 'contas')}`}
            />

            <Cartao
              linhaInteira
              rotulo="Valor base das contas"
              cor="bg-tinta-suave"
              numero={
                <Numero texto={formatCurrency(resumo.base)} max={28} className="text-tinta">
                  <NumeroAnimado valor={resumo.base} formatar={moeda} />
                </Numero>
              }
              rodape={
                resumo.base === 0 ? 'Nenhuma conta tem valor base'
                  : resumo.total === 0 ? 'Quanto o mês costuma custar, pela soma das contas'
                  : Math.abs(foraDaBase) <= TOLERANCIA_BASE ? `O mês ficou dentro da referência (até ${porcento(TOLERANCIA_BASE * 100)})`
                  : `O mês ficou ${porcento(Math.abs(foraDaBase) * 100)} ${foraDaBase > 0 ? 'acima' : 'abaixo'} da referência`
              }
            />
          </div>

          {/* ── o ano e a composição do mês ── */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <EvolucaoAno ano={ano} mes={mes} totais={totais} contas={contagem} base={resumo.base} onIr={irParaMes} />
            <RankingCustos
              id="composicao"
              titulo={DIMENSAO[dimensao].titulo}
              plural={DIMENSAO[dimensao].plural}
              feminino={DIMENSAO[dimensao].feminino}
              recorte={null}
              itens={ranking}
              selecionado={selecionado}
              onSelecionar={setSelecionado}
              cor="bg-serie-custo-op"
              dica="clique para filtrar as contas"
              vazio={`Nenhum valor lançado em ${nomePeriodo}.`}
              controle={
                <Segmentado
                  rotulo="Agrupar os custos por" opcoes={DIMENSOES} valor={dimensao}
                  onMudar={d => { setDimensao(d); setSelecionado(null) }}
                />
              }
            />
          </div>

          {/* `key`: busca e grupos recolhidos recomeçam ao trocar de mês */}
          <ContasDoMes
            key={`${mes}-${ano}`}
            contas={contasDoMes}
            valores={valores}
            anteriores={anteriores}
            nomeMes={nomeMes}
            nomeMesAnterior={mes > 1 ? MESES[mes - 2] : null}
            podeEditar={podeEditar}
            recorte={recorte}
            onSalvar={salvarValor}
            onEditarConta={conta => setDialogo({ conta })}
            onNovaConta={() => setDialogo({ conta: null })}
            alteracoes={alteracoes}
          />
        </div>
      )}

      {podeEditar && (
        <DialogoConta
          aberto={dialogo !== null}
          conta={dialogo?.conta ?? null}
          contas={plano}
          onFechar={() => setDialogo(null)}
          onSalvo={aoSalvarConta}
        />
      )}
    </PaginaInterna>
  )
}

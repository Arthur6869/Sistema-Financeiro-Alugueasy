'use client'

import { useId, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { TIPOS_CONTA, type ContaOp, type TipoConta } from '@/lib/custos-operacionais'
import { Segmentado } from '@/components/dashboard/valor'
import { CampoMoeda } from '@/components/painel/campo-moeda'
import { Dialogo } from '@/components/painel/dialogo'

const CLASSIFICACOES = ['Custo do serviço (CSV)', 'Despesa administrativa', 'Despesa operacional', 'A definir']

const campo =
  'h-11 w-full rounded-xl border border-linha bg-white px-3 text-sm text-tinta transition-colors placeholder:text-apagado/70 ' +
  'focus-visible:border-marca-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-marca-700/15'
const rotulo = 'mb-1.5 block text-[13px] font-medium text-tinta-suave'

/**
 * Próximo código livre do grupo: "3. Escritório" com 3.01…3.08 → "3.09".
 * Grupo novo (sem número ou sem contas) → o próximo número de grupo, ".01".
 */
function sugerirCodigo(grupo: string, contas: ContaOp[]): string {
  const numero = grupo.match(/^\s*(\d+)\s*\./)?.[1]
  const prefixos = contas.map(c => Number(c.codigo.split('.')[0])).filter(Number.isFinite)
  const prefixo = numero ?? String((prefixos.length ? Math.max(...prefixos) : 0) + 1)
  const usados = contas.filter(c => c.codigo.startsWith(`${prefixo}.`)).map(c => Number(c.codigo.split('.')[1])).filter(Number.isFinite)
  const proximo = (usados.length ? Math.max(...usados) : 0) + 1
  return `${prefixo}.${String(proximo).padStart(2, '0')}`
}

/** Criar (`conta` nula) ou editar uma conta do plano de custos operacionais. */
export function DialogoConta({ aberto, conta, contas, onFechar, onSalvo }: {
  aberto: boolean
  conta: ContaOp | null
  /** Plano atual: de onde saem os grupos, as classificações e o próximo código */
  contas: ContaOp[]
  onFechar: () => void
  onSalvo: (conta: ContaOp, nova: boolean) => void
}) {
  return (
    <Dialogo
      aberto={aberto} onFechar={onFechar}
      titulo={conta ? 'Editar conta' : 'Nova conta'}
      descricao={conta
        ? 'Muda a conta em todos os meses. Os valores já lançados não são alterados.'
        : 'A conta entra no plano e passa a aparecer em todos os meses.'}
    >
      {/* `key`: cada abertura começa com o formulário limpo (ou com os dados da conta escolhida) */}
      {aberto && <Formulario key={conta?.id ?? 'nova'} conta={conta} contas={contas} onFechar={onFechar} onSalvo={onSalvo} />}
    </Dialogo>
  )
}

function Formulario({ conta, contas, onFechar, onSalvo }: {
  conta: ContaOp | null
  contas: ContaOp[]
  onFechar: () => void
  onSalvo: (conta: ContaOp, nova: boolean) => void
}) {
  const id = useId()
  const grupos = [...new Set(contas.map(c => c.grupo))]
  const classificacoes = [...new Set([...CLASSIFICACOES, ...contas.map(c => c.classificacao_dre)])]

  const [grupo, setGrupo] = useState(conta?.grupo ?? grupos[0] ?? '')
  const [codigo, setCodigo] = useState(conta?.codigo ?? sugerirCodigo(grupos[0] ?? '', contas))
  // enquanto a pessoa não mexer no código, ele acompanha o grupo escolhido
  const [codigoManual, setCodigoManual] = useState(!!conta)
  const [nome, setNome] = useState(conta?.nome ?? '')
  const [tipo, setTipo] = useState<TipoConta>(conta?.tipo ?? 'variavel')
  const [classificacao, setClassificacao] = useState(conta?.classificacao_dre ?? 'A definir')
  const [dia, setDia] = useState(conta?.dia_vencimento ? String(conta.dia_vencimento) : '')
  const [base, setBase] = useState<number | null>(conta && conta.valor_base > 0 ? conta.valor_base : null)
  const [observacao, setObservacao] = useState(conta?.observacao ?? '')
  const [encerrada, setEncerrada] = useState(conta ? !conta.ativo : false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function mudarGrupo(valor: string) {
    setGrupo(valor)
    if (!codigoManual) setCodigo(sugerirCodigo(valor, contas))
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const diaNumero = dia.trim() === '' ? null : Number(dia)
    if (nome.trim().length < 2) return setErro('Informe o nome da conta.')
    if (grupo.trim().length < 2) return setErro('Informe o grupo.')
    if (!codigo.trim()) return setErro('Informe o código.')
    if (diaNumero !== null && !(Number.isInteger(diaNumero) && diaNumero >= 1 && diaNumero <= 31)) return setErro('O dia de vencimento vai de 1 a 31.')

    setEnviando(true)
    setErro(null)
    try {
      const res = await fetch(conta ? `/api/custos-operacionais/contas/${conta.id}` : '/api/custos-operacionais/contas', {
        method: conta ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: codigo.trim(), nome: nome.trim(), grupo: grupo.trim(), tipo,
          classificacao_dre: classificacao.trim() || 'A definir',
          dia_vencimento: diaNumero, valor_base: base ?? 0,
          observacao: observacao.trim() || null,
          ...(conta ? { ativo: !encerrada } : {}),
        }),
      })
      const corpo = await res.json().catch(() => null)
      if (!res.ok || !corpo?.conta) return setErro((corpo?.error as string | undefined) ?? 'Não foi possível salvar a conta.')
      onSalvo(corpo.conta as ContaOp, !conta)
    } catch {
      setErro('Sem resposta do servidor. Confira a conexão e tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      <div>
        <label htmlFor={`${id}-nome`} className={rotulo}>Nome da conta</label>
        <input id={`${id}-nome`} autoFocus={!conta} value={nome} onChange={e => setNome(e.target.value)} maxLength={120} placeholder="Ex.: Seguro do escritório" className={campo} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <div>
          <label htmlFor={`${id}-grupo`} className={rotulo}>Grupo</label>
          <input id={`${id}-grupo`} list={`${id}-grupos`} value={grupo} onChange={e => mudarGrupo(e.target.value)} maxLength={80} placeholder="Escolha ou digite um novo" className={campo} />
          <datalist id={`${id}-grupos`}>{grupos.map(g => <option key={g} value={g} />)}</datalist>
        </div>
        <div>
          <label htmlFor={`${id}-codigo`} className={rotulo}>Código</label>
          <input id={`${id}-codigo`} value={codigo} onChange={e => { setCodigo(e.target.value); setCodigoManual(true) }} maxLength={12} className={`${campo} tabular-nums`} />
        </div>
      </div>

      <div>
        <span className={rotulo}>Tipo</span>
        <Segmentado rotulo="Tipo da conta" opcoes={TIPOS_CONTA} valor={tipo} onMudar={setTipo} />
        <p className="mt-1.5 text-xs text-apagado">
          {tipo === 'fixo' ? 'Mesmo valor (ou quase) todo mês.' : tipo === 'variavel' ? 'Muda conforme o mês.' : 'Lançamento contábil: não sai do caixa no mês.'}
        </p>
      </div>

      <div>
        <label htmlFor={`${id}-class`} className={rotulo}>Classificação no DRE</label>
        <input id={`${id}-class`} list={`${id}-classes`} value={classificacao} onChange={e => setClassificacao(e.target.value)} maxLength={80} className={campo} />
        <datalist id={`${id}-classes`}>{classificacoes.map(c => <option key={c} value={c} />)}</datalist>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-base`} className={rotulo}>Valor base <span className="font-normal text-apagado">(opcional)</span></label>
          <CampoMoeda id={`${id}-base`} valor={base} onMudar={setBase} className="h-11 rounded-xl text-left" />
          <p className="mt-1.5 text-xs text-apagado">Quanto a conta costuma ser. Serve de referência.</p>
        </div>
        <div>
          <label htmlFor={`${id}-dia`} className={rotulo}>Dia de vencimento <span className="font-normal text-apagado">(opcional)</span></label>
          <input id={`${id}-dia`} inputMode="numeric" value={dia} onChange={e => setDia(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="1 a 31" className={`${campo} tabular-nums`} />
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-obs`} className={rotulo}>Observação <span className="font-normal text-apagado">(opcional)</span></label>
        <textarea id={`${id}-obs`} value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={500} rows={2} className={`${campo} h-auto resize-y py-2.5`} />
      </div>

      {conta && (
        <label className="flex items-start gap-3 rounded-xl border border-linha bg-creme/50 p-3 text-sm text-tinta">
          <input type="checkbox" checked={encerrada} onChange={e => setEncerrada(e.target.checked)} className="mt-0.5 size-4 accent-marca-700" />
          <span>
            <span className="font-medium">Conta encerrada</span>
            <span className="block text-[13px] text-apagado">Deixa de aparecer nos meses sem valor. O que já foi lançado continua valendo.</span>
          </span>
        </label>
      )}

      {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-negativo">{erro}</p>}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <button
          type="button" onClick={onFechar} disabled={enviando}
          className="h-11 rounded-full border border-linha bg-white px-5 text-sm font-medium text-tinta transition-colors hover:bg-creme-escuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700 disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit" disabled={enviando}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-marca-800 px-6 text-sm font-semibold text-white transition-colors hover:bg-marca-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca-700 disabled:opacity-60"
        >
          {enviando && <Loader2 size={16} aria-hidden="true" className="animate-spin" />}
          {conta ? 'Salvar alterações' : 'Criar conta'}
        </button>
      </div>
    </form>
  )
}

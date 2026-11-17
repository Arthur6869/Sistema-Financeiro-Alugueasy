/*
 * Custos operacionais — tipos e regras compartilhados entre a página, a tela e
 * as rotas de gravação. Tabelas: custos_operacionais_contas (plano de contas)
 * e custos_operacionais_lancamentos (valor de cada conta em cada mês) —
 * migration 047.
 */

export type TipoConta = 'fixo' | 'variavel' | 'provisao'

export type ContaOp = {
  id: string
  codigo: string
  nome: string
  grupo: string
  classificacao_dre: string
  tipo: TipoConta
  dia_vencimento: number | null
  /** Referência: "quanto essa conta costuma ser" */
  valor_base: number
  observacao: string | null
  ordem: number
  /** Conta encerrada só aparece nos meses em que tem valor */
  ativo: boolean
}

export type LancamentoOp = {
  id: string
  conta_id: string
  mes: number
  ano: number
  valor: number
  observacao: string | null
  origem: 'manual' | 'planilha'
}

export const TIPOS_CONTA: { valor: TipoConta; rotulo: string }[] = [
  { valor: 'fixo', rotulo: 'Fixo' },
  { valor: 'variavel', rotulo: 'Variável' },
  { valor: 'provisao', rotulo: 'Provisão' },
]
export const ROTULO_TIPO: Record<TipoConta, string> = { fixo: 'Fixo', variavel: 'Variável', provisao: 'Provisão' }

/** Acima disto o valor do mês é destacado contra o valor base (mesma regra da planilha: 10%). */
export const TOLERANCIA_BASE = 0.1

export const COLUNAS_CONTA = 'id, codigo, nome, grupo, classificacao_dre, tipo, dia_vencimento, valor_base, observacao, ordem, ativo'
export const COLUNAS_LANCAMENTO = 'id, conta_id, mes, ano, valor, observacao, origem'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ehUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

const centavos = (n: number) => Math.round(n * 100) / 100
const TETO = 99_999_999.99

/** Grupos na ordem do plano ("1. …" antes de "10. …"), contas na ordem da planilha. */
export function ordenarContas<T extends Pick<ContaOp, 'grupo' | 'ordem' | 'codigo'>>(contas: T[]): T[] {
  return [...contas].sort((a, b) =>
    a.grupo.localeCompare(b.grupo, 'pt-BR', { numeric: true }) ||
    a.ordem - b.ordem ||
    a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true }))
}

/** O banco devolve `numeric` ora como número, ora como texto: aqui vira número. */
export function normalizarConta(c: Record<string, unknown>): ContaOp {
  return { ...(c as unknown as ContaOp), valor_base: Number(c.valor_base) || 0 }
}
export function normalizarLancamento(l: Record<string, unknown>): LancamentoOp {
  return { ...(l as unknown as LancamentoOp), valor: Number(l.valor) || 0 }
}

type CamposConta = Partial<Omit<ContaOp, 'id' | 'ordem'>>

/**
 * Valida o corpo de criação/edição de conta. Em `parcial` (edição) só confere
 * o que veio; na criação, código, nome e grupo são obrigatórios.
 * Devolve `{ erro }` ou `{ campos }` já limpos.
 */
export function validarConta(corpo: unknown, parcial: boolean): { erro: string } | { campos: CamposConta } {
  if (!corpo || typeof corpo !== 'object') return { erro: 'Corpo inválido' }
  const b = corpo as Record<string, unknown>
  const campos: CamposConta = {}

  const texto = (chave: 'codigo' | 'nome' | 'grupo' | 'classificacao_dre', rotulo: string, min: number, max: number, obrigatorio: boolean) => {
    if (b[chave] === undefined) return obrigatorio && !parcial ? `Informe ${rotulo}` : null
    if (typeof b[chave] !== 'string') return `${rotulo}: valor inválido`
    const v = (b[chave] as string).replace(/\s+/g, ' ').trim()
    if (v.length < min) return `Informe ${rotulo}`
    if (v.length > max) return `${rotulo}: no máximo ${max} caracteres`
    campos[chave] = v
    return null
  }
  const erro =
    texto('codigo', 'o código', 1, 12, true) ??
    texto('nome', 'o nome da conta', 2, 120, true) ??
    texto('grupo', 'o grupo', 2, 80, true) ??
    texto('classificacao_dre', 'a classificação', 2, 80, false)
  if (erro) return { erro }

  if (b.tipo !== undefined) {
    if (!TIPOS_CONTA.some(t => t.valor === b.tipo)) return { erro: 'Tipo inválido' }
    campos.tipo = b.tipo as TipoConta
  }
  if (b.dia_vencimento !== undefined) {
    const d = b.dia_vencimento
    if (d !== null && !(Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 31)) return { erro: 'Dia de vencimento deve ser de 1 a 31' }
    campos.dia_vencimento = d as number | null
  }
  if (b.valor_base !== undefined) {
    const v = Number(b.valor_base)
    if (!Number.isFinite(v) || v < 0 || v > TETO) return { erro: 'Valor base inválido' }
    campos.valor_base = centavos(v)
  }
  if (b.observacao !== undefined) {
    if (b.observacao !== null && typeof b.observacao !== 'string') return { erro: 'Observação inválida' }
    const o = (b.observacao ?? '').trim()
    if (o.length > 500) return { erro: 'Observação: no máximo 500 caracteres' }
    campos.observacao = o || null
  }
  if (b.ativo !== undefined) {
    if (typeof b.ativo !== 'boolean') return { erro: 'Situação inválida' }
    campos.ativo = b.ativo
  }
  return { campos }
}

/** Valida `{ conta_id, mes, ano, valor }`. `valor` nulo ou zero significa "tirar o valor do mês". */
export function validarLancamento(corpo: unknown): { erro: string } | { conta_id: string; mes: number; ano: number; valor: number | null } {
  if (!corpo || typeof corpo !== 'object') return { erro: 'Corpo inválido' }
  const b = corpo as Record<string, unknown>
  if (!ehUuid(b.conta_id)) return { erro: 'Conta inválida' }
  const mes = Number(b.mes)
  const ano = Number(b.ano)
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) return { erro: 'Mês inválido' }
  if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) return { erro: 'Ano inválido' }
  if (b.valor === null || b.valor === undefined) return { conta_id: b.conta_id, mes, ano, valor: null }
  const valor = Number(b.valor)
  if (!Number.isFinite(valor) || valor < 0 || valor > TETO) return { erro: 'Valor inválido' }
  return { conta_id: b.conta_id, mes, ano, valor: valor === 0 ? null : centavos(valor) }
}

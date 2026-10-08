/**
 * Tipos e utilitários da camada operacional (checklist de limpeza).
 * Usado pela área /operacional, pela rota /api/limpezas e pela tela /limpezas.
 */

export type ItemChecklistModelo = {
  id: string
  apartamento_id: string | null
  area: string
  descricao: string
  ordem: number
  ativo: boolean
}

/** "Foto" de um item no momento em que a limpeza foi registrada. */
export type ItemLimpeza = {
  area: string
  descricao: string
  concluido: boolean
}

/** Uma das pessoas que fez a limpeza (id pode ser null se a conta foi excluída). */
export type Responsavel = { id: string | null; nome: string }

/** Conta da equipe de limpeza, como devolvida por listar_equipe_limpeza(). */
export type MembroEquipe = { id: string; nome: string }

export type Limpeza = {
  id: string
  apartamento_id: string | null
  imovel: string
  /** Quem registrou (fez o envio). Pode não estar entre os responsáveis. */
  operador_id: string | null
  operador_nome: string
  /** Todas as pessoas que fizeram a limpeza. */
  responsaveis: Responsavel[]
  iniciada_em: string | null
  finalizada_em: string
  itens: ItemLimpeza[]
  total_itens: number
  itens_concluidos: number
  completa: boolean
  observacao: string | null
  email_enviado: boolean
  email_erro: string | null
}

/**
 * Situação da unidade para a equipe de limpeza (migration 043), calculada no
 * banco a partir das entradas/saídas da Amenitiz e da última limpeza.
 */
export type SituacaoLimpeza = 'pendente' | 'incompleta' | 'ocupado' | 'limpo' | 'livre'

/** Uma unidade da lista de limpeza — quartos ativos na Amenitiz (migration 043). */
export type ImovelLimpeza = {
  unidade_id: string
  /** Cadastro financeiro ligado (itens extras do checklist); null se ainda não existe. */
  apartamento_id: string | null
  empreendimento: string
  numero: string
  ultima_limpeza_em: string | null
  /** Primeiros nomes de quem fez a última limpeza, separados por vírgula. */
  ultima_limpeza_por: string | null
  ultima_limpeza_completa: boolean | null
  /** Última limpeza foi hoje (fuso de São Paulo). Zera sozinho no dia seguinte. */
  limpa_hoje: boolean
  situacao: SituacaoLimpeza
  /** Data de saída do hóspede que está no imóvel agora ('YYYY-MM-DD'). */
  hospedado_ate: string | null
  saida_hoje: boolean
  entrada_hoje: boolean
  /** Última saída dos últimos 7 dias ('YYYY-MM-DD'). */
  ultima_saida: string | null
  /** Próximo check-in a partir de hoje ('YYYY-MM-DD'). */
  proxima_entrada: string | null
  proxima_entrada_hospedes: number | null
  /** Quando o sync da Amenitiz gravou a ocupação pela última vez. */
  ocupacao_atualizada_em: string | null
}

/** Hoje em São Paulo, 'YYYY-MM-DD'. */
export function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: FUSO })
}

/** 'YYYY-MM-DD' → "hoje", "amanhã", "ontem" ou "qui, 12/10". */
export function diaRelativo(data: string): string {
  const hoje = hojeSP()
  const dias = Math.round((Date.parse(`${data}T12:00:00Z`) - Date.parse(`${hoje}T12:00:00Z`)) / 86400_000)
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'amanhã'
  if (dias === -1) return 'ontem'
  const d = new Date(`${data}T12:00:00Z`)
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')
  return `${semana}, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}`
}

/**
 * Urgência para ordenar "o que limpar primeiro": pendente com hóspede chegando
 * hoje > pendente chegando amanhã > demais pendentes > incompleta > resto.
 */
export function urgencia(i: ImovelLimpeza): number {
  if (i.situacao === 'pendente') {
    if (i.entrada_hoje) return 0
    if (i.proxima_entrada && diaRelativo(i.proxima_entrada) === 'amanhã') return 1
    return i.saida_hoje ? 3 : 2
  }
  if (i.situacao === 'incompleta') return 4
  return 9
}

/** Linha de status de cada unidade, igual no site e no app. */
export function descreverSituacao(i: ImovelLimpeza): { titulo: string; detalhe: string } {
  const quem = i.ultima_limpeza_por ? ` · ${i.ultima_limpeza_por}` : ''
  const chegada = i.proxima_entrada
    ? `Próxima entrada ${diaRelativo(i.proxima_entrada)}${i.proxima_entrada_hospedes ? ` · ${i.proxima_entrada_hospedes} hósp.` : ''}`
    : 'Sem entrada prevista'
  switch (i.situacao) {
    case 'pendente':
      return {
        titulo: i.saida_hoje ? 'Saída hoje · limpar após a saída' : `Hóspede saiu ${diaRelativo(i.ultima_saida ?? hojeSP())}`,
        detalhe: i.entrada_hoje ? 'Entrada hoje — prioridade' : chegada,
      }
    case 'incompleta':
      return { titulo: 'Limpeza incompleta', detalhe: `Registrada ${tempoDesde(i.ultima_limpeza_em)}${quem}` }
    case 'ocupado':
      return {
        titulo: `Hospedado · sai ${diaRelativo(i.hospedado_ate ?? hojeSP())}`,
        detalhe: i.limpa_hoje ? `Arrumação hoje${quem}` : 'Aguardar a saída do hóspede',
      }
    case 'limpo':
      return {
        titulo: i.limpa_hoje ? `Finalizado hoje às ${hora(i.ultima_limpeza_em)}` : 'Pronto para o próximo hóspede',
        detalhe: i.limpa_hoje ? `${chegada}${quem}` : chegada,
      }
    default:
      return { titulo: 'Disponível', detalhe: chegada }
  }
}

function hora(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' })
}

/**
 * "Maria, João e Ana" — nomes de quem fez a limpeza. Registros anteriores à
 * migration 041 não têm responsáveis: cai em quem registrou.
 */
export function nomesResponsaveis(
  l: { responsaveis?: Responsavel[] | null; operador_nome: string },
  curto = false,
): string {
  const lista = (l.responsaveis ?? []).map(r => r.nome?.trim()).filter(Boolean) as string[]
  const nomes = (lista.length ? lista : [l.operador_nome]).map(n => (curto ? n.split(' ')[0] : n))
  if (nomes.length <= 1) return nomes[0] ?? ''
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

export const FUSO = 'America/Sao_Paulo'

/** ISO do instante `dias` atrás — filtro de período da tela /limpezas. */
export function inicioDoPeriodo(dias: number): string {
  return new Date(Date.now() - dias * 86400_000).toISOString()
}

/** Agrupa itens por área mantendo a ordem em que as áreas aparecem. */
export function agruparPorArea<T extends { area: string }>(itens: T[]): { area: string; itens: T[] }[] {
  const grupos: { area: string; itens: T[] }[] = []
  for (const item of itens) {
    let g = grupos.find(x => x.area === item.area)
    if (!g) { g = { area: item.area, itens: [] }; grupos.push(g) }
    g.itens.push(item)
  }
  return grupos
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** "há 3 h", "ontem", "12/10" — para a lista de imóveis. */
export function tempoDesde(iso: string | null): string {
  if (!iso) return 'Sem registro'
  const minutos = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'agora'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `há ${horas} h`
  const dias = Math.round(horas / 24)
  if (dias === 1) return 'ontem'
  if (dias < 7) return `há ${dias} dias`
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' })
}

/** Duração entre início e fim, ou null se não houver início. */
export function duracao(inicio: string | null, fim: string): string | null {
  if (!inicio) return null
  const min = Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60000)
  if (min <= 0) return null
  const h = Math.floor(min / 60)
  return h > 0 ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`
}

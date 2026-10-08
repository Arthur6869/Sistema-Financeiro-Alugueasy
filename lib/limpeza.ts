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
  /** Primeiro nome de quem está no imóvel (só o primeiro nome, migration 044). */
  hospede_atual: string | null
  /** Check-in de quem está no imóvel ('YYYY-MM-DD'). */
  hospedado_desde: string | null
  hospedes_atuais: number | null
  /** Primeiro nome de quem entra na próxima reserva. */
  proximo_hospede: string | null
  /** Check-out da próxima reserva ('YYYY-MM-DD'). */
  proxima_saida: string | null
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

/** Slug do prédio para a URL: "Athos Bulcão" → "athos-bulcao". */
export function slugPredio(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const ORDEM_SITUACAO: Record<SituacaoLimpeza, number> = { pendente: 0, incompleta: 1, ocupado: 2, limpo: 3, livre: 4 }

function numeroOrdenavel(n: string): number {
  const d = parseInt(n.replace(/\D/g, ''), 10)
  return isNaN(d) ? Number.MAX_SAFE_INTEGER : d
}

/**
 * Ordem de trabalho dentro de um prédio: urgentes (hóspede chega hoje),
 * pendentes, incompletas, hospedados, prontos, livres — e por número no empate.
 */
export function ordenarPorPrioridade(imoveis: ImovelLimpeza[]): ImovelLimpeza[] {
  return [...imoveis].sort((a, b) =>
    urgencia(a) - urgencia(b)
    || ORDEM_SITUACAO[a.situacao] - ORDEM_SITUACAO[b.situacao]
    || numeroOrdenavel(a.numero) - numeroOrdenavel(b.numero)
    || a.numero.localeCompare(b.numero))
}

/** Resumo de um prédio para a tela inicial da equipe. */
export type ResumoPredio = {
  nome: string
  slug: string
  total: number
  limpar: number
  urgentes: number
  hospedados: number
  prontos: number
  livres: number
  /** Pior estado entre as unidades — define a cor do cartão. */
  pior: SituacaoLimpeza | 'urgente'
}

/** Agrupa por empreendimento; prédios com mais trabalho vêm primeiro. */
export function resumirPredios(imoveis: ImovelLimpeza[]): ResumoPredio[] {
  const mapa = new Map<string, ResumoPredio>()
  for (const i of imoveis) {
    let r = mapa.get(i.empreendimento)
    if (!r) {
      r = { nome: i.empreendimento, slug: slugPredio(i.empreendimento), total: 0, limpar: 0, urgentes: 0, hospedados: 0, prontos: 0, livres: 0, pior: 'livre' }
      mapa.set(i.empreendimento, r)
    }
    r.total++
    if (i.situacao === 'pendente' || i.situacao === 'incompleta') {
      r.limpar++
      if (i.situacao === 'pendente' && i.entrada_hoje) r.urgentes++
    } else if (i.situacao === 'ocupado') r.hospedados++
    else if (i.situacao === 'limpo') r.prontos++
    else r.livres++
  }
  for (const r of mapa.values()) {
    r.pior = r.urgentes ? 'urgente' : r.limpar ? 'pendente' : r.hospedados ? 'ocupado' : r.prontos ? 'limpo' : 'livre'
  }
  return [...mapa.values()].sort((a, b) => b.urgentes - a.urgentes || b.limpar - a.limpar || a.nome.localeCompare(b.nome))
}

/** Noites entre duas datas 'YYYY-MM-DD'. */
export function noitesEntre(entrada: string, saida: string): number {
  return Math.max(0, Math.round((Date.parse(`${saida}T12:00:00Z`) - Date.parse(`${entrada}T12:00:00Z`)) / 86400_000))
}

function noitesTxt(entrada: string, saida: string): string {
  const n = noitesEntre(entrada, saida)
  return `${n} ${n === 1 ? 'noite' : 'noites'}`
}

function pessoasTxt(n: number | null | undefined): string {
  return n ? ` · ${n} ${n === 1 ? 'pessoa' : 'pessoas'}` : ''
}

/**
 * Próxima reserva: "Entra hoje: João · até sáb, 11/10 (2 noites) · 2 pessoas"
 * ou "Próximo: João · sáb, 11/10 · até ter, 14/10 (3 noites)". Sem nome quando
 * a reserva não trouxe (ou quando a tela optar por não mostrar).
 */
export function descreverProximo(i: ImovelLimpeza): string {
  if (!i.proxima_entrada) return 'Sem entrada prevista'
  const dia = diaRelativo(i.proxima_entrada)
  const nome = i.proximo_hospede ?? ''
  const fim = i.proxima_saida ? ` · até ${diaRelativo(i.proxima_saida)} (${noitesTxt(i.proxima_entrada, i.proxima_saida)})` : ''
  const cabeca = dia === 'hoje' || dia === 'amanhã'
    ? (nome ? `Entra ${dia}: ${nome}` : `Entra ${dia}`)
    : (nome ? `Próximo: ${nome} · ${dia}` : `Próxima entrada ${dia}`)
  return `${cabeca}${fim}${pessoasTxt(i.proxima_entrada_hospedes)}`
}

/** Saída e entrada no mesmo dia (hoje, ou na data da saída de quem está): a limpeza mais apertada. */
export function trocaNoMesmoDia(i: ImovelLimpeza): boolean {
  if (i.saida_hoje && i.entrada_hoje) return true
  return !!i.hospedado_ate && !!i.proxima_entrada && i.hospedado_ate === i.proxima_entrada
}

/** Linha de status de cada unidade, igual no site e no app. */
export function descreverSituacao(i: ImovelLimpeza): { titulo: string; detalhe: string } {
  const quem = i.ultima_limpeza_por ? ` · ${i.ultima_limpeza_por}` : ''
  const proximo = descreverProximo(i)
  switch (i.situacao) {
    case 'pendente':
      return {
        titulo: i.saida_hoje && i.entrada_hoje
          ? 'Troca hoje · limpar assim que sair'
          : i.saida_hoje
            ? 'Saída hoje · limpar após a saída'
            : `Hóspede saiu ${diaRelativo(i.ultima_saida ?? hojeSP())}`,
        detalhe: proximo,
      }
    case 'incompleta':
      return { titulo: 'Limpeza incompleta', detalhe: `Registrada ${tempoDesde(i.ultima_limpeza_em)}${quem}` }
    case 'ocupado': {
      const sai = diaRelativo(i.hospedado_ate ?? hojeSP())
      const partes = [
        i.hospedado_desde ? `Entrou ${diaRelativo(i.hospedado_desde)}` : null,
        i.hospedado_desde && i.hospedado_ate ? noitesTxt(i.hospedado_desde, i.hospedado_ate) : null,
        pessoasTxt(i.hospedes_atuais).slice(3) || null,
        trocaNoMesmoDia(i) ? 'troca no mesmo dia' : null,
        i.limpa_hoje ? `arrumação hoje${quem}` : null,
      ].filter(Boolean)
      return {
        titulo: i.hospede_atual ? `Hóspede: ${i.hospede_atual} · sai ${sai}` : `Hospedado · sai ${sai}`,
        detalhe: partes.length ? partes.join(' · ') : 'Aguardar a saída do hóspede',
      }
    }
    case 'limpo':
      return {
        titulo: i.limpa_hoje ? `Finalizado hoje às ${hora(i.ultima_limpeza_em)}` : 'Pronto para o próximo hóspede',
        detalhe: i.limpa_hoje ? `${proximo}${quem}` : proximo,
      }
    default:
      return { titulo: 'Disponível', detalhe: proximo }
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

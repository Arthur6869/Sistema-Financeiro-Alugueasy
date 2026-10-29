import { fetchTodasReservasMes, calcularValorLiquido } from '@/lib/amenitiz'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

// Serialização com chaves ordenadas em todos os níveis: a mesma reserva vinda
// da Amenitiz com as chaves em outra ordem não pode parecer alterada.
// undefined vira null (JSON.stringify omitiria a chave).
function serializarOrdenado(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(serializarOrdenado).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${serializarOrdenado(o[k])}`).join(',')}}`
  }
  return JSON.stringify(v) ?? 'null'
}

/**
 * Hash estável do que o sync gravaria numa linha. Comparado com o `sync_hash`
 * já gravado (migration 045) para PULAR o upsert de linhas idênticas: cada
 * regravação custa I/O de disco (versão nova da linha, índices, WAL e
 * autovacuum) mesmo sem mudança nenhuma — e o cron roda a cada 10 min. Foi o
 * que esgotou o orçamento de I/O do Supabase em out/2026 (17 mi de updates
 * em amenitiz_reservas para ~9 mil linhas).
 */
function hashEstavel(valor: unknown): string {
  return createHash('sha1').update(serializarOrdenado(valor)).digest('hex')
}

const AMENITIZ_EMP_MAP: Array<[pfx: string, dbNome: string]> = [
  // Formato "Nome Completo - Número" (separador ' - ' no nome do quarto no Amenitiz)
  ['LINK NOROESTE',   'LINK'],
  // "Asa Sul 415 - 104": 415 é a quadra (parte do nome), 104 é o apartamento
  ['ASA SUL 415',     'ASA SUL'],
  // Formato "Prefixo Número" (empreendimento + nº no mesmo segmento)
  // "SM 806", "SM 701": Saint Moritz abreviado na Amenitiz. Sem este prefixo o
  // sync descartava SM 701/1106/1808 (só o 806 resolvia, por amenitiz_room_id).
  // Cadastro financeiro de 01/10/2026; 613 cadastrado em 22/10/2026.
  ['SAINT MORITZ',    'SAINT MORITZ'],
  ['SM',              'SAINT MORITZ'],
  ['BRISAS DO LAGO',  'BRISAS'],
  ['METROPOLITAN',    'METROPOLITAN'],
  ['MERCURE LIDER',   'MERCURE'],
  ['CULLINAN',        'CULLINAN'],
  ['ESSENCE',         'ESSENCE'],
  ['MERCURE',         'MERCURE'],
  ['NOBILE',          'NOBILE'],
  ['FUSION',          'FUSION'],
  ['RAMADA',          'RAMADA'],
  ['VISION',          'VISION'],
  ['EASY',            'EASY'],
  ['AMAZE',           'AMAZE'],
  ['AB',              'ATHOS'],
  ['ATHOS BULCAO',    'ATHOS'],
  ['ATHOS BULCÃO',    'ATHOS'],
  ['ATHOS',           'ATHOS'],
]

// Anúncios que trocaram de imóvel na Amenitiz (renomearam o anúncio e passaram a
// operar outro apartamento). Reservas com check-in ANTES de inicioNovoImovel
// pertencem ao imóvel antigo. antigo === null → imóvel antigo ainda não
// identificado no sistema: a reserva é gravada com apartamento_id = null
// (não aparece no portal de nenhum proprietário nem nas diárias).
const TRANSFERENCIAS_ANUNCIO: Array<{
  empNome: string
  aptNum: string
  inicioNovoImovel: string // 'YYYY-MM-DD' — primeiro check-in do imóvel novo
  antigo: { empNome: string; aptNum: string } | null
}> = [
  // "Link Noroeste - 204": até 28/05/2026 o anúncio era o BRISAS A115 (a aba
  // Cobranças das reservas antigas mostra "Brisas do Lago A115"; imóvel antigo
  // identificado pelo usuário em 27/07/2026). LINK 204 começou em 29/05/2026.
  { empNome: 'LINK', aptNum: '204', inicioNovoImovel: '2026-05-29', antigo: { empNome: 'BRISAS', aptNum: 'A115' } },
  // "LINK Noroeste - 104": até 02/05/2026 o anúncio era o BRISAS B119 (a aba
  // Cobranças das reservas antigas mostra "Brisas do Lago - B119"; confirmado
  // pelo usuário em 27/07/2026). LINK 104 começou em 03/05/2026.
  { empNome: 'LINK', aptNum: '104', inicioNovoImovel: '2026-05-03', antigo: { empNome: 'BRISAS', aptNum: 'B119' } },
  // "Asa Sul 415 - 104" / quarto "SQS 414" (room e4a90e7d): até 12/03/2026 o
  // anúncio era o "Park Sul Essence - 204" (a aba Cobranças das reservas
  // antigas mostra "Park Sul Essence - 204"; confirmado pelo usuário em
  // 29/07/2026 com prints do calendário). O ASA SUL 104 começou em 16/05/2026 —
  // entre 12/03 e 16/05 o anúncio não teve reserva nenhuma. Este quarto resolve
  // por amenitiz_room_id (o nome "SQS 414" não casa com nenhum prefixo do
  // AMENITIZ_EMP_MAP), então aptNum aqui é a chave 'room:<8 primeiros chars>'.
  // ESSENCE 204 não existe no cadastro → antigo: null (reservas antigas ficam
  // com apartamento_id nulo, fora de qualquer portal e das diárias).
  { empNome: 'ASA SUL', aptNum: 'room:e4a90e7d', inicioNovoImovel: '2026-05-16', antigo: null },
  // O mesmo quarto e4a90e7d ("Vision " na Amenitiz) trocou de imóvel de novo:
  // a partir do check-in de 16/09/2026 opera o VISION 1016 (sub) e o ASA SUL
  // 104 saiu da carteira — confirmado pelo usuário em 22/10/2026. O quarto
  // resolve por amenitiz_room_id, que precisa estar no VISION 1016 para esta
  // regra valer: mover SÓ DEPOIS do deploy, senão o cron de 10 min remapeia
  // jul–set para o Vision. Reservas anteriores a 16/09 voltam ao ASA SUL 104
  // pelo nome (chave do cadastro) e, em cadeia, as anteriores a 16/05 caem na
  // regra de FK nula (entrada abaixo, mesma regra acima com a chave por nome).
  { empNome: 'VISION',  aptNum: 'room:e4a90e7d', inicioNovoImovel: '2026-09-16', antigo: { empNome: 'ASA SUL', aptNum: '104' } },
  { empNome: 'ASA SUL', aptNum: '104',           inicioNovoImovel: '2026-05-16', antigo: null },
]

// Unidades que a Amenitiz anuncia separadas mas que no sistema são UM único
// apartamento (anúncio conjunto — mesmas unidades físicas). A reserva de
// qualquer unidade individual é alocada ao apartamento conjunto no lookup;
// individual_room_name/number preservam a unidade real para exibição.
// Confirmado pelo usuário em 07/07/2026 (Metropolitan).
const APELIDOS_APARTAMENTO: Record<string, string> = {
  'METROPOLITAN::1615':  '1615A - 1615',
  'METROPOLITAN::1615A': '1615A - 1615',
  'METROPOLITAN::1701':  '1701 - 1701A',
  'METROPOLITAN::1701A': '1701 - 1701A',
}

// Ajustes manuais de valor líquido definidos pela gestão (booking_id → valor
// fixo em R$). Aplicados em TODO sync: o upsert reescreve valor_liquido com o
// valor daqui, então o ajuste sobrevive aos crons de 5 min e diário — UPDATE
// direto no banco era revertido no ciclo seguinte (aconteceu com a reserva
// 3765951988, ajustada via script em jul/2026 e desfeita pelo sync).
// afetaDiarias: se true, o valor ajustado também substitui o original na
// agregação de diárias da competência do check-in; se false, a diária mantém o
// valor da API (ex.: prestação do mês do check-in já entregue).
// Aplicação imediata (sem esperar o cron): scripts/ajuste-faturamento-portal-jun2026.ts.
const AJUSTES_VALOR_LIQUIDO: Record<string, { valor: number; afetaDiarias: boolean }> = {
  // marlene cunha, EASY 117 (11/05→11/06/2026): NÃO ajustar. A reserva ficou em
  // 18.414,00 para a fração de junho exibir 5.940,00 (×10/31), mas maio detém 21
  // das 31 noites e o painel de ocupação de maio inflava para 12.474,00 —
  // divergindo do faturamento de 6.137,99 fechado com o cliente. Os dois meses
  // são mutuamente exclusivos nesta reserva: maio certo exige o valor da API
  // (6.137,98 → mai 4.157,99 / jun 1.980,00), junho certo exigiria 18.414,00.
  // Decisão da gestão em 28/07/2026: maio prevalece.
  // Faturamento de junho/2026 definido pela gestão em 28/07/2026 — a diária de
  // junho (KPI do portal/prestação) E o painel de ocupação de junho fecham nos
  // totais abaixo. Reservas que cruzam a virada foram zeradas com o valor
  // movido para a reserva de calibração (só junho) — efeito aceito pela gestão:
  // a fração de julho delas sai da ocupação de julho (cards R$ 0,00).
  //
  // ATIVO APENAS O ASA SUL 104 (decisão de 29/07/2026): o pedido do dia foi
  // fechar junho da proprietária desse imóvel em R$ 6.643,14. Os outros cinco
  // alvos de 28/07 seguem comentados — descomentar move o KPI e o painel de
  // outros proprietários, então exige decisão explícita da gestão.
  // '1180749274': { valor: 5583.60, afetaDiarias: true }, // LINK 104 calibração → jun 7.887,62
  // '8999278194': { valor: 0,       afetaDiarias: true }, // LINK 104 crosser jun→jul zerado
  // '3806962788': { valor: 455.65,  afetaDiarias: true }, // ATHOS 910   → jun 6.897,47
  // '6210120260': { valor: 973.59,  afetaDiarias: true }, // FUSION 722 calibração → jun 5.716,12
  // '8394481973': { valor: 0,       afetaDiarias: true }, // FUSION 722 crosser jun→jul zerado
  // '516241750':  { valor: 298.75,  afetaDiarias: true }, // FUSION 1415 → jun 5.714,65
  // '7872803089': { valor: 464.28,  afetaDiarias: true }, // FUSION 1501 → jun 5.582,60
  '4806953104': { valor: 0,       afetaDiarias: true }, // ASA SUL 104 → jun 6.643,14
  '1269962843': { valor: 0,       afetaDiarias: true }, // ASA SUL 104 (idem)
  '2706349721': { valor: 1882.62, afetaDiarias: true }, // ASA SUL 104 calibração
  '3766741104': { valor: 0,       afetaDiarias: true }, // ASA SUL 104 crosser jun→jul zerado
  // Faturamento de MAIO/2026 do ASA SUL 104 fechado pela gestão em 29/07/2026:
  // R$ 3.806,42 no KPI e no painel. Maio só conta reservas a partir de 16/05
  // (ver TRANSFERENCIAS_ANUNCIO); as ativas somavam 1.890,00, então a diferença
  // vai para a reserva de calibração, que fica contida dentro de maio.
  '8734719794': { valor: 2994.41, afetaDiarias: true },  // ASA SUL 104 calibração → mai 3.806,42
  // Check-in em MAIO, checkout em junho. afetaDiarias passou a true em
  // 29/07/2026: enquanto era false, a diária de maio somava esta reserva pelo
  // valor da API (675,00) e maio fechava 4.481,42 em vez do alvo.
  '5607150631': { valor: 0,       afetaDiarias: true },  // ASA SUL 104 crosser mai→jun zerado
  // Sub-centavo: a soma decimal de junho dava exatamente x,145 (fronteira de
  // arredondamento); valores redondos tiram a soma da fronteira sem mudar a
  // exibição individual (R$ 413,04 / R$ 426,94 permanecem).
  '8546214963': { valor: 413.04,  afetaDiarias: true }, // ASA SUL 104
  '6672564913': { valor: 426.94,  afetaDiarias: true }, // ASA SUL 104
}

// Faturamento mensal fechado pela gestão (fonte: planilha de prestação de
// contas). Sobrescreve o valor da diária do período — que é o KPI "Faturamento"
// do portal em mês fechado (Histórico e Rentabilidade) e a base do repasse.
// Reaplicado em todo sync completo, então sobrevive ao cron das 05:00 (a janela
// móvel cobre o mês corrente + 2 anteriores e regenera as diárias do zero).
//
// Quando usar em vez de AJUSTES_VALOR_LIQUIDO: a diária soma o valor INTEGRAL
// da reserva na competência do check-in, sem ratear noites. Um mês que recebe a
// fração de uma reserva iniciada no mês anterior nunca fecha no total da
// planilha ajustando reservas individuais — só um alvo direto resolve.
//
// Limitação aceita: não altera amenitiz_reservas, então o painel de reservas
// (que rateia por noites) pode não somar exatamente este total.
//
// Chave: 'EMPREENDIMENTO::numero::mes/ano'.
// Aplicação imediata (sem esperar o cron): scripts/ajuste-faturamento-mensal.ts.
// Sem alvos ativos por ora (decisão de 29/07/2026): o mecanismo fica pronto,
// mas os alvos do EASY 117 seguem comentados para não mover o KPI do Leonardo
// junto com o ajuste do ASA SUL 104 — descomentar exige decisão da gestão.
const FATURAMENTO_MENSAL: Record<string, number> = {
  // EASY 117 (Leonardo) — planilha de maio/2026: 594,00 (3 de 5 noites da
  // reserva 29/04→04/05) + 1.386,00 (04/05→11/05) + 4.157,99 (21 de 31 noites
  // da reserva 11/05→11/06). A diária fechava em 7.523,98 porque somava a
  // reserva de maio→junho integral e ignorava a fração vinda de abril.
  // 'EASY::117::5/2026': 6137.99,
  // EASY 117 (Leonardo) — junho/2026 fechado pela gestão. Junho não tinha linha
  // de diária (KPI exibia R$ 0,00): a única reserva do mês é a 3765951988, que
  // tem check-in em maio, e a agregação só conta reservas com check-in no
  // próprio mês. Sem um alvo direto, junho fica zerado para sempre.
  // 'EASY::117::6/2026': 5940.00,
}

function parseNomeQuarto(roomName: string): { dbEmpNome: string; aptNumero: string } | null {
  if (!roomName) return null
  const parts = roomName.trim().split(' - ')
  const seg0 = (parts[0] ?? '').trim().toUpperCase()

  // Formato 1: "Easy 117" — empreendimento e número no mesmo segmento (sem ' - ')
  for (const [pfx, dbNome] of AMENITIZ_EMP_MAP) {
    if (seg0.startsWith(pfx + ' ')) {
      const aptRaw = seg0.slice(pfx.length).trim()
      if (!aptRaw) continue
      const aptNorm = /^\d+$/.test(aptRaw) ? String(parseInt(aptRaw, 10)) : aptRaw
      return { dbEmpNome: dbNome, aptNumero: aptNorm }
    }
  }

  // Formato 2: "Link Noroeste - 104" — nome do empreendimento é o primeiro segmento inteiro,
  // número do apartamento é o segundo segmento (simples: dígitos ou letra+dígitos)
  if (parts.length >= 2) {
    const aptRaw = (parts[1] ?? '').trim()
    if (/^[A-Z]?\d{1,6}[A-Z]?$/i.test(aptRaw)) {
      for (const [pfx, dbNome] of AMENITIZ_EMP_MAP) {
        if (seg0 === pfx) {
          const aptNorm = /^\d+$/.test(aptRaw) ? String(parseInt(aptRaw, 10)) : aptRaw.toUpperCase()
          return { dbEmpNome: dbNome, aptNumero: aptNorm }
        }
      }
    }
  }

  console.warn(`[Sync] parseNomeQuarto: prefixo desconhecido em "${roomName}"`)
  return null
}

function lookupApt(
  aptMap: Record<string, { id: string; tipoGestao: string; empNome: string }>,
  empNome: string,
  aptNum: string
) {
  const chave = `${empNome}::${aptNum}`
  if (aptMap[chave]) return aptMap[chave]
  if (aptNum.includes(' E ')) {
    const [a, b] = aptNum.split(' E ')
    for (const variante of [`${a} - ${b}`, `${b} - ${a}`, `${a}/${b}`, `${b}/${a}`]) {
      const k = `${empNome}::${variante}`
      if (aptMap[k]) return aptMap[k]
    }
  }
  return undefined
}

/**
 * Grava entrada/saída de cada quarto em `limpeza_ocupacao` — a fonte da lista
 * da equipe de limpeza. Usa TODOS os quartos da reserva (reserva de grupo ocupa
 * vários) e também quartos que o mapeamento financeiro não reconhece (ex.: "SM
 * 701"), que o sync de reservas descarta. Só reservas que saem a partir de 14
 * dias atrás: o que é mais antigo não muda nada na limpeza e só gastaria IO.
 * Sem dados do hóspede além do número de pessoas.
 */
async function gravarOcupacaoLimpeza(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  reservas: Awaited<ReturnType<typeof fetchTodasReservasMes>>,
) {
  const corte = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10)
  const agora = new Date().toISOString()
  // booking_id → linhas (uma por quarto); a chave interna deduplica o quarto
  const porReserva = new Map<string, Map<string, Record<string, unknown>>>()
  for (const r of reservas) {
    const checkin = String(r.checkin ?? '').slice(0, 10)
    const checkout = String(r.checkout ?? '').slice(0, 10)
    if (!r.booking_id || !checkin || !checkout || checkout < corte) continue
    const hospedes = (Number(r.adults) || 0) + (Number(r.children) || 0)
    // Só o PRIMEIRO nome do titular (migration 044): a equipe de limpeza não
    // recebe sobrenome, e-mail nem telefone do hóspede.
    const hospede = String(r.booker?.first_name ?? '').trim().split(/\s+/)[0]?.slice(0, 40) || null
    const id = String(r.booking_id)
    for (const room of r.rooms ?? []) {
      if (!room?.individual_room_id) continue
      if (!porReserva.has(id)) porReserva.set(id, new Map())
      porReserva.get(id)!.set(room.individual_room_id, {
        booking_id: id, room_id: room.individual_room_id,
        checkin, checkout, status: r.status ?? 'confirmed',
        hospedes: hospedes || null, hospede, atualizado_em: agora,
      })
    }
  }
  // Lotes por reserva (nunca partir uma reserva entre dois lotes). Só as
  // reservas cuja ocupação MUDOU são regravadas: compara o que está no banco
  // com o que a Amenitiz devolveu e pula as idênticas — antes, ~600 linhas
  // eram apagadas e reinseridas a cada rodada do cron (I/O de disco à toa).
  // Reserva trocada de quarto: apaga as linhas dela antes de regravar, senão
  // o quarto antigo continuaria "ocupado".
  const ids = [...porReserva.keys()]
  const LOTE = 300
  for (let i = 0; i < ids.length; i += LOTE) {
    const loteIds = ids.slice(i, i + LOTE)
    const { data: atuais, error: selErr } = await supabase
      .from('limpeza_ocupacao')
      .select('booking_id, room_id, checkin, checkout, status, hospedes, hospede')
      .in('booking_id', loteIds)
    if (selErr) throw new Error(selErr.message)
    const gravadoPorId = new Map<string, Record<string, unknown>[]>()
    for (const row of atuais ?? []) {
      const id = String(row.booking_id)
      if (!gravadoPorId.has(id)) gravadoPorId.set(id, [])
      gravadoPorId.get(id)!.push(row)
    }
    const mudaram = loteIds.filter(id =>
      assinaturaOcupacao(gravadoPorId.get(id) ?? []) !== assinaturaOcupacao([...porReserva.get(id)!.values()]))
    if (mudaram.length === 0) continue
    const { error: delErr } = await supabase.from('limpeza_ocupacao').delete().in('booking_id', mudaram)
    if (delErr) throw new Error(delErr.message)
    const linhas = mudaram.flatMap(id => [...porReserva.get(id)!.values()])
    const { error } = await supabase.from('limpeza_ocupacao').insert(linhas)
    if (error) throw new Error(error.message)
  }
}

// O que importa para a limpeza numa reserva (sem atualizado_em), em ordem de
// quarto — igual no banco e no payload novo ⇒ nada a regravar.
function assinaturaOcupacao(linhas: Record<string, unknown>[]): string {
  return JSON.stringify(
    linhas
      .map(l => [String(l.room_id), String(l.checkin), String(l.checkout), String(l.status), l.hospedes ?? null, l.hospede ?? null])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  )
}

export type SyncAmenitizResult = {
  success: boolean
  mes: number
  ano: number
  total_reservas: number
  faturamento_bruto: number
  faturamento_liquido: number
  apartamentos_sincronizados: number
  apts_nao_encontrados: string[]
  /** Linhas de amenitiz_reservas efetivamente gravadas (novas ou alteradas). */
  reservas_gravadas?: number
  /** Linhas idênticas ao banco, puladas pelo sync_hash (migration 045). */
  reservas_inalteradas?: number
  error?: string
}

export async function runAmenitizSync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  mes: number,
  ano: number,
  {
    empFiltro,
    actorUserId,
    // reservasOnly: apenas upsert em amenitiz_reservas, sem tocar diarias/importacoes/syncs.
    // Usado pelo botão do proprietário — não destrutivo.
    reservasOnly,
    // apenasNovas: insere só booking_ids que ainda não existem no banco.
    // Para backfill de meses passados sem sobrescrever edições manuais de analistas.
    apenasNovas,
  }: { empFiltro?: string | null; actorUserId?: string | null; reservasOnly?: boolean; apenasNovas?: boolean } = {}
): Promise<SyncAmenitizResult> {
  // Só cria log de sync para runs completos (cron/admin), não para checks do proprietário
  const { data: syncLog } = reservasOnly
    ? { data: null }
    : await supabase
        .from('amenitiz_syncs')
        .insert({ mes, ano, status: 'em_andamento', sincronizado_por: actorUserId ?? null })
        .select().single()

  const { data: apartamentos, error: aptError } = await supabase
    .from('apartamentos')
    .select('id, numero, tipo_gestao, amenitiz_room_id, empreendimentos(nome)')

  if (aptError || !apartamentos?.length) {
    const msg = aptError?.message ?? 'Nenhum apartamento cadastrado'
    return { success: false, mes, ano, total_reservas: 0, faturamento_bruto: 0, faturamento_liquido: 0, apartamentos_sincronizados: 0, apts_nao_encontrados: [], error: msg }
  }

  const empFiltroNorm = empFiltro ? String(empFiltro).toUpperCase().trim() : null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aptsFiltrados = empFiltroNorm
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? apartamentos.filter((a: any) => ((a.empreendimentos?.nome) ?? '').toUpperCase().trim() === empFiltroNorm)
    : apartamentos

  const aptMapCompleto: Record<string, { id: string; tipoGestao: string; empNome: string }> = {}
  const aptMapByRoomId: Record<string, { id: string; tipoGestao: string; empNome: string }> = {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aptsFiltrados.forEach((a: any) => {
    const empNome    = ((a.empreendimentos?.nome) ?? '').toUpperCase().trim()
    const aptNum     = String(a.numero ?? '').trim().toUpperCase()
    const tipoGestao = a.tipo_gestao ?? 'adm'
    const info       = { id: a.id, tipoGestao, empNome }
    aptMapCompleto[`${empNome}::${aptNum}`] = info
    if (a.amenitiz_room_id) aptMapByRoomId[String(a.amenitiz_room_id)] = info
  })

  let reservas
  try {
    reservas = await fetchTodasReservasMes(mes, ano)
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
    if (!reservasOnly && syncLog?.id) {
      await supabase.from('amenitiz_syncs').update({ status: 'erro', erro_mensagem: msg, updated_at: new Date().toISOString() }).eq('id', syncLog.id)
    }
    return { success: false, mes, ano, total_reservas: 0, faturamento_bruto: 0, faturamento_liquido: 0, apartamentos_sincronizados: 0, apts_nao_encontrados: [], error: msg }
  }

  // Ocupação para a equipe de limpeza (migration 043). Independe do mapeamento
  // financeiro abaixo e nunca derruba o sync.
  try {
    await gravarOcupacaoLimpeza(supabase, reservas)
  } catch (e) {
    console.error('[Sync] ocupação da limpeza não gravada:', e instanceof Error ? e.message : e)
  }

  const porAptId: Record<string, { aptId: string; empNome: string; aptNum: string; tipoGestao: string; totalBruto: number; totalLiquido: number; countReservas: number }> = {}
  let totalReservas = 0, totalBruto = 0, totalLiquido = 0
  const naoEncontrados: string[] = []

  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim    = new Date(ano, mes, 0).toISOString().slice(0, 10)

  // Payloads acumulados para upsert em lote (evita N round trips ao Supabase).
  // Dois mapas separados: PostgREST exige que todos os objetos do batch tenham
  // as mesmas chaves, e apartamento_id é omitido quando o lookup falha (para
  // preservar o valor existente no banco). Map por booking_id deduplica dentro
  // do lote — o Postgres rejeita batch que afeta a mesma linha duas vezes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payloadsComApt = new Map<string, any>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payloadsSemApt = new Map<string, any>()

  for (const r of reservas) {
    // Cancelada/no-show NÃO é pulada: o upsert precisa atualizar o status da linha
    // existente (senão uma reserva confirmada→cancelada fica 'confirmed' para sempre,
    // inflando o faturamento). Ela só não entra na agregação de diárias/totais.
    const cancelada = ['cancelled', 'canceled', 'no_show'].includes(r.status)
    const room = r.rooms?.[0]
    if (!room) continue

    const roomName   = room.individual_room_name ?? ''
    const valorBruto = parseFloat(r.total_amount_after_tax) || 0
    const parsed     = parseNomeQuarto(roomName)

    let empNomeDoRoom: string, aptNumRoom: string
    if (parsed) {
      empNomeDoRoom = parsed.dbEmpNome
      aptNumRoom    = parsed.aptNumero
    } else {
      const roomIdInfo = room.individual_room_id ? aptMapByRoomId[room.individual_room_id] : undefined
      if (roomIdInfo) {
        empNomeDoRoom = roomIdInfo.empNome
        aptNumRoom    = `room:${String(room.individual_room_id).slice(0, 8)}`
      } else {
        continue
      }
    }

    // Anúncio transferido: reserva anterior à troca pertence ao imóvel antigo.
    // Com antigo conhecido, remapeia (taxa e vínculo do imóvel certo); sem
    // antigo, marca para gravar com FK nula (limpa atribuição errada existente).
    // Em cadeia: o imóvel antigo pode ter sido, ele mesmo, uma troca anterior
    // (quarto e4a90e7d: VISION 1016 ← ASA SUL 104 ← sem imóvel).
    let semVinculoTransferencia = false
    for (let passo = 0; passo < TRANSFERENCIAS_ANUNCIO.length; passo++) {
      const empAtual = empNomeDoRoom, aptAtual = aptNumRoom
      const transferencia = TRANSFERENCIAS_ANUNCIO.find(t =>
        t.empNome === empAtual && t.aptNum === aptAtual && r.checkin < t.inicioNovoImovel)
      if (!transferencia) break
      if (transferencia.antigo === null) { semVinculoTransferencia = true; break }
      empNomeDoRoom = transferencia.antigo.empNome
      aptNumRoom    = transferencia.antigo.aptNum
    }

    // Anúncio conjunto: a unidade individual resolve para o apartamento conjunto
    // no vínculo/diárias; a reserva continua exibindo a unidade real.
    const aptNumCanonico = APELIDOS_APARTAMENTO[`${empNomeDoRoom}::${aptNumRoom}`] ?? aptNumRoom

    // Resolver aptInfo ANTES do upsert para incluir apartamento_id como FK real
    // (migration 022 — necessário para RLS do portal funcionar por FK, não por
    // texto) e ANTES da taxa: o tipo de gestão do imóvel define se a reserva
    // direta paga os 10% da AlugEasy (só adm; sub é isenta).
    const aptInfo = semVinculoTransferencia
      ? undefined
      : aptNumRoom.startsWith('room:')
        ? aptMapByRoomId[room.individual_room_id ?? '']
        : lookupApt(aptMapCompleto, empNomeDoRoom, aptNumCanonico)

    // Check-in define a vigência da tabela do Booking (reajuste de 09/2026).
    const { valorLiquido, taxaAplicada, plataformaNormalizada } = calcularValorLiquido(valorBruto, r.source, empNomeDoRoom, aptNumRoom, r.checkin, aptInfo?.tipoGestao)

    // Ajuste manual da gestão: força o valor líquido gravado na reserva; com
    // afetaDiarias o valor ajustado também entra na agregação de diárias.
    const ajusteManual = AJUSTES_VALOR_LIQUIDO[String(r.booking_id)]
    const valorLiquidoReserva = ajusteManual ? ajusteManual.valor : valorLiquido
    const valorLiquidoDiaria  = ajusteManual?.afetaDiarias ? ajusteManual.valor : valorLiquido

    const nomeHospede = [`${r.booker.first_name} ${r.booker.last_name}`.trim(), r.booker.phone?.trim() ? `— ${r.booker.phone.trim()}` : ''].filter(Boolean).join(' ')

    // apartamento_id só é incluído no payload quando o lookup tem sucesso.
    // Ao omitir o campo no ON CONFLICT UPDATE, preservamos o valor existente no banco
    // em vez de sobrescrever com null quando o lookup falha temporariamente.
    const aptId = aptInfo?.id
    // Competência pela data de CHECK-IN — reserva que atravessa a virada é
    // gravada também pelo sync do mês seguinte (para o portal ratear as noites),
    // mas pertence ao mês em que o hóspede entrou. Idempotente entre syncs.
    const ciStr = String(r.checkin ?? '').slice(0, 10)
    const mesCompetencia = parseInt(ciStr.slice(5, 7)) || mes
    const anoCompetencia = parseInt(ciStr.slice(0, 4)) || ano

    const payload = {
      booking_id: r.booking_id, hotel_uuid: process.env.AMENITIZ_HOTEL_UUID!,
      status: r.status, source: r.source, plataforma_normalizada: plataformaNormalizada,
      checkin: r.checkin, checkout: r.checkout,
      individual_room_number: aptNumRoom, individual_room_name: roomName,
      valor_bruto: valorBruto, taxa_aplicada: taxaAplicada, valor_liquido: valorLiquidoReserva,
      nome_hospede: nomeHospede, email_hospede: r.booker.email, phone_hospede: r.booker.phone,
      mes_competencia: mesCompetencia, ano_competencia: anoCompetencia, raw_data: r,
    }
    // Chave SEMPRE texto: a API devolve booking_id como número (apesar do tipo
    // declarado), e o banco devolve text — sem String() o lookup por
    // booking_id vindo do banco (sync_hash e apenasNovas) nunca encontra nada.
    const chave = String(r.booking_id)
    if (semVinculoTransferencia) {
      // FK explicitamente nula: sobrescreve atribuição errada gravada antes da regra
      payloadsSemApt.delete(chave)
      payloadsComApt.set(chave, { ...payload, apartamento_id: null })
    } else if (aptId) {
      payloadsSemApt.delete(chave)
      payloadsComApt.set(chave, { ...payload, apartamento_id: aptId })
    } else if (!payloadsComApt.has(chave)) {
      payloadsSemApt.set(chave, payload)
    }

    // Cancelada: linha atualizada acima (status), mas fora das diárias e dos totais
    if (cancelada) continue

    // Atravessou a virada (check-in em mês anterior): upsertada acima para o
    // portal ratear as noites deste mês, mas fora das diárias/totais — o valor
    // integral já entra na competência do mês do check-in (sync daquele mês).
    if (ciStr && ciStr < dataInicio) continue

    // Transferência sem imóvel antigo identificado: fora das diárias, sem aviso
    if (semVinculoTransferencia) continue

    if (!aptInfo) {
      const aviso = `${empNomeDoRoom} ${aptNumRoom}`
      if (!naoEncontrados.includes(aviso)) naoEncontrados.push(aviso)
      continue
    }

    const key = aptInfo.id
    if (!porAptId[key]) {
      porAptId[key] = { aptId: aptInfo.id, empNome: aptInfo.empNome, aptNum: aptNumRoom, tipoGestao: aptInfo.tipoGestao, totalBruto: 0, totalLiquido: 0, countReservas: 0 }
    }
    porAptId[key].totalBruto   += valorBruto
    porAptId[key].totalLiquido += valorLiquidoDiaria
    porAptId[key].countReservas++
    totalReservas++
    totalBruto   += valorBruto
    totalLiquido += valorLiquidoDiaria
  }

  // Backfill seguro: remove dos lotes os booking_ids já existentes, preservando
  // linhas que analistas possam ter editado manualmente em meses passados.
  if (apenasNovas) {
    const ids = [...new Set([...payloadsComApt.keys(), ...payloadsSemApt.keys()])]
    for (let i = 0; i < ids.length; i += 500) {
      const { data: existentes } = await supabase
        .from('amenitiz_reservas')
        .select('booking_id')
        .in('booking_id', ids.slice(i, i + 500))
      for (const row of existentes ?? []) {
        payloadsComApt.delete(String(row.booking_id))
        payloadsSemApt.delete(String(row.booking_id))
      }
    }
  }

  // Só grava o que mudou: o hash do payload vai na coluna sync_hash e é
  // comparado com o da última gravação. Linha nova ou alterada → upsert;
  // idêntica → pulada. Se a coluna ainda não existir (migration 045 não
  // aplicada), cai no comportamento antigo e grava tudo — o sync nunca para
  // por causa da otimização.
  for (const mapa of [payloadsComApt, payloadsSemApt]) {
    for (const [id, p] of mapa) mapa.set(id, { ...p, sync_hash: hashEstavel(p) })
  }
  let reservasInalteradas = 0
  const idsCandidatos = apenasNovas ? [] : [...new Set([...payloadsComApt.keys(), ...payloadsSemApt.keys()])]
  for (let i = 0; i < idsCandidatos.length; i += 500) {
    const { data: existentes, error: selError } = await supabase
      .from('amenitiz_reservas')
      .select('booking_id, sync_hash')
      .in('booking_id', idsCandidatos.slice(i, i + 500))
    if (selError) {
      console.warn('[Sync] sync_hash indisponível, gravando todas as reservas:', selError.message)
      for (const mapa of [payloadsComApt, payloadsSemApt]) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const [id, { sync_hash: _h, ...semHash }] of mapa) mapa.set(id, semHash)
      }
      reservasInalteradas = 0
      break
    }
    for (const row of existentes ?? []) {
      const id = String(row.booking_id)
      const p = payloadsComApt.get(id) ?? payloadsSemApt.get(id)
      if (p && row.sync_hash && row.sync_hash === p.sync_hash) {
        payloadsComApt.delete(id)
        payloadsSemApt.delete(id)
        reservasInalteradas++
      }
    }
  }
  const reservasGravadas = payloadsComApt.size + payloadsSemApt.size

  // Upsert em lotes de 500 — antes era 1 round trip por reserva (N+1).
  const LOTE = 500
  for (const rows of [Array.from(payloadsComApt.values()), Array.from(payloadsSemApt.values())]) {
    for (let i = 0; i < rows.length; i += LOTE) {
      const { error: upsertError } = await supabase
        .from('amenitiz_reservas')
        .upsert(rows.slice(i, i + LOTE), { onConflict: 'booking_id' })
      if (upsertError) {
        const msg = `Erro ao gravar reservas (lote ${i / LOTE + 1}): ${upsertError.message}`
        if (!reservasOnly && syncLog?.id) {
          await supabase.from('amenitiz_syncs').update({ status: 'erro', erro_mensagem: msg, updated_at: new Date().toISOString() }).eq('id', syncLog.id)
        }
        return { success: false, mes, ano, total_reservas: 0, faturamento_bruto: 0, faturamento_liquido: 0, apartamentos_sincronizados: 0, apts_nao_encontrados: naoEncontrados, error: msg }
      }
    }
  }

  // Bloco destrutivo — DELETE + re-INSERT de diárias e logs.
  // NUNCA executado em modo reservasOnly (botão do proprietário).
  if (!reservasOnly) {
    if (empFiltroNorm) {
      const aptIds = Object.values(aptMapCompleto).map(i => i.id)
      if (aptIds.length > 0) {
        await supabase.from('diarias').delete().gte('data', dataInicio).lte('data', dataFim).in('apartamento_id', aptIds)
      }
    } else {
      await supabase.from('diarias').delete().gte('data', dataInicio).lte('data', dataFim)
    }

    const diariasParaInserir = Object.values(porAptId).map(d => ({
      apartamento_id: d.aptId,
      valor:          Math.round(d.totalLiquido * 100) / 100,
      data:           dataInicio,
      tipo_gestao:    d.tipoGestao,
    }))

    // Alvo da gestão sobrescreve o total agregado. Aplicado aqui (e não na
    // agregação por reserva) para valer também quando o mês não tem nenhuma
    // reserva com check-in no período — caso em que não existe linha em
    // porAptId e a diária simplesmente não seria gravada.
    for (const [chave, valor] of Object.entries(FATURAMENTO_MENSAL)) {
      const [empNome, aptNum, competencia] = chave.split('::')
      if (competencia !== `${mes}/${ano}`) continue
      // Fora do empFiltro deste run (ou apartamento inexistente): as diárias
      // dele não foram deletadas acima, então não há o que sobrescrever.
      const info = lookupApt(aptMapCompleto, empNome, aptNum)
      if (!info) continue
      const existente = diariasParaInserir.find(d => d.apartamento_id === info.id)
      if (existente) existente.valor = valor
      else diariasParaInserir.push({ apartamento_id: info.id, valor, data: dataInicio, tipo_gestao: info.tipoGestao })
    }

    if (diariasParaInserir.length > 0) {
      const { error } = await supabase.from('diarias').insert(diariasParaInserir)
      if (error) throw new Error(`Erro ao inserir diárias: ${error.message}`)
    }

    await supabase.from('importacoes').insert({
      nome_arquivo:  empFiltroNorm ? `amenitiz-sync-${empFiltroNorm.toLowerCase()}-${mes}-${ano}` : `amenitiz-sync-${mes}-${ano}`,
      tipo:          'diarias_adm',
      mes, ano,
      status:        'concluido',
      importado_por: actorUserId ?? null,
    })

    if (syncLog?.id) {
      await supabase.from('amenitiz_syncs').update({
        status: 'concluido', total_reservas: totalReservas,
        faturamento_bruto: totalBruto, faturamento_liquido: totalLiquido,
        updated_at: new Date().toISOString(),
      }).eq('id', syncLog.id)
    }
  }

  return {
    success: true, mes, ano,
    total_reservas: totalReservas,
    faturamento_bruto: Math.round(totalBruto * 100) / 100,
    faturamento_liquido: Math.round(totalLiquido * 100) / 100,
    apartamentos_sincronizados: Object.keys(porAptId).length,
    apts_nao_encontrados: naoEncontrados,
    reservas_gravadas: reservasGravadas,
    reservas_inalteradas: reservasInalteradas,
  }
}

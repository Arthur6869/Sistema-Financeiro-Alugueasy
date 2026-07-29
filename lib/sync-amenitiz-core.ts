import { fetchTodasReservasMes, calcularValorLiquido } from '@/lib/amenitiz'
import type { SupabaseClient } from '@supabase/supabase-js'

const AMENITIZ_EMP_MAP: Array<[pfx: string, dbNome: string]> = [
  // Formato "Nome Completo - Número" (separador ' - ' no nome do quarto no Amenitiz)
  ['LINK NOROESTE',   'LINK'],
  // "Asa Sul 415 - 104": 415 é a quadra (parte do nome), 104 é o apartamento
  ['ASA SUL 415',     'ASA SUL'],
  // Formato "Prefixo Número" (empreendimento + nº no mesmo segmento)
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
  // Check-in em MAIO: afetaDiarias false preserva a diária de maio (prestação
  // entregue); some apenas dos painéis de ocupação de maio/junho.
  '5607150631': { valor: 0,       afetaDiarias: false }, // ASA SUL 104 crosser mai→jun zerado
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

export type SyncAmenitizResult = {
  success: boolean
  mes: number
  ano: number
  total_reservas: number
  faturamento_bruto: number
  faturamento_liquido: number
  apartamentos_sincronizados: number
  apts_nao_encontrados: string[]
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
    const transferencia = TRANSFERENCIAS_ANUNCIO.find(t =>
      t.empNome === empNomeDoRoom && t.aptNum === aptNumRoom && r.checkin < t.inicioNovoImovel)
    const semVinculoTransferencia = !!transferencia && transferencia.antigo === null
    if (transferencia?.antigo) {
      empNomeDoRoom = transferencia.antigo.empNome
      aptNumRoom    = transferencia.antigo.aptNum
    }

    // Anúncio conjunto: a unidade individual resolve para o apartamento conjunto
    // no vínculo/diárias; a reserva continua exibindo a unidade real.
    const aptNumCanonico = APELIDOS_APARTAMENTO[`${empNomeDoRoom}::${aptNumRoom}`] ?? aptNumRoom

    const { valorLiquido, taxaAplicada, plataformaNormalizada } = calcularValorLiquido(valorBruto, r.source, empNomeDoRoom, aptNumRoom)

    // Ajuste manual da gestão: força o valor líquido gravado na reserva; com
    // afetaDiarias o valor ajustado também entra na agregação de diárias.
    const ajusteManual = AJUSTES_VALOR_LIQUIDO[String(r.booking_id)]
    const valorLiquidoReserva = ajusteManual ? ajusteManual.valor : valorLiquido
    const valorLiquidoDiaria  = ajusteManual?.afetaDiarias ? ajusteManual.valor : valorLiquido

    const nomeHospede = [`${r.booker.first_name} ${r.booker.last_name}`.trim(), r.booker.phone?.trim() ? `— ${r.booker.phone.trim()}` : ''].filter(Boolean).join(' ')

    // Resolver aptInfo ANTES do upsert para incluir apartamento_id como FK real
    // (migration 022 — necessário para RLS do portal funcionar por FK, não por texto)
    const aptInfo = semVinculoTransferencia
      ? undefined
      : aptNumRoom.startsWith('room:')
        ? aptMapByRoomId[room.individual_room_id ?? '']
        : lookupApt(aptMapCompleto, empNomeDoRoom, aptNumCanonico)

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
    if (semVinculoTransferencia) {
      // FK explicitamente nula: sobrescreve atribuição errada gravada antes da regra
      payloadsSemApt.delete(r.booking_id)
      payloadsComApt.set(r.booking_id, { ...payload, apartamento_id: null })
    } else if (aptId) {
      payloadsSemApt.delete(r.booking_id)
      payloadsComApt.set(r.booking_id, { ...payload, apartamento_id: aptId })
    } else if (!payloadsComApt.has(r.booking_id)) {
      payloadsSemApt.set(r.booking_id, payload)
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
        payloadsComApt.delete(row.booking_id)
        payloadsSemApt.delete(row.booking_id)
      }
    }
  }

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
  }
}

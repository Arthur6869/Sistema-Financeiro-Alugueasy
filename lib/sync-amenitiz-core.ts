import { fetchTodasReservasMes, calcularValorLiquido } from '@/lib/amenitiz'
import type { SupabaseClient } from '@supabase/supabase-js'

const AMENITIZ_EMP_MAP: Array<[pfx: string, dbNome: string]> = [
  // Formato "Nome Completo - Número" (separador ' - ' no nome do quarto no Amenitiz)
  ['LINK NOROESTE',   'LINK'],
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
  }: { empFiltro?: string | null; actorUserId?: string | null; reservasOnly?: boolean } = {}
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
    if (['cancelled', 'canceled', 'no_show'].includes(r.status)) continue
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

    const { valorLiquido, taxaAplicada, plataformaNormalizada } = calcularValorLiquido(valorBruto, r.source, empNomeDoRoom, aptNumRoom)

    const nomeHospede = [`${r.booker.first_name} ${r.booker.last_name}`.trim(), r.booker.phone?.trim() ? `— ${r.booker.phone.trim()}` : ''].filter(Boolean).join(' ')

    // Resolver aptInfo ANTES do upsert para incluir apartamento_id como FK real
    // (migration 022 — necessário para RLS do portal funcionar por FK, não por texto)
    const aptInfo = aptNumRoom.startsWith('room:')
      ? aptMapByRoomId[room.individual_room_id ?? '']
      : lookupApt(aptMapCompleto, empNomeDoRoom, aptNumRoom)

    // apartamento_id só é incluído no payload quando o lookup tem sucesso.
    // Ao omitir o campo no ON CONFLICT UPDATE, preservamos o valor existente no banco
    // em vez de sobrescrever com null quando o lookup falha temporariamente.
    const aptId = aptInfo?.id
    const payload = {
      booking_id: r.booking_id, hotel_uuid: process.env.AMENITIZ_HOTEL_UUID!,
      status: r.status, source: r.source, plataforma_normalizada: plataformaNormalizada,
      checkin: r.checkin, checkout: r.checkout,
      individual_room_number: aptNumRoom, individual_room_name: roomName,
      valor_bruto: valorBruto, taxa_aplicada: taxaAplicada, valor_liquido: valorLiquido,
      nome_hospede: nomeHospede, email_hospede: r.booker.email, phone_hospede: r.booker.phone,
      mes_competencia: mes, ano_competencia: ano, raw_data: r,
    }
    if (aptId) {
      payloadsSemApt.delete(r.booking_id)
      payloadsComApt.set(r.booking_id, { ...payload, apartamento_id: aptId })
    } else if (!payloadsComApt.has(r.booking_id)) {
      payloadsSemApt.set(r.booking_id, payload)
    }

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
    porAptId[key].totalLiquido += valorLiquido
    porAptId[key].countReservas++
    totalReservas++
    totalBruto   += valorBruto
    totalLiquido += valorLiquido
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
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim    = new Date(ano, mes, 0).toISOString().slice(0, 10)

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

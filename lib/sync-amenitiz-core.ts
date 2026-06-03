import { fetchTodasReservasMes, calcularValorLiquido } from '@/lib/amenitiz'
import type { SupabaseClient } from '@supabase/supabase-js'

const AMENITIZ_EMP_MAP: Array<[pfx: string, dbNome: string]> = [
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
  ['AB',              'ATHOS'],
  ['ATHOS BULCAO',    'ATHOS'],
  ['ATHOS BULCÃO',    'ATHOS'],
  ['ATHOS',           'ATHOS'],
]

function parseNomeQuarto(roomName: string): { dbEmpNome: string; aptNumero: string } | null {
  if (!roomName) return null
  const prefixoBruto = (roomName.split(' - ')[0] ?? roomName).trim().toUpperCase()
  for (const [pfx, dbNome] of AMENITIZ_EMP_MAP) {
    if (prefixoBruto.startsWith(pfx + ' ')) {
      const aptRaw = prefixoBruto.slice(pfx.length).trim()
      if (!aptRaw) return null
      const aptNorm = /^\d+$/.test(aptRaw) ? String(parseInt(aptRaw, 10)) : aptRaw
      return { dbEmpNome: dbNome, aptNumero: aptNorm }
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
  { empFiltro, actorUserId }: { empFiltro?: string | null; actorUserId?: string | null } = {}
): Promise<SyncAmenitizResult> {
  const { data: syncLog } = await supabase
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
    if (syncLog?.id) {
      await supabase.from('amenitiz_syncs').update({ status: 'erro', erro_mensagem: msg, updated_at: new Date().toISOString() }).eq('id', syncLog.id)
    }
    return { success: false, mes, ano, total_reservas: 0, faturamento_bruto: 0, faturamento_liquido: 0, apartamentos_sincronizados: 0, apts_nao_encontrados: [], error: msg }
  }

  const porAptId: Record<string, { aptId: string; empNome: string; aptNum: string; tipoGestao: string; totalBruto: number; totalLiquido: number; countReservas: number }> = {}
  let totalReservas = 0, totalBruto = 0, totalLiquido = 0
  const naoEncontrados: string[] = []

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

    await supabase.from('amenitiz_reservas').upsert({
      booking_id: r.booking_id, hotel_uuid: process.env.AMENITIZ_HOTEL_UUID!,
      status: r.status, source: r.source, plataforma_normalizada: plataformaNormalizada,
      checkin: r.checkin, checkout: r.checkout,
      individual_room_number: aptNumRoom, individual_room_name: roomName,
      valor_bruto: valorBruto, taxa_aplicada: taxaAplicada, valor_liquido: valorLiquido,
      nome_hospede: nomeHospede, email_hospede: r.booker.email, phone_hospede: r.booker.phone,
      mes_competencia: mes, ano_competencia: ano, raw_data: r,
    }, { onConflict: 'booking_id' })

    const aptInfo = aptNumRoom.startsWith('room:')
      ? aptMapByRoomId[room.individual_room_id ?? '']
      : lookupApt(aptMapCompleto, empNomeDoRoom, aptNumRoom)

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

  return {
    success: true, mes, ano,
    total_reservas: totalReservas,
    faturamento_bruto: Math.round(totalBruto * 100) / 100,
    faturamento_liquido: Math.round(totalLiquido * 100) / 100,
    apartamentos_sincronizados: diariasParaInserir.length,
    apts_nao_encontrados: naoEncontrados,
  }
}

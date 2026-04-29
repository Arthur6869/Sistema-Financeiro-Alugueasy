import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isInternalApiRequest } from '@/lib/internal-api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  fetchTodasReservasMes,
  calcularValorLiquido,
  testConnection,
} from '@/lib/amenitiz'

// Mapa: prefixo usado no Amenitiz → nome do empreendimento no banco (uppercase)
// Nomes no banco: ESSENCE, EASY, CULLINAN, ATHOS, NOBILE, FUSION, MERCURE, METROPOLITAN, RAMADA, BRISAS, VISION
// Ordem importa: prefixos mais longos/específicos primeiro para evitar match parcial
const AMENITIZ_EMP_MAP: Array<[pfx: string, dbNome: string]> = [
  ['BRISAS DO LAGO',  'BRISAS'],        // banco usa "BRISAS"
  ['METROPOLITAN',    'METROPOLITAN'],
  ['MERCURE LIDER',   'MERCURE'],       // banco não diferencia Mercure Lider
  ['CULLINAN',        'CULLINAN'],
  ['ESSENCE',         'ESSENCE'],
  ['MERCURE',         'MERCURE'],
  ['NOBILE',          'NOBILE'],
  ['FUSION',          'FUSION'],
  ['RAMADA',          'RAMADA'],
  ['VISION',          'VISION'],
  ['EASY',            'EASY'],
  ['AB',              'ATHOS'],         // Athos Bulcão aparece abreviado como "AB" no Amenitiz
  ['ATHOS BULCAO',    'ATHOS'],
  ['ATHOS BULCÃO',    'ATHOS'],
  ['ATHOS',           'ATHOS'],
]

/**
 * Extrai nome do empreendimento (conforme banco) e número do apartamento
 * a partir de individual_room_name.
 *
 * Formato: "[EMP_PREFIX] [APT_NUM] - [descrição]"
 * Ex: "Essence 504 - Studio com varanda" → { dbEmpNome: "ESSENCE", aptNumero: "504" }
 * Ex: "AB 114 - Quarto padrão"           → { dbEmpNome: "ATHOS BULCÃO", aptNumero: "114" }
 * Ex: "Brisas do Lago A113 - ..."        → { dbEmpNome: "BRISAS DO LAGO", aptNumero: "A113" }
 */
function parseNomeQuarto(roomName: string): { dbEmpNome: string; aptNumero: string } | null {
  if (!roomName) return null
  const prefixoBruto = (roomName.split(' - ')[0] ?? roomName).trim().toUpperCase()

  for (const [pfx, dbNome] of AMENITIZ_EMP_MAP) {
    if (prefixoBruto.startsWith(pfx + ' ')) {
      const aptRaw  = prefixoBruto.slice(pfx.length).trim()
      if (!aptRaw) return null
      // Normalizar zeros à esquerda em números puros: "03" → "3"
      const aptNorm = /^\d+$/.test(aptRaw) ? String(parseInt(aptRaw, 10)) : aptRaw
      return { dbEmpNome: dbNome, aptNumero: aptNorm }
    }
  }

  console.warn(`[Sync] parseNomeQuarto: prefixo desconhecido em "${roomName}"`)
  return null
}

/**
 * Busca apartamento no mapa por (emp, aptNum).
 * Tenta variantes para unidades combinadas como "1615 E 1615A".
 */
function lookupApt(
  aptMap: Record<string, { id: string; tipoGestao: string; empNome: string }>,
  empNome: string,
  aptNum: string
) {
  const chave = `${empNome}::${aptNum}`
  if (aptMap[chave]) return aptMap[chave]

  // Variantes para unidades combinadas ("1615 E 1615A")
  if (aptNum.includes(' E ')) {
    const [a, b] = aptNum.split(' E ')
    for (const variante of [`${a} - ${b}`, `${b} - ${a}`, `${a}/${b}`, `${b}/${a}`]) {
      const k = `${empNome}::${variante}`
      if (aptMap[k]) return aptMap[k]
    }
  }

  return undefined
}

export async function POST(request: NextRequest) {
  try {
    // Ler body ANTES de qualquer await — Next.js 16 Turbopack consome o stream
    // na primeira vez que um await de I/O ocorre antes da leitura
    const body = await request.json()
    const { mes, ano, empreendimento } = body   // empreendimento é opcional

    if (!mes || !ano || mes < 1 || mes > 12) {
      return NextResponse.json({ error: 'mes e ano são obrigatórios (1–12)' }, { status: 400 })
    }

    const internalRequest = isInternalApiRequest(request)
    const supabase = internalRequest ? createAdminClient() : await createClient()
    let actorUserId: string | null = null

    if (!internalRequest) {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
      }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'analista') {
        return NextResponse.json({ error: 'Apenas analistas podem sincronizar' }, { status: 403 })
      }

      actorUserId = user.id
    }

    // Criar log de sincronização
    const { data: syncLog } = await supabase
      .from('amenitiz_syncs')
      .insert({ mes, ano, status: 'em_andamento', sincronizado_por: actorUserId })
      .select().single()

    // Buscar TODOS os apartamentos com tipo_gestao e amenitiz_room_id do banco
    const { data: apartamentos, error: aptError } = await supabase
      .from('apartamentos')
      .select('id, numero, tipo_gestao, amenitiz_room_id, empreendimentos(nome)')

    if (aptError) {
      console.error('[Sync] Erro ao buscar apartamentos:', aptError.message)
      return NextResponse.json({ error: `Erro ao buscar apartamentos: ${aptError.message}` }, { status: 500 })
    }

    if (!apartamentos?.length) {
      return NextResponse.json({ error: 'Nenhum apartamento cadastrado' }, { status: 400 })
    }

    // Filtrar por empreendimento se especificado (sync parcial)
    const empFiltro = empreendimento ? String(empreendimento).toUpperCase().trim() : null
    const aptsFiltrados = empFiltro
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? apartamentos.filter((a: any) => ((a.empreendimentos?.nome) ?? '').toUpperCase().trim() === empFiltro)
      : apartamentos

    if (empFiltro && aptsFiltrados.length === 0) {
      return NextResponse.json({ error: `Empreendimento "${empreendimento}" não encontrado ou sem apartamentos` }, { status: 400 })
    }

    // Mapa primário: "EMPREENDIMENTO_UPPER::APT_NUMERO_UPPER" → info
    const aptMapCompleto: Record<string, { id: string; tipoGestao: string; empNome: string }> = {}
    // Mapa secundário: amenitiz_room_id (UUID) → info (fallback para quartos sem número padrão)
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

    // Buscar reservas dos 3 endpoints com merge por booking_id
    let reservas
    try {
      reservas = await fetchTodasReservasMes(mes, ano)
      console.log(`[Sync] ${reservas.length} reservas únicas obtidas para ${mes}/${ano}`)
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      await supabase.from('amenitiz_syncs').update({
        status: 'erro',
        erro_mensagem: msg,
        updated_at: new Date().toISOString(),
      }).eq('id', syncLog!.id)
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    // Acumulador por apartamento_id (não por número — evita colisão ADM/SUB)
    const porAptId: Record<string, {
      aptId:         string
      empNome:       string
      aptNum:        string
      tipoGestao:    string
      totalBruto:    number
      totalLiquido:  number
      countReservas: number
    }> = {}

    let totalReservas = 0
    let totalBruto    = 0
    let totalLiquido  = 0
    const naoEncontrados: string[] = []

    for (const r of reservas) {
      // Ignorar canceladas e no-shows
      if (['cancelled', 'canceled', 'no_show'].includes(r.status)) continue

      const room = r.rooms?.[0]
      if (!room) continue

      const roomName   = room.individual_room_name ?? ''
      const valorBruto = parseFloat(r.total_amount_after_tax) || 0

      const parsed = parseNomeQuarto(roomName)
      let empNomeDoRoom: string
      let aptNumRoom: string

      if (parsed) {
        empNomeDoRoom = parsed.dbEmpNome
        aptNumRoom    = parsed.aptNumero
      } else {
        // Fallback: tentar pelo individual_room_id (quartos com nome genérico, sem número)
        const roomIdInfo = room.individual_room_id
          ? aptMapByRoomId[room.individual_room_id]
          : undefined
        if (roomIdInfo) {
          empNomeDoRoom = roomIdInfo.empNome
          aptNumRoom    = `room:${String(room.individual_room_id).slice(0, 8)}`
        } else {
          console.warn(
            `[Sync] ⚠️ Quarto sem mapeamento: "${roomName}" ` +
            `(room_id: ${room.individual_room_id}) — booking ${r.booking_id} ignorado`
          )
          continue
        }
      }

      // Calcular valor líquido com taxa da plataforma
      const { valorLiquido, taxaAplicada, plataformaNormalizada } = calcularValorLiquido(
        valorBruto,
        r.source,
        empNomeDoRoom,
        aptNumRoom
      )

      console.log(
        `[Sync] ${empNomeDoRoom} apt ${aptNumRoom} | ` +
        `${plataformaNormalizada} | ` +
        `Bruto: R$${valorBruto.toFixed(2)} | ` +
        `Taxa: ${(taxaAplicada * 100).toFixed(0)}% | ` +
        `Líquido: R$${valorLiquido.toFixed(2)}`
      )

      // Nome do hóspede com telefone
      const nomeHospede = [
        `${r.booker.first_name} ${r.booker.last_name}`.trim(),
        r.booker.phone?.trim() ? `— ${r.booker.phone.trim()}` : '',
      ].filter(Boolean).join(' ')

      // Salvar reserva para auditoria (upsert por booking_id)
      await supabase.from('amenitiz_reservas').upsert({
        booking_id:             r.booking_id,
        hotel_uuid:             process.env.AMENITIZ_HOTEL_UUID!,
        status:                 r.status,
        source:                 r.source,
        plataforma_normalizada: plataformaNormalizada,
        checkin:                r.checkin,
        checkout:               r.checkout,
        individual_room_number: aptNumRoom,
        individual_room_name:   roomName,
        valor_bruto:            valorBruto,
        taxa_aplicada:          taxaAplicada,
        valor_liquido:          valorLiquido,
        nome_hospede:           nomeHospede,
        email_hospede:          r.booker.email,
        phone_hospede:          r.booker.phone,
        mes_competencia:        mes,
        ano_competencia:        ano,
        raw_data:               r,
      }, { onConflict: 'booking_id' })

      // Encontrar apartamento no banco por (empreendimento + número) ou room_id (fallback)
      const aptInfo = aptNumRoom.startsWith('room:')
        ? aptMapByRoomId[room.individual_room_id ?? '']
        : lookupApt(aptMapCompleto, empNomeDoRoom, aptNumRoom)

      if (!aptInfo) {
        const aviso = `${empNomeDoRoom} ${aptNumRoom}`
        console.warn(`[Sync] ⚠️ Não encontrado no banco: "${aviso}" — verificar cadastro`)
        if (!naoEncontrados.includes(aviso)) naoEncontrados.push(aviso)
        continue
      }

      // Acumular por apartamento_id
      const key = aptInfo.id
      if (!porAptId[key]) {
        porAptId[key] = {
          aptId:         aptInfo.id,
          empNome:       aptInfo.empNome,
          aptNum:        aptNumRoom,
          tipoGestao:    aptInfo.tipoGestao,
          totalBruto:    0,
          totalLiquido:  0,
          countReservas: 0,
        }
      }
      porAptId[key].totalBruto    += valorBruto
      porAptId[key].totalLiquido  += valorLiquido
      porAptId[key].countReservas++

      totalReservas++
      totalBruto   += valorBruto
      totalLiquido += valorLiquido
    }

    // Apagar diárias do período — apenas para os apts do empreendimento (ou todos)
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim    = new Date(ano, mes, 0).toISOString().slice(0, 10)

    if (empFiltro) {
      // Sync parcial: remover somente os apts deste empreendimento
      const aptIds = Object.values(aptMapCompleto).map(i => i.id)
      if (aptIds.length > 0) {
        await supabase.from('diarias').delete()
          .gte('data', dataInicio).lte('data', dataFim)
          .in('apartamento_id', aptIds)
      }
      console.log(`[Sync] Diárias de ${empFiltro} em ${mes}/${ano} removidas (${aptIds.length} apts)`)
    } else {
      // Sync total: remover tudo do período
      await supabase.from('diarias').delete()
        .gte('data', dataInicio).lte('data', dataFim)
      console.log(`[Sync] Diárias anteriores de ${mes}/${ano} removidas`)
    }

    // Inserir novas diárias com tipo_gestao correto (vindo do cadastro do banco)
    const diariasParaInserir: {
      apartamento_id: string
      valor:          number
      data:           string
      tipo_gestao:    string
    }[] = []

    for (const dados of Object.values(porAptId)) {
      diariasParaInserir.push({
        apartamento_id: dados.aptId,
        valor:          Math.round(dados.totalLiquido * 100) / 100,
        data:           dataInicio,
        tipo_gestao:    dados.tipoGestao,
      })

      console.log(
        `[Sync] ✓ ${dados.empNome} apt ${dados.aptNum} ` +
        `(${dados.tipoGestao.toUpperCase()}) | ` +
        `${dados.countReservas} reservas | ` +
        `Líquido: R$${dados.totalLiquido.toFixed(2)}`
      )
    }

    if (diariasParaInserir.length > 0) {
      const { error } = await supabase.from('diarias').insert(diariasParaInserir)
      if (error) throw new Error(`Erro ao inserir diárias: ${error.message}`)
      console.log(`[Sync] ✓ Inseridas ${diariasParaInserir.length} registros de diárias`)
    }

    // Registrar no histórico de importações
    await supabase.from('importacoes').insert({
      nome_arquivo:  empFiltro
        ? `amenitiz-sync-${empFiltro.toLowerCase()}-${mes}-${ano}`
        : `amenitiz-sync-${mes}-${ano}`,
      tipo:          'diarias_adm',
      mes, ano,
      status:        'concluido',
      importado_por: actorUserId,
    })

    // Atualizar log de sincronização
    await supabase.from('amenitiz_syncs').update({
      status:              'concluido',
      total_reservas:      totalReservas,
      faturamento_bruto:   totalBruto,
      faturamento_liquido: totalLiquido,
      updated_at:          new Date().toISOString(),
    }).eq('id', syncLog!.id)

    return NextResponse.json({
      success:                      true,
      mes, ano,
      total_reservas:               totalReservas,
      faturamento_bruto:            totalBruto,
      faturamento_liquido:          totalLiquido,
      apartamentos_sincronizados:   diariasParaInserir.length,
      apartamentos_nao_encontrados: naoEncontrados,
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('[Sync] Erro:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// GET — Testar conexão (usuário autenticado ou chamada interna MCP)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    if (!isInternalApiRequest(request)) {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
      }
    }
    const resultado = await testConnection()
    return NextResponse.json({
      ok:             resultado.ok,
      status:         resultado.status,
      detail:         resultado.detail,
      hotelId:        resultado.hotelId,
      reservasCount:  resultado.reservasCount,
      mensagem:       resultado.ok
        ? `✅ Conexão OK — ${resultado.reservasCount ?? 0} reservas no mês atual (hotel_id: ${resultado.hotelId})`
        : `❌ Falha: ${resultado.detail ?? `HTTP ${resultado.status}`}`,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

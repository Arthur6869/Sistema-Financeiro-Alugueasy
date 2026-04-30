// ── INTERFACES (campos reais confirmados via Insomnia — 200 OK) ────────────

export interface AmenitizRoom {
  room_id: string
  individual_room_id: string
  individual_room_name: string   // ex: "Brisas do Lago - Apartamento de 1 Quarto..."
  individual_room_number: number // number — NÃO usar para matching direto com o banco
}

export interface AmenitizBooker {
  first_name: string
  last_name: string
  email: string
  phone: string
  language: string
}

export interface AmenitizReserva {
  booking_id: string
  status: string                   // 'confirmed' | 'cancelled' | 'no_show'
  currency_code: string
  source: string                   // 'manual' | 'booking' | 'airbnb'
  total_amount_after_tax: string   // ⚠️ STRING — SEMPRE usar parseFloat()
  checkin: string                  // 'YYYY-MM-DD'
  checkout: string
  adults: number
  children: number
  online_checkin_url: string
  online_checkin_registered: boolean
  booker: AmenitizBooker
  rooms: AmenitizRoom[]
}

// ── TAXAS POR PLATAFORMA — Regras de negócio AlugEasy ──────────────────────

const TAXA_BOOKING: Record<string, number> = {
  'ESSENCE':        0.16,
  'METROPOLITAN':   0.16,
  'CULLINAN':       0.16,
  'BRISAS DO LAGO': 0.16,
  'BRISAS':         0.16,
  'MERCURE':        0.16, // exceto apt 1419 → 13%
  'MERCURE LIDER':  0.16,
  'EASY':           0.13,
  'ATHOS':          0.13,
  'ATHOS BULCAO':   0.13,
  'ATHOS BULÇÃO':   0.13,
  'ATHOS BULCÃO':   0.13,
  'NOBILE':         0.13,
  'FUSION':         0.13,
  'RAMADA':         0.13,
  'VISION':         0.13,
}

// Casos especiais por apartamento — key: "EMPREENDIMENTO_UPPER::APT_NUM"
const TAXA_BOOKING_ESPECIFICO: Record<string, number> = {
  'MERCURE::1419': 0.13,
}

/**
 * Extrai o nome do empreendimento do campo individual_room_name.
 * Ex: "Brisas do Lago - Apartamento de 1 Quarto com Vista" → "BRISAS DO LAGO"
 * Ex: "Essence - Studio 204"                               → "ESSENCE"
 */
export function extrairEmpreendimento(roomName: string): string {
  if (!roomName) return ''
  const partes = roomName.split(' - ')
  return (partes[0] ?? roomName).trim().toUpperCase()
}

/**
 * Calcula o valor líquido após dedução da taxa da plataforma.
 */
export function calcularValorLiquido(
  valorBruto: number,
  source: string,
  empNome: string,
  aptNumero: number | string
): { valorLiquido: number; taxaAplicada: number; plataformaNormalizada: string } {

  const src = (source ?? '').toLowerCase().trim()
  const emp = empNome.toUpperCase().trim()
  const apt = String(aptNumero).trim()

  // AIRBNB — sem taxa (valor retornado já é líquido)
  if (src.includes('airbnb')) {
    return { valorLiquido: valorBruto, taxaAplicada: 0, plataformaNormalizada: 'Airbnb' }
  }

  // BOOKING — taxa varia por empreendimento (com caso especial por apt)
  if (src.includes('booking')) {
    const chaveEspecial = `${emp}::${apt}`
    const taxa = TAXA_BOOKING_ESPECIFICO[chaveEspecial] ?? TAXA_BOOKING[emp] ?? 0.13
    return {
      valorLiquido: valorBruto * (1 - taxa),
      taxaAplicada: taxa,
      plataformaNormalizada: 'Booking',
    }
  }

  // MANUAL / ALUGUEASY / DIRETO — 10% para todos
  if (['manual', 'alugueasy', 'direct', 'amenitiz'].some(s => src.includes(s))) {
    return {
      valorLiquido: valorBruto * 0.90,
      taxaAplicada: 0.10,
      plataformaNormalizada: 'Alugueasy',
    }
  }

  // Fallback — source desconhecido: logar aviso, salvar sem taxa
  console.warn(
    `[Amenitiz] ⚠️ Source desconhecido: "${source}" ` +
    `(emp: ${emp}, apt: ${apt}). Aplicando 0% — verificar manualmente.`
  )
  return { valorLiquido: valorBruto, taxaAplicada: 0, plataformaNormalizada: source }
}

// ── CLIENTE HTTP ────────────────────────────────────────────────────────────

function getHeaders(): HeadersInit {
  const token = process.env.AMENITIZ_ACCESS_TOKEN
  if (!token) throw new Error('AMENITIZ_ACCESS_TOKEN não configurado no .env.local')
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}

/**
 * Retorna lista de hotel_ids a tentar, em ordem de prioridade.
 * UUID primeiro (padrão do vendor API), depois BATCAVE_ID numérico como fallback.
 */
function getHotelIdCandidates(): string[] {
  const batcaveId = process.env.AMENITIZ_BATCAVE_ID
  const hotelUuid = process.env.AMENITIZ_HOTEL_UUID
  if (!batcaveId && !hotelUuid) {
    throw new Error('AMENITIZ_BATCAVE_ID ou AMENITIZ_HOTEL_UUID não configurados no .env.local')
  }
  const candidates: string[] = []
  if (hotelUuid) candidates.push(hotelUuid)
  if (batcaveId) candidates.push(batcaveId)
  return candidates
}

/** Cache em memória (válido enquanto o processo Node estiver ativo). */
let _cachedHotelId: string | null = null

/**
 * Tenta fazer GET em um URL com cada hotel_id candidato.
 * Retorna { hotelId, res } do primeiro que responder com 2xx, ou lança erro.
 */
async function fetchComFallback(
  baseUrl: string,
  path: string,
): Promise<{ hotelId: string; res: Response }> {
  const candidates = _cachedHotelId ? [_cachedHotelId, ...getHotelIdCandidates().filter(id => id !== _cachedHotelId)] : getHotelIdCandidates()
  const headers = getHeaders()
  const erros: string[] = []

  for (const hotelId of candidates) {
    const url = `${baseUrl}${path}&hotel_id=${hotelId}`
    console.log(`[Amenitiz] GET ${url}`)
    let res: Response
    try {
      res = await fetch(url, { headers })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      erros.push(`hotel_id=${hotelId}: Rede — ${msg}`)
      continue
    }

    if (res.ok) {
      // Caching do hotel_id que funcionou
      if (_cachedHotelId !== hotelId) {
        _cachedHotelId = hotelId
        console.log(`[Amenitiz] ✅ hotel_id válido encontrado e cacheado: ${hotelId}`)
      }
      return { hotelId, res }
    }

    const body = await res.text().catch(() => '')
    erros.push(`hotel_id=${hotelId}: HTTP ${res.status} — ${body.slice(0, 150)}`)
    console.warn(`[Amenitiz] ❌ hotel_id=${hotelId} → ${res.status} ${res.statusText}`)
  }

  // Todos falharam
  throw new Error(`Amenitiz API indisponível. Tentativas:\n${erros.join('\n')}`)
}

/**
 * Busca reservas de um endpoint específico da Amenitiz.
 */
async function fetchEndpoint(
  endpoint: 'checkin' | 'created' | 'updated',
  mes: number,
  ano: number
): Promise<AmenitizReserva[]> {
  const baseUrl = process.env.AMENITIZ_BASE_URL
  if (!baseUrl) throw new Error('AMENITIZ_BASE_URL não configurado no .env.local')

  const from = `${ano}-${String(mes).padStart(2, '0')}-01`
  const to = new Date(ano, mes, 0).toISOString().slice(0, 10)
  const pathQuery = `/bookings/${endpoint}?from=${from}&to=${to}`

  let res: Response
  try {
    const result = await fetchComFallback(baseUrl, pathQuery)
    res = result.res
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn(`[Amenitiz] /bookings/${endpoint} falhou: ${msg}`)
    return []
  }

  const rawText = await res.text()
  let data: unknown
  try {
    data = JSON.parse(rawText)
  } catch {
    console.warn(`[Amenitiz] /bookings/${endpoint} resposta não-JSON: ${rawText.slice(0, 100)}`)
    return []
  }

  const lista = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown>)?.data ?? (data as Record<string, unknown>)?.bookings ?? [])
  console.log(`[Amenitiz] /bookings/${endpoint} → ${(lista as AmenitizReserva[]).length} reservas`)
  return lista as AmenitizReserva[]
}

/**
 * Busca os 3 endpoints em paralelo e retorna reservas únicas por booking_id.
 * Garante que nenhuma reserva do mês seja perdida por diferença de datas.
 * Inclui tratamento de erros e validação de dados.
 */
export async function fetchTodasReservasMes(
  mes: number,
  ano: number
): Promise<AmenitizReserva[]> {
  try {
    const [porCheckin, porCriacao, porAtualizacao] = await Promise.all([
      fetchEndpoint('checkin', mes, ano).catch((err) => {
        console.error(`[Amenitiz] Erro ao buscar checkin:`, err);
        return [];
      }),
      fetchEndpoint('created', mes, ano).catch((err) => {
        console.error(`[Amenitiz] Erro ao buscar created:`, err);
        return [];
      }),
      fetchEndpoint('updated', mes, ano).catch((err) => {
        console.error(`[Amenitiz] Erro ao buscar updated:`, err);
        return [];
      }),
    ]);

    // Merge por booking_id — primeira ocorrência vence
    const mapa = new Map<string, AmenitizReserva>();
    for (const r of [...porCheckin, ...porCriacao, ...porAtualizacao]) {
      if (r && r.booking_id && !mapa.has(r.booking_id)) {
        mapa.set(r.booking_id, r);
      }
    }

    // Filtrar apenas reservas com check-in dentro do mês/ano solicitado.
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0);

    const reservasFiltradas = Array.from(mapa.values()).filter((r) => {
      const checkinDate = new Date(r.checkin);
      return checkinDate >= dataInicio && checkinDate <= dataFim;
    });

    console.log(
      `[Amenitiz] Merge: checkin=${porCheckin.length} created=${porCriacao.length} ` +
      `updated=${porAtualizacao.length} → único=${mapa.size} → após filtro check-in=${reservasFiltradas.length}`
    );

    return reservasFiltradas;
  } catch (error) {
    console.error(`[Amenitiz] Erro ao buscar reservas do mês:`, error);
    throw new Error('Erro ao buscar reservas do mês. Verifique os logs para mais detalhes.');
  }
}

export interface TestConnectionResult {
  ok: boolean
  status: number
  detail?: string   // mensagem de erro da API Amenitiz ou do sistema
  hotelId?: string  // qual hotel_id foi usado (diagnóstico)
  reservasCount?: number
}

/**
 * Testa a conexão com a API Amenitiz com validação de resposta.
 * Retorna detalhes do erro para facilitar diagnóstico.
 */
export async function testConnection(): Promise<TestConnectionResult> {
  try {
    const baseUrl = process.env.AMENITIZ_BASE_URL
    if (!baseUrl) {
      return { ok: false, status: 0, detail: 'AMENITIZ_BASE_URL não configurado no .env.local' }
    }

    const token = process.env.AMENITIZ_ACCESS_TOKEN
    if (!token) {
      return { ok: false, status: 0, detail: 'AMENITIZ_ACCESS_TOKEN não configurado no .env.local' }
    }

    // Usa mês atual como período de teste (mais chances de ter dados)
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const pathQuery = `/bookings/checkin?from=${y}-${m}-01&to=${y}-${m}-${lastDay}`

    let hotelId: string
    let res: Response
    try {
      const result = await fetchComFallback(baseUrl, pathQuery)
      hotelId = result.hotelId
      res = result.res
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`[Amenitiz Test] Todos hotel_ids falharam: ${msg}`)
      return { ok: false, status: 0, detail: msg }
    }

    console.log(`[Amenitiz Test] HTTP ${res.status} com hotel_id=${hotelId}`)

    const rawText = await res.text()
    let data: unknown
    try {
      data = JSON.parse(rawText)
    } catch {
      return {
        ok: false,
        status: res.status,
        detail: `Resposta não é JSON válido: ${rawText.slice(0, 200)}`,
        hotelId,
      }
    }

    const lista = Array.isArray(data)
      ? data
      : ((data as Record<string, unknown>)?.data ?? (data as Record<string, unknown>)?.bookings ?? null)

    if (!Array.isArray(lista)) {
      return {
        ok: false,
        status: res.status,
        detail: `Formato inesperado — chaves recebidas: ${Object.keys(data as object).join(', ')}`,
        hotelId,
      }
    }

    console.log(`[Amenitiz Test] OK — ${lista.length} reservas (hotel_id=${hotelId})`)
    return { ok: true, status: res.status, reservasCount: lista.length, hotelId }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Amenitiz Test] Erro:`, msg)
    return { ok: false, status: 0, detail: msg }
  }
}

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
  booking_id: string               // ⚠️ a API devolve NÚMERO na prática — usar String() como chave
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
//
// BOOKING — tabela por empreendimento com VIGÊNCIA pela data de CHECK-IN da
// reserva. Reajuste do Booking informado pelo usuário em 08/09/2026 (print):
// faixa de 13% → 15% e faixa de 16% → 18%. Vigência CONFIRMADA pelo usuário
// em 08/09/2026: check-in a partir de 01/08/2026 — julho/2026 e anteriores
// (prestações já entregues) ficam com a tabela antiga. O gerador de planilha
// (lib-prestacao.mjs, TAXAS_BOOKING) repete esta tabela — manter os dois iguais.

export const TAXA_BOOKING_VIGENCIA = '2026-08-01'

// Tabela antiga (confirmada pelo usuário em 06/07/2026) — check-in < vigência
const TAXA_BOOKING_ATE_JUL_2026: Record<string, number> = {
  'ESSENCE':        0.16,
  'METROPOLITAN':   0.16,
  'CULLINAN':       0.16,
  'BRISAS DO LAGO': 0.16,
  'BRISAS':         0.16,
  'MERCURE':        0.16, // exceto apt 1419 → 13%
  'MERCURE LIDER':  0.16,
  'ASA SUL':        0.16,
  'AMAZE':          0.13,
  'LINK':           0.13, // confirmado pelo usuário em 07/07/2026
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

// Tabela reajustada — check-in >= vigência. Lista definitiva enviada pelo
// usuário em 05/10/2026 (corrige o print de 08/09: VISION é 15%, não 18%;
// SAINT MORITZ entra com 15%). ASA SUL, AMAZE e a exceção MERCURE 1419 não
// constam na lista de 05/10 — mantidos como no print de 08/09.
const TAXA_BOOKING_DESDE_AGO_2026: Record<string, number> = {
  'ESSENCE':        0.18,
  'METROPOLITAN':   0.18,
  'CULLINAN':       0.18,
  'BRISAS DO LAGO': 0.18,
  'BRISAS':         0.18,
  'MERCURE':        0.18, // exceto apt 1419 → 15%
  'MERCURE LIDER':  0.18,
  'VISION':         0.15,
  'SAINT MORITZ':   0.15,
  'ASA SUL':        0.15, // print: "13% para 15%" (o sistema aplicava 16% até jul/2026)
  'LINK':           0.15, // print: "15% para 15%" (o sistema aplicava 13% até jul/2026)
  'EASY':           0.15,
  'ATHOS':          0.15,
  'ATHOS BULCAO':   0.15,
  'ATHOS BULÇÃO':   0.15,
  'ATHOS BULCÃO':   0.15,
  'NOBILE':         0.15,
  'FUSION':         0.15,
  'RAMADA':         0.15,
  'AMAZE':          0.13, // não consta no print — mantido
}

// Casos especiais por apartamento — key: "EMPREENDIMENTO_UPPER::APT_NUM"
const TAXA_BOOKING_ESPECIFICO_ATE_JUL_2026: Record<string, number> = {
  'MERCURE::1419': 0.13,
}
const TAXA_BOOKING_ESPECIFICO_DESDE_AGO_2026: Record<string, number> = {
  'MERCURE::1419': 0.15,
}

/** Reajuste do Booking vale para a reserva? Pela data de check-in (ISO). Sem data → tabela antiga. */
export function taxaBookingNovaVigente(checkin: string | null | undefined): boolean {
  return String(checkin ?? '').slice(0, 10) >= TAXA_BOOKING_VIGENCIA
}

function taxaBookingPara(emp: string, apt: string, novaVigente: boolean): number {
  const especifico = novaVigente ? TAXA_BOOKING_ESPECIFICO_DESDE_AGO_2026 : TAXA_BOOKING_ESPECIFICO_ATE_JUL_2026
  const tabela = novaVigente ? TAXA_BOOKING_DESDE_AGO_2026 : TAXA_BOOKING_ATE_JUL_2026
  return especifico[`${emp}::${apt}`] ?? tabela[emp] ?? (novaVigente ? 0.15 : 0.13)
}

// Airbnb — taxa única para todos os empreendimentos
const TAXA_AIRBNB = 0.1821

// AlugEasy — reserva direta (source manual / alugueasy / amenitiz). Cobrada SÓ
// em administração (tipo_gestao 'adm'): em sublocação ('sub') a reserva direta
// é isenta e o imóvel paga apenas Booking e Airbnb (regra informada pelo
// usuário em 16/10/2026). Sem tipo_gestao conhecido, vale a regra de adm.
const TAXA_ALUGEASY = 0.10
export type TipoGestao = 'adm' | 'sub'
export function taxaAlugEasyPara(tipoGestao: string | null | undefined): number {
  return tipoGestao === 'sub' ? 0 : TAXA_ALUGEASY
}

/**
 * Taxas de plataforma vigentes para um apartamento — para exibição no portal.
 * `ref` (mes/ano do período visualizado) aplica a vigência histórica:
 * Airbnb era 0% até mai/2026 (18,21% a partir de jun/2026); Booking usa a
 * tabela antiga até jul/2026 e a reajustada a partir de ago/2026. mes <= 0 =
 * ano inteiro (usa a taxa vigente do ano). `tipoGestao` 'sub' zera a taxa
 * AlugEasy (sublocação não paga a taxa da reserva direta).
 */
export function getTaxasPlataforma(
  empNome: string,
  aptNumero: string | number,
  ref?: { mes: number; ano: number },
  tipoGestao?: string | null
): { booking: number; airbnb: number; alugueasy: number } {
  const emp = (empNome ?? '').toUpperCase().trim()
  const apt = String(aptNumero ?? '').trim().toUpperCase()
  const bookingNovo = !ref || ref.ano > 2026 || (ref.ano === 2026 && (ref.mes >= 8 || ref.mes <= 0))
  const booking = taxaBookingPara(emp, apt, bookingNovo)
  const airbnbVigente = !ref || ref.ano > 2026 || (ref.ano === 2026 && (ref.mes >= 6 || ref.mes <= 0))
  return { booking, airbnb: airbnbVigente ? TAXA_AIRBNB : 0, alugueasy: taxaAlugEasyPara(tipoGestao) }
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
 * `checkin` (ISO) define a vigência da tabela do Booking — sem data, vale a
 * tabela antiga (não reajusta reserva de data desconhecida por acidente).
 * `tipoGestao` do imóvel: em 'sub' a reserva direta (AlugEasy) é isenta;
 * ausente ⇒ regra de administração (10%).
 */
export function calcularValorLiquido(
  valorBruto: number,
  source: string,
  empNome: string,
  aptNumero: number | string,
  checkin: string | null | undefined,
  tipoGestao?: string | null
): { valorLiquido: number; taxaAplicada: number; plataformaNormalizada: string } {

  const src = (source ?? '').toLowerCase().trim()
  const emp = empNome.toUpperCase().trim()
  const apt = String(aptNumero).trim()

  // AIRBNB — 18,21% para todos os empreendimentos (definido pelo usuário em
  // 27/07/2026, vigência a partir de junho/2026; antes o valor era tratado
  // como já líquido — reservas de competência jan–mai/2026 permanecem a 0%)
  if (src.includes('airbnb')) {
    return {
      valorLiquido: valorBruto * (1 - TAXA_AIRBNB),
      taxaAplicada: TAXA_AIRBNB,
      plataformaNormalizada: 'Airbnb',
    }
  }

  // BOOKING — taxa varia por empreendimento (com caso especial por apt) e por
  // vigência: check-in >= TAXA_BOOKING_VIGENCIA usa a tabela reajustada
  if (src.includes('booking')) {
    const taxa = taxaBookingPara(emp, apt, taxaBookingNovaVigente(checkin))
    return {
      valorLiquido: valorBruto * (1 - taxa),
      taxaAplicada: taxa,
      plataformaNormalizada: 'Booking',
    }
  }

  // MANUAL / ALUGUEASY / DIRETO — 10% em administração; 0% em sublocação
  if (['manual', 'alugueasy', 'direct', 'amenitiz'].some(s => src.includes(s))) {
    const taxa = taxaAlugEasyPara(tipoGestao)
    return {
      valorLiquido: valorBruto * (1 - taxa),
      taxaAplicada: taxa,
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

  // A API Amenitiz limita o range a 31 dias por chamada (HTTP 422 acima disso)
  // — sempre 1 mês exato por request.
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
    // A API limita cada chamada a 31 dias — para capturar reservas que
    // entraram em meses anteriores e atravessam a virada (ex: check-in 31/dez,
    // checkout 02/jan), o endpoint checkin é consultado também para os 2 meses
    // anteriores (1 chamada de 1 mês cada). O filtro por sobreposição abaixo
    // descarta o que não toca o mês solicitado.
    const ant1 = mes === 1 ? { m: 12, a: ano - 1 } : { m: mes - 1, a: ano };
    const ant2 = ant1.m === 1 ? { m: 12, a: ant1.a - 1 } : { m: ant1.m - 1, a: ant1.a };

    const fetchSeguro = (endpoint: 'checkin' | 'created' | 'updated', m: number, a: number) =>
      fetchEndpoint(endpoint, m, a).catch((err) => {
        console.error(`[Amenitiz] Erro ao buscar ${endpoint} ${m}/${a}:`, err);
        return [] as AmenitizReserva[];
      });

    const [porCheckin, porCheckinAnt1, porCheckinAnt2, porCriacao, porAtualizacao] = await Promise.all([
      fetchSeguro('checkin', mes, ano),
      fetchSeguro('checkin', ant1.m, ant1.a),
      fetchSeguro('checkin', ant2.m, ant2.a),
      fetchSeguro('created', mes, ano),
      fetchSeguro('updated', mes, ano),
    ]);

    // Merge por booking_id — primeira ocorrência vence
    const mapa = new Map<string, AmenitizReserva>();
    for (const r of [...porCheckin, ...porCheckinAnt1, ...porCheckinAnt2, ...porCriacao, ...porAtualizacao]) {
      if (r && r.booking_id && !mapa.has(r.booking_id)) {
        mapa.set(r.booking_id, r);
      }
    }

    // Mantém reservas com check-in no mês OU que atravessam a virada
    // (check-in anterior, checkout depois do dia 01 — ainda hospedado no mês).
    // O portal/PDF rateiam o valor por noites; as diárias do sync continuam
    // por competência de check-in (ver sync-amenitiz-core).
    // Comparação por STRING 'YYYY-MM-DD' — new Date('2026-06-01') é meia-noite
    // UTC (= 21h do dia anterior em Brasília), o que descartava silenciosamente
    // todas as reservas com check-in no dia 01 do mês.
    const from = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const to = `${ano}-${String(mes).padStart(2, '0')}-${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}`;

    const reservasFiltradas = Array.from(mapa.values()).filter((r) => {
      const ci = String(r.checkin ?? '').slice(0, 10);
      const co = String(r.checkout ?? '').slice(0, 10);
      const checkinNoMes = ci >= from && ci <= to;
      const atravessaVirada = ci < from && co > from; // checkout > dia 01 ⇒ ≥1 noite no mês
      return checkinNoMes || atravessaVirada;
    });

    console.log(
      `[Amenitiz] Merge: checkin=${porCheckin.length}+${porCheckinAnt1.length}+${porCheckinAnt2.length} ` +
      `created=${porCriacao.length} updated=${porAtualizacao.length} ` +
      `→ único=${mapa.size} → após filtro sobreposição=${reservasFiltradas.length}`
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

import { NextRequest, NextResponse } from 'next/server'

// ⚠️  ENDPOINT FECHADO POR PADRÃO (Bloco 2)
//
// Este esqueleto está pronto mas NÃO processa nada até o Bloco 2 ser concluído.
// A flag abaixo permanece false até receber:
//   (a) o secret de assinatura do webhook Amenitiz
//   (b) um exemplo real do payload de evento de reserva
//   (c) confirmação de que a URL foi cadastrada no painel Amenitiz
//
// Enquanto VALIDACAO_BLOCO2_CONCLUIDA === false, toda requisição recebe 501.
// Isso garante que o endpoint não processa nada inseguro acidentalmente.
const VALIDACAO_BLOCO2_CONCLUIDA = false

export async function POST(request: NextRequest) {
  // Corpo bruto é lido ANTES de qualquer parse — necessário para HMAC timing-safe.
  // (HMAC deve ser verificado sobre o raw body, não o JSON parseado.)
  const rawBody = await request.text()

  // ── TODO (Bloco 2-A): Validação de assinatura HMAC ──────────────────────────
  // Implementar assim que o secret for fornecido.
  // Usar timingSafeEqual para evitar timing attacks.
  //
  // import { createHmac, timingSafeEqual } from 'crypto'
  // function validarHmac(raw: string, assinatura: string, secret: string): boolean {
  //   const esperado = createHmac('sha256', secret).update(raw).digest('hex')
  //   try {
  //     return timingSafeEqual(Buffer.from(assinatura, 'hex'), Buffer.from(esperado, 'hex'))
  //   } catch { return false }
  // }
  // const assinatura = request.headers.get('x-amenitiz-signature') ?? ''
  // if (!validarHmac(rawBody, assinatura, process.env.AMENITIZ_WEBHOOK_SECRET!)) {
  //   return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  // }

  if (!VALIDACAO_BLOCO2_CONCLUIDA) {
    return NextResponse.json(
      { error: 'Webhook não configurado — aguardando credenciais Amenitiz (Bloco 2)' },
      { status: 501 }
    )
  }

  // ── TODO (Bloco 2-B): Mapeamento do payload real da Amenitiz ────────────────
  // Confirmar nomes de campo contra o exemplo fornecido — não assumir nada.
  //
  // type AmenitizWebhookPayload = {
  //   booking_id: string          // TODO: confirmar nome real do campo
  //   status: string              // TODO: confirmar valores ('confirmed'|'cancelled'|...)
  //   checkin: string             // TODO: confirmar formato (YYYY-MM-DD?)
  //   checkout: string
  //   total_amount_after_tax: string  // TODO: confirmar se é string como na API REST
  //   source: string              // 'manual'|'booking'|'airbnb'
  //   rooms: Array<{
  //     individual_room_id: string
  //     individual_room_name: string
  //     individual_room_number: number
  //   }>
  //   booker: {
  //     first_name: string; last_name: string
  //     email: string; phone: string
  //   }
  // }
  //
  // const payload = JSON.parse(rawBody) as AmenitizWebhookPayload
  //
  // ── TODO (Bloco 2-C): Upsert idempotente por booking_id ─────────────────────
  // Reutilizar lookupApt() e calcularValorLiquido() de sync-amenitiz-core / amenitiz.ts.
  // Nunca reimplementar a regra de resolução quarto→apartamento ou de taxa.
  //
  // Ignorar canceladas/no-show (mesmo filtro que o sync):
  // if (['cancelled', 'canceled', 'no_show'].includes(payload.status)) {
  //   return NextResponse.json({ received: true, acao: 'ignorada' }, { status: 200 })
  // }
  //
  // const supabase = createAdminClient()
  // await supabase.from('amenitiz_reservas').upsert({ ... }, { onConflict: 'booking_id' })
  //
  // Registrar ingest:
  // await supabase.from('ingest_status').upsert(
  //   { id: 'global', ultimo_at: new Date().toISOString(), fonte: 'webhook',
  //     updated_at: new Date().toISOString() },
  //   { onConflict: 'id' }
  // )

  // Resposta 2xx imediata — boas práticas de webhook (evitar timeout da Amenitiz)
  return NextResponse.json({ received: true }, { status: 200 })
}

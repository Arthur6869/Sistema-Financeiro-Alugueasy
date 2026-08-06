import { getSessaoApi } from '@/lib/supabase/api-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAmenitizSync } from '@/lib/sync-amenitiz-core'
import { NextRequest, NextResponse } from 'next/server'

// Janela mínima entre dois syncs disparados por proprietário. O sync varre a
// Amenitiz inteira, então sem esta trava um "puxar para atualizar" no app mobile
// vira rajada de chamadas à API externa — e qualquer conta de proprietário
// consegue disparar isso indefinidamente.
const JANELA_MINIMA_MS = 3 * 60 * 1000

export async function POST(request: NextRequest) {
  // Auth: só proprietário autenticado pode disparar sync próprio.
  // Aceita sessão de cookie (web) ou Authorization: Bearer (app mobile).
  const { supabase, userId, role, ativo } = await getSessaoApi(request)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (role !== 'proprietario')
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  // Conta suspensa não movimenta nada. A checagem de `ativo` só existia no
  // proxy.ts, que não cobre /api — e um cliente mobile nunca passa por ele.
  if (!ativo)
    return NextResponse.json({ error: 'Conta desativada' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const mes = Number(body.mes)
  const ano = Number(body.ano)
  if (!mes || !ano || mes < 1 || mes > 12 || ano < 2020 || ano > 2100)
    return NextResponse.json({ error: 'Parâmetros mes/ano inválidos' }, { status: 400 })

  // Apartamentos do próprio usuário — usados para responder só com o número dele.
  // A leitura passa pela RLS de proprietario_apartamentos (vínculo ativo).
  const { data: vinculos } = await supabase
    .from('proprietario_apartamentos')
    .select('apartamento_id')
    .eq('proprietario_id', userId)
    .eq('ativo', true)
  const aptIds = (vinculos ?? []).map(v => v.apartamento_id)

  try {
    const admin = createAdminClient()

    // Throttle compartilhado, guardado no banco (o servidor é serverless: um
    // contador em memória não sobrevive entre invocações).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: statusAtual } = await (admin as any)
      .from('ingest_status').select('ultimo_at').eq('id', 'global').maybeSingle()
    const ultimoAt = statusAtual?.ultimo_at ? Date.parse(statusAtual.ultimo_at) : 0
    const desdeUltimo = Date.now() - ultimoAt

    if (ultimoAt && desdeUltimo < JANELA_MINIMA_MS) {
      return NextResponse.json({
        success: true,
        sincronizado_agora: false,
        aguarde_segundos: Math.ceil((JANELA_MINIMA_MS - desdeUltimo) / 1000),
        total_reservas: await contarReservasDoProprietario(admin, aptIds, mes, ano),
        error: null,
      })
    }

    // reservasOnly: apenas upsert em amenitiz_reservas — não toca diarias, importacoes ou syncs.
    // O proprietário verifica novas reservas sem destruir dados existentes.
    const result = await runAmenitizSync(admin, mes, ano, { actorUserId: userId, reservasOnly: true })

    if (result.success) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin as any).from('ingest_status').upsert(
        { id: 'global', ultimo_at: new Date().toISOString(), fonte: 'proprietario',
          updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
    }

    return NextResponse.json({
      success: result.success,
      sincronizado_agora: result.success,
      // Nunca devolver result.total_reservas: é a contagem da carteira INTEIRA e
      // vazaria o volume de operação da empresa para um proprietário.
      total_reservas: await contarReservasDoProprietario(admin, aptIds, mes, ano),
      error: result.error ?? null,
    })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 })
  }
}

async function contarReservasDoProprietario(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  aptIds: string[],
  mes: number,
  ano: number
): Promise<number> {
  if (aptIds.length === 0) return 0

  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fimDate = new Date(ano, mes, 0)
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(fimDate.getDate()).padStart(2, '0')}`

  const { count } = await admin
    .from('amenitiz_reservas')
    .select('*', { count: 'exact', head: true })
    .in('apartamento_id', aptIds)
    .gte('checkin', inicio)
    .lte('checkin', fim)

  return count ?? 0
}

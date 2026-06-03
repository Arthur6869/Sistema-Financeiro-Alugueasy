import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isInternalApiRequest } from '@/lib/internal-api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { testConnection } from '@/lib/amenitiz'
import { runAmenitizSync } from '@/lib/sync-amenitiz-core'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mes, ano, empreendimento } = body

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

    const empFiltro = empreendimento ? String(empreendimento).toUpperCase().trim() : null
    const result = await runAmenitizSync(supabase, mes, ano, { empFiltro, actorUserId })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json({
      success:                      true,
      mes, ano,
      total_reservas:               result.total_reservas,
      faturamento_bruto:            result.faturamento_bruto,
      faturamento_liquido:          result.faturamento_liquido,
      apartamentos_sincronizados:   result.apartamentos_sincronizados,
      apartamentos_nao_encontrados: result.apts_nao_encontrados,
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

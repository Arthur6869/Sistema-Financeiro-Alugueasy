import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

async function autenticar(request: NextRequest): Promise<boolean> {
  const internalKey = request.headers.get('x-alugueasy-internal-key')
  if (internalKey && internalKey === process.env.ALUGUEASY_INTERNAL_API_KEY) {
    return true
  }
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  return profile?.role === 'analista'
}

function mesAnterior() {
  const agora = new Date()
  const mes = agora.getMonth() === 0 ? 12 : agora.getMonth()
  const ano = agora.getMonth() === 0 ? agora.getFullYear() - 1 : agora.getFullYear()
  return { mes, ano }
}

export async function POST(request: NextRequest) {
  if (!await autenticar(request))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const { mes, ano } = mesAnterior()
  const mesFinal = typeof body.mes === 'number' ? body.mes : mes
  const anoFinal = typeof body.ano === 'number' ? body.ano : ano

  const supabase = createAdminClient()
  const inicio = Date.now()
  const alertas: string[] = []

  type Etapas = {
    sync_amenitiz?: Record<string, unknown>
    custos_adm?: Record<string, unknown>
    custos_sub?: Record<string, unknown>
    kpis?: Record<string, unknown>
    custos_manuais?: Record<string, unknown>
    emails?: Record<string, unknown>
  }
  const etapas: Etapas = {}

  const baseUrl = process.env.ALUGUEASY_BASE_URL ?? 'http://localhost:3000'
  const internalHeaders = {
    'Content-Type': 'application/json',
    'x-alugueasy-internal-key': process.env.ALUGUEASY_INTERNAL_API_KEY ?? '',
  }

  // ── ETAPA 1: Sync Amenitiz ──────────────────────────────────────────────
  try {
    const syncRes = await fetch(`${baseUrl}/api/amenitiz-sync`, {
      method: 'POST',
      headers: internalHeaders,
      body: JSON.stringify({ mes: mesFinal, ano: anoFinal }),
    })
    const syncData = await syncRes.json() as Record<string, unknown>
    etapas.sync_amenitiz = {
      status: syncRes.ok ? 'ok' : 'erro',
      reservas: syncData.total_reservas ?? 0,
      faturamento_liquido: syncData.faturamento_liquido ?? 0,
      apts_nao_encontrados: syncData.apts_nao_encontrados ?? [],
    }
    if (!syncRes.ok)
      alertas.push(`❌ Sync Amenitiz falhou: ${(syncData.error as string) ?? 'erro desconhecido'}`)
    const naoEncontrados = (syncData.apts_nao_encontrados as string[] | undefined) ?? []
    if (naoEncontrados.length > 0)
      alertas.push(`⚠️ ${naoEncontrados.length} apt(s) sem room_id — faturamento perdido: ${naoEncontrados.join(', ')}`)
  } catch (e) {
    etapas.sync_amenitiz = { status: 'erro', erro: (e as Error).message }
    alertas.push(`❌ Sync Amenitiz — erro de conexão: ${(e as Error).message}`)
  }

  // ── ETAPA 2: Custos ADM ─────────────────────────────────────────────────
  const { data: custosAdm } = await supabase
    .from('custos')
    .select('apartamentos(empreendimentos(nome))')
    .eq('mes', mesFinal).eq('ano', anoFinal).eq('tipo_gestao', 'adm')

  const empsAdm = new Set(
    (custosAdm ?? []).map((r: any) => r.apartamentos?.empreendimentos?.nome).filter(Boolean)
  )
  etapas.custos_adm = { empreendimentos_com_dados: empsAdm.size, lista: [...empsAdm] }
  if (empsAdm.size < 5)
    alertas.push(`⚠️ Custos ADM: apenas ${empsAdm.size} empreendimento(s) com dados — esperado ≥ 5`)

  // ── ETAPA 3: Custos SUB ─────────────────────────────────────────────────
  const { data: custosSub } = await supabase
    .from('custos')
    .select('apartamentos(empreendimentos(nome))')
    .eq('mes', mesFinal).eq('ano', anoFinal).eq('tipo_gestao', 'sub')

  const empsSub = new Set(
    (custosSub ?? []).map((r: any) => r.apartamentos?.empreendimentos?.nome).filter(Boolean)
  )
  etapas.custos_sub = { empreendimentos_com_dados: empsSub.size, lista: [...empsSub] }
  if (empsSub.size < 5)
    alertas.push(`⚠️ Custos SUB: apenas ${empsSub.size} empreendimento(s) com dados — esperado ≥ 5`)

  // ── ETAPA 4: KPIs ──────────────────────────────────────────────────────
  const [{ data: fatData }, { data: custData }] = await Promise.all([
    supabase.from('amenitiz_reservas').select('valor_liquido')
      .eq('mes_competencia', mesFinal).eq('ano_competencia', anoFinal),
    supabase.from('custos').select('valor').eq('mes', mesFinal).eq('ano', anoFinal),
  ])

  const faturamento = (fatData ?? []).reduce((a: number, r: any) => a + (r.valor_liquido ?? 0), 0)
  const custos = (custData ?? []).reduce((a: number, r: any) => a + (r.valor ?? 0), 0)
  const lucro = faturamento - custos
  const margem = faturamento > 0 ? (lucro / faturamento * 100) : 0

  etapas.kpis = {
    faturamento: Math.round(faturamento * 100) / 100,
    custos: Math.round(custos * 100) / 100,
    lucro: Math.round(lucro * 100) / 100,
    margem_percent: Math.round(margem * 100) / 100,
  }
  if (faturamento === 0)
    alertas.push('❌ Faturamento zerado — sync Amenitiz pode não ter funcionado')
  if (margem < 10 && faturamento > 0)
    alertas.push(`⚠️ Margem muito baixa: ${margem.toFixed(1)}% (mínimo esperado: 10%)`)

  // ── ETAPA 5: Lançamentos manuais ────────────────────────────────────────
  const { data: manuais } = await supabase
    .from('custos').select('id, categoria, valor')
    .eq('mes', mesFinal).eq('ano', anoFinal).eq('origem', 'manual')

  const valorManuais = (manuais ?? []).reduce((a: number, r: any) => a + (r.valor ?? 0), 0)
  etapas.custos_manuais = { total: manuais?.length ?? 0, valor_total: Math.round(valorManuais * 100) / 100 }
  if ((manuais?.length ?? 0) > 0)
    alertas.push(`ℹ️ ${manuais!.length} lançamento(s) manual(is) — revisar antes de fechar`)

  // ── ETAPA 6: Emails para proprietários ─────────────────────────────────
  const { data: proprietarios } = await supabase
    .from('profiles').select('id, full_name').eq('role', 'proprietario')

  const emailsEnviados: string[] = []
  const emailsErro: string[] = []

  for (const prop of (proprietarios ?? []) as Array<{ id: string; full_name: string }>) {
    try {
      const emailRes = await fetch(`${baseUrl}/api/enviar-extrato-email`, {
        method: 'POST',
        headers: internalHeaders,
        body: JSON.stringify({ proprietario_id: prop.id, mes: mesFinal, ano: anoFinal }),
      })
      if (emailRes.ok) emailsEnviados.push(prop.full_name)
      else emailsErro.push(prop.full_name)
    } catch {
      emailsErro.push(prop.full_name)
    }
  }

  etapas.emails = {
    enviados: emailsEnviados.length,
    erros: emailsErro.length,
    lista_enviados: emailsEnviados,
    lista_erros: emailsErro,
  }
  if (emailsErro.length > 0)
    alertas.push(`⚠️ ${emailsErro.length} email(s) não enviado(s): ${emailsErro.join(', ')}`)

  // ── STATUS GERAL ────────────────────────────────────────────────────────
  const temErro = alertas.some(a => a.startsWith('❌'))
  const temAviso = alertas.some(a => a.startsWith('⚠️'))
  const statusGeral = temErro ? 'erro' : temAviso ? 'aviso' : 'ok'

  // ── NOTIFICAR ANALISTAS SE HOUVER PROBLEMA ──────────────────────────────
  if (alertas.length > 0 && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const { data: analistasProfiles } = await supabase
        .from('profiles').select('id').eq('role', 'analista')
      const analistaIds = new Set(
        ((analistasProfiles ?? []) as Array<{ id: string }>).map(p => p.id)
      )
      const emailsAnalistas = users
        .filter(u => analistaIds.has(u.id) && u.email)
        .map(u => u.email!)

      if (emailsAnalistas.length > 0) {
        const emoji = temErro ? '🔴' : '🟡'
        const periodo = `${String(mesFinal).padStart(2, '0')}/${anoFinal}`
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'noreply@alugueasy.com.br',
          to: emailsAnalistas,
          subject: `${emoji} AlugEasy — Fechamento ${periodo}: ${alertas.length} alerta(s)`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#193660;padding:24px;border-radius:12px 12px 0 0">
                <h2 style="color:white;margin:0">AlugEasy — Relatório de Fechamento</h2>
                <p style="color:#93c5fd;margin:4px 0 0">${periodo}</p>
              </div>
              <div style="background:#f9fafb;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
                <h3 style="margin:0 0 16px;color:#111827">
                  ${emoji} Status: ${temErro ? 'Erro crítico' : 'Atenção necessária'}
                </h3>
                <ul style="margin:0;padding:0 0 0 20px">
                  ${alertas.map(a => `<li style="margin-bottom:8px;color:#374151">${a}</li>`).join('')}
                </ul>
                <div style="margin-top:24px;padding:16px;background:white;border-radius:8px;border:1px solid #e5e7eb">
                  <strong>KPIs do período:</strong><br>
                  Faturamento: R$ ${(etapas.kpis.faturamento as number).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<br>
                  Custos: R$ ${(etapas.kpis.custos as number).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<br>
                  Lucro: R$ ${(etapas.kpis.lucro as number).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}<br>
                  Margem: ${etapas.kpis.margem_percent}%
                </div>
                <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">
                  Gerado automaticamente pelo agente de fechamento mensal AlugEasy.
                </p>
              </div>
            </div>
          `,
        })
      }
    } catch {
      // não quebra o fluxo se o email de notificação falhar
    }
  }

  return NextResponse.json({
    periodo: `${String(mesFinal).padStart(2, '0')}/${anoFinal}`,
    executado_em: new Date().toISOString(),
    status_geral: statusGeral,
    total_alertas: alertas.length,
    alertas,
    etapas,
    duracao_ms: Date.now() - inicio,
  })
}

export async function GET(request: NextRequest) {
  if (!await autenticar(request))
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createAdminClient()
  const { mes, ano } = mesAnterior()

  const [{ data: fat }, { data: cust }, { data: sync }] = await Promise.all([
    supabase.from('amenitiz_reservas').select('valor_liquido')
      .eq('mes_competencia', mes).eq('ano_competencia', ano),
    supabase.from('custos').select('valor').eq('mes', mes).eq('ano', ano),
    supabase.from('amenitiz_syncs').select('status, updated_at')
      .eq('mes', mes).eq('ano', ano)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  const faturamento = (fat ?? []).reduce((a: number, r: any) => a + (r.valor_liquido ?? 0), 0)
  const custos = (cust ?? []).reduce((a: number, r: any) => a + (r.valor ?? 0), 0)

  return NextResponse.json({
    periodo: `${String(mes).padStart(2, '0')}/${ano}`,
    faturamento: Math.round(faturamento * 100) / 100,
    custos: Math.round(custos * 100) / 100,
    lucro: Math.round((faturamento - custos) * 100) / 100,
    sync_status: (sync as any)?.status ?? 'nunca sincronizado',
    sync_updated_at: (sync as any)?.updated_at ?? null,
    pronto_para_fechar: faturamento > 0 && custos > 0,
  })
}

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { gerarHtmlEmail } from '@/components/emails/extrato-mensal'
import { MESES } from '@/lib/constants'

function calcularRepasse(
  faturamento: number,
  lucro: number,
  taxaRepasse: number,
  tipoRepasse: 'lucro' | 'faturamento'
) {
  const base = tipoRepasse === 'faturamento' ? faturamento : lucro
  return base * (taxaRepasse / 100)
}

export async function POST(request: NextRequest) {
  // Aceitar chamada via cookie de sessão (analista logado) ou via chave interna (MCP)
  const internalKey = request.headers.get('x-alugueasy-internal-key')
  const validInternalKey = process.env.ALUGUEASY_INTERNAL_API_KEY

  let autorizado = false

  if (internalKey && validInternalKey && internalKey === validInternalKey) {
    autorizado = true
  } else {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'analista') autorizado = true
    }
  }

  if (!autorizado) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await request.json()
  const { proprietario_id, mes, ano } = body as {
    proprietario_id: string
    mes: number
    ano: number
  }

  if (!proprietario_id || !mes || !ano) {
    return NextResponse.json(
      { error: 'proprietario_id, mes e ano são obrigatórios' },
      { status: 400 }
    )
  }

  const adminSupabase = createAdminClient()

  // Buscar perfil do proprietário
  const { data: propProfile } = await adminSupabase
    .from('profiles')
    .select('full_name')
    .eq('id', proprietario_id)
    .single()

  // Buscar email via admin auth API
  const { data: { user: propUser }, error: userErr } = await adminSupabase.auth.admin.getUserById(proprietario_id)
  if (userErr || !propUser?.email) {
    return NextResponse.json({ error: 'Email do proprietário não encontrado' }, { status: 404 })
  }

  // Buscar apartamentos vinculados
  const { data: vinculos } = await adminSupabase
    .from('proprietario_apartamentos')
    .select('apartamentos(id, numero, tipo_gestao, taxa_repasse, tipo_repasse, empreendimentos(nome))')
    .eq('proprietario_id', proprietario_id)
    .eq('ativo', true)

  type AptRow = {
    id: string
    numero: string
    tipo_gestao: 'adm' | 'sub' | null
    taxa_repasse: number | null
    tipo_repasse: 'lucro' | 'faturamento' | null
    empreendimentos: { nome: string } | null
  }
  const apts = ((vinculos ?? []) as unknown as { apartamentos: AptRow | null }[])
    .map(v => v.apartamentos)
    .filter((a): a is AptRow => a !== null)

  if (apts.length === 0) {
    return NextResponse.json({ error: 'Nenhum apartamento vinculado ativo' }, { status: 404 })
  }

  // Buscar dados financeiros por apartamento (diarias + custos)
  const aptIds = apts.map(a => a.id)
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  type RowValor = { apartamento_id: string; valor: number | null }

  const [{ data: fatRaw }, { data: cusRaw }] = await Promise.all([
    adminSupabase
      .from('diarias')
      .select('apartamento_id, valor')
      .in('apartamento_id', aptIds)
      .gte('data', dataInicio)
      .lte('data', dataFim),
    adminSupabase
      .from('custos')
      .select('apartamento_id, valor')
      .in('apartamento_id', aptIds)
      .eq('mes', mes)
      .eq('ano', ano),
  ])

  const fatData = (fatRaw ?? []) as unknown as RowValor[]
  const custData = (cusRaw ?? []) as unknown as RowValor[]

  const aptsDados = apts.map(apt => {
    const faturamento = fatData
      .filter(r => r.apartamento_id === apt.id)
      .reduce((s, r) => s + (r.valor ?? 0), 0)
    const custos = custData
      .filter(r => r.apartamento_id === apt.id)
      .reduce((s, r) => s + (r.valor ?? 0), 0)
    const lucro = faturamento - custos
    const taxaRepasse = apt.taxa_repasse ?? 0
    const tipoRepasse = apt.tipo_repasse ?? 'lucro'
    const repasse = calcularRepasse(faturamento, lucro, taxaRepasse, tipoRepasse)
    const valorLiquido = lucro - repasse

    return {
      empreendimento: apt.empreendimentos?.nome ?? '—',
      numero: apt.numero,
      tipoGestao: apt.tipo_gestao ?? '—',
      faturamento: Math.round(faturamento * 100) / 100,
      custos: Math.round(custos * 100) / 100,
      lucro: Math.round(lucro * 100) / 100,
      repasse: Math.round(repasse * 100) / 100,
      valorLiquido: Math.round(valorLiquido * 100) / 100,
    }
  })

  const totalFaturamento = aptsDados.reduce((s, a) => s + a.faturamento, 0)
  const totalLucro = aptsDados.reduce((s, a) => s + a.lucro, 0)
  const totalRepasse = aptsDados.reduce((s, a) => s + a.repasse, 0)
  const totalLiquido = aptsDados.reduce((s, a) => s + a.valorLiquido, 0)

  const mesLabel = MESES[mes - 1] ?? String(mes)

  // Gerar e enviar email
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data: emailData, error: emailError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@alugueasy.com.br',
    to: propUser.email,
    subject: `AlugEasy — Extrato de ${mesLabel} de ${ano}`,
    html: gerarHtmlEmail({
      nomeProprietario: (propProfile as { full_name?: string } | null)?.full_name ?? 'Proprietário',
      mes: mesLabel,
      ano,
      apartamentos: aptsDados,
      totalFaturamento,
      totalLucro,
      totalRepasse,
      totalLiquido,
    }),
  })

  if (emailError) {
    return NextResponse.json({ error: emailError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    email_enviado_para: propUser.email,
    apartamentos: aptsDados.length,
    mes: mesLabel,
    ano,
    email_id: emailData?.id,
  })
}

import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { gerarHtmlEmail } from '@/components/emails/extrato-mensal'
import { MESES } from '@/lib/constants'

function calcularRepasse(faturamento: number, lucro: number, taxaRepasse: number, tipoRepasse: 'lucro' | 'faturamento') {
  const base = tipoRepasse === 'faturamento' ? faturamento : lucro
  return base * (taxaRepasse / 100)
}

export type EnviarExtratoResult = {
  success: boolean
  email_enviado_para?: string
  apartamentos?: number
  error?: string
}

export async function enviarExtratoProprietario(
  proprietarioId: string,
  mes: number,
  ano: number
): Promise<EnviarExtratoResult> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY não configurada' }
  }

  const adminSupabase = createAdminClient()

  const { data: propProfile } = await adminSupabase
    .from('profiles').select('full_name').eq('id', proprietarioId).single()

  const { data: { user: propUser }, error: userErr } = await adminSupabase.auth.admin.getUserById(proprietarioId)
  if (userErr || !propUser?.email) {
    return { success: false, error: 'Email do proprietário não encontrado' }
  }

  const { data: vinculos } = await adminSupabase
    .from('proprietario_apartamentos')
    .select('apartamentos(id, numero, tipo_gestao, taxa_repasse, tipo_repasse, empreendimentos(nome))')
    .eq('proprietario_id', proprietarioId)
    .eq('ativo', true)

  type AptRow = {
    id: string; numero: string; tipo_gestao: 'adm' | 'sub' | null
    taxa_repasse: number | null; tipo_repasse: 'lucro' | 'faturamento' | null
    empreendimentos: { nome: string } | null
  }
  const apts = ((vinculos ?? []) as unknown as { apartamentos: AptRow | null }[])
    .map(v => v.apartamentos).filter((a): a is AptRow => a !== null)

  if (apts.length === 0) {
    return { success: false, error: 'Nenhum apartamento vinculado ativo' }
  }

  const aptIds   = apts.map(a => a.id)
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim    = new Date(ano, mes, 0).toISOString().slice(0, 10)

  type RowValor = { apartamento_id: string; valor: number | null }
  const [{ data: fatRaw }, { data: cusRaw }] = await Promise.all([
    adminSupabase.from('diarias').select('apartamento_id, valor').in('apartamento_id', aptIds).gte('data', dataInicio).lte('data', dataFim),
    adminSupabase.from('custos').select('apartamento_id, valor').in('apartamento_id', aptIds).eq('mes', mes).eq('ano', ano),
  ])

  const fatData  = (fatRaw ?? []) as unknown as RowValor[]
  const custData = (cusRaw ?? []) as unknown as RowValor[]

  const aptsDados = apts.map(apt => {
    const faturamento = fatData.filter(r => r.apartamento_id === apt.id).reduce((s, r) => s + (r.valor ?? 0), 0)
    const custos      = custData.filter(r => r.apartamento_id === apt.id).reduce((s, r) => s + (r.valor ?? 0), 0)
    const lucro       = faturamento - custos
    const taxaRepasse = apt.taxa_repasse ?? 0
    const tipoRepasse = apt.tipo_repasse ?? 'lucro'
    const repasse     = calcularRepasse(faturamento, lucro, taxaRepasse, tipoRepasse)
    return {
      empreendimento: apt.empreendimentos?.nome ?? '—',
      numero:         apt.numero,
      tipoGestao:     apt.tipo_gestao ?? '—',
      faturamento:    Math.round(faturamento * 100) / 100,
      custos:         Math.round(custos * 100) / 100,
      lucro:          Math.round(lucro * 100) / 100,
      repasse:        Math.round(repasse * 100) / 100,
      valorLiquido:   Math.round((lucro - repasse) * 100) / 100,
    }
  })

  const mesLabel = MESES[mes - 1] ?? String(mes)
  const resend   = new Resend(process.env.RESEND_API_KEY)

  const { error: emailError } = await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? 'noreply@alugueasy.com.br',
    to:      propUser.email,
    subject: `AlugEasy — Extrato de ${mesLabel} de ${ano}`,
    html:    gerarHtmlEmail({
      nomeProprietario: (propProfile as { full_name?: string } | null)?.full_name ?? 'Proprietário',
      mes: mesLabel, ano,
      apartamentos:    aptsDados,
      totalFaturamento: aptsDados.reduce((s, a) => s + a.faturamento, 0),
      totalLucro:       aptsDados.reduce((s, a) => s + a.lucro, 0),
      totalRepasse:     aptsDados.reduce((s, a) => s + a.repasse, 0),
      totalLiquido:     aptsDados.reduce((s, a) => s + a.valorLiquido, 0),
    }),
  })

  if (emailError) {
    return { success: false, error: emailError.message }
  }

  return { success: true, email_enviado_para: propUser.email, apartamentos: aptsDados.length }
}

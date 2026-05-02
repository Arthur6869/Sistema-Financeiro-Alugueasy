import { createClient } from '@/lib/supabase/server'
import { MESES } from '@/lib/constants'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const mes = params.mes !== undefined ? parseInt(params.mes) : now.getMonth() + 1
  const ano = params.ano !== undefined ? parseInt(params.ano) : now.getFullYear()

  const anoMesLabel =
    mes > 0 && ano > 0 ? `${MESES[mes - 1]} ${ano}` :
    mes > 0 ? `${MESES[mes - 1]} — todos os anos` :
    ano > 0 ? `Todos os meses de ${ano}` :
    'Todos os períodos'

  const supabase = await createClient()

  // ── Queries de faturamento: prioridade para diárias (xlsx-conferido) ──────
  // Se a tabela `diarias` tiver dados para o período, ela é usada como fonte
  // de faturamento (valores conferidos nas planilhas). Caso contrário, usa
  // amenitiz_reservas (dados brutos da API).

  // Calcular intervalo de datas para filtro de diárias
  const dataInicio = mes > 0 && ano > 0
    ? `${ano}-${String(mes).padStart(2, '0')}-01`
    : ano > 0 ? `${ano}-01-01` : null
  const dataFim = mes > 0 && ano > 0
    ? new Date(ano, mes, 0).toISOString().slice(0, 10)
    : ano > 0 ? `${ano}-12-31` : null

  // Query para diárias (xlsx-sourced)
  let diariasQuery = supabase
    .from('diarias')
    .select('valor, tipo_gestao, apartamentos(empreendimento_id, empreendimentos(nome))')

  if (dataInicio) diariasQuery = diariasQuery.gte('data', dataInicio) as typeof diariasQuery
  if (dataFim)    diariasQuery = diariasQuery.lte('data', dataFim) as typeof diariasQuery

  // Query para reservas do Amenitiz (fallback quando diárias não disponível)
  let reservasQuery = supabase
    .from('amenitiz_reservas')
    .select('valor_liquido, individual_room_number')

  if (mes > 0) reservasQuery = reservasQuery.eq('mes_competencia', mes) as typeof reservasQuery
  if (ano > 0) reservasQuery = reservasQuery.eq('ano_competencia', ano) as typeof reservasQuery

  // Query para custos
  let custosQuery = supabase
    .from('custos')
    .select('valor, apartamento_id, tipo_gestao, apartamentos(empreendimento_id, empreendimentos(nome))')

  if (mes > 0) custosQuery = custosQuery.eq('mes', mes) as typeof custosQuery
  if (ano > 0) custosQuery = custosQuery.eq('ano', ano) as typeof custosQuery

  const [
    { data: empreendimentos },
    { data: diariasData },
    { data: reservasData },
    { data: custosData },
    { data: apartamentosData },
  ] = await Promise.all([
    supabase
      .from('empreendimentos')
      .select('id, nome')
      .order('nome'),
    diariasQuery,
    reservasQuery,
    custosQuery,
    supabase
      .from('apartamentos')
      .select('id, numero, empreendimento_id, empreendimentos(nome)')
  ])

  // Determinar fonte de faturamento: xlsx (diarias) tem prioridade sobre Amenitiz
  const usandoDiariasXlsx = (diariasData?.length ?? 0) > 0

  const faturamentoTotal = usandoDiariasXlsx
    ? diariasData!.reduce((acc: number, d: any) => acc + (d.valor || 0), 0)
    : (reservasData?.reduce((acc, r) => acc + (r.valor_liquido || 0), 0) ?? 0)

  const custosTotal = custosData?.reduce((acc, c) => acc + (c.valor || 0), 0) ?? 0
  const lucroTotal = faturamentoTotal - custosTotal
  const qtdEmpreendimentos = empreendimentos?.length ?? 0
  const margemPct = faturamentoTotal > 0 ? Math.round((lucroTotal / faturamentoTotal) * 100) : 0
  const custosPct = faturamentoTotal > 0 ? Math.min(100, Math.round((custosTotal / faturamentoTotal) * 100)) : 0

  // Mapear número do apartamento para empreendimento (usado no fallback Amenitiz)
  const aptMap: Record<string, string> = {}
  apartamentosData?.forEach((a: any) => {
    const num = String(a.numero).trim()
    const emp = a.empreendimentos?.nome || ''
    if (emp) aptMap[num] = emp
  })

  const empreendimentoMap: Record<string, { fat: number; custos: number }> = {}

  // Agregar faturamento por empreendimento — xlsx tem prioridade
  if (usandoDiariasXlsx) {
    diariasData!.forEach((d: any) => {
      const nome = d.apartamentos?.empreendimentos?.nome
      if (nome) {
        if (!empreendimentoMap[nome]) empreendimentoMap[nome] = { fat: 0, custos: 0 }
        empreendimentoMap[nome].fat += d.valor || 0
      }
    })
  } else {
    reservasData?.forEach((r: any) => {
      const aptNum = String(r.individual_room_number).trim()
      const empNome = aptMap[aptNum]
      if (empNome) {
        if (!empreendimentoMap[empNome]) empreendimentoMap[empNome] = { fat: 0, custos: 0 }
        empreendimentoMap[empNome].fat += r.valor_liquido || 0
      }
    })
  }

  custosData?.forEach((c: any) => {
    const nome = c.apartamentos?.empreendimentos?.nome
    if (nome) {
      if (!empreendimentoMap[nome]) empreendimentoMap[nome] = { fat: 0, custos: 0 }
      empreendimentoMap[nome].custos += c.valor || 0
    }
  })

  const chartData = Object.entries(empreendimentoMap).map(([nome, vals]) => ({
    empreendimento: nome.length > 10 ? nome.substring(0, 10) : nome,
    faturamento: Math.round(vals.fat),
    lucro: Math.round(vals.fat - vals.custos),
  }))

  const empreendimentoCards = Object.entries(empreendimentoMap).map(([nome, vals]) => ({
    nome,
    fat: vals.fat,
    luc: vals.fat - vals.custos,
  }))

  const hasData = faturamentoTotal > 0

  return (
    <DashboardContent
      mes={mes}
      ano={ano}
      anoMesLabel={anoMesLabel}
      usandoDiariasXlsx={usandoDiariasXlsx}
      faturamentoTotal={faturamentoTotal}
      custosTotal={custosTotal}
      lucroTotal={lucroTotal}
      custosPct={custosPct}
      margemPct={margemPct}
      hasData={hasData}
      qtdEmpreendimentos={qtdEmpreendimentos}
      chartData={chartData}
      empreendimentoCards={empreendimentoCards}
    />
  )
}

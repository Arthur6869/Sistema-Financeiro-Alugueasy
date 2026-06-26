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

  // Validate params — rejeita NaN e valores fora do intervalo válido
  const parsedMes = params.mes !== undefined ? parseInt(params.mes, 10) : now.getMonth() + 1
  const parsedAno = params.ano !== undefined ? parseInt(params.ano, 10) : now.getFullYear()
  const mes = (!isNaN(parsedMes) && parsedMes >= 0 && parsedMes <= 12) ? parsedMes : now.getMonth() + 1
  const ano = (!isNaN(parsedAno) && (parsedAno === 0 || (parsedAno >= 2000 && parsedAno <= 2100))) ? parsedAno : now.getFullYear()

  const anoMesLabel =
    mes > 0 && ano > 0 ? `${MESES[mes - 1]} ${ano}` :
    mes > 0 ? `${MESES[mes - 1]} — todos os anos` :
    ano > 0 ? `Todos os meses de ${ano}` :
    'Todos os períodos'

  const supabase = await createClient()

  // Intervalo de datas para filtro de diárias
  const dataInicio = mes > 0 && ano > 0
    ? `${ano}-${String(mes).padStart(2, '0')}-01`
    : ano > 0 ? `${ano}-01-01` : null
  const dataFim = mes > 0 && ano > 0
    ? new Date(ano, mes, 0).toISOString().slice(0, 10)
    : ano > 0 ? `${ano}-12-31` : null

  // Build queries
  let diariasQuery = supabase
    .from('diarias')
    .select('apartamento_id, valor, tipo_gestao, apartamentos(numero, empreendimento_id, tipo_gestao, empreendimentos(nome))')
    .limit(50000)
  if (dataInicio) diariasQuery = diariasQuery.gte('data', dataInicio) as typeof diariasQuery
  if (dataFim)    diariasQuery = diariasQuery.lte('data', dataFim) as typeof diariasQuery

  let custosQuery = supabase
    .from('custos')
    .select('valor, apartamento_id, tipo_gestao, apartamentos(empreendimento_id, empreendimentos(nome))')
    .limit(50000)
  if (mes > 0) custosQuery = custosQuery.eq('mes', mes) as typeof custosQuery
  if (ano > 0) custosQuery = custosQuery.eq('ano', ano) as typeof custosQuery

  // Buscar queries principais em paralelo (reservas Amenitiz somente se necessário depois)
  const [
    { data: empreendimentos, error: empError },
    { data: diariasData, error: diariasError },
    { data: custosData, error: custosError },
    { data: apartamentosData },
    { data: custosOpVar },
    { data: mesesComCustosData },
    { data: custosSumData },
  ] = await Promise.all([
    supabase.from('empreendimentos').select('id, nome').order('nome'),
    diariasQuery,
    custosQuery,
    supabase.from('apartamentos').select('id, numero, empreendimento_id, tipo_gestao, empreendimentos(nome)'),
    // Busca custos operacionais variáveis — quando mes=0 traz todos do ano
    mes > 0 && ano > 0
      ? supabase.from('custos_operacionais_variaveis').select('mes, diarias').eq('mes', mes).eq('ano', ano)
      : supabase.from('custos_operacionais_variaveis').select('mes, diarias').eq('ano', ano),
    // Conta meses distintos com custos (somente ao exibir todos os meses de um ano)
    mes === 0 && ano > 0
      ? supabase.from('custos').select('mes').eq('ano', ano).limit(50000)
      : Promise.resolve({ data: null, error: null }),
    // Agregação server-side do total de custos reservas — bypassa o db-max-rows do PostgREST
    // O .reduce() client-side é truncado pelo limite de linhas do servidor; sum() retorna 1 linha
    mes === 0 && ano > 0
      ? (supabase.from('custos').select('valor.sum()').eq('ano', ano) as any)
      : Promise.resolve({ data: null, error: null }),
  ])

  if (empError)    console.error('[dashboard] empreendimentos:', empError.message)
  if (diariasError) console.error('[dashboard] diarias:', diariasError.message)
  if (custosError)  console.error('[dashboard] custos:', custosError.message)

  // Determinar fonte de faturamento: xlsx (diarias) tem prioridade sobre Amenitiz
  const usandoDiariasXlsx = (diariasData?.length ?? 0) > 0

  // Busca Amenitiz somente como fallback — evita query desnecessária quando diarias tem dados
  let reservasData: Array<{ valor_liquido: number; individual_room_number: string | number }> | null = null
  if (!usandoDiariasXlsx) {
    let reservasQuery = supabase
      .from('amenitiz_reservas')
      .select('valor_liquido, individual_room_number')
    if (mes > 0) reservasQuery = reservasQuery.eq('mes_competencia', mes) as typeof reservasQuery
    if (ano > 0) reservasQuery = reservasQuery.eq('ano_competencia', ano) as typeof reservasQuery
    const { data, error: reservasError } = await reservasQuery
    if (reservasError) console.error('[dashboard] amenitiz_reservas:', reservasError.message)
    reservasData = data
  }

  // Totais financeiros
  const faturamentoTotal = usandoDiariasXlsx
    ? diariasData!.reduce((acc: number, d: any) => acc + (d.valor || 0), 0)
    : (reservasData?.reduce((acc, r) => acc + (r.valor_liquido || 0), 0) ?? 0)

  const CUSTOS_OP_FIXO = 43509.92
  const CUSTO_DIARIA_OP = 250.00
  const custosOpVarRows = (custosOpVar as Array<{ mes: number; diarias: number }> | null) ?? []
  const totalDiariasOp = custosOpVarRows.reduce((s, r) => s + (r.diarias ?? 0), 0)

  const qtdMesesAtivos = mes > 0
    ? 1
    : mesesComCustosData
      ? new Set((mesesComCustosData as Array<{ mes: number }>).map((r) => r.mes)).size
      : 1

  const custosOperacionais = qtdMesesAtivos * CUSTOS_OP_FIXO + totalDiariasOp * CUSTO_DIARIA_OP
  // Usa agregação server-side no modo anual (mes=0) — evita truncamento pelo db-max-rows do Supabase
  const custosReservasSumRow = (custosSumData as Array<{ sum: number }> | null)?.[0]
  const custosReservas = (mes === 0 && custosReservasSumRow?.sum != null)
    ? Number(custosReservasSumRow.sum)
    : custosData?.reduce((acc, c) => acc + (c.valor || 0), 0) ?? 0
  const custosTotal = custosReservas + custosOperacionais
  const lucroTotal = faturamentoTotal - custosTotal
  const qtdEmpreendimentos = empreendimentos?.length ?? 0
  const margemPct = faturamentoTotal > 0 ? Math.round((lucroTotal / faturamentoTotal) * 100) : 0
  const custosPct = faturamentoTotal > 0 ? Math.min(100, Math.round((custosTotal / faturamentoTotal) * 100)) : 0

  // Map de apartamentos por ID — O(1) em vez de O(n) por .find() nos loops
  const aptLookupMap = new Map<string, any>()
  apartamentosData?.forEach((a: any) => aptLookupMap.set(a.id, a))

  // Map por número de apartamento — usado somente no fallback Amenitiz
  const aptByNumberMap = new Map<string, any>()
  apartamentosData?.forEach((a: any) => {
    const key = String(a.numero).trim()
    if (!aptByNumberMap.has(key)) aptByNumberMap.set(key, a)
  })

  // Agregar por apartamento (chave = apartamento_id UUID)
  const aptCardMap: Record<string, {
    numero: string; empNome: string; tipo: string; fat: number; custos: number
  }> = {}

  if (usandoDiariasXlsx) {
    diariasData!.forEach((d: any) => {
      const id = d.apartamento_id
      if (!id) return
      if (!aptCardMap[id]) {
        aptCardMap[id] = {
          numero: d.apartamentos?.numero || '?',
          empNome: d.apartamentos?.empreendimentos?.nome || '—',
          tipo: d.apartamentos?.tipo_gestao || d.tipo_gestao || '',
          fat: 0, custos: 0,
        }
      }
      aptCardMap[id].fat += d.valor || 0
    })
  }

  custosData?.forEach((c: any) => {
    const id = c.apartamento_id
    if (!id) return
    if (!aptCardMap[id]) {
      const apt = aptLookupMap.get(id)
      aptCardMap[id] = {
        numero: apt?.numero || '?',
        empNome: (apt?.empreendimentos as any)?.nome || '—',
        tipo: apt?.tipo_gestao || c.tipo_gestao || '',
        fat: 0, custos: 0,
      }
    }
    aptCardMap[id].custos += c.valor || 0
  })

  const apartamentoCards = Object.entries(aptCardMap)
    .map(([, v]) => ({ ...v, luc: v.fat - v.custos }))
    .sort((a, b) => a.empNome.localeCompare(b.empNome) || a.numero.localeCompare(b.numero))

  // Agregar por empreendimento
  const empreendimentoMap: Record<string, { fat: number; custos: number }> = {}

  if (usandoDiariasXlsx) {
    diariasData!.forEach((d: any) => {
      const nome = d.apartamentos?.empreendimentos?.nome
      if (nome) {
        if (!empreendimentoMap[nome]) empreendimentoMap[nome] = { fat: 0, custos: 0 }
        empreendimentoMap[nome].fat += d.valor || 0
      }
    })
  } else {
    // Fallback Amenitiz: identifica empreendimento pelo número do apt via Map (O(1))
    reservasData?.forEach((r: any) => {
      const aptNum = String(r.individual_room_number).trim()
      const apt = aptByNumberMap.get(aptNum)
      const empNome = apt ? ((apt.empreendimentos as any)?.nome || '') : ''
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

  // Nome completo no chartData — o componente de gráfico aplica truncamento no eixo
  const chartData = Object.entries(empreendimentoMap).map(([nome, vals]) => ({
    empreendimento: nome,
    faturamento: Math.round(vals.fat),
    lucro: Math.round(vals.fat - vals.custos),
  }))

  const empreendimentoCards = Object.entries(empreendimentoMap).map(([nome, vals]) => ({
    nome,
    fat: vals.fat,
    luc: vals.fat - vals.custos,
  }))

  // Exibe dados se há qualquer faturamento ou custo — não esconde períodos só com custos
  const hasData = faturamentoTotal > 0 || custosReservas > 0

  return (
    <DashboardContent
      mes={mes}
      ano={ano}
      anoMesLabel={anoMesLabel}
      usandoDiariasXlsx={usandoDiariasXlsx}
      faturamentoTotal={faturamentoTotal}
      custosReservas={custosReservas}
      custosOperacionais={custosOperacionais}
      custosTotal={custosTotal}
      lucroTotal={lucroTotal}
      custosPct={custosPct}
      margemPct={margemPct}
      hasData={hasData}
      qtdEmpreendimentos={qtdEmpreendimentos}
      chartData={chartData}
      empreendimentoCards={empreendimentoCards}
      apartamentoCards={apartamentoCards}
    />
  )
}

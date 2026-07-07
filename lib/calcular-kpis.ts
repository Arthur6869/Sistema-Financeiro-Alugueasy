// Lógica de cálculo de KPIs extraída de prestacao-contas/page.tsx.
// Usar esta função em QUALQUER lugar que precise dos mesmos números — portal, PDF, API.
// Não duplicar a regra: se a lógica mudar, muda aqui e todos herdam.

export type DiariaKpi  = { valor: number | null; tipo_gestao: string | null }
export type CustoKpi   = { valor: number | null; tipo_gestao: string | null }
export type ReservaKpi = { valor_liquido: number | null; status: string | null }
export type ApartamentoKpi = {
  tipo_gestao:     'adm' | 'sub' | null
  taxa_repasse:    number | null
  tipo_repasse:    'lucro' | 'faturamento' | null
  modelo_contrato: 'administracao' | 'sublocacao' | null
}

export type KPIsResult = {
  receitaAdm:               number
  receitaSub:               number
  receitaTotal:             number
  receitaReservasTotal:     number
  custosAdm:                number
  custosSub:                number
  custosTotal:              number
  lucroLiquido:             number
  valorRepasse:             number   // taxa AlugEasy (não é o valor ao proprietário)
  valorLiquidoProprietario: number   // o que o proprietário recebe
  margemLiquida:            number
  usarDiarias:              boolean
  taxa:                     number
  baseCalculo:              number
  tipoRepasseLabel:         string
}

export type CalcularKPIsOpts = {
  // Inverte a preferência de fonte de receita: reservas Amenitiz > diárias.
  // Usar APENAS para o mês corrente — amenitiz_reservas atualiza a cada 5 min
  // (cron) enquanto diarias só muda no sync completo diário. Meses fechados
  // devem continuar em diárias para bater com a prestação de contas/PDF.
  preferirReservas?: boolean
}

export function calcularKPIs(
  diarias:  DiariaKpi[],
  custos:   CustoKpi[],
  reservas: ReservaKpi[],
  apt:      ApartamentoKpi,
  opts?:    CalcularKPIsOpts,
): KPIsResult {
  // Receita primária: diárias conferidas (XLSX importado)
  const receitaAdmDiarias   = diarias.filter(d => d.tipo_gestao === 'adm').reduce((s, d) => s + Number(d.valor ?? 0), 0)
  const receitaSubDiarias   = diarias.filter(d => d.tipo_gestao === 'sub').reduce((s, d) => s + Number(d.valor ?? 0), 0)
  const receitaDiariasTotal = receitaAdmDiarias + receitaSubDiarias

  // Receita fallback: amenitiz_reservas (exclui canceladas/no-show)
  const reservasValidas     = reservas.filter(r => !['cancelled', 'canceled', 'no_show'].includes(String(r.status ?? '').toLowerCase()))
  const receitaReservasTotal = reservasValidas.reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0)

  // Preferência: diárias > reservas Amenitiz.
  // Com preferirReservas (mês corrente), inverte: reservas são a fonte mais
  // fresca (cron de 5 min + realtime) e o valor_liquido já desconta as taxas.
  const usarDiarias = opts?.preferirReservas && receitaReservasTotal > 0
    ? false
    : receitaDiariasTotal > 0
  let receitaAdm = receitaAdmDiarias
  let receitaSub = receitaSubDiarias
  if (!usarDiarias && receitaReservasTotal > 0) {
    receitaAdm = 0
    receitaSub = 0
    const fallbackGestao = apt.tipo_gestao ?? (apt.modelo_contrato === 'sublocacao' ? 'sub' : 'adm')
    if (fallbackGestao === 'sub') receitaSub = receitaReservasTotal
    else                          receitaAdm = receitaReservasTotal
  }
  const receitaTotal = receitaAdm + receitaSub

  // Custos
  const custosAdm   = custos.filter(c => c.tipo_gestao === 'adm').reduce((s, c) => s + Number(c.valor ?? 0), 0)
  const custosSub   = custos.filter(c => c.tipo_gestao === 'sub').reduce((s, c) => s + Number(c.valor ?? 0), 0)
  const custosTotal = custosAdm + custosSub

  // Resultado
  const lucroLiquido = receitaTotal - custosTotal
  const taxa         = Number(apt.taxa_repasse ?? 0) / 100
  const baseCalculo  = apt.tipo_repasse === 'faturamento' ? receitaTotal : lucroLiquido
  const valorRepasse = baseCalculo * taxa
  const valorLiquidoProprietario = lucroLiquido - valorRepasse
  const margemLiquida = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0
  const tipoRepasseLabel = apt.tipo_repasse === 'faturamento' ? 'Faturamento Bruto' : 'Lucro Líquido'

  return {
    receitaAdm, receitaSub, receitaTotal, receitaReservasTotal,
    custosAdm, custosSub, custosTotal,
    lucroLiquido, valorRepasse, valorLiquidoProprietario,
    margemLiquida, usarDiarias, taxa, baseCalculo, tipoRepasseLabel,
  }
}

// Soma de KPIsResult de vários apartamentos (para o painel multi-imóvel do portal)
export function somarKPIs(lista: KPIsResult[]): KPIsResult {
  const soma = (key: keyof KPIsResult) =>
    lista.reduce((s, k) => s + (typeof k[key] === 'number' ? (k[key] as number) : 0), 0)

  const receitaTotal = soma('receitaTotal')
  const custosTotal  = soma('custosTotal')
  const lucroLiquido = soma('lucroLiquido')
  const valorRepasse = soma('valorRepasse')

  return {
    receitaAdm:               soma('receitaAdm'),
    receitaSub:               soma('receitaSub'),
    receitaTotal,
    receitaReservasTotal:     soma('receitaReservasTotal'),
    custosAdm:                soma('custosAdm'),
    custosSub:                soma('custosSub'),
    custosTotal,
    lucroLiquido,
    valorRepasse,
    valorLiquidoProprietario: soma('valorLiquidoProprietario'),
    margemLiquida:            receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0,
    usarDiarias:              lista.some(k => k.usarDiarias),
    taxa:                     lista[0]?.taxa ?? 0,
    baseCalculo:              soma('baseCalculo'),
    tipoRepasseLabel:         lista[0]?.tipoRepasseLabel ?? 'Lucro Líquido',
  }
}

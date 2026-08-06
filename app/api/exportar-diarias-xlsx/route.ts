import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'
import { fetchAllRows } from '@/lib/supabase-fetch-all'
import { temChaveInterna } from '@/lib/internal-key'

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * Planilha de conferência de diárias (ADM ou SUB), uma aba por empreendimento.
 * GET /api/exportar-diarias-xlsx?mes=6&ano=2026&tipo=adm|sub
 *
 * Regras de negócio:
 * - Competência por CHECK-IN no mês, valor INTEGRAL da reserva — espelha
 *   exatamente a listagem da Amenitiz de 01 ao último dia do mês, que é a
 *   fonte usada na conferência manual (decisão do usuário em 08/07/2026,
 *   substituindo o rateio por noite de 07/07/2026).
 * - Reservas canceladas/no-show ficam fora (o sync as mantém em
 *   amenitiz_reservas só para atualizar status).
 * - Cruzamento por FK apartamento_id (não por número — números repetem entre
 *   empreendimentos, e a FK nula das transferências de anúncio já exclui
 *   reservas que pertencem a outro imóvel).
 * - valor_liquido já vem líquido das taxas de plataforma aplicadas no sync
 *   (Booking 13/16% por empreendimento, AlugEasy 10%, Airbnb 18,21% a partir
 *   de jun/2026 — 0% até mai/2026).
 * - A linha "Taxa AlugEasy 18%" é a comissão de administração cobrada do
 *   proprietário — separada das taxas de plataforma acima.
 */

const CANCELADAS = new Set(['cancelled', 'canceled', 'no_show'])
const TAXA_ALUGUEASY = 0.18

/**
 * Correções de classificação com vigência mensal — valem APENAS para o mês
 * indicado; a conferência dos demais meses permanece intacta (mesmo padrão
 * de regra datada do TRANSFERENCIAS_ANUNCIO em lib/sync-amenitiz-core.ts).
 * Fonte: planilhas de conferência de junho/2026 fornecidas pelo usuário.
 */
const OVERRIDES_GESTAO_MENSAL: {
  emp: string; numero: string; mes: number; ano: number
  tipo: 'adm' | 'sub'
  /** quando presente, o apartamento também muda de empreendimento no mês */
  empDestino?: string
}[] = [
  { emp: 'EASY',    numero: '216',  mes: 6, ano: 2026, tipo: 'sub' },
  { emp: 'EASY',    numero: '217',  mes: 6, ano: 2026, tipo: 'sub' },
  { emp: 'ATHOS',   numero: '1016', mes: 6, ano: 2026, tipo: 'sub' },
  { emp: 'ATHOS',   numero: '1209', mes: 6, ano: 2026, tipo: 'sub' },
  { emp: 'NOBILE',  numero: '803',  mes: 6, ano: 2026, tipo: 'sub' },
  { emp: 'VISION',  numero: '220',  mes: 6, ano: 2026, tipo: 'sub' },
  { emp: 'FUSION',  numero: '1709', mes: 6, ano: 2026, tipo: 'sub' },
  // Quarto Amenitiz "SQS 414" está cadastrado como ESSENCE 204 (sub); na
  // conferência de junho ele é o ASA SUL 204 (ADM).
  { emp: 'ESSENCE', numero: '204',  mes: 6, ano: 2026, tipo: 'adm', empDestino: 'ASA SUL' },
]

const COR_HEADER = '1F3864'
const COR_SUBTOTAL = 'EBF3FB'
const COR_RESULTADO_FAT = 'C6EFCE'
const COR_RESULTADO_LUC = 'FFF2CC'
const COR_BOOKING = 'FF0070C0'
const COR_AIRBNB = 'FFFF6B35'
const COR_ALUGUEASY = 'FF00B050'
const COR_TAXA = 'FF7030A0'
const COR_ZERO = 'FFCCCCCC'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const isInternal = temChaveInterna(request)

  if (!user && !isInternal)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (user && !isInternal) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'analista'].includes(profile.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
  }

  const { searchParams } = new URL(request.url)
  const mes = parseInt(searchParams.get('mes') ?? String(new Date().getMonth() + 1))
  const ano = parseInt(searchParams.get('ano') ?? String(new Date().getFullYear()))
  const tipo = searchParams.get('tipo') ?? 'adm'

  if (tipo !== 'adm' && tipo !== 'sub')
    return NextResponse.json({ error: 'Parâmetro tipo deve ser adm ou sub' }, { status: 400 })
  if (!(mes >= 1 && mes <= 12) || !(ano >= 2000 && ano <= 2100))
    return NextResponse.json({ error: 'Período inválido' }, { status: 400 })

  const MESES_ABREV = ['JAN','FEV','MAR','ABR','MAI','JUN',
                        'JUL','AGO','SET','OUT','NOV','DEZ']
  const mesLabel = MESES_ABREV[mes - 1]

  const adminSupabase = createAdminClient()

  const ultimoDia = new Date(ano, mes, 0).getDate()
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

  type AptRow = { id: string; numero: string; empreendimento_id: string; tipo_gestao: string }
  type EmpRow = { id: string; nome: string }
  type ReservaRow = {
    booking_id: string; apartamento_id: string | null; valor_liquido: number | null
    plataforma_normalizada: string | null; status: string | null
    checkin: string | null
  }
  type DiariaRow = { apartamento_id: string; valor: number; data: string }
  type CustoRow = { apartamento_id: string; valor: number }

  // Reservas com CHECK-IN dentro do mês — o mesmo conjunto que a Amenitiz
  // lista de 01 ao último dia, garantindo conferência 1:1 com a plataforma.
  const reservasPromise = fetchAllRows<ReservaRow>((f, t) =>
    adminSupabase
      .from('amenitiz_reservas')
      .select('booking_id, apartamento_id, valor_liquido, plataforma_normalizada, status, checkin')
      .gte('checkin', dataInicio)
      .lte('checkin', dataFim)
      .order('checkin').order('booking_id')
      .range(f, t) as unknown as Page<ReservaRow>
  )

  const [
    { data: empreendimentos },
    { data: apartamentos },
    { rows: reservasBrutas, error: reservasError },
    { data: custos },
  ] = await Promise.all([
    adminSupabase.from('empreendimentos').select('id, nome').order('nome'),
    adminSupabase.from('apartamentos').select('id, numero, empreendimento_id, tipo_gestao').order('numero'),
    reservasPromise,
    adminSupabase.from('custos')
      .select('apartamento_id, valor')
      .eq('mes', mes)
      .eq('ano', ano)
      .eq('tipo_gestao', tipo),
  ])

  if (reservasError)
    return NextResponse.json({ error: reservasError }, { status: 500 })

  const empsTyped = (empreendimentos ?? []) as EmpRow[]
  const custosTyped = (custos ?? []) as CustoRow[]

  // Aplica as correções de vigência mensal antes de agrupar por tipo/empreendimento
  const empIdPorNome = new Map(empsTyped.map(e => [e.nome.toUpperCase(), e.id]))
  const empNomePorId = new Map(empsTyped.map(e => [e.id, e.nome.toUpperCase()]))
  let overridesAplicados = 0
  const apartamentosCorrigidos = ((apartamentos ?? []) as AptRow[]).map(a => {
    const o = OVERRIDES_GESTAO_MENSAL.find(o =>
      o.mes === mes && o.ano === ano &&
      o.emp === empNomePorId.get(a.empreendimento_id) &&
      o.numero === String(a.numero).trim())
    if (!o) return a
    overridesAplicados++
    return {
      ...a,
      tipo_gestao: o.tipo,
      empreendimento_id: o.empDestino
        ? (empIdPorNome.get(o.empDestino) ?? a.empreendimento_id)
        : a.empreendimento_id,
    }
  })

  const aptsDoTipo = apartamentosCorrigidos.filter(a => a.tipo_gestao === tipo)
  const aptIdsDoTipo = new Set(aptsDoTipo.map(a => a.id))

  // ── Uma linha por reserva, valor líquido integral (igual Amenitiz) ────────
  type ValorApt = { valor: number; plataforma: 'booking' | 'airbnb' | 'alugueasy' }
  const valoresPorAptId: Record<string, ValorApt[]> = {}
  let canceladasExcluidas = 0
  let semVinculo = 0

  for (const r of reservasBrutas) {
    if (CANCELADAS.has(String(r.status ?? '').toLowerCase())) {
      canceladasExcluidas++
      continue
    }
    if (!r.checkin) continue
    if (!r.apartamento_id) {
      // FK nula = vínculo desconhecido ou transferência de anúncio — fora da
      // conferência (mesma regra do sync para diárias/totais).
      semVinculo++
      continue
    }
    if (!aptIdsDoTipo.has(r.apartamento_id)) continue // apartamento do outro tipo de gestão

    const valorNoMes = Math.round((r.valor_liquido ?? 0) * 100) / 100

    const plat = String(r.plataforma_normalizada ?? '').toLowerCase()
    const plataforma = plat.includes('booking') ? 'booking'
      : plat.includes('airbnb') ? 'airbnb'
      : 'alugueasy'

    if (!valoresPorAptId[r.apartamento_id]) valoresPorAptId[r.apartamento_id] = []
    valoresPorAptId[r.apartamento_id].push({ valor: valorNoMes, plataforma })
  }

  // Fallback: apts do tipo sem nenhuma reserva Amenitiz no mês → tabela diarias
  // (lançamentos manuais, já limitados a 01..último dia pelo filtro de data).
  const aptsSemReservas = aptsDoTipo.filter(a => !valoresPorAptId[a.id]?.length)
  if (aptsSemReservas.length > 0) {
    const { data: diariasFallback } = await adminSupabase
      .from('diarias')
      .select('apartamento_id, valor, data')
      .in('apartamento_id', aptsSemReservas.map(a => a.id))
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data')

    for (const d of (diariasFallback ?? []) as DiariaRow[]) {
      if (!valoresPorAptId[d.apartamento_id]) valoresPorAptId[d.apartamento_id] = []
      valoresPorAptId[d.apartamento_id].push({ valor: d.valor ?? 0, plataforma: 'alugueasy' })
    }
  }

  // ── Montagem do workbook ─────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'AlugEasy'
  wb.created = new Date()

  const resultado: Record<string, { fat: number, luc: number }> = {}

  for (const emp of empsTyped) {
    const aptsEmp = aptsDoTipo
      .filter(a => a.empreendimento_id === emp.id)
      .sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }))

    if (aptsEmp.length === 0) continue

    const sheet = wb.addWorksheet(emp.nome.toUpperCase().slice(0, 31))
    sheet.views = [{ state: 'frozen', ySplit: 2 }]

    // Colunas: valores nas ímpares, espaçadores nas pares, última = rótulos
    const numCols = aptsEmp.length * 2 + 1
    for (let c = 1; c <= numCols; c++) {
      sheet.getColumn(c).width = c % 2 === 1 ? 14 : 3
    }
    sheet.getColumn(numCols).width = 18

    // Linha 1: título
    const cellMes = sheet.getRow(1).getCell(1)
    cellMes.value = `${mesLabel}/${ano} - ${tipo.toUpperCase()} - ${emp.nome.toUpperCase()}`
    cellMes.font = { bold: true, size: 12, color: { argb: 'FF' + COR_HEADER } }

    // Linha 2: números dos apartamentos
    const linhaApts = sheet.getRow(2)
    aptsEmp.forEach((apt, i) => {
      const col = i * 2 + 1
      const cell = linhaApts.getCell(col)
      cell.value = apt.numero
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR_HEADER } }
      cell.alignment = { horizontal: 'center' }
    })

    // Área de dados: linhas dinâmicas — nunca trunca reservas
    const valoresPorApt: ValorApt[][] = aptsEmp.map(apt => valoresPorAptId[apt.id] ?? [])
    const numLinhas = Math.max(12, ...valoresPorApt.map(v => v.length))
    const dataStart = 3
    const dataEnd = dataStart + numLinhas - 1

    for (let linha = 0; linha < numLinhas; linha++) {
      const row = sheet.getRow(dataStart + linha)
      aptsEmp.forEach((_, i) => {
        const col = i * 2 + 1
        const val = valoresPorApt[i][linha]?.valor ?? 0
        const cell = row.getCell(col)
        cell.value = val
        cell.numFmt = '#,##0.00'
        if (val === 0) cell.font = { color: { argb: COR_ZERO } }
      })
    }

    // Subtotal por apartamento — a fórmula soma SOMENTE a área de dados
    const rowSubtotal = dataEnd + 1
    const linhaSubtotal = sheet.getRow(rowSubtotal)
    const subtotais: number[] = []
    aptsEmp.forEach((_, i) => {
      const col = i * 2 + 1
      const total = Math.round(valoresPorApt[i].reduce((a, v) => a + v.valor, 0) * 100) / 100
      subtotais.push(total)
      const colLetter = sheet.getColumn(col).letter
      const cell = linhaSubtotal.getCell(col)
      cell.value = { formula: `=SUM(${colLetter}${dataStart}:${colLetter}${dataEnd})` }
      cell.numFmt = '#,##0.00'
      cell.font = { bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR_SUBTOTAL } }
      cell.border = { top: { style: 'thin', color: { argb: 'FF' + COR_HEADER } } }
    })
    linhaSubtotal.getCell(numCols).value = 'subtotal'
    linhaSubtotal.getCell(numCols).font = { italic: true, color: { argb: 'FF' + COR_HEADER } }

    // Quebra por plataforma — ABAIXO do subtotal, fora de qualquer SUM
    const plataformas = [
      { key: 'booking' as const, label: 'booking', cor: COR_BOOKING },
      { key: 'airbnb' as const, label: 'airbnb', cor: COR_AIRBNB },
      { key: 'alugueasy' as const, label: 'alugueasy', cor: COR_ALUGUEASY },
    ]
    plataformas.forEach((p, pIdx) => {
      const row = sheet.getRow(rowSubtotal + 2 + pIdx)
      aptsEmp.forEach((_, i) => {
        const col = i * 2 + 1
        const val = valoresPorApt[i]
          .filter(v => v.plataforma === p.key)
          .reduce((a, v) => a + v.valor, 0)
        if (val > 0) {
          const cell = row.getCell(col)
          cell.value = Math.round(val * 100) / 100
          cell.numFmt = '#,##0.00'
          cell.font = { color: { argb: p.cor } }
        }
      })
      row.getCell(numCols).value = p.label
      row.getCell(numCols).font = { color: { argb: p.cor }, italic: true }
    })

    // Taxa de administração AlugEasy (18% sobre o subtotal de cada apto)
    const rowTaxa = rowSubtotal + 2 + plataformas.length
    const linhaTaxa = sheet.getRow(rowTaxa)
    aptsEmp.forEach((_, i) => {
      const col = i * 2 + 1
      const colLetter = sheet.getColumn(col).letter
      const cell = linhaTaxa.getCell(col)
      cell.value = { formula: `=${colLetter}${rowSubtotal}*${TAXA_ALUGUEASY}` }
      cell.numFmt = '#,##0.00'
      cell.font = { color: { argb: COR_TAXA } }
    })
    linhaTaxa.getCell(numCols).value = `Taxa AlugEasy ${TAXA_ALUGUEASY * 100}%`
    linhaTaxa.getCell(numCols).font = { italic: true, color: { argb: COR_TAXA } }

    // TOTAL do empreendimento
    const totalEmp = Math.round(subtotais.reduce((a, b) => a + b, 0) * 100) / 100
    const rowTotal = rowTaxa + 2
    const linhaTotalRow = sheet.getRow(rowTotal)
    const cellTotalLabel = linhaTotalRow.getCell(1)
    cellTotalLabel.value = 'TOTAL:'
    cellTotalLabel.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cellTotalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR_HEADER } }

    const subCells = aptsEmp.map((_, i) => {
      const col = i * 2 + 1
      return `${sheet.getColumn(col).letter}${rowSubtotal}`
    }).join('+')
    const cellTotalVal = linhaTotalRow.getCell(2)
    cellTotalVal.value = { formula: `=${subCells}` }
    cellTotalVal.numFmt = '#,##0.00'
    cellTotalVal.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cellTotalVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR_HEADER } }

    // FAT e LUC
    const custoEmp = custosTyped
      .filter(c => aptsEmp.some(a => a.id === c.apartamento_id))
      .reduce((a, c) => a + (c.valor ?? 0), 0)
    const lucroEmp = Math.round((totalEmp - custoEmp) * 100) / 100

    const linhaFatEmp = sheet.getRow(rowTotal + 1)
    linhaFatEmp.getCell(1).value = 'FAT'
    linhaFatEmp.getCell(1).font = { bold: true, color: { argb: COR_ALUGUEASY } }
    linhaFatEmp.getCell(2).value = totalEmp
    linhaFatEmp.getCell(2).numFmt = '#,##0.00'
    linhaFatEmp.getCell(2).font = { bold: true }

    const linhaLucEmp = sheet.getRow(rowTotal + 2)
    linhaLucEmp.getCell(1).value = 'LUC'
    linhaLucEmp.getCell(1).font = { bold: true, color: { argb: 'FFFF9900' } }
    linhaLucEmp.getCell(2).value = lucroEmp
    linhaLucEmp.getCell(2).numFmt = '#,##0.00'
    linhaLucEmp.getCell(2).font = { bold: true, color: { argb: lucroEmp >= 0 ? COR_ALUGUEASY : 'FFFF0000' } }

    resultado[emp.nome.toUpperCase()] = { fat: totalEmp, luc: lucroEmp }
  }

  // ── Sheet de resultado ───────────────────────────────────────────────────
  const sheetRes = wb.addWorksheet(`RESULTADO ${tipo.toUpperCase()} MES`)
  const empsOrdem = empsTyped.map(e => e.nome.toUpperCase()).filter(n => resultado[n])

  const cellTitulo = sheetRes.getRow(1).getCell(1)
  cellTitulo.value = `${mesLabel}/${ano} - ${tipo.toUpperCase()}`
  cellTitulo.font = { bold: true, size: 14, color: { argb: 'FF' + COR_HEADER } }

  const linhaEmpRes = sheetRes.getRow(2)
  empsOrdem.forEach((emp, i) => {
    const col = i * 2 + 1
    const cell = linhaEmpRes.getCell(col)
    cell.value = emp
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR_HEADER } }
    cell.alignment = { horizontal: 'center' }
    sheetRes.getColumn(col).width = 16
    sheetRes.getColumn(col + 1).width = 6
  })

  const linhaFat = sheetRes.getRow(3)
  const linhaLucRes = sheetRes.getRow(4)
  let totalFatGeral = 0
  let totalLucGeral = 0

  empsOrdem.forEach((emp, i) => {
    const col = i * 2 + 1
    const dados = resultado[emp] ?? { fat: 0, luc: 0 }
    totalFatGeral += dados.fat
    totalLucGeral += dados.luc

    const cellFat = linhaFat.getCell(col)
    cellFat.value = dados.fat
    cellFat.numFmt = '#,##0.00'
    cellFat.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR_RESULTADO_FAT } }
    linhaFat.getCell(col + 1).value = 'FAT'
    linhaFat.getCell(col + 1).font = { bold: true, color: { argb: COR_ALUGUEASY } }

    const cellLuc = linhaLucRes.getCell(col)
    cellLuc.value = dados.luc
    cellLuc.numFmt = '#,##0.00'
    cellLuc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR_RESULTADO_LUC } }
    linhaLucRes.getCell(col + 1).value = 'LUC'
    linhaLucRes.getCell(col + 1).font = { bold: true, color: { argb: 'FFFF9900' } }
  })

  totalFatGeral = Math.round(totalFatGeral * 100) / 100
  totalLucGeral = Math.round(totalLucGeral * 100) / 100

  const linhaTotal = sheetRes.getRow(7)
  linhaTotal.getCell(1).value = 'TOTAL FAT'
  linhaTotal.getCell(1).font = { bold: true }
  linhaTotal.getCell(2).value = totalFatGeral
  linhaTotal.getCell(2).numFmt = '#,##0.00'
  linhaTotal.getCell(2).font = { bold: true }

  const linhaTotalLuc = sheetRes.getRow(8)
  linhaTotalLuc.getCell(1).value = 'TOTAL LUC'
  linhaTotalLuc.getCell(1).font = { bold: true }
  linhaTotalLuc.getCell(2).value = totalLucGeral
  linhaTotalLuc.getCell(2).numFmt = '#,##0.00'
  linhaTotalLuc.getCell(2).font = { bold: true, color: { argb: totalLucGeral >= 0 ? COR_ALUGUEASY : 'FFFF0000' } }

  // Notas de auditoria — transparência da conferência
  const notas = [
    `Competência: reservas com check-in de 01/${String(mes).padStart(2, '0')} a ${ultimoDia}/${String(mes).padStart(2, '0')}/${ano}, valor integral — espelha a listagem da Amenitiz.`,
    `Valores líquidos das taxas de plataforma (Booking 13/16%, AlugEasy 10%, Airbnb 18,21% desde jun/2026) aplicadas no sync.`,
    `Reservas canceladas/no-show excluídas: ${canceladasExcluidas}.`,
    ...(semVinculo > 0 ? [`Reservas sem vínculo de apartamento (fora da conferência): ${semVinculo}.`] : []),
    ...(overridesAplicados > 0 ? [`Correções de vigência ${String(mes).padStart(2, '0')}/${ano} aplicadas: ${overridesAplicados} apartamento(s) reclassificado(s).`] : []),
  ]
  notas.forEach((nota, i) => {
    const cell = sheetRes.getRow(10 + i).getCell(1)
    cell.value = nota
    cell.font = { italic: true, size: 9, color: { argb: 'FF808080' } }
  })

  const buffer = await wb.xlsx.writeBuffer()
  const nomeArquivo = `CONFERENCIA_DIARIAS_${tipo.toUpperCase()}_${mesLabel}_${ano}.xlsx`

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      'Cache-Control': 'no-cache',
    },
  })
}

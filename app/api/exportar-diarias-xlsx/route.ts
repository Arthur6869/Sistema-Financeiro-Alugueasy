import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const internalKey = request.headers.get('x-alugueasy-internal-key')
  const isInternal = internalKey === process.env.ALUGUEASY_INTERNAL_API_KEY

  if (!user && !isInternal)
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mes = parseInt(searchParams.get('mes') ?? String(new Date().getMonth() + 1))
  const ano = parseInt(searchParams.get('ano') ?? String(new Date().getFullYear()))
  const tipo = (searchParams.get('tipo') ?? 'adm') as 'adm' | 'sub'

  const MESES_ABREV = ['JAN','FEV','MAR','ABR','MAI','JUN',
                        'JUL','AGO','SET','OUT','NOV','DEZ']
  const mesLabel = MESES_ABREV[mes - 1]

  const adminSupabase = createAdminClient()

  const [
    { data: empreendimentos },
    { data: apartamentos },
    { data: diarias },
    { data: reservas },
    { data: custos },
  ] = await Promise.all([
    adminSupabase.from('empreendimentos').select('id, nome').order('nome'),
    adminSupabase.from('apartamentos').select('id, numero, empreendimento_id, tipo_gestao').eq('tipo_gestao', tipo).order('numero'),
    adminSupabase.from('diarias')
      .select('apartamento_id, valor, data, tipo_gestao')
      .gte('data', `${ano}-${String(mes).padStart(2,'0')}-01`)
      .lte('data', `${ano}-${String(mes).padStart(2,'0')}-31`)
      .eq('tipo_gestao', tipo),
    adminSupabase.from('amenitiz_reservas')
      .select('individual_room_number, valor_liquido, plataforma_normalizada, checkin, checkout')
      .eq('mes_competencia', mes)
      .eq('ano_competencia', ano),
    adminSupabase.from('custos')
      .select('apartamento_id, valor')
      .eq('mes', mes)
      .eq('ano', ano)
      .eq('tipo_gestao', tipo),
  ])

  type AptRow = { id: string; numero: string; empreendimento_id: string; tipo_gestao: string }
  type EmpRow = { id: string; nome: string }
  type DiariaRow = { apartamento_id: string; valor: number; data: string; tipo_gestao: string }
  type ReservaRow = { individual_room_number: string; valor_liquido: number; plataforma_normalizada: string }
  type CustoRow = { apartamento_id: string; valor: number }

  const empsTyped = (empreendimentos ?? []) as EmpRow[]
  const aptsTyped = (apartamentos ?? []) as AptRow[]
  const diariasTyped = (diarias ?? []) as DiariaRow[]
  const reservasTyped = (reservas ?? []) as ReservaRow[]
  const custosTyped = (custos ?? []) as CustoRow[]

  const custosPorApt: Record<string, number> = {}
  for (const c of custosTyped) {
    custosPorApt[c.apartamento_id] = (custosPorApt[c.apartamento_id] ?? 0) + (c.valor ?? 0)
  }

  const reservasPorApt: Record<string, number[]> = {}
  for (const d of diariasTyped) {
    if (!reservasPorApt[d.apartamento_id]) reservasPorApt[d.apartamento_id] = []
    reservasPorApt[d.apartamento_id].push(d.valor ?? 0)
  }

  const plataformaPorApt: Record<string, { booking: number, airbnb: number, alugueasy: number }> = {}
  for (const r of reservasTyped) {
    const num = String(r.individual_room_number ?? '').trim()
    if (!plataformaPorApt[num]) plataformaPorApt[num] = { booking: 0, airbnb: 0, alugueasy: 0 }
    const plat = String(r.plataforma_normalizada ?? '').toLowerCase()
    const val = r.valor_liquido ?? 0
    if (plat.includes('booking')) plataformaPorApt[num].booking += val
    else if (plat.includes('airbnb')) plataformaPorApt[num].airbnb += val
    else plataformaPorApt[num].alugueasy += val
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'AlugEasy'
  wb.created = new Date()

  const COR_HEADER = '1F3864'
  const COR_SUBTOTAL = 'EBF3FB'
  const COR_RESULTADO_FAT = 'C6EFCE'
  const COR_RESULTADO_LUC = 'FFF2CC'
  const TAXA_ALUGUEASY = 0.18

  const resultado: Record<string, { fat: number, luc: number }> = {}

  for (const emp of empsTyped) {
    const aptsEmp = aptsTyped
      .filter(a => a.empreendimento_id === emp.id)
      .sort((a, b) => String(a.numero).localeCompare(String(b.numero), undefined, { numeric: true }))

    if (aptsEmp.length === 0) continue

    const sheet = wb.addWorksheet(emp.nome.toUpperCase())

    const numCols = aptsEmp.length * 2 + 1
    for (let c = 1; c <= numCols; c++) {
      sheet.getColumn(c).width = c % 2 === 1 ? 14 : 3
    }

    // Linha 1: mês
    const cellMes = sheet.getRow(1).getCell(1)
    cellMes.value = `${mesLabel} - ${tipo.toUpperCase()}`
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

    const MAX_LINHAS = 27
    const valoresPorApt: number[][] = aptsEmp.map(apt => {
      const vals = reservasPorApt[apt.id] ?? []
      const res = [...vals]
      while (res.length < MAX_LINHAS) res.push(0)
      return res.slice(0, MAX_LINHAS)
    })

    for (let linha = 0; linha < MAX_LINHAS; linha++) {
      const row = sheet.getRow(linha + 3)
      aptsEmp.forEach((_, i) => {
        const col = i * 2 + 1
        const val = valoresPorApt[i][linha]
        const cell = row.getCell(col)
        cell.value = val > 0 ? val : 0
        cell.numFmt = '#,##0.00'
        if (val === 0) cell.font = { color: { argb: 'FFCCCCCC' } }
      })

      if (linha === MAX_LINHAS - 6) {
        row.getCell(numCols).value = 'booking'
        row.getCell(numCols).font = { color: { argb: 'FF0070C0' }, italic: true }
      }
      if (linha === MAX_LINHAS - 5) {
        row.getCell(numCols).value = 'airbnb'
        row.getCell(numCols).font = { color: { argb: 'FFFF6B35' }, italic: true }
      }
      if (linha === MAX_LINHAS - 4) {
        row.getCell(numCols).value = 'alugueasy'
        row.getCell(numCols).font = { color: { argb: 'FF00B050' }, italic: true }
      }
    }

    // Linha 30: subtotais
    const linhaSubtotal = sheet.getRow(30)
    const subtotais: number[] = []
    aptsEmp.forEach((_, i) => {
      const col = i * 2 + 1
      const total = valoresPorApt[i].reduce((a, b) => a + b, 0)
      subtotais.push(total)
      const colLetter = sheet.getColumn(col).letter
      const cell = linhaSubtotal.getCell(col)
      cell.value = { formula: `=SUM(${colLetter}3:${colLetter}29)` }
      cell.numFmt = '#,##0.00'
      cell.font = { bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR_SUBTOTAL } }
    })

    // Linha 31: TOTAL
    const totalEmp = subtotais.reduce((a, b) => a + b, 0)
    const linhaTotalRow = sheet.getRow(31)
    const cellTotalLabel = linhaTotalRow.getCell(1)
    cellTotalLabel.value = 'TOTAL:'
    cellTotalLabel.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cellTotalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR_HEADER } }

    const subCols = aptsEmp.map((_, i) => {
      const col = i * 2 + 1
      return `${sheet.getColumn(col).letter}30`
    }).join('+')
    const cellTotalVal = linhaTotalRow.getCell(2)
    cellTotalVal.value = { formula: `=${subCols}` }
    cellTotalVal.numFmt = '#,##0.00'
    cellTotalVal.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cellTotalVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR_HEADER } }

    // Linha 32: taxa AlugEasy
    const linhaTaxa = sheet.getRow(32)
    aptsEmp.forEach((_, i) => {
      const col = i * 2 + 1
      const colLetter = sheet.getColumn(col).letter
      const cell = linhaTaxa.getCell(col)
      cell.value = { formula: `=${colLetter}30*${TAXA_ALUGUEASY}` }
      cell.numFmt = '#,##0.00'
      cell.font = { color: { argb: 'FF7030A0' } }
    })
    linhaTaxa.getCell(numCols).value = `Taxa ${TAXA_ALUGUEASY * 100}%`
    linhaTaxa.getCell(numCols).font = { italic: true, color: { argb: 'FF7030A0' } }

    // Linhas 34-35: FAT e LUC
    const custoEmp = custosTyped
      .filter(c => aptsEmp.some(a => a.id === c.apartamento_id))
      .reduce((a, c) => a + (c.valor ?? 0), 0)
    const lucroEmp = totalEmp - custoEmp

    const linhaMeta = sheet.getRow(34)
    linhaMeta.getCell(numCols - 2).value = 'FAT'
    linhaMeta.getCell(numCols - 2).font = { bold: true, color: { argb: 'FF00B050' } }
    linhaMeta.getCell(numCols - 1).value = totalEmp
    linhaMeta.getCell(numCols - 1).numFmt = '#,##0.00'
    linhaMeta.getCell(numCols - 1).font = { bold: true }

    const linhaLuc = sheet.getRow(35)
    linhaLuc.getCell(numCols - 2).value = 'LUC'
    linhaLuc.getCell(numCols - 2).font = { bold: true, color: { argb: 'FFFF9900' } }
    linhaLuc.getCell(numCols - 1).value = lucroEmp
    linhaLuc.getCell(numCols - 1).numFmt = '#,##0.00'
    linhaLuc.getCell(numCols - 1).font = { bold: true, color: { argb: lucroEmp >= 0 ? 'FF00B050' : 'FFFF0000' } }

    resultado[emp.nome.toUpperCase()] = { fat: totalEmp, luc: lucroEmp }
  }

  // Sheet de resultado
  const sheetRes = wb.addWorksheet(`RESULTADO ${tipo.toUpperCase()} MES`)
  const empsOrdem = empsTyped.map(e => e.nome.toUpperCase())

  const cellTitulo = sheetRes.getRow(1).getCell(1)
  cellTitulo.value = `${mesLabel} - ${tipo.toUpperCase()}`
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
    linhaFat.getCell(col + 1).font = { bold: true, color: { argb: 'FF00B050' } }

    const cellLuc = linhaLucRes.getCell(col)
    cellLuc.value = dados.luc
    cellLuc.numFmt = '#,##0.00'
    cellLuc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + COR_RESULTADO_LUC } }
    linhaLucRes.getCell(col + 1).value = 'LUC'
    linhaLucRes.getCell(col + 1).font = { bold: true, color: { argb: 'FFFF9900' } }
  })

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
  linhaTotalLuc.getCell(2).font = { bold: true, color: { argb: totalLucGeral >= 0 ? 'FF00B050' : 'FFFF0000' } }

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

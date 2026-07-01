/**
 * Parser para planilhas COFERENCIA DE CUSTOS — categorias por apartamento.
 * Espelha a lógica de /api/import/route.ts
 */
import * as XLSX from 'xlsx'
import { normalize, parseNumero, arredondar, extrairNumeroApt } from '../lib/xlsx-parser'

/** Parse valores monetários das planilhas (inclui "R$ 2.075.87") */
function parseValorPlanilha(raw: unknown): number {
  if (raw == null) return NaN
  if (typeof raw === 'number') return raw
  const s = String(raw).replace(/R\$/gi, '').trim()
  if (!s) return NaN
  if (s.includes(',')) return parseNumero(raw)
  const parts = s.split('.')
  if (parts.length > 2) {
    const cents = parts.pop()!
    return parseFloat(`${parts.join('')}.${cents}`)
  }
  return parseFloat(s)
}

export interface ParsedCusto {
  apartamento_id: string
  empreendimento: string
  numero: string
  categoria: string
  valor: number
}

interface ColApartamento {
  colIdx: number
  apartamento_id: string
  numero: string
}

const APT_ALIASES: Record<string, Record<string, string>> = {
  CULLINAN: { '218': '218C', '404': '404C' },
  ATHOS: { '19': '19M' },
}

function resolverEmpId(sheetName: string, empMap: Record<string, string>): string | undefined {
  const upper = sheetName.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (empMap[upper]) return empMap[upper]
  const aliases: Record<string, string> = { AMAZE: 'AMEZE' }
  if (aliases[upper] && empMap[aliases[upper]]) return empMap[aliases[upper]]
  for (const [nomeEmp, id] of Object.entries(empMap)) {
    const nomeNorm = nomeEmp.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (upper.includes(nomeNorm) || nomeNorm.includes(upper)) return id
  }
  return undefined
}

function resolverAptId(
  empId: string,
  aptNum: string,
  aptMap: Record<string, string>,
  empNome: string
): string | undefined {
  let n = normalize(aptNum)
  const alias = APT_ALIASES[empNome.toUpperCase()]?.[n]
  if (alias) n = normalize(alias)
  if (aptMap[`${empId}::${n}`]) return aptMap[`${empId}::${n}`]
  const spaced = normalize(aptNum.replace(/\s*-\s*/g, ' - '))
  if (aptMap[`${empId}::${spaced}`]) return aptMap[`${empId}::${spaced}`]
  if (aptNum.includes('-')) {
    for (const part of aptNum.split('-').map(p => normalize(p.trim()))) {
      if (aptMap[`${empId}::${part}`]) return aptMap[`${empId}::${part}`]
    }
  }
  return undefined
}

function extrairColunasApartamento(
  rows: unknown[][],
  empreendimento_id: string,
  aptMap: Record<string, string>,
  empNome: string
): ColApartamento[] {
  for (let rowIdx = 0; rowIdx < Math.min(10, rows.length); rowIdx++) {
    const row = rows[rowIdx]
    if (!row) continue
    const candidatos: ColApartamento[] = []
    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = row[colIdx]
      if (cell == null) continue
      if (typeof cell !== 'string' && typeof cell !== 'number') continue
      const cellStr = String(cell).trim()
      if (!cellStr || cellStr.toLowerCase() === 'descrição' || cellStr.toLowerCase() === 'descricao') continue
      const aptNum = extrairNumeroApt(cellStr) ?? (cellStr.includes('-') && cellStr.length > 2 ? cellStr : null)
      if (!aptNum || aptNum === '-') continue
      const apartamento_id = resolverAptId(empreendimento_id, aptNum, aptMap, empNome)
      if (apartamento_id) candidatos.push({ colIdx, apartamento_id, numero: aptNum })
    }
    if (candidatos.length >= 1) return candidatos
  }
  return []
}

function encontrarLinhaTotais(rows: unknown[][], aptCols: ColApartamento[]): number {
  const keywordIdx = rows.findIndex(row => {
    if (!row) return false
    return row.some(cell => {
      if (cell == null) return false
      const s = String(cell).trim().toUpperCase().replace(/:$/, '').replace(/\s+/g, '')
      return s.startsWith('TOTAL') || s.startsWith('SOMA') || s === 'SUBTOTAL'
    })
  })
  if (keywordIdx >= 0) return keywordIdx
  if (aptCols.length > 0) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]
      if (!row) continue
      if (aptCols.some(({ colIdx }) => {
        const v = parseValorPlanilha(row[colIdx])
        return !isNaN(v) && v > 0
      })) return i
    }
  }
  return -1
}

export function parseConferenciaCustos(
  workbook: XLSX.WorkBook,
  empMap: Record<string, string>,
  aptMap: Record<string, string>,
  empNames: Record<string, string>
): ParsedCusto[] {
  const result: ParsedCusto[] = []
  const sheets = workbook.SheetNames.filter(
    n => !n.toUpperCase().includes('RESULTADO') && !n.toUpperCase().includes('RESUMO')
  )

  for (const sheetName of sheets) {
    const empId = resolverEmpId(sheetName, empMap)
    if (!empId) {
      console.warn(`[custos] "${sheetName}" — empreendimento não encontrado`)
      continue
    }
    const empNome = empNames[empId] ?? sheetName
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1, defval: null, raw: true,
    }) as unknown[][]
    if (!rows || rows.length < 2) continue

    const aptCols = extrairColunasApartamento(rows, empId, aptMap, empNome)
    const totalRowIdx = encontrarLinhaTotais(rows, aptCols)
    if (totalRowIdx < 0 || aptCols.length === 0) {
      console.warn(`[custos] "${sheetName}" — sem totais (${aptCols.length} apts)`)
      continue
    }

    let headerRowIdx = 0
    outer: for (let ri = 0; ri < Math.min(10, rows.length); ri++) {
      const row = rows[ri]
      if (!row) continue
      for (const { colIdx } of aptCols) {
        const cell = row[colIdx]
        if (cell != null && extrairNumeroApt(String(cell).trim())) {
          headerRowIdx = ri
          break outer
        }
      }
    }

    const numerosColuna = aptCols.map(c => normalize(c.numero))
    const skipIndividual = new Set<string>()
    if (empNome.toUpperCase() === 'METROPOLITAN') {
      const has1615 = numerosColuna.some(n => n.includes('1615A') && n.includes('-'))
      const has1701 = numerosColuna.some(n => n.includes('1701') && n.includes('-'))
      if (has1615) { skipIndividual.add(normalize('1615')); skipIndividual.add(normalize('1615A')) }
      if (has1701) { skipIndividual.add(normalize('1701')); skipIndividual.add(normalize('1701A')) }
    }

    for (const { colIdx, apartamento_id, numero } of aptCols) {
      if (skipIndividual.has(normalize(numero))) continue

      for (let ri = headerRowIdx + 1; ri < totalRowIdx; ri++) {
        const row = rows[ri]
        if (!row) continue
        const rawVal = row[colIdx]
        const rawDesc = row[colIdx + 1]
        const descStr = String(rawDesc ?? '').trim()
        if (!descStr || descStr === '-') continue
        if (/^R?\$?\s*[\d.,]+$/.test(descStr)) continue

        const valor = arredondar(parseValorPlanilha(rawVal))
        if (isNaN(valor) || valor <= 0) continue

        result.push({
          apartamento_id,
          empreendimento: empNome,
          numero,
          categoria: descStr,
          valor,
        })
      }
    }
  }
  return result
}

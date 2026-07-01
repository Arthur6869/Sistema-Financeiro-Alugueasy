/**
 * Parser robusto para planilhas COFERENCIA DE DIARIAS — totais por apt na linha 30.
 */
import * as XLSX from 'xlsx'
import { normalize, parseNumero, arredondar, extrairNumeroApt } from '../lib/xlsx-parser'

export interface ParsedApt {
  empreendimento: string
  numero: string
  apartamento_id: string
  valor: number
}

function resolverEmpId(sheetName: string, empMap: Record<string, string>): string | undefined {
  const upper = sheetName.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (empMap[upper]) return empMap[upper]
  // Aliases comuns
  const aliases: Record<string, string> = { AMAZE: 'AMEZE' }
  if (aliases[upper] && empMap[aliases[upper]]) return empMap[aliases[upper]]
  for (const [nomeEmp, id] of Object.entries(empMap)) {
    const nomeNorm = nomeEmp.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (upper.includes(nomeNorm) || nomeNorm.includes(upper)) return id
  }
  return undefined
}

/** Aliases planilha → número no banco, por empreendimento */
const APT_ALIASES: Record<string, Record<string, string>> = {
  CULLINAN: { '218': '218C', '404': '404C' },
  ATHOS: { '19': '19M' },
}

/** Tenta mapear número da planilha para apartamento_id */
function resolverAptId(
  empId: string,
  aptNum: string,
  aptMap: Record<string, string>,
  empNome: string
): string | undefined {
  let n = normalize(aptNum)
  const alias = APT_ALIASES[empNome.toUpperCase()]?.[n]
  if (alias) n = normalize(alias)

  // Tentativa exata (inclui "1615A-1615" como apt combinado)
  const exactKey = `${empId}::${n}`
  if (aptMap[exactKey]) return aptMap[exactKey]

  // Chave com espaços ao redor de hífen: "1615A - 1615"
  const spaced = normalize(aptNum.replace(/\s*-\s*/g, ' - '))
  if (aptMap[`${empId}::${spaced}`]) return aptMap[`${empId}::${spaced}`]

  // Partes separadas por hífen — só se não existir apt combinado
  if (aptNum.includes('-') && !aptMap[`${empId}::${n}`]) {
    for (const part of aptNum.split('-').map(p => normalize(p.trim()))) {
      const id = aptMap[`${empId}::${part}`]
      if (id) return id
    }
  }
  return undefined
}

export function parseConferenciaDiarias(
  workbook: XLSX.WorkBook,
  empMap: Record<string, string>,
  aptMap: Record<string, string>,
  empNames: Record<string, string>
): ParsedApt[] {
  const result: ParsedApt[] = []
  const seen = new Set<string>()

  // Empreendimentos válidos = os listados na aba RESULTADO (fonte de verdade do fechamento)
  const resultadoNome = [...workbook.SheetNames]
    .reverse()
    .find(n => n.toUpperCase().includes('RESULTADO'))
  const empIdsPermitidos = new Set<string>()
  if (resultadoNome) {
    const resRows = XLSX.utils.sheet_to_json(workbook.Sheets[resultadoNome], {
      header: 1, defval: null, raw: true,
    }) as unknown[][]
    for (let ri = 0; ri < Math.min(6, resRows.length); ri++) {
      const row = resRows[ri]
      if (!row) continue
      const candidatos: string[] = []
      for (const cell of row) {
        if (cell == null || typeof cell === 'number') continue
        const empId = resolverEmpId(String(cell), empMap)
        if (empId) candidatos.push(empId)
      }
      if (candidatos.length >= 2) {
        candidatos.forEach(id => empIdsPermitidos.add(id))
        break
      }
    }
  }

  const sheets = workbook.SheetNames.filter(
    n => !n.toUpperCase().includes('RESULTADO') && !n.toUpperCase().includes('RESUMO')
  )

  for (const sheetName of sheets) {
    const empId = resolverEmpId(sheetName, empMap)
    if (!empId) {
      console.warn(`[conferencia] "${sheetName}" — empreendimento não encontrado`)
      continue
    }
    if (empIdsPermitidos.size > 0 && !empIdsPermitidos.has(empId)) {
      console.log(`[conferencia] "${sheetName}" — fora do RESULTADO, ignorado`)
      continue
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      raw: true,
    }) as unknown[][]

    if (!rows.length) continue

    // Cabeçalho de apts: preferir linha 2 (index 1), fallback scan primeiras 10 linhas
    let headerRowIdx = -1
    let aptCols: Array<{ colIdx: number; numero: string }> = []

    for (let ri = 0; ri < Math.min(10, rows.length); ri++) {
      const row = rows[ri]
      if (!row) continue
      const candidatos: Array<{ colIdx: number; numero: string }> = []
      for (let ci = 0; ci < row.length; ci++) {
        const cell = row[ci]
        if (cell == null) continue
        const str = String(cell).trim()
        if (!str) continue
        const aptNum = extrairNumeroApt(str) ?? (str.includes('-') && str.length > 2 ? str : null)
        if (!aptNum || aptNum === '-') continue
        // Ignorar labels de legenda
        if (/^(booking|airbnb|alugueasy)$/i.test(str)) continue
        const aptId = resolverAptId(empId, aptNum, aptMap, empNames[empId] ?? sheetName)
        if (aptId) candidatos.push({ colIdx: ci, numero: aptNum })
      }
      if (candidatos.length > aptCols.length) {
        aptCols = candidatos
        headerRowIdx = ri
      }
    }

    if (aptCols.length === 0) {
      console.warn(`[conferencia] "${sheetName}" — nenhuma coluna de apt encontrada`)
      continue
    }

    // Linha de totais: preferir linha imediatamente acima da linha "TOTAL"
    let totalRowIdx = -1
    for (let ri = headerRowIdx + 1; ri < rows.length; ri++) {
      const row = rows[ri]
      if (!row) continue
      const isTotal = row.some(cell => {
        const s = String(cell ?? '').trim().toUpperCase().replace(/:$/, '')
        return s === 'TOTAL' || s.startsWith('TOTAL')
      })
      if (isTotal && ri > 0) {
        totalRowIdx = ri - 1
        break
      }
    }
    if (totalRowIdx < 0) {
      // Fallback: linha 30 (index 29) ou última com valores nas colunas de apt
      totalRowIdx = Math.min(29, rows.length - 1)
      let bestScore = -1
      for (let ri = Math.max(headerRowIdx + 1, 20); ri < Math.min(rows.length, 40); ri++) {
        const row = rows[ri]
        if (!row) continue
        let score = 0
        for (const { colIdx } of aptCols) {
          const v = parseNumero(row[colIdx])
          if (!isNaN(v) && v > 100) score++
        }
        if (score > bestScore) {
          bestScore = score
          totalRowIdx = ri
        }
      }
    }
    const totalRow = rows[totalRowIdx]

    const empNome = empNames[empId] ?? sheetName
    const numerosColuna = aptCols.map(c => normalize(c.numero))

    // METROPOLITAN: se existem unidades combinadas, não importar apts individuais duplicados
    const skipIndividual = new Set<string>()
    if (empNome.toUpperCase() === 'METROPOLITAN') {
      const hasCombined1615 = numerosColuna.some(n => n.includes('1615A') && n.includes('1615') && n.includes('-'))
      const hasCombined1701 = numerosColuna.some(n => n.includes('1701') && n.includes('-'))
      if (hasCombined1615) { skipIndividual.add(normalize('1615')); skipIndividual.add(normalize('1615A')) }
      if (hasCombined1701) { skipIndividual.add(normalize('1701')); skipIndividual.add(normalize('1701A')) }
    }

    for (const { colIdx, numero } of aptCols) {
      const valor = arredondar(parseNumero(totalRow[colIdx]))
      if (isNaN(valor) || valor <= 0) continue

      if (skipIndividual.has(normalize(numero))) continue

      const aptId = resolverAptId(empId, numero, aptMap, empNome)!
      const key = `${aptId}`
      if (seen.has(key)) continue // evita duplicata de colunas repetidas
      seen.add(key)

      result.push({ empreendimento: empNome, numero, apartamento_id: aptId, valor })
    }
  }

  return result
}

/**
 * xlsx-parser.ts
 * Helpers compartilhados para parsing de planilhas de conferência AlugEasy.
 * Usados por /api/import e /api/sync-local.
 */

import * as XLSX from 'xlsx'

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ColApartamento {
  colIdx: number
  apartamento_id: string
  numero: string
}

export interface PlanilhaApartamento {
  apartamento_id: string
  valor: number
}

export interface ParsedPlanilha {
  totalGeral: number
  porApartamento: PlanilhaApartamento[]
}

// ─── Helpers básicos ──────────────────────────────────────────────────────────

/** Normaliza número de apartamento para comparação: remove espaços, maiúsculo */
export function normalize(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, '')
}

/** Converte valor bruto (número ou string) para float */
export function parseNumero(raw: unknown): number {
  if (raw == null) return NaN
  if (typeof raw === 'number') return raw
  const s = String(raw).replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
  return parseFloat(s)
}

/** Arredonda para 2 casas decimais */
export function arredondar(v: number): number {
  return Math.round(v * 100) / 100
}

// ─── Detecção de colunas de apartamentos ─────────────────────────────────────

/**
 * Tenta extrair o número do apartamento de uma string de célula.
 * Exemplos reconhecidos: "APT 204", "Apt204", "204", "A 104", "D 137", "1615A"
 */
export function extrairNumeroApt(cell: string): string | null {
  const s = cell.trim()
  const mApt = s.match(/^apt\s*(\S+.*)$/i)
  if (mApt) return mApt[1].trim()
  // Número puro (célula numérica do Excel): "204", "1419", "11"
  if (/^\d+$/.test(s)) return s
  // Alfanumérico curto: "A 104", "D 137", "1615A", "A113"
  if (s.length <= 10 && /^[A-Za-z]?\s*\d/.test(s)) return s
  return null
}

/**
 * Varre as primeiras linhas da planilha em busca de uma linha de cabeçalho
 * que contenha números de apartamentos e retorna as colunas encontradas.
 */
export function extrairColunasApartamento(
  rows: unknown[][],
  empreendimento_id: string,
  aptMap: Record<string, string>
): ColApartamento[] {
  const resultado: ColApartamento[] = []

  for (let rowIdx = 0; rowIdx < Math.min(10, rows.length); rowIdx++) {
    const row = rows[rowIdx]
    if (!row) continue

    const candidatos: ColApartamento[] = []

    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = row[colIdx]
      if (cell == null) continue
      if (typeof cell !== 'string' && typeof cell !== 'number') continue
      const cellStr = String(cell).trim()
      if (!cellStr) continue

      const aptNum = extrairNumeroApt(cellStr)
      if (!aptNum) continue

      const key = `${empreendimento_id}::${normalize(aptNum)}`
      const apartamento_id = aptMap[key]
      if (apartamento_id) {
        candidatos.push({ colIdx, apartamento_id, numero: aptNum })
      }
    }

    if (candidatos.length >= 1) {
      resultado.push(...candidatos)
      break
    }
  }

  return resultado
}

/**
 * Encontra a linha de totais usando 3 estratégias em cascata:
 * 1. Palavra-chave TOTAL / SOMA em qualquer célula
 * 2. Última linha com valores numéricos nas colunas de apartamento
 * 3. Retorna -1 se não encontrar
 */
export function encontrarLinhaTotais(
  rows: unknown[][],
  aptCols: ColApartamento[]
): number {
  const keywordIdx = rows.findIndex((row) => {
    if (!row) return false
    return row.some((cell) => {
      if (cell == null) return false
      const s = String(cell).trim().toUpperCase().replace(/\s+/g, '')
      return s.startsWith('TOTAL') || s.startsWith('SOMA') || s === 'SUBTOTAL'
    })
  })
  if (keywordIdx >= 0) return keywordIdx

  if (aptCols.length > 0) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i]
      if (!row) continue
      const temValor = aptCols.some(({ colIdx }) => {
        const v = parseNumero(row[colIdx])
        return !isNaN(v) && v > 0
      })
      if (temValor) return i
    }
  }

  return -1
}

// ─── Parser da aba de Resultado (fonte de verdade para sync) ─────────────────

/**
 * Lê a aba de resultado (última aba ou a que contém "RESULTADO" no nome)
 * e extrai os totais por apartamento.
 *
 * A aba de resultado é a fonte de verdade para a verificação local:
 * contém os valores mensais finais conferidos ("RESULTADO ADM MES", etc.)
 *
 * Estratégia de parsing:
 *   1. Tenta detectar apartamentos em colunas (mesmo padrão das abas individuais)
 *      usando um mapa combinado sem prefixo de empreendimento.
 *   2. Se não encontrar colunas, tenta leitura por linhas:
 *      cada linha = [emp_name?, apt_num, ..., valor_final]
 *   3. Se nenhuma encontrar, lê apenas o TOTAL geral da linha "TOTAL"
 *      e o associa ao primeiro apartamento de cada empreendimento (fallback).
 *
 * @param workbook      Workbook XLSX já carregado
 * @param empMap        Mapa { NOME_EMP_UPPER → empreendimento_id }
 * @param aptMap        Mapa { emp_id::NUM_UPPER → apartamento_id }
 * @param firstAptByEmp Mapa { emp_id → primeiro apartamento_id (fallback) }
 */
export function parsePlanilhaResultado(
  workbook: XLSX.WorkBook,
  empMap: Record<string, string>,
  _aptMap: Record<string, string>,
  firstAptByEmp: Record<string, string>
): ParsedPlanilha {
  // ── 1. Localizar a aba de resultado ──────────────────────────────────────
  // Preferência: última aba que contenha "RESULTADO" no nome.
  // Fallback: última aba do workbook.
  const nomes = workbook.SheetNames
  const resultadoNome =
    [...nomes].reverse().find(n => n.toUpperCase().includes('RESULTADO')) ??
    nomes[nomes.length - 1]

  console.log(`[xlsx-parser:resultado] Usando aba "${resultadoNome}"`)

  const worksheet = workbook.Sheets[resultadoNome]
  if (!worksheet) return { totalGeral: 0, porApartamento: [] }

  // raw: true → retorna números diretamente, evitando problemas de formatação de moeda
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]

  if (!rows || rows.length < 2) return { totalGeral: 0, porApartamento: [] }

  // ── Helper: normaliza string para comparação ──────────────────────────────
  const norm = (s: unknown): string =>
    String(s ?? '').trim().toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  // ── Helper: tenta associar texto de célula a um empreendimento_id ─────────
  const resolverEmpId = (cell: unknown): string | null => {
    const cellNorm = norm(cell)
    if (!cellNorm) return null
    // Busca exata
    if (empMap[cellNorm]) return empMap[cellNorm]
    // Busca parcial (empreendimento contém o texto da célula ou vice-versa)
    for (const [empNome, empId] of Object.entries(empMap)) {
      const empNorm = norm(empNome)
      if (cellNorm === empNorm) return empId
      if (cellNorm.includes(empNorm) || empNorm.includes(cellNorm)) return empId
    }
    return null
  }

  // ── 2. Encontrar linha de cabeçalho de empreendimentos ───────────────────
  // Estrutura esperada: [ESSENCE, "", EASY, "", CULLINAN, "", ...]
  // A linha com ≥ 2 células que casam com nomes de empreendimentos é o cabeçalho.
  let headerRowIdx = -1
  const empColMap: Record<number, string> = {} // colIdx → empreendimento_id

  for (let rowIdx = 0; rowIdx < Math.min(6, rows.length); rowIdx++) {
    const row = rows[rowIdx]
    if (!row) continue
    const candidatos: Record<number, string> = {}

    for (let c = 0; c < row.length; c++) {
      const empId = resolverEmpId(row[c])
      if (empId) candidatos[c] = empId
    }

    if (Object.keys(candidatos).length >= 2) {
      headerRowIdx = rowIdx
      Object.assign(empColMap, candidatos)
      console.log(`[xlsx-parser:resultado] Cabeçalho de empreendimentos na linha ${rowIdx}: ${Object.keys(candidatos).length} encontrados`)
      break
    }
  }

  if (headerRowIdx === -1) {
    console.warn(`[xlsx-parser:resultado] Cabeçalho de empreendimentos não encontrado`)
    return { totalGeral: 0, porApartamento: [] }
  }

  // ── 3. Encontrar a linha FAT ──────────────────────────────────────────────
  // Procura nas próximas linhas aquela que contenha ≥ 1 célula igual a "FAT"
  // (as células de label ficam nas colunas ímpares, adjacentes aos valores).
  let fatRowIdx = -1

  for (let rowIdx = headerRowIdx + 1; rowIdx < Math.min(headerRowIdx + 6, rows.length); rowIdx++) {
    const row = rows[rowIdx]
    if (!row) continue
    const temFAT = row.some(cell => norm(cell) === 'FAT')
    if (temFAT) {
      fatRowIdx = rowIdx
      console.log(`[xlsx-parser:resultado] Linha FAT encontrada na linha ${rowIdx}`)
      break
    }
  }

  if (fatRowIdx === -1) {
    console.warn(`[xlsx-parser:resultado] Linha FAT não encontrada`)
    return { totalGeral: 0, porApartamento: [] }
  }

  // ── 4. Extrair FAT por empreendimento → firstAptByEmp ────────────────────
  // Para cada empreendimento do cabeçalho: lê o valor na mesma coluna da linha FAT.
  const fatRow = rows[fatRowIdx]
  const porApartamento: PlanilhaApartamento[] = []
  const vistosEmpId = new Set<string>()

  for (const [colIdxStr, empId] of Object.entries(empColMap)) {
    if (vistosEmpId.has(empId)) continue
    const colIdx = parseInt(colIdxStr)
    const valor = arredondar(parseNumero(fatRow[colIdx]))

    if (isNaN(valor) || valor <= 0) {
      console.warn(`[xlsx-parser:resultado] Emp ${empId} col ${colIdx}: valor inválido (${fatRow[colIdx]})`)
      continue
    }

    const aptId = firstAptByEmp[empId]
    if (!aptId) {
      console.warn(`[xlsx-parser:resultado] Emp ${empId}: sem apartamento cadastrado no banco — ignorado`)
      continue
    }

    porApartamento.push({ apartamento_id: aptId, valor })
    vistosEmpId.add(empId)
  }

  const totalGeral = arredondar(porApartamento.reduce((acc, r) => acc + r.valor, 0))
  console.log(`[xlsx-parser:resultado] Total FAT extraído: R$ ${totalGeral} (${porApartamento.length} empreendimentos)`)
  return { totalGeral, porApartamento }
}

// ─── Parser principal (abas individuais por empreendimento) ───────────────────

/**
 * Parseia um workbook xlsx iterando pelas abas de empreendimento
 * (ignora abas RESULTADO/RESUMO). Usado como fallback quando a aba
 * de resultado não tem granularidade por apartamento.
 *
 * @param workbook     Workbook XLSX já carregado
 * @param empMap       Mapa { NOME_EMP_UPPER → empreendimento_id }
 * @param aptMap       Mapa { emp_id::NUM_UPPER → apartamento_id }
 * @param firstAptByEmp Mapa { emp_id → primeiro apartamento_id (fallback) }
 */
export function parsePlanilhaTotais(
  workbook: XLSX.WorkBook,
  empMap: Record<string, string>,
  aptMap: Record<string, string>,
  firstAptByEmp: Record<string, string>
): ParsedPlanilha {
  const porApartamento: PlanilhaApartamento[] = []

  function resolverEmpId(sheetName: string): string | undefined {
    const upper = sheetName.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (empMap[upper]) return empMap[upper]
    for (const [nomeEmp, id] of Object.entries(empMap)) {
      const nomeNorm = nomeEmp.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (upper.includes(nomeNorm) || nomeNorm.includes(upper)) return id
    }
    return undefined
  }

  const sheetsToProcess = workbook.SheetNames.filter(name =>
    !name.toUpperCase().includes('RESULTADO') &&
    !name.toUpperCase().includes('RESUMO')
  )

  for (const sheetName of sheetsToProcess) {
    const empreendimento_id = resolverEmpId(sheetName)
    if (!empreendimento_id) {
      console.warn(`[xlsx-parser] "${sheetName}" não encontrado no banco — ignorado`)
      continue
    }

    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as unknown[][]

    if (!rows || rows.length < 2) continue

    const aptCols = extrairColunasApartamento(rows, empreendimento_id, aptMap)
    const totalRowIdx = encontrarLinhaTotais(rows, aptCols)

    if (aptCols.length > 0 && totalRowIdx >= 0) {
      const totalRow = rows[totalRowIdx]
      for (const { colIdx, apartamento_id } of aptCols) {
        const raw = totalRow[colIdx] ?? totalRow[colIdx + 1] ?? totalRow[colIdx - 1]
        const valor = arredondar(parseNumero(raw))
        if (!isNaN(valor) && valor > 0) {
          porApartamento.push({ apartamento_id, valor })
        }
      }
    } else if (aptCols.length === 0 && totalRowIdx >= 0) {
      // Fallback: total consolidado no primeiro apartamento do empreendimento
      const totalRow = rows[totalRowIdx]
      let valor = NaN
      for (let c = 1; c < totalRow.length; c++) {
        const v = arredondar(parseNumero(totalRow[c]))
        if (!isNaN(v) && v > 0) { valor = v; break }
      }
      if (!isNaN(valor)) {
        const apartamento_id = firstAptByEmp[empreendimento_id]
        if (apartamento_id) {
          porApartamento.push({ apartamento_id, valor })
        }
      }
    } else {
      console.warn(`[xlsx-parser] Linha de totais não encontrada em "${sheetName}" — aba ignorada`)
    }
  }

  const totalGeral = arredondar(porApartamento.reduce((acc, r) => acc + r.valor, 0))
  return { totalGeral, porApartamento }
}

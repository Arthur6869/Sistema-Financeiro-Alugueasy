import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { parsePlanilhaResultado, parsePlanilhaTotais } from '@/lib/xlsx-parser'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Usuário não autenticado. Faça login novamente.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'analista') {
      return NextResponse.json({ error: 'Apenas analistas podem importar planilhas' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const tipo = formData.get('tipo') as string
    const mesParam = formData.get('mes') as string
    const anoParam = formData.get('ano') as string

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }
    if (!['custos_adm', 'custos_sub', 'diarias_adm', 'diarias_sub'].includes(tipo)) {
      return NextResponse.json({
        error: 'Tipo inválido. Use custos_adm, custos_sub, diarias_adm ou diarias_sub.'
      }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'csv'].includes(ext ?? '')) {
      return NextResponse.json({ error: 'Formato inválido. Envie um arquivo .xlsx ou .csv' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })

    const mes = mesParam ? parseInt(mesParam) : new Date().getMonth() + 1
    const ano = anoParam ? parseInt(anoParam) : new Date().getFullYear()
    const data_registro = `${ano}-${String(mes).padStart(2, '0')}-01`
    const tipo_gestao = tipo.includes('adm') ? 'adm' : 'sub'

    const { data: allEmpreendimentos } = await supabase
      .from('empreendimentos')
      .select('id, nome')

    const { data: allApartamentos } = await supabase
      .from('apartamentos')
      .select('id, numero, empreendimento_id, tipo_gestao')
      .order('empreendimento_id')

    if (!allEmpreendimentos || !allApartamentos) {
      return NextResponse.json({ error: 'Erro ao carregar dados do banco' }, { status: 500 })
    }

    // Mapa: NOME_EMP_UPPER → empreendimento_id (exato)
    const empMap: Record<string, string> = {}
    allEmpreendimentos.forEach(e => { empMap[e.nome.toUpperCase()] = e.id })

    /**
     * Resolve empreendimento_id a partir do nome de uma aba da planilha.
     * Tenta correspondência exata primeiro, depois parcial (a aba contém
     * o nome do empreendimento ou vice-versa). Ex:
     *   "BRISAS DO LAGO" → encontra "BRISAS"
     *   "ATHOS BULCÃO"   → encontra "ATHOS"
     */
    function resolverEmpId(sheetName: string): string | undefined {
      const upper = sheetName.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      // 1. Exato
      if (empMap[upper]) return empMap[upper]
      // 2. Parcial: nome do banco está contido no nome da aba
      for (const [nomeEmp, id] of Object.entries(empMap)) {
        const nomeNorm = nomeEmp.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (upper.includes(nomeNorm) || nomeNorm.includes(upper)) return id
      }
      return undefined
    }

    // Mapa: empreendimento_id::NUMERO_NORMALIZADO → apartamento_id
    const aptMap: Record<string, string> = {}
    allApartamentos.forEach(a => {
      aptMap[`${a.empreendimento_id}::${normalizar(a.numero)}`] = a.id
    })

    // Mapa: empreendimento_id → primeiro apartamento_id (fallback)
    const firstAptByEmp: Record<string, string> = {}
    allApartamentos.forEach(a => {
      if (!firstAptByEmp[a.empreendimento_id]) {
        firstAptByEmp[a.empreendimento_id] = a.id
      }
    })

    // Mapa tipo_gestao-aware: prefere apt que bate o tipo da importação.
    // Ex: diarias_adm para BRISAS escolhe E016 (adm), não A117 (sub).
    // Fallback para firstAptByEmp quando não há apt do tipo certo.
    const firstAptByEmpTipo: Record<string, string> = {}
    allApartamentos.forEach(a => {
      if (a.tipo_gestao === tipo_gestao && !firstAptByEmpTipo[a.empreendimento_id]) {
        firstAptByEmpTipo[a.empreendimento_id] = a.id
      }
    })
    Object.entries(firstAptByEmp).forEach(([empId, aptId]) => {
      if (!firstAptByEmpTipo[empId]) firstAptByEmpTipo[empId] = aptId
    })

    const diariasToInsert: DiariaInsert[] = []
    const sheetsIgnorados: string[] = []
    let custosCount = 0

    // =====================================================================
    // CUSTOS — um registro por unidade (valor = subtotal da coluna)
    // Algoritmo: lê a linha imediatamente acima de "TOTAL:" como subtotal
    // por unidade. Valida soma das unidades ≈ total da aba (tol. R$ 0,05).
    // =====================================================================
    if (tipo.startsWith('custos')) {
      type CostItem = { apartamento_id: string; numero: string; categoria: string; valor: number; sheet: string }
      const allItems: CostItem[] = []
      const divergencias: Array<{ sheet: string; erro: string }> = []

      const sheetsToProcess = workbook.SheetNames.filter(name =>
        !name.toUpperCase().includes('RESULTADO') &&
        !name.toUpperCase().includes('RESUMO')
      )

      console.log(`[CUSTOS] Abas a processar: ${sheetsToProcess.join(', ')}`)

      for (const sheetName of sheetsToProcess) {
        const empreendimento_id = resolverEmpId(sheetName)
        if (!empreendimento_id) {
          console.warn(`[CUSTOS] "${sheetName}" não encontrado no banco — ignorado`)
          sheetsIgnorados.push(sheetName)
          continue
        }

        const worksheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as unknown[][]
        if (!rows || rows.length < 4) { sheetsIgnorados.push(sheetName); continue }

        // 1. Linha de cabeçalho: primeira linha 0-7 com célula começando em "Descri"
        let headerRowIdx = -1
        for (let ri = 0; ri < Math.min(8, rows.length); ri++) {
          const row = rows[ri]
          if (!row) continue
          if (row.some(c => typeof c === 'string' && c.trim().toLowerCase().startsWith('descri'))) {
            headerRowIdx = ri
            break
          }
        }

        // 2. Colunas de unidade: col c onde col c+1 começa com "Descri"
        let unitCols: ColApartamento[] = []
        const aptNaoNoBanco: string[] = []
        if (headerRowIdx >= 0) {
          const hRow = rows[headerRowIdx]
          for (let c = 0; c < hRow.length - 1; c++) {
            const next = hRow[c + 1]
            if (typeof next !== 'string' || !next.trim().toLowerCase().startsWith('descri')) continue
            const cellVal = hRow[c]
            if (cellVal == null) continue
            const aptNum = extrairNumeroApt(String(cellVal).trim())
            if (!aptNum) continue
            const key = `${empreendimento_id}::${normalizar(aptNum)}`
            const apartamento_id = aptMap[key]
            if (apartamento_id) {
              unitCols.push({ colIdx: c, apartamento_id, numero: aptNum })
            } else {
              aptNaoNoBanco.push(aptNum)
            }
          }
        }

        // Fallback: detectar unidades por número de apartamento na linha de cabeçalho
        if (unitCols.length === 0) {
          unitCols = extrairColunasApartamento(rows, empreendimento_id, aptMap)
          if (unitCols.length > 0 && headerRowIdx < 0) {
            outerLoop: for (let ri = 0; ri < Math.min(10, rows.length); ri++) {
              const row = rows[ri]
              if (!row) continue
              for (const { colIdx } of unitCols) {
                const cell = row[colIdx]
                if (cell != null && extrairNumeroApt(String(cell).trim())) {
                  headerRowIdx = ri
                  break outerLoop
                }
              }
            }
          }
        }

        if (unitCols.length === 0) {
          console.warn(`[CUSTOS] "${sheetName}" — nenhuma coluna de unidade encontrada`)
          sheetsIgnorados.push(sheetName)
          continue
        }

        // 3. Linha TOTAL: (primeira após o cabeçalho com célula começando em "TOTAL")
        let totalRowIdx = -1
        for (let ri = Math.max(1, headerRowIdx + 1); ri < rows.length; ri++) {
          const row = rows[ri]
          if (!row) continue
          if (row.some(c => c != null && String(c).trim().toUpperCase().startsWith('TOTAL'))) {
            totalRowIdx = ri
            break
          }
        }

        if (totalRowIdx < 0) {
          console.warn(`[CUSTOS] "${sheetName}" — linha TOTAL não encontrada`)
          sheetsIgnorados.push(sheetName)
          continue
        }

        // 4. Linha de subtotal = imediatamente acima de TOTAL:
        const subtotalRowIdx = totalRowIdx - 1
        if (subtotalRowIdx <= headerRowIdx) {
          console.warn(`[CUSTOS] "${sheetName}" — TOTAL muito próximo do cabeçalho`)
          sheetsIgnorados.push(sheetName)
          continue
        }

        const subtotalRow = rows[subtotalRowIdx] ?? []
        const totalRow    = rows[totalRowIdx]    ?? []

        // 5a. Ler subtotais por unidade (linha acima de TOTAL) — usados para validação.
        const subtotalPorApt: Record<string, number> = {}
        let temSubtotalInvalido = false
        for (const { colIdx, apartamento_id, numero } of unitCols) {
          const raw   = subtotalRow[colIdx]
          const valor = arredondar(parseMoneyBR(raw))
          if (isNaN(valor)) {
            console.warn(`[CUSTOS] ${sheetName} apt ${numero}: subtotal inválido (${raw})`)
            divergencias.push({ sheet: sheetName, erro: `Apt ${numero}: subtotal inválido (${JSON.stringify(raw)})` })
            temSubtotalInvalido = true
            continue
          }
          if (valor > 0) subtotalPorApt[apartamento_id] = valor
        }
        if (temSubtotalInvalido) continue
        if (Object.keys(subtotalPorApt).length === 0) { sheetsIgnorados.push(sheetName); continue }

        // 5b. Ler linhas individuais de custo (entre cabeçalho e subtotal).
        // Estrutura da planilha: col[c] = valor, col[c+1] = nome da categoria.
        const sheetItems: CostItem[] = []
        for (let ri = headerRowIdx + 1; ri < subtotalRowIdx; ri++) {
          const row = rows[ri] ?? []
          for (const { colIdx, apartamento_id, numero } of unitCols) {
            const valor = arredondar(parseMoneyBR(row[colIdx]))
            if (isNaN(valor) || valor <= 0) continue
            const categoria = String(row[colIdx + 1] ?? '').trim()
            if (!categoria) continue
            sheetItems.push({ apartamento_id, numero, categoria, valor, sheet: sheetName })
          }
        }

        // 5c. Se não encontrou itens individuais, usa subtotal como "Total Consolidado".
        const sheetItemsParaUsar: CostItem[] = sheetItems.length > 0
          ? sheetItems
          : Object.entries(subtotalPorApt).map(([apartamento_id, valor]) => {
              const col = unitCols.find(u => u.apartamento_id === apartamento_id)
              return { apartamento_id, numero: col?.numero ?? '', categoria: 'Total Consolidado', valor, sheet: sheetName }
            })

        // 6. Total geral da aba: primeiro valor numérico na linha TOTAL:
        let grandTotal = 0
        for (const cell of totalRow) {
          if (cell == null) continue
          const v = parseMoneyBR(cell)
          if (!isNaN(v) && v > 0) { grandTotal = arredondar(v); break }
        }

        // 7. Validar Σ subtotais ≈ TOTAL: (tolerância R$ 0,05)
        const somaUnidades = arredondar(Object.values(subtotalPorApt).reduce((s, v) => s + v, 0))
        if (grandTotal > 0 && Math.abs(somaUnidades - grandTotal) > 0.05) {
          const difStr = `Σ R$ ${somaUnidades.toFixed(2)} ≠ TOTAL R$ ${grandTotal.toFixed(2)}`
          const naoStr = aptNaoNoBanco.length > 0
            ? ` | Apts não cadastrados no banco: ${aptNaoNoBanco.join(', ')}`
            : ''
          console.error(`[CUSTOS] "${sheetName}" — ${difStr}${naoStr}`)
          divergencias.push({ sheet: sheetName, erro: `${difStr}${naoStr}` })
          continue
        }

        allItems.push(...sheetItemsParaUsar)
        console.log(`[CUSTOS] ✓ "${sheetName}" — ${sheetItemsParaUsar.length} item(ns), R$ ${somaUnidades.toFixed(2)} (${sheetItems.length > 0 ? 'detalhado' : 'consolidado'})`)
      }

      // Divergências de validação → HTTP 422 (não grava nada)
      if (divergencias.length > 0) {
        return NextResponse.json({
          error: 'Divergências encontradas. Corrija as abas indicadas antes de importar.',
          divergencias,
          abas_ok: [...new Set(allItems.map(u => u.sheet))],
          nao_gravados: sheetsIgnorados,
        }, { status: 422 })
      }

      if (allItems.length === 0) {
        return NextResponse.json({
          error: 'Nenhum custo encontrado no arquivo. Verifique se o arquivo correto foi enviado.'
        }, { status: 400 })
      }

      // DELETE único por (mes, ano, tipo_gestao) antes de inserir
      const { error: delPeriodoErr } = await supabase
        .from('custos').delete()
        .eq('mes', mes).eq('ano', ano).eq('tipo_gestao', tipo_gestao)
      if (delPeriodoErr) {
        return NextResponse.json({ error: `Erro ao limpar período: ${delPeriodoErr.message}` }, { status: 500 })
      }

      // INSERT em lote — uma linha por item de custo com categoria individual
      const custosToInsert: CustoInsert[] = allItems.map(item => ({
        apartamento_id: item.apartamento_id,
        mes, ano,
        categoria: item.categoria,
        valor: item.valor,
        tipo_gestao,
      }))
      const { error: insErr } = await supabase.from('custos').insert(custosToInsert)
      if (insErr) {
        return NextResponse.json({ error: `Erro ao inserir custos: ${insErr.message}` }, { status: 500 })
      }
      custosCount = custosToInsert.length
    }

    // =====================================================================
    // DIÁRIAS (FATURAMENTO)
    // =====================================================================
    if (tipo.startsWith('diarias')) {
      // Usa firstAptByEmpTipo para que BRISAS ADM escolha um apt adm (E016),
      // não um apt sub (A117), evitando atribuição cruzada de tipo_gestao.
      let parsed = parsePlanilhaResultado(workbook, empMap, aptMap, firstAptByEmpTipo)

      if (parsed.porApartamento.length === 0) {
        parsed = parsePlanilhaTotais(workbook, empMap, aptMap, firstAptByEmpTipo)
      }

      if (parsed.porApartamento.length === 0) {
        return NextResponse.json({
          error: 'Nenhum faturamento foi encontrado no arquivo. Verifique se a planilha está no formato esperado.'
        }, { status: 400 })
      }

      for (const row of parsed.porApartamento) {
        diariasToInsert.push({
          apartamento_id: row.apartamento_id,
          valor: row.valor,
          data: data_registro,
          tipo_gestao,
        })
      }
    }

    // =====================================================================
    // PROTEÇÃO ANTI-DUPLICAÇÃO — apenas para diárias
    // (custos já foram processados inline por apt, com DELETE por apt antes de INSERT)
    // =====================================================================

    if (diariasToInsert.length > 0) {
      const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)
      await supabase.from('diarias').delete()
        .gte('data', data_registro)
        .lte('data', dataFim)
        .eq('tipo_gestao', tipo_gestao)
    }

    // =====================================================================
    // INSERIR — apenas diárias (custos já inseridos inline no loop acima)
    // =====================================================================

    if (diariasToInsert.length > 0) {
      const { error: diariasError } = await supabase
        .from('diarias')
        .upsert(diariasToInsert, { onConflict: 'apartamento_id,data,tipo_gestao' })
      if (diariasError) {
        return NextResponse.json({ error: `Erro ao inserir diárias: ${diariasError.message}` }, { status: 500 })
      }
    }

    // =====================================================================
    // HISTÓRICO
    // =====================================================================

    // ── validação pós-importação ──────────────────────────────────────────
    if (sheetsIgnorados.length > 0) {
      console.error(`[import] AVISO: ${sheetsIgnorados.length} aba(s) não gravada(s): ${sheetsIgnorados.join(', ')}`)
    }

    const observacao = sheetsIgnorados.length > 0
      ? `Abas ignoradas (${sheetsIgnorados.length}): ${sheetsIgnorados.join(', ')}`
      : null

    const importRecord: Record<string, unknown> = {
      nome_arquivo: file.name,
      tipo, mes, ano,
      status: 'concluido',
      importado_por: user.id,
    }
    if (observacao) importRecord.observacao = observacao

    const { error: importErr } = await supabase.from('importacoes').insert(importRecord)
    if (importErr) {
      // Fallback: se a coluna observacao ainda não existe no banco, insere sem ela
      if (importErr.message.includes('observacao')) {
        delete importRecord.observacao
        await supabase.from('importacoes').insert(importRecord)
      }
    }

    return NextResponse.json({
      success: true,
      message: sheetsIgnorados.length > 0
        ? `Importação concluída com avisos. ${sheetsIgnorados.length} aba(s) não gravada(s).`
        : 'Importação concluída com sucesso.',
      tipo, mes, ano,
      arquivo: file.name,
      registros: {
        diarias: diariasToInsert.length,
        custos: custosCount,
      },
      nao_gravados: sheetsIgnorados,
      ...(sheetsIgnorados.length > 0 ? { aviso: `Abas não encontradas no banco: ${sheetsIgnorados.join(', ')}` } : {}),
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Erro na importação:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// =========================================================================
// HELPERS
// =========================================================================

interface CustoInsert {
  apartamento_id: string
  valor: number
  categoria: string
  mes: number
  ano: number
  tipo_gestao: string
}

interface DiariaInsert {
  apartamento_id: string
  valor: number
  data: string
  tipo_gestao: string
}

interface ColApartamento {
  colIdx: number
  apartamento_id: string
  numero: string
}

/** Normaliza número de apartamento para comparação flexível */
function normalizar(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/\s*-\s*/g, '-')
    .replace(/\.0$/, '')
    .trim()
}

/** Converte valor bruto (número ou string) para float */
function parseNumero(raw: unknown): number {
  if (raw == null) return NaN
  if (typeof raw === 'number') return raw
  const s = String(raw).replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
  return parseFloat(s)
}

/**
 * Converte valor monetário BR para float, respeitando os separadores reais da planilha.
 * "1.108,52"  → 1108.52   (vírgula=decimal, pontos=milhar)
 * "11.180.31" → 11180.31  (múltiplos pontos sem vírgula: último ponto é decimal)
 * "769.05"    → 769.05    (um ponto: decimal padrão)
 */
function parseMoneyBR(raw: unknown): number {
  if (raw == null) return NaN
  if (typeof raw === 'number') return raw
  let s = String(raw).replace(/R\$\s*/gi, '').replace(/\s+/g, '').trim()
  if (!s || s === '-') return NaN
  if (s.includes(',')) {
    // Formato BR: "1.108,52" → remove pontos de milhar, troca vírgula por ponto
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    const dots = (s.match(/\./g) ?? []).length
    if (dots > 1) {
      // Múltiplos pontos, sem vírgula: "11.180.31" → último ponto é decimal
      const lastDot = s.lastIndexOf('.')
      s = s.slice(0, lastDot).replace(/\./g, '') + '.' + s.slice(lastDot + 1)
    }
  }
  return parseFloat(s)
}

/** Arredonda para 2 casas decimais, evitando floats como 53664.01873333 */
function arredondar(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Varre as primeiras linhas da planilha em busca de uma linha de cabeçalho
 * que contenha números de apartamentos (ex: "APT 204", "204", "Apt 301").
 * Retorna o índice de coluna e o apartamento_id correspondente para cada
 * apartamento encontrado.
 *
 * Padrão esperado na planilha:
 *   Col 0       | Col 1  | Col 2       | Col 3  | ...
 *   APT 204     | Desc   | APT 301     | Desc   | ...
 *   (valores)   |        | (valores)   |        |
 *   TOTAL:      | 5000   | TOTAL:      | 4000   | (um TOTAL por apartamento)
 *
 * OU (TOTAL único na col 1, valores por apt nas colunas pares):
 *   Col 0  | Col 1   | Col 2  | Col 3   | Col 4
 *   Desc   | APT 204 | APT 301| APT 404 | TOTAL
 *   ...
 *   TOTAL: | 5000    | 4000   | 3000    | 16165
 */
function extrairColunasApartamento(
  rows: unknown[][],
  empreendimento_id: string,
  aptMap: Record<string, string>
): ColApartamento[] {
  const resultado: ColApartamento[] = []

  // Varrer as primeiras 10 linhas procurando uma com nomes de apartamentos
  for (let rowIdx = 0; rowIdx < Math.min(10, rows.length); rowIdx++) {
    const row = rows[rowIdx]
    if (!row) continue

    const candidatos: ColApartamento[] = []

    for (let colIdx = 0; colIdx < row.length; colIdx++) {
      const cell = row[colIdx]
      if (cell == null) continue
      // Aceita string E number (apt como número puro no Excel: 204, 301, 1419...)
      if (typeof cell !== 'string' && typeof cell !== 'number') continue
      const cellStr = String(cell).trim()
      if (!cellStr) continue

      // Extrair número do apartamento da célula
      // Aceita: "APT 204", "Apt 204", "204", "APT204", "A 104", "D 137", 204 (number), etc.
      const aptNum = extrairNumeroApt(cellStr)
      if (!aptNum) continue

      // Tentar resolver: empreendimento_id::numero
      const key = `${empreendimento_id}::${normalizar(aptNum)}`
      const apartamento_id = aptMap[key]
      if (apartamento_id) {
        candidatos.push({ colIdx, apartamento_id, numero: aptNum })
      }
    }

    if (candidatos.length >= 1) {
      // Encontrou linha de cabeçalho com apartamentos reconhecidos
      console.log(`[IMPORT] Linha ${rowIdx} tem ${candidatos.length} apartamentos: ${candidatos.map(c => c.numero).join(', ')}`)
      resultado.push(...candidatos)
      break
    }
  }

  return resultado
}

/**
 * Tenta extrair o número do apartamento de uma string de célula.
 * Exemplos reconhecidos: "APT 204", "Apt204", "204", "A 104", "D 137", "1615A"
 */
/**
 * Encontra a linha de totais de uma planilha usando 3 estratégias em cascata:
 *
 * 1. Busca por palavra-chave: qualquer célula que comece com "TOTAL" ou "SOMA"
 * 2. Se não encontrar e aptCols existir: última linha com valores numéricos
 *    em TODAS as colunas de apartamentos (a linha de total é sempre a maior)
 * 3. Retorna -1 se nenhuma estratégia funcionar
 */
function encontrarLinhaTotais(rows: unknown[][], aptCols: ColApartamento[]): number {
  // Estratégia 1: Palavra-chave TOTAL ou SOMA em qualquer célula
  const keywordIdx = rows.findIndex((row) => {
    if (!row) return false
    return row.some((cell) => {
      if (cell == null) return false
      const s = String(cell).trim().toUpperCase().replace(/\s+/g, '')
      return s.startsWith('TOTAL') || s.startsWith('SOMA') || s === 'SUBTOTAL'
    })
  })
  if (keywordIdx >= 0) return keywordIdx

  // Estratégia 2 (só quando aptCols detectados): última linha com valores
  // numéricos > 0 em pelo menos uma das colunas de apartamento
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

function extrairNumeroApt(cell: string): string | null {
  const s = cell.trim()

  // Padrão "APT 204", "APT204", "Apt 204"
  const mApt = s.match(/^apt\s*(\S+.*)$/i)
  if (mApt) return mApt[1].trim()

  // Número puro (célula numérica do Excel convertida para string): "204", "1419", "11"
  if (/^\d+$/.test(s)) return s

  // Composto: "1615A - 1615", "1701 - 1701A"
  if (/^\d+[A-Za-z]?\s*-\s*\d+[A-Za-z]?$/.test(s)) return s

  // Alfanumérico: "A 104", "D 137", "1615A", "A113", "D138"
  if (s.length <= 15 && /^[A-Za-z]?\s*\d/.test(s)) return s

  return null
}

function extrairTotalLinha(totalRow: unknown[], aptCols: ColApartamento[]): number {
  if (!totalRow || totalRow.length === 0) return 0

  // Em planilhas padrão, TOTAL geral costuma ficar na linha de totais;
  // priorizamos o maior valor numérico da linha como total consolidado.
  let maior = 0
  for (const cell of totalRow) {
    const valor = arredondar(parseNumero(cell))
    if (!isNaN(valor) && valor > maior) maior = valor
  }

  // Se não encontrou valor geral, tenta somar os totais por coluna de apt.
  if (maior <= 0 && aptCols.length > 0) {
    const somaApts = aptCols.reduce((acc, { colIdx }) => {
      const v = arredondar(parseNumero(totalRow[colIdx]))
      return acc + (!isNaN(v) && v > 0 ? v : 0)
    }, 0)
    return arredondar(somaApts)
  }

  return arredondar(maior)
}

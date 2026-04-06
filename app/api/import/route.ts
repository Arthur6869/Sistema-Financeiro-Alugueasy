import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const tipo = formData.get('tipo') as string
    const mesParam = formData.get('mes') as string
    const anoParam = formData.get('ano') as string

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }
    if (!['custos_adm', 'custos_sub', 'diarias_adm', 'diarias_sub'].includes(tipo)) {
      return NextResponse.json({ error: `Tipo inválido: "${tipo}"` }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'csv'].includes(ext ?? '')) {
      return NextResponse.json({ error: 'Formato inválido. Envie um arquivo .xlsx ou .csv' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Usuário não autenticado. Faça login novamente.' }, { status: 401 })
    }

    const mes = mesParam ? parseInt(mesParam) : new Date().getMonth() + 1
    const ano = anoParam ? parseInt(anoParam) : new Date().getFullYear()
    const data_registro = `${ano}-${String(mes).padStart(2, '0')}-01`
    const tipo_gestao = tipo.includes('adm') ? 'adm' : 'sub'

    const { data: allEmpreendimentos } = await supabase
      .from('empreendimentos')
      .select('id, nome')

    const { data: allApartamentos } = await supabase
      .from('apartamentos')
      .select('id, numero, empreendimento_id')

    if (!allEmpreendimentos || !allApartamentos) {
      return NextResponse.json({ error: 'Erro ao carregar dados do banco' }, { status: 500 })
    }

    const empMap: Record<string, string> = {}
    allEmpreendimentos.forEach(e => { empMap[e.nome.toUpperCase()] = e.id })

    const aptMap: Record<string, string> = {}
    allApartamentos.forEach(a => {
      aptMap[`${a.empreendimento_id}::${a.numero}`] = a.id
    })

    const firstAptByEmp: Record<string, string> = {}
    allApartamentos.forEach(a => {
      if (!firstAptByEmp[a.empreendimento_id]) {
        firstAptByEmp[a.empreendimento_id] = a.id
      }
    })

    const custosToInsert: any[] = []
    const diariasToInsert: any[] = []

    // ========== PROCESSAMENTO POR TIPO ==========

    if (tipo.startsWith('diarias')) {
      // ─────────────────────────────────────────────────────────────────
      // DIÁRIAS: Usar a aba "RESULTADO ADM MES" / "RESULTADO SUB MES"
      // que consolida os totais de TODOS os empreendimentos corretamente.
      //
      // NÃO ler as abas individuais — elas têm apartamentos em colunas
      // horizontais e o TOTAL: delas pode ser parcial.
      //
      // Estrutura da aba RESULTADO:
      //   Linha 0: "FEV - ADM"
      //   Linha 1: "ESSENCE" [col0]  "EASY" [col2]  "CULLINAN" [col4] ...
      //   Linha 2:  42731.25  "FAT"   15392.92 "FAT"  5899.98   "FAT" ...
      //   Linha 6: "TOTAL FAT"  143049.19
      // ─────────────────────────────────────────────────────────────────

      const resultSheetName = workbook.SheetNames.find(name =>
        name.toUpperCase().includes('RESULTADO')
      )

      if (!resultSheetName) {
        return NextResponse.json({
          error: 'Aba RESULTADO não encontrada. Verifique se o arquivo correto foi enviado.'
        }, { status: 400 })
      }

      const worksheet = workbook.Sheets[resultSheetName]
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][]

      let nomesRow: any[] = []
      const fatValoresPorEmp: Record<string, number> = {}

      const NOMES_EMPREENDIMENTOS = [
        'ESSENCE', 'EASY', 'CULLINAN', 'ATHOS', 'NOBILE',
        'FUSION', 'MERCURE', 'METROPOLITAN', 'RAMADA', 'BRISAS', 'VISION'
      ]

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        if (!row) continue

        const cell0 = row[0] != null ? String(row[0]).trim().toUpperCase() : ''

        if (cell0 === 'TOTAL FAT') {
          const totalGeral = parseFloat(row[1])
          console.log(`[DIÁRIAS] TOTAL FAT consolidado (${resultSheetName}): R$ ${totalGeral}`)
          continue
        }

        // Linha de nomes dos empreendimentos
        if (row.some((c: any) =>
          typeof c === 'string' &&
          NOMES_EMPREENDIMENTOS.includes(c.trim().toUpperCase())
        )) {
          nomesRow = row
          continue
        }

        // Linha de valores FAT: [valor, "FAT", valor, "FAT" ...]
        if (
          nomesRow.length > 0 &&
          Object.keys(fatValoresPorEmp).length === 0 &&
          row.some((c: any) => c === 'FAT')
        ) {
          for (let j = 0; j < row.length; j++) {
            if (typeof row[j] === 'number') {
              const nomeEmp = nomesRow[j]
              if (typeof nomeEmp === 'string' && nomeEmp.trim()) {
                const nomeUpper = nomeEmp.trim().toUpperCase()
                fatValoresPorEmp[nomeUpper] = row[j]
                console.log(`[DIÁRIAS] ${nomeUpper} → R$ ${row[j]}`)
              }
            }
          }
        }
      }

      for (const [nomeEmp, valor] of Object.entries(fatValoresPorEmp)) {
        if (valor <= 0) continue

        const empreendimento_id = empMap[nomeEmp]
        if (!empreendimento_id) {
          console.warn(`[DIÁRIAS] "${nomeEmp}" não encontrado no banco. Pulando.`)
          continue
        }

        const apartamento_id = firstAptByEmp[empreendimento_id]
        if (!apartamento_id) {
          console.warn(`[DIÁRIAS] Nenhum apartamento para "${nomeEmp}". Pulando.`)
          continue
        }

        diariasToInsert.push({
          apartamento_id,
          valor,
          data: data_registro,
          tipo_gestao
        })
        console.log(`[DIÁRIAS] ✓ ${nomeEmp} (${tipo_gestao}) → R$ ${valor}`)
      }

    } else {
      // ─────────────────────────────────────────────────────────────────
      // CUSTOS: Cada aba = um empreendimento.
      //
      // REGRA CRÍTICA: pegar APENAS o valor da linha "TOTAL:" de cada aba.
      // NÃO ler linha por linha — a planilha tem apartamentos em colunas
      // horizontais e só o TOTAL: já soma tudo corretamente.
      //
      // Estrutura de cada aba:
      //   Linha 0:  "FEV"
      //   Linha 1:  APT 204  "Descrição"  APT 301  "Descrição" ...
      //   Linha 2:  30       "Amenitiz"   30        "Amenitiz"  ...
      //   ...
      //   Linha 30: "TOTAL:"  16165.64  ← ÚNICO valor a ser lido
      // ─────────────────────────────────────────────────────────────────

      const sheetsToProcess = workbook.SheetNames.filter(name =>
        !name.toUpperCase().includes('RESULTADO') &&
        !name.toUpperCase().includes('RESUMO')
      )

      console.log(`[CUSTOS] Abas a processar: ${sheetsToProcess.join(', ')}`)

      for (const sheetName of sheetsToProcess) {
        const empreendimento_id = empMap[sheetName.toUpperCase()]
        if (!empreendimento_id) {
          console.warn(`[CUSTOS] "${sheetName}" não encontrado no banco. Pulando.`)
          continue
        }

        const worksheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][]

        if (!rows || rows.length < 2) continue

        // Buscar dinamicamente a linha "TOTAL:" — NÃO usar número de linha fixo
        let totalEncontrado = false
        for (let i = 0; i < rows.length; i++) {
          const cellA = rows[i][0]
          if (cellA == null) continue

          const cellAStr = String(cellA).trim().toUpperCase()

          // Linha de TOTAL: começa com "TOTAL" e contém ":"
          if (cellAStr.startsWith('TOTAL') && cellAStr.includes(':')) {
            const cellB = rows[i][1]
            if (cellB == null) break

            let valor: number
            if (typeof cellB === 'string') {
              valor = parseFloat(
                cellB.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()
              )
            } else {
              valor = parseFloat(cellB)
            }

            if (!isNaN(valor) && valor > 0) {
              const apartamento_id = firstAptByEmp[empreendimento_id]
              if (apartamento_id) {
                custosToInsert.push({
                  apartamento_id,
                  valor,
                  categoria: 'Total Consolidado',
                  mes,
                  ano,
                  tipo_gestao
                })
                console.log(`[CUSTOS] ✓ ${sheetName} (${tipo_gestao}) → R$ ${valor}`)
                totalEncontrado = true
              } else {
                console.warn(`[CUSTOS] Nenhum apartamento para "${sheetName}". Pulando.`)
              }
            }
            break // Próxima aba — só precisa do TOTAL
          }
        }

        if (!totalEncontrado) {
          console.warn(`[CUSTOS] Linha TOTAL: não encontrada na aba "${sheetName}"`)
        }
      }

      // Validar se encontrou dados
      if (custosToInsert.length === 0) {
        return NextResponse.json({
          error: 'Nenhum custo foi encontrado no arquivo. Verifique se o arquivo correto foi enviado.'
        }, { status: 400 })
      }
    }

    // ========== PROTEÇÃO ANTI-DUPLICAÇÃO ==========
    // Apagar registros anteriores SOMENTE após confirmar que há dados novos

    if (tipo.startsWith('diarias') && diariasToInsert.length > 0) {
      const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const dataFim = `${ano}-${String(mes).padStart(2, '0')}-28`

      const { error: deleteErr } = await supabase
        .from('diarias')
        .delete()
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .eq('tipo_gestao', tipo_gestao)

      if (deleteErr) {
        console.warn('Aviso ao limpar diárias anteriores:', deleteErr.message)
      } else {
        console.log(`[IMPORT] Diárias anteriores de ${mes}/${ano} (${tipo_gestao}) removidas`)
      }
    }

    if (tipo.startsWith('custos') && custosToInsert.length > 0) {
      const { error: deleteErr } = await supabase
        .from('custos')
        .delete()
        .eq('mes', mes)
        .eq('ano', ano)
        .eq('tipo_gestao', tipo_gestao)

      if (deleteErr) {
        console.warn('Aviso ao limpar custos anteriores:', deleteErr.message)
      } else {
        console.log(`[IMPORT] Custos anteriores de ${mes}/${ano} (${tipo_gestao}) removidos`)
      }
    }

    // ========== INSERIR DADOS NO BANCO ==========

    if (custosToInsert.length > 0) {
      const { error: custosError } = await supabase.from('custos').insert(custosToInsert)
      if (custosError) {
        console.error('Erro ao inserir custos:', custosError)
        return NextResponse.json({ error: `Erro ao inserir custos: ${custosError.message}` }, { status: 500 })
      }
      console.log(`✓ Inseridos ${custosToInsert.length} registros de custos`)
    }

    if (diariasToInsert.length > 0) {
      const { error: diariasError } = await supabase.from('diarias').insert(diariasToInsert)
      if (diariasError) {
        console.error('Erro ao inserir diárias:', diariasError)
        return NextResponse.json({ error: `Erro ao inserir diárias: ${diariasError.message}` }, { status: 500 })
      }
      console.log(`✓ Inseridas ${diariasToInsert.length} registros de diárias`)
    }

    // ========== REGISTRAR HISTÓRICO ==========

    const { error: insertError } = await supabase.from('importacoes').insert({
      nome_arquivo: file.name,
      tipo,
      mes,
      ano,
      status: 'concluido',
      importado_por: user.id,
    })

    if (insertError) {
      console.error('Erro ao inserir no histórico de importações:', insertError)
      return NextResponse.json({
        error: `Falha ao registrar importação no histórico: ${insertError.message}`
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Importação concluída com sucesso.',
      tipo,
      mes,
      ano,
      arquivo: file.name,
      registros: {
        diarias: diariasToInsert.length,
        custos: custosToInsert.length,
      }
    })

  } catch (error: any) {
    console.error('Erro na importação:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
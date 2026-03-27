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

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    if (!rows || rows.length < 2) {
      return NextResponse.json({ error: 'Planilha vazia ou sem dados (mínimo 2 linhas)' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Usuário não autenticado. Faça login novamente.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Apenas administradores podem importar planilhas.' }, { status: 403 })
    }

    const tipo_gestao = tipo.includes('adm') ? 'adm' : 'sub'
    const mes = mesParam ? parseInt(mesParam) : new Date().getMonth() + 1
    const ano = anoParam ? parseInt(anoParam) : new Date().getFullYear()
    const data_registro = `${ano}-${String(mes).padStart(2, '0')}-01`

    // Garantir que o empreendimento padrão existe
    let { data: emp } = await supabase
      .from('empreendimentos')
      .select('id')
      .eq('nome', 'Residencial AlugEasy')
      .single()

    if (!emp) {
      const { data: newEmp, error: empErr } = await supabase
        .from('empreendimentos')
        .insert({ nome: 'Residencial AlugEasy' })
        .select('id')
        .single()
      if (empErr) throw empErr
      emp = newEmp
    }

    const empreendimento_id = emp!.id
    const headerRow = rows[0]
    const columnsCount = headerRow.length

    // Coletar números de apartamentos da linha de cabeçalho
    const aptNumbers: string[] = []
    for (let col = 0; col < columnsCount; col += 2) {
      const val = headerRow[col]
      if (val) aptNumbers.push(val.toString().replace('.0', ''))
    }

    if (aptNumbers.length === 0) {
      return NextResponse.json({ error: 'Nenhum apartamento encontrado no cabeçalho da planilha' }, { status: 400 })
    }

    // Buscar todos os apartamentos em uma única query
    const { data: existingApts } = await supabase
      .from('apartamentos')
      .select('id, numero')
      .eq('empreendimento_id', empreendimento_id)
      .in('numero', aptNumbers)

    const aptMap: Record<string, string> = {}
    existingApts?.forEach((a) => { aptMap[a.numero] = a.id })

    // Inserir apartamentos ausentes em lote
    const missingNums = aptNumbers.filter((n) => !aptMap[n])
    if (missingNums.length > 0) {
      const { data: newApts, error: batchErr } = await supabase
        .from('apartamentos')
        .insert(missingNums.map((numero) => ({ numero, empreendimento_id })))
        .select('id, numero')
      if (batchErr) throw batchErr
      newApts?.forEach((a) => { aptMap[a.numero] = a.id })
    }

    // Construir todos os registros a inserir
    const custosToInsert: any[] = []
    const diariasToInsert: any[] = []

    for (let col = 0; col < columnsCount; col += 2) {
      const val = headerRow[col]
      if (!val) continue
      const numero = val.toString().replace('.0', '')
      const apartamento_id = aptMap[numero]
      if (!apartamento_id) continue

      if (tipo.startsWith('custos')) {
        for (let row = 1; row < rows.length; row++) {
          const valor = parseFloat(rows[row][col])
          const categoria = rows[row][col + 1]?.toString() || 'Outros'
          if (!isNaN(valor) && valor > 0 && categoria !== 'Descrição') {
            custosToInsert.push({ apartamento_id, valor, categoria, mes, ano, tipo_gestao })
          }
        }
      } else {
        const valor = parseFloat(rows[1]?.[col])
        if (!isNaN(valor) && valor > 0) {
          diariasToInsert.push({ apartamento_id, valor, data: data_registro, tipo_gestao })
        }
      }
    }

    // Inserções em lote
    if (custosToInsert.length > 0) {
      const { error } = await supabase.from('custos').insert(custosToInsert)
      if (error) throw error
    }
    if (diariasToInsert.length > 0) {
      const { error } = await supabase.from('diarias').insert(diariasToInsert)
      if (error) throw error
    }

    await supabase.from('importacoes').insert({
      nome_arquivo: file.name,
      tipo,
      mes,
      ano,
      status: 'concluido',
      importado_por: user.id,
    })

    return NextResponse.json({
      success: true,
      inserted: { custos: custosToInsert.length, diarias: diariasToInsert.length },
    })
  } catch (error: any) {
    console.error('Erro na importação:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

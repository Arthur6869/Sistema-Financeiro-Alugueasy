/**
 * /api/sync-local
 *
 * GET  ?ano=2026   → Escaneia as pastas "dados *" do projeto, parseia os xlsx e
 *                    compara com o banco. Retorna relatório de divergências.
 *
 * POST { mes, ano, tipo } → Aplica a correção: re-importa o xlsx local para o banco.
 *   - custos_adm / custos_sub  → grava na tabela `custos`
 *   - diarias_adm / diarias_sub → grava na tabela `diarias` (totais mensais por apt)
 *
 * Acesso: apenas usuários autenticados (GET) / role='analista' (POST)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import {
  parsePlanilhaResultado,
  parsePlanilhaTotais,
  normalize,
  arredondar,
} from '@/lib/xlsx-parser'

// ─── Mapeamento de meses ──────────────────────────────────────────────────────

const MES_ABREV: Record<string, number> = {
  JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
  JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
}

// ─── Detecção de tipo e mês a partir do nome do arquivo ──────────────────────

/**
 * Extrai tipo ('custos_adm' | 'custos_sub' | 'diarias_adm' | 'diarias_sub')
 * e mês (1–12) a partir do nome do arquivo xlsx.
 *
 * Exemplos de nomes aceitos:
 *   "_  COFERENCIA DE CUSTOS - ADM - JAN (1).xlsx"
 *   "_ COFERENCIA DE DIARIAS - SUB - FEV (1).xlsx"
 */
function parseNomeArquivo(filename: string): { tipo: string; mes: number } | null {
  // Normalizar: remover acentos, uppercase
  const upper = filename
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  let tipo: string | null = null
  if (upper.includes('CUSTO') && upper.includes('ADM')) tipo = 'custos_adm'
  else if (upper.includes('CUSTO') && upper.includes('SUB')) tipo = 'custos_sub'
  else if (upper.includes('DIARIA') && upper.includes('ADM')) tipo = 'diarias_adm'
  else if (upper.includes('DIARIA') && upper.includes('SUB')) tipo = 'diarias_sub'

  if (!tipo) return null

  // Detectar mês: busca padrão "- MES" ou "- MES (" no nome
  let mes: number | null = null
  for (const [abrev, num] of Object.entries(MES_ABREV)) {
    const regex = new RegExp(`-\\s*${abrev}(\\s|\\(|\\.xlsx|$)`, 'i')
    if (regex.test(upper)) {
      mes = num
      break
    }
  }

  if (!mes) return null
  return { tipo, mes }
}

// ─── Descoberta de arquivos ───────────────────────────────────────────────────

interface ArquivoLocal {
  filePath: string
  filename: string
  tipo: string
  mes: number
  ano: number
}

/**
 * Escaneia o diretório raiz do projeto em busca de pastas "dados *"
 * e coleta todos os xlsx encontrados (até 2 níveis de profundidade).
 */
function descobrirArquivos(ano: number): ArquivoLocal[] {
  const root = process.cwd()
  const result: ArquivoLocal[] = []

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return []
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (!entry.name.toLowerCase().startsWith('dados ')) continue

    const subDir = path.join(root, entry.name)
    let subEntries: fs.Dirent[]
    try {
      subEntries = fs.readdirSync(subDir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const sub of subEntries) {
      if (sub.isFile() && sub.name.toLowerCase().endsWith('.xlsx')) {
        const parsed = parseNomeArquivo(sub.name)
        if (parsed) {
          result.push({ filePath: path.join(subDir, sub.name), filename: sub.name, tipo: parsed.tipo, mes: parsed.mes, ano })
        }
      } else if (sub.isDirectory()) {
        const deepDir = path.join(subDir, sub.name)
        let deepEntries: fs.Dirent[]
        try {
          deepEntries = fs.readdirSync(deepDir, { withFileTypes: true })
        } catch {
          continue
        }
        for (const file of deepEntries) {
          if (!file.isFile() || !file.name.toLowerCase().endsWith('.xlsx')) continue
          const parsed = parseNomeArquivo(file.name)
          if (parsed) {
            result.push({ filePath: path.join(deepDir, file.name), filename: file.name, tipo: parsed.tipo, mes: parsed.mes, ano })
          }
        }
      }
    }
  }

  return result
}

// ─── Helpers de DB ────────────────────────────────────────────────────────────

async function carregarMapas(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [{ data: emps }, { data: apts }] = await Promise.all([
    supabase.from('empreendimentos').select('id, nome'),
    supabase.from('apartamentos').select('id, numero, empreendimento_id'),
  ])

  const empMap: Record<string, string> = {}
  ;(emps ?? []).forEach((e: { id: string; nome: string }) => {
    empMap[e.nome.toUpperCase()] = e.id
  })

  const aptMap: Record<string, string> = {}
  const firstAptByEmp: Record<string, string> = {}
  ;(apts ?? []).forEach((a: { id: string; numero: string; empreendimento_id: string }) => {
    aptMap[`${a.empreendimento_id}::${normalize(a.numero)}`] = a.id
    if (!firstAptByEmp[a.empreendimento_id]) firstAptByEmp[a.empreendimento_id] = a.id
  })

  return { empMap, aptMap, firstAptByEmp }
}

// ─── GET — Relatório de comparação ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const ano = parseInt(searchParams.get('ano') ?? String(new Date().getFullYear()))
  const mesParam = searchParams.get('mes')
  const mesFiltro = mesParam ? parseInt(mesParam) : null  // null = todos os meses

  // Descobrir arquivos e filtrar pelo mês selecionado
  const todosArquivos = descobrirArquivos(ano)
  const arquivos = mesFiltro
    ? todosArquivos.filter(a => a.mes === mesFiltro)
    : todosArquivos

  if (todosArquivos.length === 0) {
    return NextResponse.json({
      report: [],
      totalArquivos: 0,
      ano,
      aviso: 'Nenhuma pasta "dados *" encontrada no projeto. Coloque as planilhas em pastas nomeadas como "dados jan", "dados fev", etc.',
    })
  }

  if (arquivos.length === 0) {
    return NextResponse.json({
      report: [],
      totalArquivos: 0,
      ano,
      mes: mesFiltro,
      aviso: `Nenhum arquivo encontrado para o período selecionado (mês ${mesFiltro}/${ano}). Verifique se a pasta correspondente existe no projeto.`,
    })
  }

  const { empMap, aptMap, firstAptByEmp } = await carregarMapas(supabase)

  const report = []

  for (const arq of arquivos) {
    const { filePath, filename, tipo, mes } = arq
    const tipo_gestao = tipo.includes('adm') ? 'adm' : 'sub'

    // ── Parsear xlsx ────────────────────────────────────────────────
    let valorPlanilha = 0
    let erroParsing: string | null = null

    try {
      const buffer = fs.readFileSync(filePath)
      const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })
      // Verificação usa a aba RESULTADO (última aba = valores finais conferidos)
      const parsed = parsePlanilhaResultado(workbook, empMap, aptMap, firstAptByEmp)
      valorPlanilha = parsed.totalGeral
    } catch (e) {
      erroParsing = e instanceof Error ? e.message : String(e)
      console.error(`[sync-local] Erro ao parsear ${filename}:`, erroParsing)
    }

    // ── Buscar valor no banco ────────────────────────────────────────
    let valorDB = 0
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

    if (tipo.startsWith('custos')) {
      const { data } = await supabase
        .from('custos')
        .select('valor')
        .eq('mes', mes)
        .eq('ano', ano)
        .eq('tipo_gestao', tipo_gestao)

      valorDB = arredondar((data ?? []).reduce((acc: number, r: { valor: number }) => acc + (r.valor || 0), 0))
    } else {
      // Diárias: verificar tabela diarias primeiro (xlsx-sourced)
      const { data: diariasData } = await supabase
        .from('diarias')
        .select('valor')
        .gte('data', dataInicio)
        .lte('data', dataFim)
        .eq('tipo_gestao', tipo_gestao)

      if (diariasData && diariasData.length > 0) {
        valorDB = arredondar(diariasData.reduce((acc: number, r: { valor: number }) => acc + (r.valor || 0), 0))
      } else {
        // Fallback: amenitiz_reservas (sem filtro de tipo_gestao pois não é coluna direta)
        const { data: reservasData } = await supabase
          .from('amenitiz_reservas')
          .select('valor_liquido')
          .eq('mes_competencia', mes)
          .eq('ano_competencia', ano)

        valorDB = arredondar((reservasData ?? []).reduce((acc: number, r: { valor_liquido: number }) => acc + (r.valor_liquido || 0), 0))
      }
    }

    // ── Calcular divergência ─────────────────────────────────────────
    const diferenca = arredondar(valorPlanilha - valorDB)
    const tolerancia = 0.10
    const status: string =
      erroParsing ? 'erro_parsing' :
      valorPlanilha === 0 ? 'planilha_vazia' :
      Math.abs(diferenca) <= tolerancia ? 'ok' :
      valorDB === 0 ? 'sem_dados_db' :
      'divergente'

    report.push({
      mes,
      ano,
      tipo,
      tipo_gestao,
      arquivo: filename,
      valorPlanilha,
      valorDB,
      diferenca,
      status,
      erroParsing,
    })
  }

  // Ordenar por mês → tipo
  report.sort((a, b) => a.mes - b.mes || a.tipo.localeCompare(b.tipo))

  return NextResponse.json({ report, totalArquivos: arquivos.length, ano })
}

// ─── POST — Aplicar correção ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'analista') {
    return NextResponse.json({ error: 'Apenas analistas podem sincronizar planilhas' }, { status: 403 })
  }

  const body = await request.json()
  const { mes, ano, tipo } = body as { mes: number; ano: number; tipo: string }

  if (!mes || !ano || !tipo) {
    return NextResponse.json({ error: 'mes, ano e tipo são obrigatórios' }, { status: 400 })
  }

  const tipo_gestao = tipo.includes('adm') ? 'adm' : 'sub'

  // ── Localizar arquivo ────────────────────────────────────────────────
  const arquivos = descobrirArquivos(ano)
  const arq = arquivos.find(a => a.mes === mes && a.tipo === tipo)

  if (!arq) {
    return NextResponse.json({
      error: `Arquivo não encontrado para ${tipo} — ${mes}/${ano}. Verifique se a pasta "dados *" com o arquivo xlsx está no projeto.`,
    }, { status: 404 })
  }

  // ── Carregar mapas de DB ─────────────────────────────────────────────
  const { empMap, aptMap, firstAptByEmp } = await carregarMapas(supabase)

  // ── Parsear xlsx — usa aba RESULTADO como fonte de verdade ──────────────
  let parsed
  try {
    const buffer = fs.readFileSync(arq.filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false })
    // 1ª tentativa: aba RESULTADO (valores finais conferidos)
    parsed = parsePlanilhaResultado(workbook, empMap, aptMap, firstAptByEmp)
    // Fallback: se a aba RESULTADO não retornou dados por apt, usa abas individuais
    if (parsed.porApartamento.length === 0) {
      console.warn(`[sync-local] Aba RESULTADO sem dados por apt — usando abas individuais`)
      parsed = parsePlanilhaTotais(workbook, empMap, aptMap, firstAptByEmp)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Erro ao parsear arquivo: ${msg}` }, { status: 500 })
  }

  if (parsed.porApartamento.length === 0) {
    return NextResponse.json({
      error: 'Nenhum dado encontrado no arquivo. Verifique se o arquivo está no formato correto.',
    }, { status: 400 })
  }

  const dataRef = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  if (tipo.startsWith('custos')) {
    // ── CUSTOS: apagar e reinserir ──────────────────────────────────
    await supabase.from('custos').delete()
      .eq('mes', mes)
      .eq('ano', ano)
      .eq('tipo_gestao', tipo_gestao)

    const records = parsed.porApartamento.map(r => ({
      apartamento_id: r.apartamento_id,
      valor: r.valor,
      categoria: 'Total Consolidado',
      mes, ano, tipo_gestao,
    }))

    const { error } = await supabase.from('custos').insert(records)
    if (error) {
      return NextResponse.json({ error: `Erro ao inserir custos: ${error.message}` }, { status: 500 })
    }
  } else {
    // ── DIÁRIAS: armazenar totais mensais por apartamento na tabela diarias ──
    // Apagar registros xlsx-sourced existentes para o período
    await supabase.from('diarias').delete()
      .gte('data', dataRef)
      .lte('data', dataFim)
      .eq('tipo_gestao', tipo_gestao)

    const records = parsed.porApartamento.map(r => ({
      apartamento_id: r.apartamento_id,
      valor: r.valor,
      data: dataRef,   // data = primeiro dia do mês (representação mensal)
      tipo_gestao,
    }))

    const { error } = await supabase.from('diarias').insert(records)
    if (error) {
      return NextResponse.json({ error: `Erro ao inserir diárias: ${error.message}` }, { status: 500 })
    }
  }

  // ── Registrar no histórico de importações ─────────────────────────
  await supabase.from('importacoes').insert({
    nome_arquivo: arq.filename,
    tipo,
    mes,
    ano,
    status: 'concluido',
    importado_por: user.id,
  })

  return NextResponse.json({
    success: true,
    arquivo: arq.filename,
    registros: parsed.porApartamento.length,
    totalImportado: parsed.totalGeral,
    mes,
    ano,
    tipo,
  })
}

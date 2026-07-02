import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'
import { MESES_ABREV } from '@/lib/constants'
import { fetchAllRows } from '@/lib/supabase-fetch-all'

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * Export XLSX plano (uma linha por registro) de custos ou reservas.
 * GET /api/exportar-xlsx?tabela=custos|reservas&mes=6&ano=2026
 *
 * Leitura via cliente de sessão: a RLS garante que apenas internos
 * (admin/analista) enxergam o conjunto completo.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'analista'].includes(profile.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const tabela = searchParams.get('tabela')
  const mes = parseInt(searchParams.get('mes') ?? '0')
  const ano = parseInt(searchParams.get('ano') ?? '0')

  if (tabela !== 'custos' && tabela !== 'reservas') {
    return NextResponse.json({ error: 'Parâmetro tabela deve ser custos ou reservas' }, { status: 400 })
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'AlugEasy'
  wb.created = new Date()

  const headerStyle = (row: ExcelJS.Row) => {
    row.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' } }
    })
  }

  const periodoSufixo = [
    mes > 0 ? MESES_ABREV[mes - 1] : null,
    ano > 0 ? String(ano) : null,
  ].filter(Boolean).join('_') || 'todos'

  if (tabela === 'custos') {
    type Row = {
      mes: number; ano: number; categoria: string | null; valor: number | null
      tipo_gestao: string | null; origem: string | null; observacao: string | null
      apartamentos: { numero: string; empreendimentos: { nome: string } | null } | null
    }

    // Paginado: o cap db-max-rows do PostgREST (1000) ignora .limit() maiores.
    // Ordenação com tiebreaker único (id) para páginas estáveis.
    const { rows, error } = await fetchAllRows<Row>((f, t) => {
      let query = supabase
        .from('custos')
        .select('id, mes, ano, categoria, valor, tipo_gestao, origem, observacao, apartamentos(numero, empreendimentos(nome))')
        .order('ano').order('mes').order('categoria').order('id')
      if (mes > 0) query = query.eq('mes', mes) as typeof query
      if (ano > 0) query = query.eq('ano', ano) as typeof query
      return query.range(f, t) as unknown as Page<Row>
    })
    if (error) return NextResponse.json({ error }, { status: 500 })

    const sheet = wb.addWorksheet('CUSTOS')
    sheet.columns = [
      { header: 'Empreendimento', key: 'emp', width: 20 },
      { header: 'Apartamento', key: 'apt', width: 14 },
      { header: 'Categoria', key: 'cat', width: 28 },
      { header: 'Valor (R$)', key: 'valor', width: 14 },
      { header: 'Gestão', key: 'gestao', width: 10 },
      { header: 'Origem', key: 'origem', width: 12 },
      { header: 'Observação', key: 'obs', width: 32 },
      { header: 'Mês', key: 'mes', width: 6 },
      { header: 'Ano', key: 'ano', width: 8 },
    ]
    headerStyle(sheet.getRow(1))

    for (const r of rows) {
      sheet.addRow({
        emp: r.apartamentos?.empreendimentos?.nome ?? '—',
        apt: r.apartamentos?.numero ?? '—',
        cat: r.categoria ?? '—',
        valor: r.valor ?? 0,
        gestao: (r.tipo_gestao ?? '').toUpperCase(),
        origem: r.origem ?? '',
        obs: r.observacao ?? '',
        mes: r.mes,
        ano: r.ano,
      })
    }
    sheet.getColumn('valor').numFmt = '#,##0.00'

    const totalRow = sheet.addRow({ cat: 'TOTAL', valor: rows.reduce((s, r) => s + (r.valor ?? 0), 0) })
    totalRow.font = { bold: true }

    const buffer = await wb.xlsx.writeBuffer()
    return xlsxResponse(buffer as ArrayBuffer, `CUSTOS_${periodoSufixo}.xlsx`)
  }

  // reservas
  type ReservaRow = {
    booking_id: string; checkin: string | null; checkout: string | null
    nome_hospede: string | null; individual_room_number: string | null
    plataforma_normalizada: string | null; status: string | null
    valor_bruto: number | null; valor_liquido: number | null
    mes_competencia: number; ano_competencia: number
  }

  // Paginado com tiebreaker único (booking_id) — mesmo motivo do export de custos.
  const { rows, error } = await fetchAllRows<ReservaRow>((f, t) => {
    let query = supabase
      .from('amenitiz_reservas')
      .select('booking_id, checkin, checkout, nome_hospede, individual_room_number, plataforma_normalizada, status, valor_bruto, valor_liquido, mes_competencia, ano_competencia')
      .order('checkin').order('booking_id')
    if (mes > 0) query = query.eq('mes_competencia', mes) as typeof query
    if (ano > 0) query = query.eq('ano_competencia', ano) as typeof query
    return query.range(f, t) as unknown as Page<ReservaRow>
  })
  if (error) return NextResponse.json({ error }, { status: 500 })

  const sheet = wb.addWorksheet('RESERVAS')
  sheet.columns = [
    { header: 'Booking ID', key: 'id', width: 16 },
    { header: 'Check-in', key: 'ci', width: 12 },
    { header: 'Check-out', key: 'co', width: 12 },
    { header: 'Hóspede', key: 'hospede', width: 28 },
    { header: 'Apartamento', key: 'apt', width: 14 },
    { header: 'Plataforma', key: 'plat', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Valor Bruto (R$)', key: 'bruto', width: 16 },
    { header: 'Valor Líquido (R$)', key: 'liquido', width: 16 },
    { header: 'Competência', key: 'comp', width: 12 },
  ]
  headerStyle(sheet.getRow(1))

  for (const r of rows) {
    sheet.addRow({
      id: r.booking_id,
      ci: r.checkin ?? '',
      co: r.checkout ?? '',
      hospede: r.nome_hospede ?? '',
      apt: r.individual_room_number ?? '',
      plat: r.plataforma_normalizada ?? '',
      status: r.status ?? '',
      bruto: r.valor_bruto ?? 0,
      liquido: r.valor_liquido ?? 0,
      comp: `${String(r.mes_competencia).padStart(2, '0')}/${r.ano_competencia}`,
    })
  }
  sheet.getColumn('bruto').numFmt = '#,##0.00'
  sheet.getColumn('liquido').numFmt = '#,##0.00'

  const totalRow = sheet.addRow({
    status: 'TOTAL',
    bruto: rows.reduce((s, r) => s + (r.valor_bruto ?? 0), 0),
    liquido: rows.reduce((s, r) => s + (r.valor_liquido ?? 0), 0),
  })
  totalRow.font = { bold: true }

  const buffer = await wb.xlsx.writeBuffer()
  return xlsxResponse(buffer as ArrayBuffer, `RESERVAS_${periodoSufixo}.xlsx`)
}

function xlsxResponse(buffer: ArrayBuffer, filename: string) {
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
    },
  })
}

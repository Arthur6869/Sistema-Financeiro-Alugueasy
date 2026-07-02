import { NextRequest, NextResponse } from 'next/server'
import { isInternalApiRequest } from '@/lib/internal-api-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAnalista } from '@/lib/api-auth'
import { registrarAuditoria } from '@/lib/audit'
import { fetchAllRows } from '@/lib/supabase-fetch-all'

export async function DELETE(request: NextRequest) {
  const auditBase = {
    usuarioId: null as string | null,
    origem: 'web' as 'web' | 'interna',
    mes: 0,
    ano: 0,
  }

  try {
    const { searchParams } = new URL(request.url)
    const mes = parseInt(searchParams.get('mes') || '')
    const ano = parseInt(searchParams.get('ano') || '')

    if (!mes || !ano || mes < 1 || mes > 12 || ano < 2000 || ano > 2100) {
      return NextResponse.json(
        { error: 'Parâmetros mes (1-12) e ano válidos são obrigatórios' },
        { status: 400 }
      )
    }
    auditBase.mes = mes
    auditBase.ano = ano

    const internalRequest = isInternalApiRequest(request)
    let supabase

    if (internalRequest) {
      auditBase.origem = 'interna'
      supabase = createAdminClient()
    } else {
      const auth = await requireAnalista()
      if (auth.response) return auth.response
      auditBase.usuarioId = auth.user.id
      supabase = auth.supabase
    }

    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

    console.log(`[LIMPEZA] Iniciando limpeza de ${mes}/${ano}...`)

    // ── 1. Snapshot completo (paginado — o cap db-max-rows de 1000 linhas
    //       truncaria um select simples, enquanto o DELETE removeria tudo).
    //       raw_data das reservas é omitido (volume). Qualquer erro de leitura
    //       ABORTA antes de apagar: sem snapshot íntegro não há recuperação.
    const sb = supabase
    const [snapDiarias, snapCustos, snapImportacoes, snapReservas, snapSyncs] = await Promise.all([
      fetchAllRows((f, t) => sb.from('diarias').select('*').gte('data', dataInicio).lte('data', dataFim).range(f, t)),
      fetchAllRows((f, t) => sb.from('custos').select('*').eq('mes', mes).eq('ano', ano).range(f, t)),
      fetchAllRows((f, t) => sb.from('importacoes').select('*').eq('mes', mes).eq('ano', ano).range(f, t)),
      fetchAllRows((f, t) => sb.from('amenitiz_reservas')
        .select('booking_id, status, source, checkin, checkout, individual_room_number, apartamento_id, valor_bruto, valor_liquido, nome_hospede, mes_competencia, ano_competencia')
        .eq('mes_competencia', mes).eq('ano_competencia', ano).range(f, t)),
      fetchAllRows((f, t) => sb.from('amenitiz_syncs').select('*').eq('mes', mes).eq('ano', ano).range(f, t)),
    ])

    const snapErro = [snapDiarias, snapCustos, snapImportacoes, snapReservas, snapSyncs]
      .map(s => s.error).find(Boolean)
    if (snapErro) {
      return NextResponse.json(
        { error: `Falha ao ler os dados para auditoria — nada foi apagado: ${snapErro}` },
        { status: 500 }
      )
    }

    // ── 2. Persistir o snapshot ANTES dos deletes. Se a auditoria não gravar,
    //       aborta: a garantia de recuperação é pré-condição da limpeza.
    const snapshotGravado = await registrarAuditoria({
      usuarioId: auditBase.usuarioId,
      origem: auditBase.origem,
      acao: 'clear_periodo_snapshot',
      detalhes: {
        mes, ano,
        snapshot: {
          diarias: snapDiarias.rows,
          custos: snapCustos.rows,
          importacoes: snapImportacoes.rows,
          amenitiz_reservas: snapReservas.rows,
          amenitiz_syncs: snapSyncs.rows,
        },
      },
    })
    if (!snapshotGravado) {
      return NextResponse.json(
        { error: 'Falha ao gravar o snapshot de auditoria — nada foi apagado' },
        { status: 500 }
      )
    }

    // ── 3. Deletes com contagem real. diarias/custos abortam em erro (com
    //       auditoria do resultado parcial); os demais registram a falha e seguem.
    const removed = { diarias: 0, custos: 0, importacoes: 0, amenitiz_reservas: 0, amenitiz_syncs: 0 }
    const falhas: string[] = []

    const auditarResultado = async () => {
      const total = Object.values(removed).reduce((s, n) => s + n, 0)
      await registrarAuditoria({
        usuarioId: auditBase.usuarioId,
        origem: auditBase.origem,
        acao: 'clear_periodo_resultado',
        registrosAfetados: total,
        detalhes: { mes, ano, removed, falhas },
      })
      return total
    }

    const { count: delDiarias, error: errDiarias } = await supabase
      .from('diarias')
      .delete({ count: 'exact' })
      .gte('data', dataInicio)
      .lte('data', dataFim)
    if (errDiarias) {
      falhas.push(`diarias: ${errDiarias.message}`)
      await auditarResultado()
      return NextResponse.json({ error: `Erro ao limpar diárias: ${errDiarias.message}` }, { status: 500 })
    }
    removed.diarias = delDiarias ?? 0

    const { count: delCustos, error: errCustos } = await supabase
      .from('custos')
      .delete({ count: 'exact' })
      .eq('mes', mes)
      .eq('ano', ano)
    if (errCustos) {
      falhas.push(`custos: ${errCustos.message}`)
      await auditarResultado()
      return NextResponse.json({ error: `Erro ao limpar custos: ${errCustos.message}` }, { status: 500 })
    }
    removed.custos = delCustos ?? 0

    const { count: delImportacoes, error: errImportacoes } = await supabase
      .from('importacoes')
      .delete({ count: 'exact' })
      .eq('mes', mes)
      .eq('ano', ano)
    if (errImportacoes) falhas.push(`importacoes: ${errImportacoes.message}`)
    else removed.importacoes = delImportacoes ?? 0

    const { count: delReservas, error: errReservas } = await supabase
      .from('amenitiz_reservas')
      .delete({ count: 'exact' })
      .eq('mes_competencia', mes)
      .eq('ano_competencia', ano)
    if (errReservas) falhas.push(`amenitiz_reservas: ${errReservas.message}`)
    else removed.amenitiz_reservas = delReservas ?? 0

    const { count: delSyncs, error: errSyncs } = await supabase
      .from('amenitiz_syncs')
      .delete({ count: 'exact' })
      .eq('mes', mes)
      .eq('ano', ano)
    if (errSyncs) falhas.push(`amenitiz_syncs: ${errSyncs.message}`)
    else removed.amenitiz_syncs = delSyncs ?? 0

    const totalRemovido = await auditarResultado()

    console.log(`[LIMPEZA] ✓ Limpeza concluída — ${totalRemovido} registro(s) removido(s)${falhas.length ? ` | falhas: ${falhas.join('; ')}` : ''}`)

    return NextResponse.json({
      success: falhas.length === 0,
      message: falhas.length === 0
        ? `Dados de ${mes}/${ano} removidos com sucesso.`
        : `Dados de ${mes}/${ano} parcialmente removidos — falhas: ${falhas.join('; ')}`,
      removed,
      ...(falhas.length > 0 ? { falhas } : {}),
    })

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Erro na limpeza:', msg)
    await registrarAuditoria({
      usuarioId: auditBase.usuarioId,
      origem: auditBase.origem,
      acao: 'clear_periodo_erro',
      detalhes: { mes: auditBase.mes, ano: auditBase.ano, erro: msg },
    })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

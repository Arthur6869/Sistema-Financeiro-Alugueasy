import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = parseInt(searchParams.get('mes') || '')
    const ano = parseInt(searchParams.get('ano') || '')

    if (!mes || !ano) {
      return NextResponse.json(
        { error: 'Parâmetros mes e ano são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'analista') {
      return NextResponse.json({ error: 'Apenas analistas podem limpar dados' }, { status: 403 })
    }

    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

    console.log(`[LIMPEZA] Iniciando limpeza de ${mes}/${ano}...`)

    // Apagar diárias do período
    const { count: diariasCount, error: errDiarias } = await supabase
      .from('diarias')
      .delete()
      .gte('data', dataInicio)
      .lte('data', dataFim)

    if (errDiarias) {
      console.error('Erro ao limpar diárias:', errDiarias)
      return NextResponse.json(
        { error: `Erro ao limpar diárias: ${errDiarias.message}` },
        { status: 500 }
      )
    }

    console.log(`[LIMPEZA] Apagadas ${diariasCount} registros de diárias`)

    // Apagar custos do período
    const { count: custosCount, error: errCustos } = await supabase
      .from('custos')
      .delete()
      .eq('mes', mes)
      .eq('ano', ano)

    if (errCustos) {
      console.error('Erro ao limpar custos:', errCustos)
      return NextResponse.json(
        { error: `Erro ao limpar custos: ${errCustos.message}` },
        { status: 500 }
      )
    }

    console.log(`[LIMPEZA] Apagados ${custosCount} registros de custos`)

    // Apagar importações do período
    const { count: importCount, error: errImportacoes } = await supabase
      .from('importacoes')
      .delete()
      .eq('mes', mes)
      .eq('ano', ano)

    if (errImportacoes) {
      console.warn('Aviso ao limpar importações:', errImportacoes.message)
    } else {
      console.log(`[LIMPEZA] Apagados ${importCount} registros de importações`)
    }

    // Apagar reservas Amenitiz do período
    const { count: reservasCount, error: errReservas } = await supabase
      .from('amenitiz_reservas')
      .delete()
      .eq('mes_competencia', mes)
      .eq('ano_competencia', ano)

    if (errReservas) {
      console.warn('Aviso ao limpar reservas Amenitiz:', errReservas.message)
    } else {
      console.log(`[LIMPEZA] Apagados ${reservasCount} registros de amenitiz_reservas`)
    }

    // Apagar log de sincronização Amenitiz do período
    const { count: syncsCount, error: errSyncs } = await supabase
      .from('amenitiz_syncs')
      .delete()
      .eq('mes', mes)
      .eq('ano', ano)

    if (errSyncs) {
      console.warn('Aviso ao limpar syncs Amenitiz:', errSyncs.message)
    } else {
      console.log(`[LIMPEZA] Apagados ${syncsCount} registros de amenitiz_syncs`)
    }

    console.log(`[LIMPEZA] ✓ Limpeza concluída com sucesso`)

    return NextResponse.json({
      success: true,
      message: `Dados de ${mes}/${ano} removidos com sucesso.`,
      removed: {
        diarias: diariasCount || 0,
        custos: custosCount || 0,
        importacoes: importCount || 0,
        amenitiz_reservas: reservasCount || 0,
        amenitiz_syncs: syncsCount || 0,
      }
    })

  } catch (error: any) {
    console.error('Erro na limpeza:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

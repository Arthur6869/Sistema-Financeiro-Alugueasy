import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pdf } from '@react-pdf/renderer'
import { PrestacaoContasPdf } from '@/components/pdf/prestacao-contas-pdf'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { formatCurrency, MESES } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const apartamentoId = searchParams.get('apartamento_id')
    const mes = parseInt(searchParams.get('mes') || '')
    const ano = parseInt(searchParams.get('ano') || '')

    if (!apartamentoId || !mes || !ano) {
      return NextResponse.json({ error: 'apartamento_id, mes e ano são obrigatórios' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: apt, error: aptErr } = await supabase
      .from('apartamentos')
      .select('id, numero, taxa_repasse, tipo_repasse, nome_proprietario, modelo_contrato, empreendimentos(id, nome)')
      .eq('id', apartamentoId)
      .single()

    if (aptErr || !apt) {
      return NextResponse.json({ error: 'Apartamento não encontrado' }, { status: 404 })
    }

    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

    const [{ data: diarias, error: diariasErr }, { data: custos, error: custosErr }] = await Promise.all([
      supabase.from('diarias').select('valor, tipo_gestao').eq('apartamento_id', apartamentoId).gte('data', dataInicio).lte('data', dataFim),
      supabase.from('custos').select('valor, categoria, tipo_gestao').eq('apartamento_id', apartamentoId).eq('mes', mes).eq('ano', ano),
    ])

    if (diariasErr || custosErr) {
      return NextResponse.json({ error: 'Erro ao buscar dados financeiros' }, { status: 500 })
    }

    const receitaAdm = (diarias ?? []).filter((d) => d.tipo_gestao === 'adm').reduce((sum, d) => sum + Number(d.valor ?? 0), 0)
    const receitaSub = (diarias ?? []).filter((d) => d.tipo_gestao === 'sub').reduce((sum, d) => sum + Number(d.valor ?? 0), 0)
    const receitaTotal = receitaAdm + receitaSub
    const custosAdm = (custos ?? []).filter((c) => c.tipo_gestao === 'adm').reduce((sum, c) => sum + Number(c.valor ?? 0), 0)
    const custosSub = (custos ?? []).filter((c) => c.tipo_gestao === 'sub').reduce((sum, c) => sum + Number(c.valor ?? 0), 0)
    const custosTotal = custosAdm + custosSub
    const lucroLiquido = receitaTotal - custosTotal
    const taxa = Number(apt.taxa_repasse ?? 0) / 100
    const baseCalculo = apt.tipo_repasse === 'faturamento' ? receitaTotal : lucroLiquido
    const valorRepasse = baseCalculo * taxa
    const valorLiquidoProprietario = lucroLiquido - valorRepasse
    const margemLiquida = receitaTotal > 0 ? ((lucroLiquido / receitaTotal) * 100).toFixed(2) : '0,00'
    const percentualCustos = receitaTotal > 0 ? `${((custosTotal / receitaTotal) * 100).toFixed(2)}%` : '0,00%'

    const detalheCustos = (custos ?? []).map((c) => ({
      categoria: c.categoria ?? 'Desconhecido',
      tipoGestao: c.tipo_gestao === 'adm' ? 'ADM' : 'SUB',
      valor: formatCurrency(Number(c.valor ?? 0)),
    }))

    const baseCalculoLabel = apt.tipo_repasse === 'faturamento' ? 'Faturamento Bruto' : 'Lucro Líquido'
    const repasseLabelBase = apt.tipo_repasse === 'faturamento' ? 'faturamento bruto' : 'lucro líquido'

    const logoPath = path.resolve(process.cwd(), 'public', 'logo-alugueasy.png')
    const logoFile = readFileSync(logoPath)
    const logoBase64 = `data:image/png;base64,${logoFile.toString('base64')}`

    const lucroAdmNum   = receitaAdm - custosAdm
    const lucroSubNum   = receitaSub - custosSub

    const document = (
      <PrestacaoContasPdf
        logoBase64={logoBase64}
        empreendimento={(apt.empreendimentos as Array<{nome: string}>)?.[0]?.nome ?? ''}
        apartamento={apt.numero}
        mesNome={MESES[mes - 1]}
        ano={`${ano}`}
        nomeProprietario={apt.nome_proprietario ?? 'Não configurado'}
        modeloContrato={apt.modelo_contrato ?? 'administracao'}
        receitaBruta={formatCurrency(receitaTotal)}
        custosTotais={formatCurrency(custosTotal)}
        lucroLiquido={`${lucroLiquido >= 0 ? '' : '-'}${formatCurrency(Math.abs(lucroLiquido))}`}
        repasse={formatCurrency(valorRepasse)}
        baseCalculoLabel={`${Number(apt.taxa_repasse ?? 0).toFixed(2).replace('.', ',')}% sobre ${repasseLabelBase}`}
        valorLiquidoProprietario={formatCurrency(valorLiquidoProprietario)}
        margemLiquida={`${margemLiquida}%`}
        percentualCustos={percentualCustos}
        receitaAdm={receitaAdm > 0 ? formatCurrency(receitaAdm) : ''}
        custosAdm={custosAdm > 0 ? formatCurrency(custosAdm) : ''}
        lucroAdm={lucroAdmNum !== 0 ? `${lucroAdmNum < 0 ? '-' : ''}${formatCurrency(Math.abs(lucroAdmNum))}` : ''}
        receitaSub={receitaSub > 0 ? formatCurrency(receitaSub) : ''}
        custosSub={custosSub > 0 ? formatCurrency(custosSub) : ''}
        lucroSub={lucroSubNum !== 0 ? `${lucroSubNum < 0 ? '-' : ''}${formatCurrency(Math.abs(lucroSubNum))}` : ''}
        detalheCustos={detalheCustos}
        receitaTotal={receitaTotal}
        custosTotal={custosTotal}
        lucroLiquidoNum={lucroLiquido}
        valorRepasseNum={valorRepasse}
      />
    )

    const pdfBytes = await pdf(document).toBuffer()

    const fileName = `Prestacao_${(apt.empreendimentos as Array<{nome: string}>)?.[0]?.nome ?? 'Imovel'}_${apt.numero}_${mes}_${ano}.pdf`

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao gerar o PDF' }, { status: 500 })
  }
}

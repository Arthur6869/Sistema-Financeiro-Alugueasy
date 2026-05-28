import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pdf } from '@react-pdf/renderer'
import { RelatorioDesempenhoPdf } from '@/components/pdf/relatorio-desempenho-pdf'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { MESES } from '@/lib/constants'

function r2(n: number) { return Math.round(n * 100) / 100 }

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const mes = parseInt(searchParams.get('mes') || '')
    const ano = parseInt(searchParams.get('ano') || '')

    if (!mes || !ano || mes < 1 || mes > 12)
      return NextResponse.json({ error: 'mes e ano são obrigatórios' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user)
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const admin = createAdminClient()

    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

    const [
      { data: empreendimentosRaw },
      { data: apartamentosRaw },
      { data: diariasRaw },
      { data: custosRaw },
    ] = await Promise.all([
      admin.from('empreendimentos').select('id, nome').order('nome'),
      admin.from('apartamentos').select('id, numero, empreendimento_id, nome_proprietario, tipo_gestao, taxa_repasse, tipo_repasse'),
      admin.from('diarias').select('apartamento_id, valor').gte('data', dataInicio).lte('data', dataFim),
      admin.from('custos').select('apartamento_id, valor').eq('mes', mes).eq('ano', ano),
    ])

    const empreendimentos = (empreendimentosRaw ?? []) as Array<{ id: string; nome: string }>
    const apartamentos = (apartamentosRaw ?? []) as Array<{ id: string; numero: string | number; empreendimento_id: string }>
    const diarias = (diariasRaw ?? []) as Array<{ apartamento_id: string; valor: number | null }>
    const custos = (custosRaw ?? []) as Array<{ apartamento_id: string; valor: number | null }>

    // Mapas de somas por apartamento
    const fatPorApt: Record<string, number> = {}
    const custosPorApt: Record<string, number> = {}

    for (const d of diarias) {
      if (!d.apartamento_id) continue
      fatPorApt[d.apartamento_id] = (fatPorApt[d.apartamento_id] ?? 0) + Number(d.valor ?? 0)
    }
    for (const c of custos) {
      if (!c.apartamento_id) continue
      custosPorApt[c.apartamento_id] = (custosPorApt[c.apartamento_id] ?? 0) + Number(c.valor ?? 0)
    }

    // Mapa empreendimento_id → apartamentos
    const aptsPorEmp: Record<string, typeof apartamentos> = {}
    for (const apt of apartamentos) {
      if (!apt.empreendimento_id) continue
      if (!aptsPorEmp[apt.empreendimento_id]) aptsPorEmp[apt.empreendimento_id] = []
      aptsPorEmp[apt.empreendimento_id].push(apt)
    }

    let grandFaturamento = 0
    let grandCustos = 0

    const empsComDados = empreendimentos.map((emp) => {
      const aptsDoEmp = aptsPorEmp[emp.id] ?? []

      const aptDesempenhos = aptsDoEmp.map((apt) => {
        const fat = r2(fatPorApt[apt.id] ?? 0)
        const cus = r2(custosPorApt[apt.id] ?? 0)
        const lucro = r2(fat - cus)
        const margem = fat > 0 ? r2((lucro / fat) * 100) : 0
        return {
          id: apt.id,
          numero: String(apt.numero),
          empreendimentoId: emp.id,
          empreendimentoNome: emp.nome,
          faturamento: fat,
          custos: cus,
          lucroLiquido: lucro,
          margemLucro: margem,
          status: (lucro >= 0 ? 'lucro' : 'prejuizo') as 'lucro' | 'prejuizo',
        }
      })

      const totalFaturamento = r2(aptDesempenhos.reduce((s, a) => s + a.faturamento, 0))
      const totalCustos = r2(aptDesempenhos.reduce((s, a) => s + a.custos, 0))
      const totalLucro = r2(totalFaturamento - totalCustos)
      const margemEmpreendimento = totalFaturamento > 0 ? r2((totalLucro / totalFaturamento) * 100) : 0
      const aptsLucro = aptDesempenhos.filter((a) => a.lucroLiquido >= 0).length
      const aptsPrejuizo = aptDesempenhos.filter((a) => a.lucroLiquido < 0).length

      grandFaturamento += totalFaturamento
      grandCustos += totalCustos

      return {
        id: emp.id,
        nome: emp.nome,
        totalFaturamento,
        totalCustos,
        totalLucro,
        margemEmpreendimento,
        aptsLucro,
        aptsPrejuizo,
        status: (totalLucro >= 0 ? 'lucro' : 'prejuizo') as 'lucro' | 'prejuizo',
        apartamentos: aptDesempenhos,
      }
    })

    const grandLucro = r2(grandFaturamento - grandCustos)
    const margemMedia = grandFaturamento > 0 ? r2((grandLucro / grandFaturamento) * 100) : 0

    const logoPath = path.resolve(process.cwd(), 'public', 'logo-alugueasy.png')
    const logoBase64 = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`

    const dataGeracao = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    const document = (
      <RelatorioDesempenhoPdf
        logoBase64={logoBase64}
        mesNome={MESES[mes - 1]}
        ano={ano}
        dataGeracao={dataGeracao}
        empreendimentos={empsComDados}
        totalFaturamento={grandFaturamento}
        totalCustos={grandCustos}
        totalLucro={grandLucro}
        margemMedia={margemMedia}
      />
    )

    const pdfBytes = await pdf(document).toBuffer()

    return new Response(pdfBytes as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Relatorio_Desempenho_${MESES[mes - 1]}-${ano}.pdf"`,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao gerar o PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

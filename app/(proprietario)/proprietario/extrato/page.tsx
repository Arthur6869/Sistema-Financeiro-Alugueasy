import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AlertTriangle, Download } from 'lucide-react'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { MESES } from '@/lib/constants'

type SearchParams = Promise<{ mes?: string; ano?: string }>

type ApartamentoVinculo = {
  id: string
  numero: string
  tipo_gestao: 'adm' | 'sub' | null
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  empreendimentos: { nome: string } | null
}

type CustoItem = {
  apartamento_id: string
  categoria: string
  valor: number
}

type DiariasItem = {
  apartamento_id: string
  valor: number
}

function calcularRepasse(
  faturamento: number,
  lucro: number,
  taxaRepasse: number,
  tipoRepasse: 'lucro' | 'faturamento'
) {
  const base = tipoRepasse === 'faturamento' ? faturamento : lucro
  return base * (taxaRepasse / 100)
}

function formatBRL(valor: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default async function ExtratoPropPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'proprietario') redirect('/')

  const params = await searchParams
  const now = new Date()
  // Parâmetro inválido (?ano=0, ?mes=abc) cai no período atual — ver proprietario/page.tsx
  const mesParam = params.mes !== undefined ? parseInt(params.mes) : NaN
  const anoParam = params.ano !== undefined ? parseInt(params.ano) : NaN
  const mes = mesParam >= 0 && mesParam <= 12 ? mesParam : now.getMonth() + 1
  const ano = anoParam >= 2000 && anoParam <= 2100 ? anoParam : now.getFullYear()
  const nomeMes = mes > 0 ? (MESES[mes - 1] ?? '') : ''
  const labelPeriodo = nomeMes ? `${nomeMes} ${ano}` : String(ano)

  const { data: vinculos } = await supabase
    .from('proprietario_apartamentos')
    .select('apartamentos(id, numero, tipo_gestao, taxa_repasse, tipo_repasse, empreendimentos(nome))')
    .eq('proprietario_id', user.id)
    .eq('ativo', true)

  type VinculoRow = { apartamentos: ApartamentoVinculo | null }
  const apartamentos: ApartamentoVinculo[] = ((vinculos ?? []) as unknown as VinculoRow[])
    .map(v => v.apartamentos)
    .filter((a): a is ApartamentoVinculo => a !== null)

  const aptIds = apartamentos.map(a => a.id)

  const dataInicio = mes > 0
    ? `${ano}-${String(mes).padStart(2, '0')}-01`
    : `${ano}-01-01`
  const dataFim = mes > 0
    ? new Date(ano, mes, 0).toISOString().slice(0, 10)
    : `${ano}-12-31`

  const admin = createAdminClient()

  // Custos completos das planilhas (todos os lançamentos) — via admin para bypass de RLS,
  // isolado pelos aptIds já filtrados pelo vínculo do proprietário autenticado.
  const custosDetalheQuery = mes > 0
    ? admin.from('custos')
        .select('apartamento_id, categoria, valor')
        .in('apartamento_id', aptIds)
        .eq('mes', mes).eq('ano', ano)
        .order('categoria')
    : admin.from('custos')
        .select('apartamento_id, categoria, valor')
        .in('apartamento_id', aptIds)
        .eq('ano', ano)
        .order('categoria')

  // Custos repassáveis — apenas para calcular lucro e repasse ao proprietário.
  const custosRepasseQuery = mes > 0
    ? supabase.from('custos_proprietario')
        .select('apartamento_id, valor')
        .in('apartamento_id', aptIds)
        .eq('mes', mes).eq('ano', ano)
    : supabase.from('custos_proprietario')
        .select('apartamento_id, valor')
        .in('apartamento_id', aptIds)
        .eq('ano', ano)

  const [
    { data: custosDetalheData },
    { data: custosRepasseData },
    { data: diariasData },
  ] = await Promise.all([
    custosDetalheQuery,
    custosRepasseQuery,
    supabase
      .from('diarias')
      .select('apartamento_id, valor')
      .in('apartamento_id', aptIds)
      .gte('data', dataInicio)
      .lte('data', dataFim),
  ])

  const custosDetalhe = (custosDetalheData ?? []) as CustoItem[]
  const custosRepasseItens = (custosRepasseData ?? []) as { apartamento_id: string; valor: number }[]
  const diarias = (diariasData ?? []) as DiariasItem[]

  const metricas = apartamentos.map(apt => {
    const faturamento = diarias
      .filter(d => d.apartamento_id === apt.id)
      .reduce((s, d) => s + (d.valor ?? 0), 0)

    // Todos os custos lançados nas planilhas (para exibição)
    const custosPorCategoria = custosDetalhe.filter(c => c.apartamento_id === apt.id)
    const totalCustosDisplay = custosPorCategoria.reduce((s, c) => s + (c.valor ?? 0), 0)
    const semCustos = custosPorCategoria.length === 0

    // Apenas custos repassáveis (para cálculo de lucro e repasse)
    const custosRepasse = custosRepasseItens
      .filter(c => c.apartamento_id === apt.id)
      .reduce((s, c) => s + (c.valor ?? 0), 0)

    const lucro = faturamento - custosRepasse
    const taxaRepasse = apt.taxa_repasse ?? 0
    const tipoRepasse = apt.tipo_repasse ?? 'lucro'
    const repasse = calcularRepasse(faturamento, lucro, taxaRepasse, tipoRepasse)
    const valorFinal = lucro - repasse

    return { apt, faturamento, totalCustosDisplay, semCustos, lucro, repasse, valorFinal, taxaRepasse, tipoRepasse, custosPorCategoria }
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .pg-wrap { font-family: 'DM Sans', sans-serif; max-width: 1100px; margin: 0 auto; padding: 32px 28px 64px; }

        .pg-head { display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 28px; }
        .pg-greeting { font-family: 'Instrument Serif', Georgia, serif; font-size: 28px; font-weight: 400; color: #0f1a2e; margin-bottom: 4px; }
        .pg-greeting-sub { font-size: 13px; color: #5a6a82; }
        .pg-period select { font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; color: #0f1a2e; background: #fff; border: 1px solid #e7e9ee; border-radius: 9px; padding: 9px 14px; cursor: pointer; outline: none; }
        .pg-period { display: flex; gap: 8px; align-items: center; }

        .apt-card { border: 1px solid #e7e9ee; border-radius: 16px; overflow: hidden; margin-bottom: 16px; background: #fff; }
        .apt-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: #fff; border-bottom: 1px solid #e7e9ee; flex-wrap: wrap; gap: 8px; }
        .apt-name { font-size: 15px; font-weight: 700; color: #0f1a2e; }
        .apt-badge { font-size: 11px; font-weight: 600; letter-spacing: .03em; padding: 4px 12px; border-radius: 100px; }
        .badge-adm { background: #e6f1fb; color: #0c447c; }
        .badge-sub { background: #faeeda; color: #854f0b; }

        .apt-body { padding: 0 20px; }
        .apt-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #f1f2f5; }
        .apt-row:last-child { border-bottom: none; }
        .apt-row-label { font-size: 13.5px; color: #374151; font-weight: 500; }
        .apt-row-val { font-size: 14px; font-weight: 600; color: #0f1a2e; }
        .apt-row-val.muted { color: #94a3b8; font-weight: 500; font-style: italic; font-size: 12.5px; }

        /* Linhas de custo por categoria (sub-itens) */
        .apt-row-sub { display: flex; align-items: center; justify-content: space-between; padding: 9px 0 9px 20px; border-bottom: 1px solid #f1f2f5; }
        .apt-row-sub:last-child { border-bottom: none; }
        .apt-row-sub-label { font-size: 12.5px; color: #6b7280; display: flex; align-items: center; gap: 6px; }
        .apt-row-sub-val { font-size: 12.5px; font-weight: 500; color: #374151; }

        .apt-foot { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: #f8fafc; border-top: 1px solid #e7e9ee; gap: 12px; flex-wrap: wrap; }
        .apt-foot-left { display: flex; flex-direction: column; gap: 2px; }
        .apt-foot-label { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6b7280; }
        .apt-foot-val { font-size: 22px; font-weight: 700; color: #14532d; letter-spacing: -.01em; }
        .btn-pdf { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: #fff; background: #193660; border: none; border-radius: 10px; padding: 11px 18px; cursor: pointer; transition: all .15s; text-decoration: none; white-space: nowrap; }
        .btn-pdf:hover { background: #0f2647; }

        .warn-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 16px; display: flex; gap: 10px; align-items: flex-start; margin: 0 0 2px; }
        .warn-text { font-size: 12.5px; color: #92400e; line-height: 1.5; }

        .empty-page { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 20px; text-align: center; border: 1px solid #e7e9ee; border-radius: 18px; background: #fff; }

        @media (max-width: 900px) { .summary-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="pg-wrap">

        <div className="pg-head">
          <div>
            <h1 className="pg-greeting">Rentabilidade — {labelPeriodo}</h1>
            <p className="pg-greeting-sub">Demonstrativo completo de faturamento, custos e repasse</p>
          </div>
          <div className="pg-period" data-tour="ext-periodo">
            <MonthYearFilter mes={mes} ano={ano} permitirTodosAnos={false} />
          </div>
        </div>

        {metricas.length === 0 ? (
          <div className="empty-page">
            <p style={{ fontSize: 14, fontWeight: 600, color: '#0f1a2e', marginBottom: 4 }}>Nenhum dado disponível</p>
            <p style={{ fontSize: 12.5, color: '#94a3b8' }}>Não há lançamentos para {labelPeriodo} ainda.</p>
          </div>
        ) : (
          <>
            {metricas.map(({ apt, faturamento, totalCustosDisplay, semCustos, lucro, repasse, valorFinal, taxaRepasse, tipoRepasse, custosPorCategoria }, idx) => (
              <div className="apt-card" key={apt.id}>
                {/* Cabeçalho — data-tour apenas no 1º cartão (alvos do tour da ALU) */}
                <div className="apt-head" data-tour={idx === 0 ? 'ext-card-head' : undefined}>
                  <span className="apt-name">
                    Apto {apt.numero}{apt.empreendimentos?.nome ? ` — ${apt.empreendimentos.nome}` : ''}
                  </span>
                  <span className={`apt-badge ${apt.tipo_gestao === 'adm' ? 'badge-adm' : 'badge-sub'}`}>
                    {apt.tipo_gestao === 'adm' ? 'Administração' : 'Sublocação'}
                  </span>
                </div>

                {/* Linhas financeiras */}
                <div className="apt-body">

                  {/* Faturamento */}
                  <div className="apt-row" data-tour={idx === 0 ? 'ext-faturamento' : undefined}>
                    <span className="apt-row-label">Faturamento</span>
                    <span className="apt-row-val">R$ {formatBRL(faturamento)}</span>
                  </div>

                  {/* Custos — total + breakdown por categoria (todos os lançamentos da planilha) */}
                  <div className="apt-row" data-tour={idx === 0 ? 'ext-custos' : undefined}>
                    <span className="apt-row-label">Custos</span>
                    {semCustos
                      ? <span className="apt-row-val muted">Não disponível</span>
                      : <span className="apt-row-val" style={{ color: '#dc2626' }}>− R$ {formatBRL(totalCustosDisplay)}</span>
                    }
                  </div>

                  {/* Sub-itens: cada linha de custo das planilhas importadas */}
                  {custosPorCategoria.map((c, i) => (
                    <div className="apt-row-sub" key={i}>
                      <span className="apt-row-sub-label">
                        <span style={{ color: '#d1d5db', fontSize: 14 }}>↳</span>
                        {c.categoria}
                      </span>
                      <span className="apt-row-sub-val">R$ {formatBRL(c.valor)}</span>
                    </div>
                  ))}

                  {/* Aviso de custos não disponíveis */}
                  {semCustos && (
                    <div className="warn-box">
                      <AlertTriangle size={15} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span className="warn-text">
                        Os custos deste período ainda não foram lançados. O lucro e o repasse
                        são <strong>estimados</strong> e podem ser ajustados quando os custos forem importados.
                      </span>
                    </div>
                  )}

                  {/* Lucro */}
                  <div className="apt-row" data-tour={idx === 0 ? 'ext-lucro' : undefined}>
                    <span className="apt-row-label">Lucro</span>
                    <span className="apt-row-val" style={{ color: '#166534' }}>R$ {formatBRL(lucro)}</span>
                  </div>

                  {/* Taxa AlugEasy */}
                  <div className="apt-row" data-tour={idx === 0 ? 'ext-taxa' : undefined} style={{ borderBottom: 'none' }}>
                    <span className="apt-row-label">
                      Taxa AlugEasy ({taxaRepasse}% sobre {tipoRepasse === 'lucro' ? 'lucro' : 'faturamento'})
                    </span>
                    <span className="apt-row-val" style={{ color: '#6b7280', fontWeight: 500 }}>− R$ {formatBRL(repasse)}</span>
                  </div>

                </div>

                {/* Rodapé: SEU REPASSE + Baixar PDF */}
                <div className="apt-foot">
                  <div className="apt-foot-left" data-tour={idx === 0 ? 'ext-repasse' : undefined}>
                    <span className="apt-foot-label">
                      Seu repasse
                      {semCustos && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 6px', marginLeft: 6 }}>
                          Estimado
                        </span>
                      )}
                    </span>
                    <span className="apt-foot-val">R$ {formatBRL(valorFinal)}</span>
                  </div>
                  {mes > 0 && (
                    <a
                      href={`/api/prestacao-contas-pdf?apartamento_id=${apt.id}&mes=${mes}&ano=${ano}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-pdf"
                      data-tour={idx === 0 ? 'ext-pdf' : undefined}
                    >
                      <Download size={14} />
                      Baixar PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

      </div>
    </>
  )
}

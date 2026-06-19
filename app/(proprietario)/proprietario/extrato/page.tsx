import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Home, TrendingUp, Receipt, AlertTriangle, Download, Grid3x3 } from 'lucide-react'
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
  const mes = params.mes !== undefined ? parseInt(params.mes) : now.getMonth() + 1
  const ano = params.ano !== undefined ? parseInt(params.ano) : now.getFullYear()
  const nomeMes = MESES[mes - 1]

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

  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  const [{ data: custosData }, { data: diariasData }] = await Promise.all([
    supabase
      .from('custos')
      .select('apartamento_id, categoria, valor')
      .in('apartamento_id', aptIds)
      .eq('mes', mes)
      .eq('ano', ano)
      .order('categoria'),
    supabase
      .from('diarias')
      .select('apartamento_id, valor')
      .in('apartamento_id', aptIds)
      .gte('data', dataInicio)
      .lte('data', dataFim),
  ])

  const totalFaturamento = (diariasData ?? []).reduce((s, d) => s + (d.valor ?? 0), 0)
  const totalCustos = (custosData ?? []).reduce((s, c) => s + (c.valor ?? 0), 0)
  const totalLucro = totalFaturamento - totalCustos

  const metricas = apartamentos.map(apt => {
    const faturamento = (diariasData ?? [])
      .filter((d: DiariasItem) => d.apartamento_id === apt.id)
      .reduce((s, d) => s + (d.valor ?? 0), 0)

    const custosPorCategoria = (custosData ?? [])
      .filter((c: CustoItem) => c.apartamento_id === apt.id)

    const semCustos = custosPorCategoria.length === 0
    const custos = semCustos ? null : custosPorCategoria.reduce((s, c) => s + (c.valor ?? 0), 0)
    const lucro = faturamento - (custos ?? 0)
    const taxaRepasse = apt.taxa_repasse ?? 0
    const tipoRepasse = apt.tipo_repasse ?? 'lucro'
    const repasse = calcularRepasse(faturamento, lucro, taxaRepasse, tipoRepasse)
    const valorFinal = lucro - repasse

    return { apt, faturamento, custos, lucro, repasse, valorFinal, taxaRepasse, tipoRepasse }
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

        .summary-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-bottom: 24px; }
        .kpi-card { background: #fff; border: 1px solid #e7e9ee; border-radius: 16px; padding: 18px 18px 16px; position: relative; overflow: hidden; }
        .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .kpi-card.k-navy::before { background: #0f2647; }
        .kpi-card.k-red::before { background: #dc2626; }
        .kpi-card.k-green::before { background: #15803d; }
        .kpi-top { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
        .kpi-icon { width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .kpi-label { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; }
        .kpi-val { font-size: 22px; font-weight: 700; letter-spacing: -.01em; color: #0f1a2e; }

        .section-title { font-size: 15px; font-weight: 600; color: #0f1a2e; display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }

        .apt-card { border: 1px solid #e7e9ee; border-radius: 16px; overflow: hidden; margin-bottom: 16px; }
        .apt-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: #f8f6f1; border-bottom: 1px solid #e7e9ee; flex-wrap: wrap; gap: 8px; }
        .apt-name { display: flex; align-items: center; gap: 10px; font-size: 14.5px; font-weight: 600; color: #0f1a2e; }
        .apt-icon { width: 30px; height: 30px; border-radius: 8px; background: #fff; border: 1px solid #e7e9ee; display: flex; align-items: center; justify-content: center; color: #193660; }
        .apt-badge { font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; padding: 4px 10px; border-radius: 100px; }
        .badge-adm { background: #e6f1fb; color: #0c447c; }
        .badge-sub { background: #faeeda; color: #854f0b; }
        .apt-body { padding: 6px 20px; }
        .apt-row { display: flex; align-items: center; justify-content: space-between; padding: 13px 0; border-bottom: 1px solid #f1f2f5; }
        .apt-row:last-child { border-bottom: none; }
        .apt-row-label { font-size: 13px; color: #5a6a82; }
        .apt-row-val { font-size: 14px; font-weight: 600; color: #0f1a2e; }
        .apt-row-val.muted { color: #94a3b8; font-weight: 500; font-style: italic; font-size: 12.5px; }
        .apt-row-val.neg { color: #d97706; }
        .apt-foot { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: #f0fdf4; border-top: 1px solid #d1f0db; }
        .apt-foot-label { font-size: 13.5px; font-weight: 600; color: #14532d; }
        .apt-foot-val { font-size: 19px; font-weight: 700; color: #14532d; }
        .btn-pdf { display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: #193660; background: #fff; border: 1px solid #e7e9ee; border-radius: 9px; padding: 9px 16px; cursor: pointer; margin: 14px 20px 18px; transition: all .15s; text-decoration: none; }
        .btn-pdf:hover { background: #0f2647; color: #fff; border-color: #0f2647; }

        .warn-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 14px 16px; display: flex; gap: 10px; align-items: flex-start; margin: 0 20px 18px; }
        .warn-text { font-size: 12.5px; color: #92400e; line-height: 1.5; }

        .empty-page { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 64px 20px; text-align: center; border: 1px solid #e7e9ee; border-radius: 18px; background: #fff; }

        @media (max-width: 900px) { .summary-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="pg-wrap">

        <div className="pg-head">
          <div>
            <h1 className="pg-greeting">Extrato — {nomeMes} {ano}</h1>
            <p className="pg-greeting-sub">Demonstrativo completo de faturamento, custos e repasse</p>
          </div>
          <div className="pg-period">
            <MonthYearFilter mes={mes} ano={ano} />
          </div>
        </div>

        {metricas.length === 0 ? (
          <div className="empty-page">
            <p style={{ fontSize: 14, fontWeight: 600, color: '#0f1a2e', marginBottom: 4 }}>Nenhum dado disponível</p>
            <p style={{ fontSize: 12.5, color: '#94a3b8' }}>Não há lançamentos para {nomeMes} {ano} ainda.</p>
          </div>
        ) : (
          <>
            <div className="summary-grid">
              <div className="kpi-card k-navy">
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: '#e6f1fb' }}><TrendingUp size={14} color="#0c447c" /></div>
                  <span className="kpi-label">Fat.</span>
                </div>
                <div className="kpi-val">R$ {formatBRL(totalFaturamento)}</div>
              </div>
              <div className="kpi-card k-red">
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: '#fef2f2' }}><Receipt size={14} color="#dc2626" /></div>
                  <span className="kpi-label">Custos</span>
                </div>
                <div className="kpi-val">R$ {formatBRL(totalCustos)}</div>
              </div>
              <div className="kpi-card k-green">
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: '#eaf3de' }}><TrendingUp size={14} color="#27500a" /></div>
                  <span className="kpi-label">Lucro</span>
                </div>
                <div className="kpi-val" style={{ color: '#166534' }}>R$ {formatBRL(totalLucro)}</div>
              </div>
            </div>

            <div className="section-title"><Grid3x3 size={16} color="#193660" /> Detalhamento por apartamento</div>

            {metricas.map(({ apt, faturamento, custos, lucro, repasse, valorFinal, taxaRepasse, tipoRepasse }) => (
              <div className="apt-card" key={apt.id}>
                <div className="apt-head">
                  <div className="apt-name">
                    <span className="apt-icon"><Home size={15} /></span>
                    Apt {apt.numero}{apt.empreendimentos?.nome ? ` — ${apt.empreendimentos.nome}` : ''}
                  </div>
                  <span className={`apt-badge ${apt.tipo_gestao === 'adm' ? 'badge-adm' : 'badge-sub'}`}>
                    {apt.tipo_gestao === 'adm' ? 'Administração' : 'Sublocação'}
                  </span>
                </div>
                <div className="apt-body">
                  <div className="apt-row">
                    <span className="apt-row-label">Faturamento</span>
                    <span className="apt-row-val">R$ {formatBRL(faturamento)}</span>
                  </div>
                  <div className="apt-row">
                    <span className="apt-row-label">Custos</span>
                    {custos === null
                      ? <span className="apt-row-val muted">Não disponível</span>
                      : <span className="apt-row-val">R$ {formatBRL(custos)}</span>}
                  </div>
                  <div className="apt-row">
                    <span className="apt-row-label">Lucro</span>
                    <span className="apt-row-val" style={{ color: '#166534' }}>R$ {formatBRL(lucro)}</span>
                  </div>
                  <div className="apt-row">
                    <span className="apt-row-label">
                      Repasse ({taxaRepasse}% s/ {tipoRepasse})
                    </span>
                    <span className="apt-row-val neg">− R$ {formatBRL(repasse)}</span>
                  </div>
                </div>
                <div className="apt-foot">
                  <span className="apt-foot-label">Seu repasse</span>
                  <span className="apt-foot-val">R$ {formatBRL(valorFinal)}</span>
                </div>
                <a
                  href={`/api/prestacao-contas-pdf?apartamento_id=${apt.id}&mes=${mes}&ano=${ano}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-pdf"
                >
                  <Download size={14} />
                  Baixar PDF
                </a>
                {custos === null && (
                  <div className="warn-box">
                    <AlertTriangle size={16} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
                    <span className="warn-text">
                      Os custos deste mês ainda não foram lançados pela equipe AlugEasy. O lucro e o
                      repasse exibidos consideram apenas o faturamento até o momento e podem ser
                      ajustados quando os custos forem importados.
                    </span>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

      </div>
    </>
  )
}

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TrendingUp, Receipt, Wallet, Clock, BarChart2, FileText, Download, History } from 'lucide-react'
import { EvolucaoChart } from '@/components/proprietario/evolucao-chart'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { MESES, MESES_ABREV } from '@/lib/constants'

type SearchParams = Promise<{ mes?: string; ano?: string }>

type ApartamentoVinculo = {
  id: string
  numero: string
  tipo_gestao: 'adm' | 'sub' | null
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  empreendimentos: { nome: string } | null
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

export default async function ProprietarioDashboard({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'proprietario') redirect('/')

  const params = await searchParams
  const now = new Date()
  const mes = params.mes !== undefined ? parseInt(params.mes) : now.getMonth() + 1
  const ano = params.ano !== undefined ? parseInt(params.ano) : now.getFullYear()
  const nomeMes = MESES[mes - 1]
  const primeiroNome = profile?.full_name?.split(' ')[0] ?? 'Proprietário'

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

  let kpis = { faturamento: 0, custos: 0, lucro: 0, repasse: 0, margem: 0 }
  let historicoData: { label: string; faturamento: number; lucro: number; repasse: number }[] = []
  let mesesComDados = 0
  let taxaRepasseBase = 0
  let tipoRepasseBase: 'lucro' | 'faturamento' = 'lucro'

  if (aptIds.length > 0 && mes > 0) {
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

    const [{ data: custosData }, { data: diariasData }] = await Promise.all([
      supabase.from('custos').select('apartamento_id, valor').in('apartamento_id', aptIds).eq('mes', mes).eq('ano', ano),
      supabase.from('diarias').select('apartamento_id, valor').in('apartamento_id', aptIds).gte('data', dataInicio).lte('data', dataFim),
    ])

    const metricas = apartamentos.map(apt => {
      const faturamento = (diariasData ?? []).filter(d => d.apartamento_id === apt.id).reduce((s, d) => s + (d.valor ?? 0), 0)
      const custos = (custosData ?? []).filter(c => c.apartamento_id === apt.id).reduce((s, c) => s + (c.valor ?? 0), 0)
      const lucro = faturamento - custos
      const taxaRepasse = apt.taxa_repasse ?? 0
      const tipoRepasse = apt.tipo_repasse ?? 'lucro'
      const repasse = calcularRepasse(faturamento, lucro, taxaRepasse, tipoRepasse)
      const valorProprietario = lucro - repasse
      return { apt, faturamento, custos, lucro, repasse, valorProprietario, taxaRepasse, tipoRepasse }
    })

    if (metricas.length > 0) {
      taxaRepasseBase = metricas[0].taxaRepasse
      tipoRepasseBase = metricas[0].tipoRepasse
    }

    const totalFaturamento = metricas.reduce((s, m) => s + m.faturamento, 0)
    const totalCustos = metricas.reduce((s, m) => s + m.custos, 0)
    const totalLucro = metricas.reduce((s, m) => s + m.lucro, 0)
    const totalValorProprietario = metricas.reduce((s, m) => s + m.valorProprietario, 0)
    const margem = totalFaturamento > 0 ? (totalLucro / totalFaturamento) * 100 : 0

    kpis = { faturamento: totalFaturamento, custos: totalCustos, lucro: totalLucro, repasse: totalValorProprietario, margem }

    const periodos = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(ano, mes - 1 - (5 - i), 1)
      return { m: d.getMonth() + 1, a: d.getFullYear(), label: MESES_ABREV[d.getMonth()] }
    })

    historicoData = await Promise.all(
      periodos.map(async ({ m, a, label }) => {
        const di = `${a}-${String(m).padStart(2, '0')}-01`
        const df = new Date(a, m, 0).toISOString().slice(0, 10)
        const [{ data: fat }, { data: cus }] = await Promise.all([
          supabase.from('diarias').select('valor').in('apartamento_id', aptIds).gte('data', di).lte('data', df),
          supabase.from('custos').select('valor').in('apartamento_id', aptIds).eq('mes', m).eq('ano', a),
        ])
        const faturamento = (fat ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
        const lucro = faturamento - (cus ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
        const repasse = calcularRepasse(faturamento, lucro, taxaRepasseBase, tipoRepasseBase)
        return { label, faturamento, lucro, repasse }
      })
    )

    mesesComDados = historicoData.filter(h => h.faturamento > 0 || h.lucro !== 0).length
  }

  const temHistoricoSuficiente = mesesComDados >= 2

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

        .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 28px; }
        .kpi-card { background: #fff; border: 1px solid #e7e9ee; border-radius: 16px; padding: 18px 18px 16px; position: relative; overflow: hidden; transition: transform .15s, box-shadow .15s; }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(15,38,71,.06); }
        .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .kpi-card.k-navy::before { background: #0f2647; }
        .kpi-card.k-red::before { background: #dc2626; }
        .kpi-card.k-green::before { background: #15803d; }
        .kpi-card.k-amber::before { background: #d97706; }
        .kpi-top { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
        .kpi-icon { width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .kpi-label { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; }
        .kpi-val { font-size: 22px; font-weight: 700; letter-spacing: -.01em; margin-bottom: 3px; color: #0f1a2e; }
        .kpi-foot { font-size: 11.5px; color: #94a3b8; }

        .panel { background: #fff; border: 1px solid #e7e9ee; border-radius: 18px; padding: 24px; margin-bottom: 20px; }
        .panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 10px; }
        .panel-title { font-size: 15px; font-weight: 600; color: #0f1a2e; display: flex; align-items: center; gap: 8px; }
        .panel-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }

        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px; text-align: center; }
        .empty-icon { width: 48px; height: 48px; border-radius: 50%; background: #f8f6f1; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; color: #94a3b8; }
        .empty-title { font-size: 14px; font-weight: 600; color: #0f1a2e; margin-bottom: 4px; }
        .empty-desc { font-size: 12.5px; color: #94a3b8; max-width: 280px; }
        .progress-track { width: 200px; height: 6px; background: #f8f6f1; border-radius: 100px; margin-top: 16px; overflow: hidden; }
        .progress-fill { height: 100%; background: #193660; border-radius: 100px; }
        .progress-label { font-size: 11px; color: #94a3b8; margin-top: 8px; }

        .shortcut-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
        .shortcut-card { border: 1px solid #e7e9ee; border-radius: 14px; padding: 18px; text-decoration: none; display: flex; flex-direction: column; gap: 8px; transition: all .15s; cursor: pointer; }
        .shortcut-card:hover { border-color: #193660; background: #f8f6f1; }
        .shortcut-icon { width: 34px; height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
        .shortcut-title { font-size: 13.5px; font-weight: 600; color: #0f1a2e; }
        .shortcut-desc { font-size: 11.5px; color: #94a3b8; }

        @media (max-width: 900px) {
          .kpi-grid { grid-template-columns: repeat(2,1fr); }
          .shortcut-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="pg-wrap">

        <div className="pg-head">
          <div>
            <h1 className="pg-greeting">Olá, {primeiroNome} 👋</h1>
            <p className="pg-greeting-sub">Resumo dos seus imóveis em <strong>{nomeMes} {ano}</strong></p>
          </div>
          <div className="pg-period">
            <MonthYearFilter mes={mes} ano={ano} />
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card k-navy">
            <div className="kpi-top">
              <div className="kpi-icon" style={{ background: '#e6f1fb' }}><TrendingUp size={14} color="#0c447c" /></div>
              <span className="kpi-label">Faturamento</span>
            </div>
            <div className="kpi-val">R$ {formatBRL(kpis.faturamento)}</div>
            <div className="kpi-foot">{nomeMes} {ano}</div>
          </div>

          <div className="kpi-card k-red">
            <div className="kpi-top">
              <div className="kpi-icon" style={{ background: '#fef2f2' }}><Receipt size={14} color="#dc2626" /></div>
              <span className="kpi-label">Custos</span>
            </div>
            <div className="kpi-val">R$ {formatBRL(kpis.custos)}</div>
            <div className="kpi-foot">{nomeMes} {ano}</div>
          </div>

          <div className="kpi-card k-green">
            <div className="kpi-top">
              <div className="kpi-icon" style={{ background: '#eaf3de' }}><TrendingUp size={14} color="#27500a" /></div>
              <span className="kpi-label">Lucro líquido</span>
            </div>
            <div className="kpi-val" style={{ color: '#166534' }}>R$ {formatBRL(kpis.lucro)}</div>
            <div className="kpi-foot">Margem de {kpis.margem.toFixed(0)}% no mês</div>
          </div>

          <div className="kpi-card k-amber">
            <div className="kpi-top">
              <div className="kpi-icon" style={{ background: '#faeeda' }}><Wallet size={14} color="#854f0b" /></div>
              <span className="kpi-label">Seu repasse</span>
            </div>
            <div className="kpi-val" style={{ color: '#92400e' }}>R$ {formatBRL(kpis.repasse)}</div>
            <div className="kpi-foot">Após taxa AlugEasy</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title"><BarChart2 size={16} color="#193660" /> Evolução dos últimos 6 meses</div>
              <div className="panel-sub">Faturamento e repasse mês a mês</div>
            </div>
          </div>

          {temHistoricoSuficiente ? (
            <div style={{ height: 192 }}>
              <EvolucaoChart data={historicoData} />
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><Clock size={22} /></div>
              <div className="empty-title">Histórico em construção</div>
              <div className="empty-desc">O gráfico de evolução fica disponível depois de 2 meses de operação contínua.</div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.min(100, mesesComDados * 50)}%` }} />
              </div>
              <div className="progress-label">{mesesComDados} de 2 meses necessários</div>
            </div>
          )}
        </div>

        <div className="panel" style={{ paddingBottom: 18 }}>
          <div className="panel-head">
            <div className="panel-title">Acesso rápido</div>
          </div>
          <div className="shortcut-grid">
            <Link href={`/proprietario/extrato?mes=${mes}&ano=${ano}`} className="shortcut-card">
              <div className="shortcut-icon" style={{ background: '#e6f1fb' }}><FileText size={17} color="#0c447c" /></div>
              <div className="shortcut-title">Ver extrato completo</div>
              <div className="shortcut-desc">Detalhamento por apartamento do mês atual</div>
            </Link>
            <Link href={`/proprietario/extrato?mes=${mes}&ano=${ano}`} className="shortcut-card">
              <div className="shortcut-icon" style={{ background: '#faeeda' }}><Download size={17} color="#854f0b" /></div>
              <div className="shortcut-title">Baixar prestação em PDF</div>
              <div className="shortcut-desc">Relatório completo do mês de {nomeMes}</div>
            </Link>
            <Link href="/proprietario/historico" className="shortcut-card">
              <div className="shortcut-icon" style={{ background: '#eaf3de' }}><History size={17} color="#27500a" /></div>
              <div className="shortcut-title">Consultar histórico</div>
              <div className="shortcut-desc">Acompanhe os últimos 12 meses</div>
            </Link>
          </div>
        </div>

      </div>
    </>
  )
}

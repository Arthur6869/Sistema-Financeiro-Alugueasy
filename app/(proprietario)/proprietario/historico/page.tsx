import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TrendingUp, Calendar } from 'lucide-react'
import { MESES, MESES_ABREV } from '@/lib/constants'
import { HistoricoChart } from '@/components/proprietario/historico-chart'
import { HistoricoLinhaClicavel } from '@/components/proprietario/historico-linha-clicavel'

type ApartamentoVinculo = {
  id: string
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
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

export default async function ProprietarioHistoricoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'proprietario') redirect('/')

  const { data: vinculos } = await supabase
    .from('proprietario_apartamentos')
    .select('apartamentos(id, taxa_repasse, tipo_repasse)')
    .eq('proprietario_id', user.id)
    .eq('ativo', true)

  type VinculoRow = { apartamentos: ApartamentoVinculo | null }
  const apartamentos: ApartamentoVinculo[] = ((vinculos ?? []) as unknown as VinculoRow[])
    .map(v => v.apartamentos)
    .filter((a): a is ApartamentoVinculo => a !== null)

  const aptIds = apartamentos.map(a => a.id)
  const now = new Date()
  const mesAtual = now.getMonth() + 1
  const anoAtual = now.getFullYear()

  const meses = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { m: d.getMonth() + 1, a: d.getFullYear() }
  }).reverse()

  const dados = await Promise.all(
    meses.map(async ({ m, a }) => {
      const di = `${a}-${String(m).padStart(2, '0')}-01`
      const df = new Date(a, m, 0).toISOString().slice(0, 10)

      const [{ data: fat }, { data: cus }] = await Promise.all([
        supabase.from('diarias').select('valor').in('apartamento_id', aptIds).gte('data', di).lte('data', df),
        supabase.from('custos').select('valor').in('apartamento_id', aptIds).eq('mes', m).eq('ano', a),
      ])

      const faturamento = (fat ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
      const custos = (cus ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
      const lucro = faturamento - custos
      const taxaRepasse = apartamentos[0]?.taxa_repasse ?? 0
      const tipoRepasse = apartamentos[0]?.tipo_repasse ?? 'lucro'
      const repasse = calcularRepasse(faturamento, lucro, taxaRepasse, tipoRepasse)
      const valorProprietario = lucro - repasse

      const isAtual = m === mesAtual && a === anoAtual
      const semDados = faturamento === 0 && custos === 0

      return { m, a, faturamento, custos: semDados ? null : custos, lucro, repasse, valorProprietario, semDados, isAtual }
    })
  )

  const chartLabels = dados.map(d => `${MESES_ABREV[d.m - 1]}/${String(d.a).slice(2)}`)
  const chartValores = dados.map(d => d.semDados ? null : d.valorProprietario)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .pg-wrap { font-family: 'DM Sans', sans-serif; max-width: 1100px; margin: 0 auto; padding: 32px 28px 64px; }

        .pg-head { margin-bottom: 28px; }
        .pg-greeting { font-family: 'Instrument Serif', Georgia, serif; font-size: 28px; font-weight: 400; color: #0f1a2e; margin-bottom: 4px; }
        .pg-greeting-sub { font-size: 13px; color: #5a6a82; }

        .panel { background: #fff; border: 1px solid #e7e9ee; border-radius: 18px; padding: 24px; margin-bottom: 20px; }
        .panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 10px; }
        .panel-title { font-size: 15px; font-weight: 600; color: #0f1a2e; display: flex; align-items: center; gap: 8px; }
        .panel-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }

        .hist-table { width: 100%; border-collapse: collapse; }
        .hist-table th { text-align: left; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #94a3b8; padding: 0 8px 12px; border-bottom: 1px solid #e7e9ee; }
        .hist-table th.num { text-align: right; }
        .hist-table td { padding: 13px 8px; border-bottom: 1px solid #f1f2f5; font-size: 13.5px; }
        .hist-table tr:last-child td { border-bottom: none; }
        .hist-table tr.has-data { cursor: pointer; transition: background .12s; }
        .hist-table tr.has-data:hover { background: #f8f6f1; }
        .hist-month { font-weight: 600; color: #0f1a2e; }
        .hist-table td.num { text-align: right; font-weight: 600; color: #0f1a2e; }
        .hist-table td.num.dim { color: #94a3b8; font-weight: 500; }
        .hist-table td.num.repasse { color: #14532d; font-weight: 700; }
        .status-pill { font-size: 10.5px; font-weight: 700; letter-spacing: .03em; padding: 4px 10px; border-radius: 100px; display: inline-block; }
        .status-sem { background: #f1f2f5; color: #94a3b8; }
        .status-ok { background: #f0fdf4; color: #14532d; }

        .table-scroll { overflow-x: auto; }
      `}</style>

      <div className="pg-wrap">

        <div className="pg-head">
          <h1 className="pg-greeting">Histórico</h1>
          <p className="pg-greeting-sub">Últimos 12 meses — toque no mês para ver o extrato completo</p>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <div className="panel-title"><TrendingUp size={16} color="#193660" /> Repasse mensal</div>
              <div className="panel-sub">Evolução do valor recebido mês a mês</div>
            </div>
          </div>
          <HistoricoChart labels={chartLabels} valores={chartValores} />
        </div>

        <div className="panel">
          <div className="panel-head">
            <div className="panel-title"><Calendar size={16} color="#193660" /> Resumo mensal</div>
          </div>

          <div className="table-scroll">
            <table className="hist-table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Status</th>
                  <th className="num">Faturamento</th>
                  <th className="num">Custos</th>
                  <th className="num">Lucro</th>
                  <th className="num">Repasse</th>
                  <th className="num">Seu valor</th>
                </tr>
              </thead>
              <tbody>
                {dados.map(d => (
                  d.semDados ? (
                    <tr key={`${d.m}-${d.a}`}>
                      <td className="hist-month" style={{ color: '#94a3b8' }}>{MESES[d.m - 1]} {d.a}</td>
                      <td><span className="status-pill status-sem">{d.isAtual ? 'Em andamento' : 'Sem dados'}</span></td>
                      <td className="num dim">—</td>
                      <td className="num dim">—</td>
                      <td className="num dim">—</td>
                      <td className="num dim">—</td>
                      <td className="num dim">—</td>
                    </tr>
                  ) : (
                    <HistoricoLinhaClicavel
                      key={`${d.m}-${d.a}`}
                      mes={d.m}
                      ano={d.a}
                      label={`${MESES[d.m - 1]} ${d.a}`}
                      faturamento={d.faturamento}
                      custos={d.custos}
                      lucro={d.lucro}
                      repasse={d.repasse}
                      valorFinal={d.valorProprietario}
                    />
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  )
}

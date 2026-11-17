import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MESES, MESES_ABREV } from '@/lib/constants'
import { HistoricoProprietario } from '@/components/proprietario/historico'
import { calcularTaxaCarteira } from '@/lib/calcular-kpis'

type ApartamentoVinculo = {
  id: string
  numero: string
  taxa_repasse: number | null
  tipo_repasse: 'lucro' | 'faturamento' | null
  empreendimentos: { nome: string } | null
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
    .select('apartamentos(id, numero, taxa_repasse, tipo_repasse, empreendimentos(nome))')
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
        supabase.from('diarias').select('apartamento_id, valor').in('apartamento_id', aptIds).gte('data', di).lte('data', df),
        supabase.from('custos_proprietario').select('apartamento_id, valor').in('apartamento_id', aptIds).eq('mes', m).eq('ano', a),
      ])

      const fatRows = (fat ?? []) as { apartamento_id: string; valor: number | null }[]
      const cusRows = (cus ?? []) as { apartamento_id: string; valor: number | null }[]
      // Taxa imóvel a imóvel — carteiras mistas (ex.: MERCURE 12% + METROPOLITAN
      // 15% do mesmo proprietário) erravam quando a taxa do primeiro imóvel
      // valia para a carteira inteira.
      const carteira = calcularTaxaCarteira(apartamentos, fatRows, cusRows)
      const faturamento = carteira.faturamento
      const custos = carteira.custos
      const lucro = carteira.lucro
      const repasse = carteira.taxaAlugEasy
      const valorProprietario = carteira.valorProprietario

      const isAtual = m === mesAtual && a === anoAtual
      const semDados = faturamento === 0 && custos === 0

      return { m, a, faturamento, custos: semDados ? null : custos, lucro, repasse, valorProprietario, semDados, isAtual, fatRows, cusRows }
    })
  )

  // Série mensal individual de cada imóvel — alimenta o painel "Desempenho por imóvel"
  const porImovel = apartamentos.map(apt => ({
    id: apt.id,
    nome: apt.empreendimentos?.nome ? `${apt.empreendimentos.nome} · ${apt.numero}` : `Apto ${apt.numero}`,
    meses: dados.map(d => {
      const faturamento = d.fatRows.filter(r => r.apartamento_id === apt.id).reduce((s, r) => s + (r.valor ?? 0), 0)
      const custos = d.cusRows.filter(r => r.apartamento_id === apt.id).reduce((s, r) => s + (r.valor ?? 0), 0)
      return {
        label: `${MESES_ABREV[d.m - 1]}/${String(d.a).slice(2)}`,
        faturamento,
        custos,
        lucro: faturamento - custos,
      }
    }),
  }))

  return (
    <HistoricoProprietario
      linhas={dados.map(d => ({
        m: d.m,
        a: d.a,
        label: `${MESES[d.m - 1]} ${d.a}`,
        faturamento: d.faturamento,
        custos: d.custos,
        lucro: d.lucro,
        taxa: d.repasse,
        valorProprietario: d.valorProprietario,
        semDados: d.semDados,
        isAtual: d.isAtual,
      }))}
      imoveis={porImovel}
    />
  )
}

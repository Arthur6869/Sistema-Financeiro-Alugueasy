import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReservasEditavelTabela, type ReservaRow } from '@/components/reservas/reservas-editavel-tabela'
import { MonthYearFilter } from '@/components/shared/month-year-filter'
import { ExportarTabelaXlsxButton } from '@/components/shared/exportar-tabela-xlsx-button'
import { MESES } from '@/lib/constants'
import { Suspense } from 'react'

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const now = new Date()
  const mes = parseInt(params.mes ?? String(now.getMonth() + 1))
  const ano = parseInt(params.ano ?? String(now.getFullYear()))

  const [{ data: reservas }, { data: profile }] = await Promise.all([
    supabase
      .from('amenitiz_reservas')
      .select(`
        id,
        booking_id,
        checkin,
        checkout,
        valor_bruto,
        valor_liquido,
        plataforma_normalizada,
        individual_room_number,
        nome_hospede,
        mes_competencia,
        ano_competencia
      `)
      .eq('mes_competencia', mes)
      .eq('ano_competencia', ano)
      .order('checkin', { ascending: true }),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  const totalFaturamento = (reservas ?? []).reduce((a, r) => a + (r.valor_liquido ?? 0), 0)
  const mesLabel = MESES[mes - 1] ?? String(mes)

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservas Amenitiz</h1>
          <p className="text-sm text-gray-500 mt-1">
            {mesLabel} {ano} — {reservas?.length ?? 0} reserva(s) — Faturamento líquido:{' '}
            <strong className="text-gray-800">
              R$ {totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ExportarTabelaXlsxButton tabela="reservas" mes={mes} ano={ano} />
          <Suspense fallback={null}>
            <MonthYearFilter mes={mes} ano={ano} />
          </Suspense>
        </div>
      </div>

      <ReservasEditavelTabela
        reservas={(reservas ?? []) as unknown as ReservaRow[]}
        role={profile?.role ?? ''}
        mes={mes}
        ano={ano}
      />
    </div>
  )
}

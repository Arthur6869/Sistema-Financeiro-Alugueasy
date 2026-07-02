import type { SupabaseClient } from '@supabase/supabase-js'

export type Alerta = {
  nivel: 'erro' | 'aviso'
  mensagem: string
  href?: string
}

type ContextoKpis = {
  mes: number
  ano: number
  faturamentoTotal: number
  margemPct: number
}

/**
 * Checagens proativas exibidas no topo do dashboard interno.
 * Mesma lógica dos MCP tools de monitoramento (alert_margem_baixa,
 * check_apartamentos_sem_room_id, check_sync_pendente), disponível na web.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function verificarAlertas(supabase: SupabaseClient<any>, ctx: ContextoKpis): Promise<Alerta[]> {
  const alertas: Alerta[] = []

  const [aptsSemRoomIdRes, syncRes, categoriasRes] = await Promise.all([
    supabase
      .from('apartamentos')
      .select('numero, empreendimentos(nome)')
      .is('amenitiz_room_id', null),
    ctx.mes > 0 && ctx.ano > 0
      ? supabase
          .from('amenitiz_syncs')
          .select('status')
          .eq('mes', ctx.mes).eq('ano', ctx.ano)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('categorias_repassaveis')
      .select('categoria', { count: 'exact', head: true }),
  ])

  type AptRow = { numero: string; empreendimentos: { nome: string } | null }
  const aptsSemRoomId = ((aptsSemRoomIdRes.data ?? []) as unknown as AptRow[])
  if (aptsSemRoomId.length > 0) {
    const lista = aptsSemRoomId
      .slice(0, 8)
      .map(a => `${a.empreendimentos?.nome ?? '?'} ${a.numero}`)
      .join(', ')
    alertas.push({
      nivel: 'aviso',
      mensagem: `${aptsSemRoomId.length} apartamento(s) sem room_id Amenitiz — faturamento invisível no sync: ${lista}${aptsSemRoomId.length > 8 ? '…' : ''}`,
      href: '/empreendimentos',
    })
  }

  const sync = syncRes.data as { status: string } | null
  if (ctx.mes > 0 && ctx.ano > 0) {
    if (sync?.status === 'erro') {
      alertas.push({
        nivel: 'erro',
        mensagem: `Último sync Amenitiz de ${String(ctx.mes).padStart(2, '0')}/${ctx.ano} terminou com erro.`,
        href: '/importar',
      })
    }
  }

  // count vem no header quando head:true
  const totalCategorias = (categoriasRes as { count?: number | null }).count ?? 0
  if (totalCategorias === 0) {
    alertas.push({
      nivel: 'aviso',
      mensagem: 'Nenhuma categoria de custo marcada como repassável — proprietários não veem custos no portal (seed pendente, migration 027).',
    })
  }

  if (ctx.faturamentoTotal > 0 && ctx.margemPct < 10) {
    alertas.push({
      nivel: 'aviso',
      mensagem: `Margem do período em ${ctx.margemPct}% — abaixo do mínimo esperado de 10%.`,
    })
  }

  return alertas
}

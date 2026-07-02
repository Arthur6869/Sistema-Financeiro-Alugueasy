import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditEntry = {
  usuarioId?: string | null
  origem?: 'web' | 'interna'
  acao: string
  tabela?: string | null
  registrosAfetados?: number
  detalhes?: unknown
}

/**
 * Grava uma entrada em audit_log via service role.
 * Nunca lança — falha de auditoria não pode derrubar a operação principal;
 * o erro é logado no servidor e o retorno indica se a gravação persistiu
 * (chamadores que dependem da auditoria como pré-condição devem checar).
 */
export async function registrarAuditoria(entry: AuditEntry): Promise<boolean> {
  try {
    // Cast: audit_log (migration 028) ainda não existe nos tipos gerados do client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as SupabaseClient<any>
    const { error } = await admin.from('audit_log').insert({
      usuario_id: entry.usuarioId ?? null,
      origem: entry.origem ?? 'web',
      acao: entry.acao,
      tabela: entry.tabela ?? null,
      registros_afetados: entry.registrosAfetados ?? null,
      detalhes: entry.detalhes ?? null,
    })
    if (error) {
      console.error('[audit] falha ao registrar auditoria:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.error('[audit] falha ao registrar auditoria:', e)
    return false
  }
}

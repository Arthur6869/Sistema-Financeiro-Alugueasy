-- =============================================================================
-- Migration 028: Tabela de auditoria de operações destrutivas/sensíveis
--
-- Registra quem fez o quê, quando, em qual tabela, com snapshot opcional dos
-- dados afetados (jsonb). Usada inicialmente pelo /api/clear (limpeza de
-- período), que apaga dados de 5 tabelas sem qualquer rastro até agora.
--
-- Escrita sempre via service role (lib/audit.ts) — a RLS abaixo cobre leitura
-- pelo painel e eventuais inserts de sessões internas autenticadas.
-- Data: 2026-07-01
-- =============================================================================
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.audit_log;
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  origem              text NOT NULL DEFAULT 'web' CHECK (origem IN ('web', 'interna')),
  acao                text NOT NULL,
  tabela              text,
  registros_afetados  integer,
  detalhes            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_acao    ON audit_log (acao);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Somente internos (admin/analista) leem o log
CREATE POLICY "audit_select_interno" ON audit_log
  FOR SELECT TO authenticated USING (public.is_interno());

-- Sem policies de INSERT/UPDATE/DELETE para authenticated: a escrita é
-- exclusiva do service role (lib/audit.ts, bypassa RLS). Uma policy de INSERT
-- para sessões autenticadas permitiria forjar entradas com usuario_id de
-- terceiros — deny-by-default mantém o log confiável e imutável.

COMMENT ON TABLE audit_log IS
  'Auditoria de operações sensíveis. detalhes pode conter snapshot dos dados apagados para recuperação manual.';

SELECT '028 aplicada — audit_log criada' AS status;

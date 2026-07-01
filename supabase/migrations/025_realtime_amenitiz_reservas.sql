-- =============================================================================
-- Migration 025: Habilita Supabase Realtime em amenitiz_reservas
--               + tabela ingest_status para rastrear último ingest (cron/webhook)
--
-- Pré-requisito de idempotência confirmado:
--   UNIQUE(booking_id) existe desde migration 005 — é o constraint usado pelo
--   upsert { onConflict: 'booking_id' } em sync-amenitiz-core.ts. ✅
--
-- Realtime + RLS (mecanismo):
--   O canal usa o JWT do usuário autenticado (criado via @supabase/ssr, cookie).
--   O Supabase Realtime avalia as políticas SELECT da tabela (migration 023)
--   para cada linha alterada ANTES de entregar o evento ao subscriber.
--   Resultado: proprietário recebe apenas eventos de linhas cujo
--   apartamento_id está em seus vínculos ativos (proprietario_apartamentos).
--   Nenhum evento vaza entre proprietários. Sem Realtime aberto/sem RLS.
--
-- Tabelas afetadas: amenitiz_reservas (publication), + nova: ingest_status
-- Novos objetos: ultimo_ingest_timestamp() SECURITY DEFINER
-- Próxima migration disponível: 026
-- Data: 2026-06-29
-- =============================================================================
-- ROLLBACK (ordem inversa):
--   DROP FUNCTION IF EXISTS public.ultimo_ingest_timestamp();
--   DROP TABLE IF EXISTS public.ingest_status;
--   ALTER PUBLICATION supabase_realtime DROP TABLE amenitiz_reservas;
-- =============================================================================


-- PARTE 1 — Adicionar amenitiz_reservas ao publication do Realtime
-- supabase_realtime é a publication padrão criada pelo Supabase em todo projeto.
-- Idempotente: se já estiver adicionada, o erro "already member" pode ser ignorado
-- (executar manualmente via dashboard se a migration falhar nesta linha).
ALTER PUBLICATION supabase_realtime ADD TABLE amenitiz_reservas;


-- PARTE 2 — Tabela singleton para rastrear último ingest (cron + webhook)
-- Mantém UMA linha (id = 'global') que é atualizada pelo cron e pelo webhook.
-- O portal lê apenas via função SECURITY DEFINER abaixo — nunca acessa a tabela.
-- Ao adicionar o webhook (Bloco 2), basta fazer upsert nesta linha — sem mudar a UI.
CREATE TABLE IF NOT EXISTS ingest_status (
  id         text PRIMARY KEY DEFAULT 'global',
  ultimo_at  timestamptz NOT NULL DEFAULT now(),
  fonte      text NOT NULL
               CHECK (fonte IN ('cron', 'webhook', 'manual'))
               DEFAULT 'manual',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ingest_status ENABLE ROW LEVEL SECURITY;

-- Internos (admin/analista) gerenciam a tabela diretamente via service role nas API routes.
-- Via JWT de usuário, apenas internos podem SELECT (proprietário usa a função abaixo).
CREATE POLICY "ingest_status_interno" ON ingest_status
  FOR ALL TO authenticated
  USING  (public.is_interno())
  WITH CHECK (public.is_interno());

-- Seed: garante que a row 'global' existe desde o início
INSERT INTO ingest_status (id, ultimo_at, fonte)
VALUES ('global', now(), 'manual')
ON CONFLICT (id) DO NOTHING;


-- PARTE 3 — Função SECURITY DEFINER para o portal ler o timestamp
-- O proprietário pode chamar esta função e recebe apenas o timestamp.
-- NUNCA vê linhas da tabela ingest_status (RLS bloquearia, mas a função encapsula).
-- STABLE: safe para cache de plano. SECURITY DEFINER + search_path fixo: seguro.
CREATE OR REPLACE FUNCTION public.ultimo_ingest_timestamp()
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ultimo_at FROM ingest_status WHERE id = 'global';
$$;

GRANT EXECUTE ON FUNCTION public.ultimo_ingest_timestamp() TO authenticated;


-- =============================================================================
-- VERIFICAÇÃO FINAL (executar após aplicar e confirmar):
--
--   1. amenitiz_reservas está na publicação:
--      SELECT tablename FROM pg_publication_tables
--      WHERE pubname = 'supabase_realtime' AND tablename = 'amenitiz_reservas';
--
--   2. ingest_status existe com row 'global':
--      SELECT * FROM ingest_status;
--
--   3. Função criada e executável por autenticados:
--      SELECT public.ultimo_ingest_timestamp();
--
--   4. Proprietário NÃO consegue SELECT direto em ingest_status:
--      (com JWT de proprietário) SELECT * FROM ingest_status; → 0 rows
--      (com JWT de proprietário) SELECT ultimo_ingest_timestamp(); → timestamp ✅
-- =============================================================================
SELECT '025 aplicada — Realtime habilitado em amenitiz_reservas + ingest_status criado' AS status;

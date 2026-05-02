-- =============================================================================
-- Migration: 013_custos_manual_metadata.sql
-- Descrição: adiciona metadados para lançamentos manuais na tabela custos.
-- =============================================================================

ALTER TABLE public.custos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'importacao',
  ADD COLUMN IF NOT EXISTS observacao text NULL,
  ADD COLUMN IF NOT EXISTS criado_por uuid NULL REFERENCES auth.users(id);

ALTER TABLE public.custos
  DROP CONSTRAINT IF EXISTS custos_origem_check;

ALTER TABLE public.custos
  ADD CONSTRAINT custos_origem_check
  CHECK (origem IN ('manual', 'importacao'));

CREATE INDEX IF NOT EXISTS idx_custos_origem ON public.custos(origem);
CREATE INDEX IF NOT EXISTS idx_custos_criado_por ON public.custos(criado_por);

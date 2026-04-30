-- =============================================================================
-- Migration: 011_importacoes_observacao.sql
-- Data: 30/04/2026
-- Descrição: Adiciona campo observacao em importacoes para registrar warnings
--            de importação sem mudar o status para 'erro'.
--
-- Motivação: Bug jan/2026 — 7 empreendimentos com dados ausentes/errados após
--            importação parcialmente silenciosa. O campo permite rastrear quais
--            abas foram ignoradas sem bloquear a importação.
-- =============================================================================

ALTER TABLE public.importacoes
ADD COLUMN IF NOT EXISTS observacao text;

COMMENT ON COLUMN public.importacoes.observacao IS
  'Warnings ou alertas da importação. Ex: abas/empreendimentos não encontrados no banco.';

-- Verificação
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'importacoes'
  AND column_name = 'observacao';

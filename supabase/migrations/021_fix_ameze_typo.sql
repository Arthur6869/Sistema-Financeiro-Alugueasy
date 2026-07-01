-- =============================================================================
-- Migration: 021_fix_ameze_typo.sql
-- Data: 25/06/2026
-- Descrição: Corrige typo no nome do empreendimento AMEZE → AMAZE.
--
-- O empreendimento estava cadastrado como "AMEZE" (faltava o A).
-- A aba da planilha ADM é "AMAZE", portanto o resolverEmpId não conseguia
-- fazer o match e descartava silenciosamente essa aba na importação.
--
-- ASA SUL e LINK já existiam no banco com todos os apartamentos necessários:
--   ASA SUL: apt 104 (adm)  — id 73b8577b-2e35-40fd-896f-591a154b4b6f
--   LINK:    apt 104 (adm)  — id 03257c3b-a9b3-4d7b-8920-4380ce5840e1
--            apt 204 (adm)
--
-- ⚠️  Já aplicado manualmente via REST API em 25/06/2026.
--     Este arquivo serve apenas como registro histórico da migration.
-- =============================================================================

UPDATE public.empreendimentos
SET nome = 'AMAZE'
WHERE nome = 'AMEZE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.empreendimentos WHERE nome = 'AMAZE') THEN
    RAISE EXCEPTION 'AMAZE não encontrado após correção.';
  END IF;
  RAISE NOTICE 'AMEZE → AMAZE: OK';
END;
$$;

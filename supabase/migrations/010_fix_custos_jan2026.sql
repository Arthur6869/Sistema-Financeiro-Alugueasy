-- =============================================================================
-- Migration: 010_fix_custos_jan2026.sql
-- Data: 28/04/2026
-- Descrição: Corrige custos de janeiro/2026.
--
-- Diagnóstico (scripts/diagnostico-custos-jan.ts):
--   Total no banco:   R$ 187.974,81
--   Total correto:    R$ 205.775,01
--   Diferença:        R$ -17.800,20
--
-- 7 correções:
--   1. MERCURE ADM errado:      UPDATE 7400.99 → 7124.68     (−276.31)
--   2. CULLINAN ADM ausente:    INSERT 2338.62  apt 1304
--   3. ATHOS ADM ausente:       INSERT 2319.57  apt 3
--   4. NOBILE ADM ausente:      INSERT 1147.35  apt 803
--   5. NOBILE SUB ausente:      INSERT 4186.33  apt 19
--   6. FUSION SUB ausente:      INSERT 4086.33  apt 412
--   7. METROPOLITAN SUB ausente: INSERT 3998.31 apt 1701
--
-- Soma das correções: −276.31 + 2338.62 + 2319.57 + 1147.35 + 4186.33 + 4086.33 + 3998.31 = +17800.20
-- Total esperado após migração: R$ 205.775,01
-- =============================================================================

BEGIN;

-- ── 1. MERCURE ADM: corrigir valor errado ─────────────────────────────────────
UPDATE public.custos
SET valor = 7124.68
WHERE id = '5cc8fcff-f2a9-4c54-91bf-9d584e706dbc';

-- ── 2. CULLINAN ADM ───────────────────────────────────────────────────────────
INSERT INTO public.custos (apartamento_id, mes, ano, categoria, valor, tipo_gestao)
VALUES ('59e4b3a2-be6c-4ce6-9c38-96980ce0fc80', 1, 2026, 'Total Consolidado', 2338.62, 'adm');

-- ── 3. ATHOS ADM ──────────────────────────────────────────────────────────────
INSERT INTO public.custos (apartamento_id, mes, ano, categoria, valor, tipo_gestao)
VALUES ('d738c758-1f4b-4a65-9eaa-1cce3e716793', 1, 2026, 'Total Consolidado', 2319.57, 'adm');

-- ── 4. NOBILE ADM ─────────────────────────────────────────────────────────────
INSERT INTO public.custos (apartamento_id, mes, ano, categoria, valor, tipo_gestao)
VALUES ('9f1a7d90-2d7f-42f6-b0d1-3bc31b106307', 1, 2026, 'Total Consolidado', 1147.35, 'adm');

-- ── 5. NOBILE SUB ─────────────────────────────────────────────────────────────
INSERT INTO public.custos (apartamento_id, mes, ano, categoria, valor, tipo_gestao)
VALUES ('7e80e95d-3b42-42b5-9b73-faaa794604e8', 1, 2026, 'Total Consolidado', 4186.33, 'sub');

-- ── 6. FUSION SUB ─────────────────────────────────────────────────────────────
INSERT INTO public.custos (apartamento_id, mes, ano, categoria, valor, tipo_gestao)
VALUES ('4a44155b-e04d-4d31-8b9c-8189d2f7a712', 1, 2026, 'Total Consolidado', 4086.33, 'sub');

-- ── 7. METROPOLITAN SUB ───────────────────────────────────────────────────────
INSERT INTO public.custos (apartamento_id, mes, ano, categoria, valor, tipo_gestao)
VALUES ('6a0fabc4-67e1-458b-a676-bebff341e6e5', 1, 2026, 'Total Consolidado', 3998.31, 'sub');

-- ── Verificação: aborta se o total não bater ──────────────────────────────────
DO $$
DECLARE
  total   numeric;
  n_rows  integer;
BEGIN
  SELECT SUM(valor), COUNT(*) INTO total, n_rows
  FROM public.custos
  WHERE mes = 1 AND ano = 2026;

  RAISE NOTICE 'Total jan/2026 após migração: R$ % (% registros)', total, n_rows;

  IF abs(total - 205775.01) > 0.02 THEN
    RAISE EXCEPTION 'TOTAL INCORRETO: esperado 205775.01, obtido %. ROLLBACK.', total;
  END IF;
END;
$$;

COMMIT;

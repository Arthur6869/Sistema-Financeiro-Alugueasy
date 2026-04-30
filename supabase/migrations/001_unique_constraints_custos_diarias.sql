-- =============================================================================
-- Migration: 001_unique_constraints_custos_diarias.sql
-- Data: 06/04/2026
-- Descrição: Adiciona constraints UNIQUE nas tabelas custos e diarias para
--            impedir duplicação de registros em reimportações.
--
-- COMO APLICAR:
--   1. Acesse o Supabase Dashboard → projeto rlkmljeatapayiroggrp
--   2. Vá em SQL Editor
--   3. Cole e execute este script completo
-- =============================================================================


-- =============================================================================
-- PASSO 1: Remover duplicatas existentes na tabela custos
-- Mantém apenas o registro mais recente (maior id) para cada combinação única.
-- =============================================================================
DELETE FROM public.custos
WHERE id NOT IN (
  SELECT DISTINCT ON (apartamento_id, mes, ano, categoria, tipo_gestao)
    id
  FROM public.custos
  ORDER BY apartamento_id, mes, ano, categoria, tipo_gestao, created_at DESC
);


-- =============================================================================
-- PASSO 2: Adicionar constraint UNIQUE em custos
-- Garante que cada apartamento só pode ter um custo por (mes, ano, categoria, tipo_gestao).
-- =============================================================================
ALTER TABLE public.custos
  ADD CONSTRAINT custos_uq_apt_mes_ano_cat_gestao
  UNIQUE (apartamento_id, mes, ano, categoria, tipo_gestao);


-- =============================================================================
-- PASSO 3: Remover duplicatas existentes na tabela diarias
-- Mantém apenas o registro mais recente para cada combinação única.
-- =============================================================================
DELETE FROM public.diarias
WHERE id NOT IN (
  SELECT DISTINCT ON (apartamento_id, data, tipo_gestao)
    id
  FROM public.diarias
  ORDER BY apartamento_id, data, tipo_gestao, created_at DESC
);


-- =============================================================================
-- PASSO 4: Adicionar constraint UNIQUE em diarias
-- Garante que cada apartamento só pode ter uma diária por (data, tipo_gestao).
-- =============================================================================
ALTER TABLE public.diarias
  ADD CONSTRAINT diarias_uq_apt_data_gestao
  UNIQUE (apartamento_id, data, tipo_gestao);


-- =============================================================================
-- Verificação (opcional — execute após o script para confirmar)
-- =============================================================================
-- SELECT conname, contype FROM pg_constraint
-- WHERE conrelid IN ('public.custos'::regclass, 'public.diarias'::regclass)
-- AND contype = 'u';

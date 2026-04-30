-- =============================================================================
-- Migration: 002_fix_trigger_search_path.sql
-- Data: 06/04/2026
-- Descrição: Corrige a função handle_new_user() adicionando SET search_path = public
--            para eliminar vulnerabilidade de search_path injection apontada pelo
--            Supabase Security Advisor.
--
-- COMO APLICAR:
--   1. Acesse o Supabase Dashboard → projeto rlkmljeatapayiroggrp
--   2. Vá em SQL Editor
--   3. Cole e execute este script completo
-- =============================================================================


-- =============================================================================
-- Recriar a função handle_new_user() com search_path fixo
-- A cláusula SET search_path = public impede que um atacante com permissão
-- de criar schemas possa redirecionar chamadas de funções para schemas maliciosos.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    'analista'
  );
  RETURN new;
END;
$$;


-- =============================================================================
-- Verificar se o trigger ainda está ativo após recriar a função
-- =============================================================================
-- SELECT tgname, tgenabled
-- FROM pg_trigger
-- WHERE tgname = 'on_auth_user_created';

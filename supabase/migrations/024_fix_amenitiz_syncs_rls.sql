-- =============================================================================
-- Migration 024: Corrige RLS de amenitiz_syncs — substitui USING(true) por
--               função SECURITY DEFINER escopada
--
-- Problema: a policy "syncs_select" com USING(true) expõe todos os metadados
--           de sincronização (datas, status, totais) a qualquer usuário
--           autenticado, incluindo proprietários de outros imóveis.
--           Mesma classe de bug corrigida na migration 023 (Etapa A).
--
-- Solução:
--   1. Dropar "syncs_select" (USING true).
--   2. Criar "syncs_select_interno" — SELECT só para admin/analista.
--   3. Função periodo_sincronizado(p_mes, p_ano) SECURITY DEFINER retorna
--      boolean — único dado que o portal do proprietário precisa.
--      Proprietário recebe booleano; nunca vê linhas da tabela.
--
-- Tabelas afetadas: amenitiz_syncs
-- Novo objeto: função public.periodo_sincronizado(int, int)
-- Data: 2026-06-29
-- =============================================================================
-- ROLLBACK (ordem inversa):
--   DROP FUNCTION IF EXISTS public.periodo_sincronizado(int, int);
--   DROP POLICY IF EXISTS "syncs_select_interno" ON amenitiz_syncs;
--   CREATE POLICY "syncs_select" ON amenitiz_syncs
--     FOR SELECT TO authenticated USING (true);
-- =============================================================================


-- PARTE 1 — Remover policy permissiva
DROP POLICY IF EXISTS "syncs_select" ON amenitiz_syncs;


-- PARTE 2 — SELECT restrito a admin/analista
CREATE POLICY "syncs_select_interno" ON amenitiz_syncs
  FOR SELECT TO authenticated
  USING (public.is_interno());


-- PARTE 3 — Função booleana para o portal do proprietário
-- Retorna true se houver ao menos um sync concluído para o período.
-- SECURITY DEFINER: bypassa RLS internamente, retorna apenas bool — sem vazar linhas.
-- STABLE: safe para cache de plano (resultado determinístico por período).
CREATE OR REPLACE FUNCTION public.periodo_sincronizado(p_mes int, p_ano int)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM amenitiz_syncs
    WHERE mes = p_mes AND ano = p_ano AND status = 'concluido'
  );
$$;

GRANT EXECUTE ON FUNCTION public.periodo_sincronizado(int, int) TO authenticated;


-- =============================================================================
-- VERIFICAÇÃO FINAL:
--   1. "syncs_select" não existe mais
--   2. "syncs_select_interno" existe com is_interno() como condição
--   3. periodo_sincronizado() existe e é SECURITY DEFINER
--   4. Proprietário não consegue SELECT em amenitiz_syncs (retorna vazio)
--   5. Proprietário pode chamar periodo_sincronizado() e recebe boolean
-- =============================================================================
SELECT '024 aplicada — amenitiz_syncs RLS corrigido + periodo_sincronizado()' AS status;

-- =============================================================================
-- Migration 023: Corrige isolamento de RLS — elimina políticas SELECT permissivas
--
-- Problema: políticas "USING (true)" tornam amenitiz_reservas, diarias, custos e
--           apartamentos legíveis por QUALQUER usuário autenticado (incluindo
--           proprietários de outros imóveis). As policies de vínculo da migration
--           014 são somadas via OR — não restringem nada.
--
-- Solução:
--   1. Função helper is_interno() — evita subquery por linha, previne recursão RLS.
--   2. Dropar TODAS as políticas SELECT permissivas (USING true) nas 4 tabelas.
--   3. Nova política SELECT unificada por tabela:
--        is_interno()  → acesso total (admin/analista como hoje)
--        proprietario  → apenas seus apartamentos via FK (022) ou join seguro
--   4. Mecanismo deny-by-default para custos: tabela categorias_repassaveis +
--        policy de custos que exige categoria explicitamente marcada.
--   5. View custos_proprietario (security_invoker) para o portal usar.
--
-- OBRIGATÓRIO: rodar a query A.1 antes de aplicar e confirmar os nomes reais:
--   SELECT polname, polpermissive, polcmd,
--          pg_get_expr(polqual, polrelid) AS condicao
--   FROM pg_policy
--   WHERE polrelid IN (
--     'amenitiz_reservas'::regclass, 'diarias'::regclass,
--     'custos'::regclass, 'apartamentos'::regclass
--   );
-- Se houver nomes diferentes dos listados nos DROP abaixo, ajuste antes de aplicar.
--
-- Tabelas afetadas: amenitiz_reservas, diarias, custos, apartamentos,
--                   + nova tabela categorias_repassaveis, nova view custos_proprietario
-- Data: 2026-06-29
-- =============================================================================
-- ROLLBACK (executar em ordem inversa):
--   DROP VIEW IF EXISTS public.custos_proprietario;
--   DROP TABLE IF EXISTS public.categorias_repassaveis;
--   DROP FUNCTION IF EXISTS public.is_interno();
--   -- Re-criar as policies permissivas removidas (consultar migration 005 e setup inicial)
-- =============================================================================


-- =============================================================================
-- PARTE 1 — Função helper is_interno()
-- Verifica se o usuário corrente é admin ou analista.
-- SECURITY DEFINER + search_path fixo: seguro contra search_path injection (bug #9).
-- Uso de (select auth.uid()) evita avaliação por linha e previne recursão de RLS.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_interno()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'analista')
  );
$$;


-- =============================================================================
-- PARTE 2 — amenitiz_reservas
-- =============================================================================

-- Dropar políticas SELECT permissivas (migration 005 + 014)
DROP POLICY IF EXISTS "reservas_select"          ON amenitiz_reservas;
DROP POLICY IF EXISTS "proprietario_le_reservas" ON amenitiz_reservas;

-- Nova política unificada — usa FK (migration 022), elimina colisão de número
CREATE POLICY "reservas_select" ON amenitiz_reservas
FOR SELECT TO authenticated
USING (
  public.is_interno()
  OR EXISTS (
    SELECT 1 FROM proprietario_apartamentos pa
    WHERE pa.proprietario_id = (SELECT auth.uid())
      AND pa.apartamento_id  = amenitiz_reservas.apartamento_id
      AND pa.ativo = true
  )
);


-- =============================================================================
-- PARTE 3 — diarias
-- =============================================================================

-- Dropar políticas SELECT permissivas (nomes confirmados pela query A.1 em 2026-06-29)
DROP POLICY IF EXISTS "diarias_select_all"       ON diarias;  -- nome real (A.1)
DROP POLICY IF EXISTS "diarias_select"           ON diarias;  -- fallback
DROP POLICY IF EXISTS "select_diarias"           ON diarias;
DROP POLICY IF EXISTS "diarias_read"             ON diarias;
DROP POLICY IF EXISTS "read_diarias"             ON diarias;
DROP POLICY IF EXISTS "proprietario_le_diarias"  ON diarias;
DROP POLICY IF EXISTS "proprietario_read_diarias" ON diarias;

-- Nova política unificada — usa FK direta
CREATE POLICY "diarias_select" ON diarias
FOR SELECT TO authenticated
USING (
  public.is_interno()
  OR EXISTS (
    SELECT 1 FROM proprietario_apartamentos pa
    WHERE pa.proprietario_id = (SELECT auth.uid())
      AND pa.apartamento_id  = diarias.apartamento_id
      AND pa.ativo = true
  )
);


-- =============================================================================
-- PARTE 4 — Mecanismo deny-by-default para custos
-- =============================================================================

-- 4a. Tabela de categorias visíveis ao proprietário (deny-by-default)
--     Uma categoria só aparece no portal do proprietário se estiver aqui.
--     O analista gerencia a lista via /usuarios ou ferramenta MCP.
--     Sem registros → proprietário não vê nenhum custo (default seguro).
CREATE TABLE IF NOT EXISTS categorias_repassaveis (
  categoria   text PRIMARY KEY,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE categorias_repassaveis ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ler (portal precisa da lista para filtrar)
CREATE POLICY "categorias_select" ON categorias_repassaveis
  FOR SELECT TO authenticated USING (true);

-- Apenas internos (admin/analista) gerenciam a lista
CREATE POLICY "categorias_interno_gerencia" ON categorias_repassaveis
  FOR ALL TO authenticated
  USING (public.is_interno())
  WITH CHECK (public.is_interno());

-- 4b. Dropar políticas SELECT permissivas de custos (nomes confirmados pela query A.1)
DROP POLICY IF EXISTS "custos_select_all"       ON custos;   -- nome real (A.1)
DROP POLICY IF EXISTS "custos_select"           ON custos;   -- fallback
DROP POLICY IF EXISTS "select_custos"           ON custos;
DROP POLICY IF EXISTS "custos_read"             ON custos;
DROP POLICY IF EXISTS "read_custos"             ON custos;
DROP POLICY IF EXISTS "proprietario_le_custos"  ON custos;
DROP POLICY IF EXISTS "proprietario_read_custos" ON custos;

-- 4c. Nova política unificada de custos:
--     - Internos: acesso total (como hoje)
--     - Proprietários: apenas seus apartamentos E categoria explicitamente repassável
CREATE POLICY "custos_select" ON custos
FOR SELECT TO authenticated
USING (
  public.is_interno()
  OR (
    EXISTS (
      SELECT 1 FROM proprietario_apartamentos pa
      WHERE pa.proprietario_id = (SELECT auth.uid())
        AND pa.apartamento_id  = custos.apartamento_id
        AND pa.ativo = true
    )
    AND EXISTS (
      SELECT 1 FROM categorias_repassaveis cr
      WHERE upper(cr.categoria) = upper(custos.categoria)
    )
  )
);

-- 4d. View custos_proprietario — portal usa esta view (nunca a tabela direta)
--     security_invoker = true: a RLS de custos (policy 4c) é avaliada no contexto
--     do usuário que consulta, não do criador da view. Dupla proteção.
CREATE OR REPLACE VIEW public.custos_proprietario
WITH (security_invoker = true)
AS
SELECT c.*
FROM custos c
INNER JOIN categorias_repassaveis cr
  ON upper(cr.categoria) = upper(c.categoria);

COMMENT ON VIEW public.custos_proprietario IS
  'Custos filtrados pelas categorias marcadas como repassáveis ao proprietário. '
  'Use esta view no portal — nunca a tabela custos diretamente para proprietários.';


-- =============================================================================
-- PARTE 5 — apartamentos
-- =============================================================================

-- Dropar políticas SELECT permissivas (nomes confirmados pela query A.1)
DROP POLICY IF EXISTS "apartamentos_select_all"      ON apartamentos; -- nome real (A.1)
DROP POLICY IF EXISTS "apartamentos_select"          ON apartamentos;
DROP POLICY IF EXISTS "select_apartamentos"          ON apartamentos;
DROP POLICY IF EXISTS "apartamentos_read"            ON apartamentos;
DROP POLICY IF EXISTS "read_apartamentos"            ON apartamentos;
DROP POLICY IF EXISTS "enable_read_access_for_all"   ON apartamentos;

-- Nova política unificada
CREATE POLICY "apartamentos_select" ON apartamentos
FOR SELECT TO authenticated
USING (
  public.is_interno()
  OR EXISTS (
    SELECT 1 FROM proprietario_apartamentos pa
    WHERE pa.proprietario_id = (SELECT auth.uid())
      AND pa.apartamento_id  = apartamentos.id
      AND pa.ativo = true
  )
);


-- =============================================================================
-- VERIFICAÇÃO FINAL — execute após aplicar e confirme:
--   1. Nenhuma policy SELECT com USING (true) permanece nas 4 tabelas
--   2. A função is_interno() existe
--   3. A tabela categorias_repassaveis existe e está vazia (deny-by-default)
-- =============================================================================
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS condicao
-- FROM pg_policy
-- WHERE polrelid IN (
--   'amenitiz_reservas'::regclass, 'diarias'::regclass,
--   'custos'::regclass, 'apartamentos'::regclass
-- )
-- ORDER BY polrelid::text, polname;

SELECT '023 aplicada — RLS isolamento corrigido + deny-by-default de custos' AS status;

-- =============================================================================
-- Migration 036: Fecha o vazamento de LEITURA entre proprietários
--
-- DESCOBERTO NA VERIFICAÇÃO FUNCIONAL DA 035 (29/07/2026)
--   Simulando uma sessão real de proprietário (SET LOCAL ROLE authenticated +
--   request.jwt.claims), medimos o que cada um enxerga:
--
--     tabela            total   visível ao proprietário
--     apartamentos        75          75   <-- TUDO
--     empreendimentos     14          14   <-- TUDO
--     diarias            415         415   <-- TUDO
--     custos            1372        1372   <-- TUDO
--     importacoes        104         104   <-- TUDO
--     amenitiz_reservas 6579          48       filtrado corretamente
--
--   Ou seja: qualquer proprietário logado no portal lia o faturamento, os custos
--   e as condições comerciais (tipo_gestao, taxa_repasse, nome_proprietario) de
--   TODOS os outros. Não era necessário invadir nada — bastava ter conta.
--
-- CAUSA
--   As policies `<tabela>_write_authenticated` são `FOR ALL`, e **FOR ALL inclui
--   SELECT**. A migration 023 removeu as `<tabela>_select_all` permissivas e criou
--   as policies corretas de isolamento, mas deixou as `_write_authenticated` de
--   pé. Como policies permissivas se somam por OR, o `USING (true)` delas anulava
--   silenciosamente todo o isolamento da 023.
--
--     apartamentos    → apartamentos_write_authenticated     USING (true)
--     empreendimentos → empreendimentos_write_authenticated  USING (true)
--     diarias         → diarias_write_authenticated          USING (auth.role() = 'authenticated')
--     custos          → custos_write_authenticated           USING (auth.role() = 'authenticated')
--     importacoes     → importacoes_write_authenticated      USING (auth.role() = 'authenticated')
--
--   A 035 já bloqueou a ESCRITA nessas tabelas por policy restritiva. Faltava a
--   leitura, que restritiva de escrita não alcança.
--
-- CORREÇÃO
--   Trocar cada `_write_authenticated` (FOR ALL) por policies de escrita
--   explícitas por comando (INSERT/UPDATE/DELETE) exigindo is_interno(). Assim o
--   analista continua com CRUD e o SELECT volta a ser decidido apenas pelas
--   policies de isolamento da 023.
--
-- Data: 2026-07-29
-- =============================================================================
-- ROLLBACK: recria as policies antigas (NÃO recomendado — reabre o vazamento)
--   CREATE POLICY "apartamentos_write_authenticated" ON apartamentos
--     FOR ALL TO authenticated USING (true) WITH CHECK (true);
--   (idem para empreendimentos, diarias, custos, importacoes)
-- =============================================================================


-- =============================================================================
-- PARTE 1 — Substitui as policies FOR ALL por escrita explícita de interno
-- =============================================================================
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY['apartamentos', 'empreendimentos', 'diarias', 'custos', 'importacoes'];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- Remove a policy FOR ALL que concedia SELECT irrestrito de tabela
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write_authenticated', t);

    -- Recria a escrita, agora por comando e só para interno.
    -- (A 035 já tem a restritiva equivalente; esta é a permissiva que habilita
    --  a operação — sem uma permissiva, nem o analista escreveria.)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_interno', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_interno', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_interno', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated '
      'WITH CHECK (public.is_interno())', t || '_insert_interno', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated '
      'USING (public.is_interno()) WITH CHECK (public.is_interno())', t || '_update_interno', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated '
      'USING (public.is_interno())', t || '_delete_interno', t);

    RAISE NOTICE 'escrita de % isolada em is_interno(); SELECT volta às policies de isolamento', t;
  END LOOP;
END $$;


-- =============================================================================
-- PARTE 2 — SELECT das tabelas que ficaram sem policy de leitura própria
--
-- apartamentos, diarias e custos já têm a policy correta da migration 023.
-- empreendimentos e importacoes dependiam exclusivamente do FOR ALL removido
-- acima — sem estas policies elas ficariam invisíveis até para o analista.
-- =============================================================================

-- empreendimentos: o portal lê o nome via join (apartamentos → empreendimentos),
-- então o proprietário precisa enxergar os empreendimentos onde tem imóvel ativo.
DROP POLICY IF EXISTS "empreendimentos_select" ON public.empreendimentos;
CREATE POLICY "empreendimentos_select" ON public.empreendimentos
FOR SELECT TO authenticated
USING (
  public.is_interno()
  OR EXISTS (
    SELECT 1
    FROM apartamentos a
    JOIN proprietario_apartamentos pa ON pa.apartamento_id = a.id
    WHERE a.empreendimento_id = empreendimentos.id
      AND pa.proprietario_id = (SELECT auth.uid())
      AND pa.ativo = true
  )
);

-- importacoes: histórico de planilhas importadas. O portal do proprietário não
-- consulta esta tabela (verificado no código) — leitura só de interno.
DROP POLICY IF EXISTS "importacoes_select" ON public.importacoes;
CREATE POLICY "importacoes_select" ON public.importacoes
FOR SELECT TO authenticated
USING (public.is_interno());


-- =============================================================================
-- VERIFICAÇÃO — nenhuma policy permissiva FOR ALL sobrando nessas 5 tabelas
-- Esperado: 0 linhas.
-- =============================================================================
SELECT c.relname AS tabela, pol.polname AS policy_ainda_for_all,
       pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND pol.polpermissive AND pol.polcmd = '*'
  AND c.relname IN ('apartamentos', 'empreendimentos', 'diarias', 'custos', 'importacoes');

SELECT '036 aplicada — leitura entre proprietários isolada' AS status;

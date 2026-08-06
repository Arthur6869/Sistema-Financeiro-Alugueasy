-- =============================================================================
-- Migration 037: Blindagem final antes do aplicativo mobile
--
-- CONTEXTO
--   O app mobile (Expo/React Native) vai falar DIRETO com o Supabase via
--   PostgREST e Realtime. Ele nunca passa pelo proxy.ts do Next.js. Tudo que
--   hoje é protegido apenas na camada web deixa de ser protegido no celular.
--   Esta migration move essas travas para o banco, onde valem para qualquer
--   cliente — web, mobile ou um curl com o token do usuário.
--
--   Aplicar DEPOIS da 036.
--
-- O QUE ESTA MIGRATION FAZ
--   1. is_proprietario_ativo() — profiles.ativo passa a valer na RLS
--   2. custos_operacionais_variaveis: leitura só de interno
--   3. categorias_repassaveis: fecha o USING(true)
--   4. user_presence: escrita restrita a quem tem papel válido
--   5. RPCs deixam de ser chamáveis pela chave anônima
--   6. Escrita financeira exige ANALISTA (admin é somente leitura, por desenho)
--
-- COMO APLICAR
--   Supabase Dashboard -> projeto rlkmljeatapayiroggrp -> SQL Editor.
--   Rode o arquivo inteiro. As queries de verificação estão no fim.
-- Data: 2026-08-06
-- =============================================================================
-- ROLLBACK (ordem inversa):
--   -- 6:
--   DO $$ DECLARE t text; BEGIN
--     FOREACH t IN ARRAY ARRAY['apartamentos','empreendimentos','diarias','custos',
--       'amenitiz_reservas','importacoes','amenitiz_syncs','categorias_repassaveis',
--       'ingest_status','custos_operacionais_variaveis','proprietario_apartamentos']
--     LOOP
--       EXECUTE format('DROP POLICY IF EXISTS "restr_escrita_analista" ON public.%I', t);
--     END LOOP; END $$;
--   -- 5:
--   GRANT EXECUTE ON FUNCTION public.periodo_sincronizado(integer, integer) TO anon;
--   GRANT EXECUTE ON FUNCTION public.ultimo_ingest_timestamp() TO anon;
--   GRANT EXECUTE ON FUNCTION public.is_interno() TO anon;
--   -- 4:
--   DROP POLICY IF EXISTS "restr_presenca_papel_valido" ON public.user_presence;
--   -- 3:
--   DROP POLICY IF EXISTS "categorias_select" ON public.categorias_repassaveis;
--   CREATE POLICY "categorias_select" ON public.categorias_repassaveis
--     FOR SELECT TO authenticated USING (true);
--   -- 2:
--   DROP POLICY IF EXISTS "custos_op_select_interno" ON public.custos_operacionais_variaveis;
--   CREATE POLICY "autenticado_le_custos_op_variaveis" ON public.custos_operacionais_variaveis
--     FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
--   -- 1:
--   DO $$ DECLARE t text; BEGIN
--     FOREACH t IN ARRAY ARRAY['apartamentos','empreendimentos','diarias','custos',
--       'amenitiz_reservas','proprietario_apartamentos']
--     LOOP
--       EXECUTE format('DROP POLICY IF EXISTS "restr_conta_ativa" ON public.%I', t);
--     END LOOP; END $$;
--   DROP FUNCTION IF EXISTS public.is_proprietario_ativo();
-- =============================================================================


-- =============================================================================
-- PARTE 1 — profiles.ativo passa a existir para a RLS
--
-- A coluna `ativo` foi criada na 026 para suspender um proprietário, mas NENHUMA
-- policy jamais a consultou. A suspensão vivia só em proxy.ts:62-65. Resultado:
-- desativar um proprietário derruba o login do site, e nada mais — o token dele
-- continua lendo diárias, custos e reservas via PostgREST até expirar, e um app
-- mobile (que não tem proxy nenhum) ignoraria a suspensão por completo.
--
-- A policy é RESTRITIVA: entra em AND com as permissivas de isolamento da 023 e
-- da 036. Internos não são afetados (is_interno() continua valendo).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_proprietario_ativo()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'proprietario'
      AND coalesce(ativo, true) = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_proprietario_ativo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_proprietario_ativo() TO authenticated, service_role;

DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'apartamentos', 'empreendimentos', 'diarias', 'custos',
    'amenitiz_reservas', 'proprietario_apartamentos'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      RAISE NOTICE 'tabela % não existe — ignorada', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS "restr_conta_ativa" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "restr_conta_ativa" ON public.%I AS RESTRICTIVE '
      'FOR SELECT TO authenticated '
      'USING (public.is_interno() OR public.is_proprietario_ativo())', t);

    RAISE NOTICE 'leitura de % agora exige conta ativa', t;
  END LOOP;
END $$;


-- =============================================================================
-- PARTE 2 — custos_operacionais_variaveis: leitura só de interno
--
-- Policy original (020:16-18): FOR SELECT USING (auth.role() = 'authenticated').
-- `auth.role()` é 'authenticated' para QUALQUER sessão logada — o papel do
-- profiles não entra na conta. Ou seja: proprietário e até uma conta recém-criada
-- em 'pendente' liam o volume de diárias consolidado da operação, que é insumo
-- direto para inferir o faturamento agregado da AlugEasy.
-- Esta é a única tabela financeira que escapou do isolamento das 023/035/036.
-- =============================================================================
DROP POLICY IF EXISTS "autenticado_le_custos_op_variaveis" ON public.custos_operacionais_variaveis;
DROP POLICY IF EXISTS "custos_op_select_interno" ON public.custos_operacionais_variaveis;
CREATE POLICY "custos_op_select_interno" ON public.custos_operacionais_variaveis
  FOR SELECT TO authenticated
  USING (public.is_interno());


-- =============================================================================
-- PARTE 3 — categorias_repassaveis: fecha o USING(true)
--
-- Criada em 023:127-128 como FOR SELECT TO authenticated USING (true) e nunca
-- revista. O portal do proprietário realmente lê esta tabela, então não dá para
-- restringir a interno — mas dá para exigir uma conta com papel válido, tirando
-- 'pendente' e proprietário suspenso do caminho.
-- =============================================================================
DROP POLICY IF EXISTS "categorias_select" ON public.categorias_repassaveis;
CREATE POLICY "categorias_select" ON public.categorias_repassaveis
  FOR SELECT TO authenticated
  USING (public.is_interno() OR public.is_proprietario_ativo());


-- =============================================================================
-- PARTE 4 — user_presence: só papel válido escreve
--
-- A tabela ficou fora do array de restritivas da 035. As policies de 019 exigem
-- apenas `user_id = auth.uid()`, então uma conta 'pendente' — sem acesso a mais
-- nada no sistema — ainda conseguia gravar heartbeat. Impacto baixo (a linha é
-- self-scoped), mas é a única escrita que sobrevivia a um papel sem acesso.
-- =============================================================================
DROP POLICY IF EXISTS "restr_presenca_papel_valido" ON public.user_presence;
CREATE POLICY "restr_presenca_papel_valido" ON public.user_presence
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_interno() OR public.is_proprietario_ativo())
  WITH CHECK (public.is_interno() OR public.is_proprietario_ativo());


-- =============================================================================
-- PARTE 5 — RPCs fora do alcance da chave anônima
--
-- A 035 revogou os privilégios de TABELA do papel anon (035:286-296, relkind
-- r/v/m/p) e ajustou os DEFAULT PRIVILEGES para objetos FUTUROS (035:298-300).
-- Funções que já existiam ficaram de fora: no PostgreSQL, toda função nasce com
-- EXECUTE para PUBLIC, e PostgREST expõe isso em /rest/v1/rpc/<nome>. Qualquer
-- pessoa com a chave publicável (que é pública por design) conseguia chamá-las
-- sem sessão nenhuma.
-- =============================================================================
-- Varre TODAS as funções do schema public, não uma lista fixa de nomes: o dump
-- de 06/08/2026 mostrou 7 funções chamáveis por anon, incluindo `get_my_role`,
-- que não estava em nenhuma lista. Uma função nova criada amanhã nasceria aberta
-- do mesmo jeito, então o critério aqui é "tudo que existe no public".
--
-- Funções de trigger não recebem GRANT: o PostgreSQL não checa EXECUTE ao
-- disparar um trigger (a permissão é verificada na criação), então revogar não
-- quebra handle_new_user, impedir_escalonamento_role nem set_updated_at_presence.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS assinatura,
           (p.prorettype = 'pg_catalog.trigger'::regtype) AS eh_trigger
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.assinatura);
    IF NOT f.eh_trigger THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.assinatura);
    END IF;
    RAISE NOTICE 'execute de % restrito (trigger=%)', f.assinatura, f.eh_trigger;
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, PUBLIC;


-- =============================================================================
-- PARTE 6 — Escrita financeira exige ANALISTA, não apenas "interno"
--
-- Divergência real entre as duas camadas de autorização do sistema:
--   • A API trata admin como SOMENTE LEITURA (lib/api-auth.ts:34 devolve 403 a
--     admin; a tela de login anuncia "Somente leitura" para o papel).
--   • O BANCO trata admin como escritor: is_interno() inclui 'admin' (023:57) e
--     as restritivas da 035 exigem só is_interno().
--
-- No site isso já permite que um admin apague apartamentos e empreendimentos
-- direto pelo client do browser (components/shared/delete-button.tsx). Num app
-- mobile — que fala direto com o banco e por isso herda o modelo do BANCO, não o
-- da API — a divergência viraria a regra.
--
-- Esta parte alinha o banco ao desenho declarado: analista faz CRUD, admin lê.
-- A leitura de interno (que inclui admin) não é tocada.
--
-- OBS: /api/usuarios continua funcionando — usa service_role, que tem BYPASSRLS.
-- =============================================================================
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'apartamentos', 'empreendimentos', 'diarias', 'custos', 'amenitiz_reservas',
    'importacoes', 'amenitiz_syncs', 'categorias_repassaveis', 'ingest_status',
    'custos_operacionais_variaveis', 'proprietario_apartamentos'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      RAISE NOTICE 'tabela % não existe — ignorada', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS "restr_escrita_analista" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "restr_escrita_analista" ON public.%I AS RESTRICTIVE '
      'FOR ALL TO authenticated '
      'USING (true) '   -- não toca SELECT: a leitura segue as policies de isolamento
      'WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) '
      '                    AND role = ''analista''))', t);

    RAISE NOTICE 'escrita de % restrita a analista', t;
  END LOOP;
END $$;

-- DELETE não tem WITH CHECK — precisa de policy restritiva própria, senão um
-- admin continuaria apagando linhas mesmo com a regra acima no lugar.
DO $$
DECLARE
  t text;
  tabelas text[] := ARRAY[
    'apartamentos', 'empreendimentos', 'diarias', 'custos', 'amenitiz_reservas',
    'importacoes', 'amenitiz_syncs', 'categorias_repassaveis', 'ingest_status',
    'custos_operacionais_variaveis', 'proprietario_apartamentos'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS "restr_delete_analista" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "restr_delete_analista" ON public.%I AS RESTRICTIVE '
      'FOR DELETE TO authenticated '
      'USING (EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) '
      '               AND role = ''analista''))', t);

    RAISE NOTICE 'delete de % restrito a analista', t;
  END LOOP;
END $$;


-- =============================================================================
-- VERIFICAÇÃO — rode e confirme cada linha
-- =============================================================================

-- V1. is_proprietario_ativo() existe e é SECURITY DEFINER (esperado: 1 linha, 'definer')
SELECT 'V1: is_proprietario_ativo -> ' ||
       CASE WHEN prosecdef THEN 'SECURITY DEFINER OK' ELSE '*** INVOKER — ERRADO ***' END AS estado
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'is_proprietario_ativo';

-- V2. Policy de conta ativa nas 6 tabelas (esperado: 6 linhas)
SELECT c.relname AS tabela, pol.polname
FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND pol.polname = 'restr_conta_ativa'
ORDER BY c.relname;

-- V3. Nenhuma policy permissiva com USING(true) ou auth.role()='authenticated'
--     sobrando para SELECT nas tabelas financeiras (esperado: 0 linhas)
SELECT c.relname AS tabela, pol.polname AS policy_aberta,
       pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND pol.polpermissive
  AND pol.polcmd IN ('r', '*')
  AND pg_get_expr(pol.polqual, pol.polrelid) IN ('true', '(auth.role() = ''authenticated''::text)')
  AND c.relname IN ('apartamentos','empreendimentos','diarias','custos','importacoes',
                    'custos_operacionais_variaveis','categorias_repassaveis','amenitiz_reservas');

-- V4. anon não executa nenhuma função do public (esperado: 0 linhas)
SELECT 'V4 FALHOU: anon executa ' || p.oid::regprocedure AS problema
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND has_function_privilege('anon', p.oid, 'EXECUTE');

-- V5. anon sem privilégio de tabela (esperado: 0 linhas) — reconfirma a 035
SELECT 'V5 FALHOU: anon tem ' || privilege_type || ' em ' || table_name AS problema
FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public';

-- V6. Contagem de restritivas por tabela (esperado: 5 nas financeiras principais)
SELECT c.relname AS tabela, count(*) AS restritivas
FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT pol.polpermissive
GROUP BY c.relname ORDER BY c.relname;

-- V7. Quem tem papel no sistema (esperado: só a equipe conhecida + proprietários)
SELECT p.role, count(*) AS qtd
FROM public.profiles p GROUP BY p.role ORDER BY p.role;

SELECT '037 aplicada — blindagem pré-mobile' AS status;

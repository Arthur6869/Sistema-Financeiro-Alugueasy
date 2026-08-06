-- =============================================================================
-- Migration 035: Blindagem de segurança pós-incidente (auditoria de 29/07/2026)
--
-- CONTEXTO
--   Em 29/07/2026 às 00:05 a conta righettiroberto90@gmail.com foi criada por
--   auto-cadastro no endpoint público /auth/v1/signup e nasceu com role
--   'analista' (acesso total), por causa do trigger handle_new_user() original.
--   A migration 034 fechou esse vetor específico. Esta 035 fecha o RESTO da
--   superfície, para que nenhum caminho equivalente exista.
--
--   Princípio: usar policies AS RESTRICTIVE. Elas são AND-adas com todas as
--   policies permissivas existentes, então SÓ CONSEGUEM REDUZIR acesso — nunca
--   quebram uma leitura que hoje funciona, e não dependem de eu conhecer o nome
--   de cada policy legada que possa estar aberta demais.
--
-- O QUE ESTA MIGRATION FAZ
--   1. Trigger que impede escalonamento de papel (ninguém vira analista sozinho)
--   2. RLS habilitada em TODA tabela do schema public
--   3. Escrita nas tabelas financeiras exige is_interno() — restritivo
--   4. profiles: leitura só do próprio perfil (ou interno); escrita só interno
--   5. audit_log imutável para sessões de usuário
--   6. Realtime publicando APENAS amenitiz_reservas
--   7. Papel anon sem nenhum privilégio de tabela
--
-- COMO APLICAR
--   Supabase Dashboard → projeto rlkmljeatapayiroggrp → SQL Editor.
--   Rode a PARTE 0 primeiro e guarde o resultado (é o "antes").
--   Depois rode as PARTES 1 a 7 de uma vez.
-- Data: 2026-07-29
-- =============================================================================
-- ROLLBACK (ordem inversa):
--   DROP POLICY IF EXISTS "restr_anon_sem_acesso" ON <cada tabela>;
--   -- as policies restritivas criadas abaixo têm prefixo "restr_" — para
--   -- reverter tudo:
--   --   DO $$ DECLARE p record; BEGIN
--   --     FOR p IN SELECT c.relname, pol.polname FROM pg_policy pol
--   --              JOIN pg_class c ON c.oid = pol.polrelid
--   --              JOIN pg_namespace n ON n.oid = c.relnamespace
--   --              WHERE n.nspname='public' AND pol.polname LIKE 'restr_%'
--   --     LOOP EXECUTE format('DROP POLICY %I ON public.%I', p.polname, p.relname);
--   --     END LOOP; END $$;
--   DROP TRIGGER IF EXISTS trg_impedir_escalonamento_role ON public.profiles;
--   DROP FUNCTION IF EXISTS public.impedir_escalonamento_role();
--   GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;  -- só se algo quebrar
-- =============================================================================


-- =============================================================================
-- PARTE 0 — INVENTÁRIO "ANTES" (rode isolado e guarde o resultado)
-- =============================================================================
-- 0a. RLS está ligada em todas as tabelas?
--   SELECT c.relname AS tabela, c.relrowsecurity AS rls_ligada, c.relforcerowsecurity AS rls_forcada
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r'
--   ORDER BY c.relrowsecurity, c.relname;
--
-- 0b. Todas as policies e o que elas permitem:
--   SELECT c.relname AS tabela, pol.polname AS policy,
--          CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
--               WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END AS comando,
--          CASE WHEN pol.polpermissive THEN 'permissiva' ELSE 'RESTRITIVA' END AS tipo,
--          pg_get_expr(pol.polqual, pol.polrelid)      AS using_expr,
--          pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr,
--          (SELECT array_agg(rolname) FROM pg_roles WHERE oid = ANY(pol.polroles)) AS papeis
--   FROM pg_policy pol
--   JOIN pg_class c ON c.oid = pol.polrelid
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public'
--   ORDER BY c.relname, pol.polname;
--
-- 0c. O que está sendo transmitido pelo Realtime:
--   SELECT schemaname, tablename FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' ORDER BY tablename;
--
-- 0d. O que o papel anon (chave pública) pode tocar:
--   SELECT table_name, privilege_type FROM information_schema.role_table_grants
--   WHERE grantee = 'anon' AND table_schema = 'public' ORDER BY table_name;


-- =============================================================================
-- PARTE 1 — Impedir escalonamento de papel
--
-- Fecha a pergunta "e se alguém conseguir um UPDATE em profiles?". Mesmo que uma
-- policy permissiva legada deixe passar, este trigger bloqueia. Roda como
-- SECURITY DEFINER para poder consultar is_interno() sem depender de RLS.
--
-- Quem passa:
--   • service_role (rotas internas com a chave secreta, cron, este SQL Editor)
--   • o trigger handle_new_user() no cadastro (não há sessão: auth.uid() é null)
--   • interno (admin/analista) alterando o papel de OUTRA pessoa
-- Quem é bloqueado:
--   • qualquer sessão de usuário tentando mudar o próprio papel
--   • qualquer não-interno tentando mudar o papel de alguém
--   • qualquer não-interno tentando inserir um profile do zero
-- =============================================================================
CREATE OR REPLACE FUNCTION public.impedir_escalonamento_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  papel_jwt text := coalesce(auth.role(), 'anon');
  uid_atual uuid := auth.uid();
BEGIN
  -- service_role e contextos sem sessão (trigger de signup, jobs SQL) seguem
  IF papel_jwt = 'service_role' OR uid_atual IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_interno() THEN
      RAISE EXCEPTION 'SEGURANCA: criação de perfil não permitida por esta sessão';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: o papel só muda por mão de interno, e nunca o próprio papel
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.is_interno() THEN
      RAISE EXCEPTION 'SEGURANCA: alteração de papel não permitida (% -> %)', OLD.role, NEW.role;
    END IF;
    IF NEW.id = uid_atual THEN
      RAISE EXCEPTION 'SEGURANCA: não é permitido alterar o próprio papel';
    END IF;
  END IF;

  -- O id de um profile nunca muda (evita "assumir" o perfil de outro)
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'SEGURANCA: o id de um perfil não pode ser alterado';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_impedir_escalonamento_role ON public.profiles;
CREATE TRIGGER trg_impedir_escalonamento_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.impedir_escalonamento_role();


-- =============================================================================
-- PARTE 2 — RLS habilitada em TODA tabela do schema public
-- Idempotente. Uma tabela nova que alguém criar sem RLS passa a ser coberta.
-- =============================================================================
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
    RAISE NOTICE 'RLS habilitada em %', t.relname;
  END LOOP;
END $$;


-- =============================================================================
-- PARTE 3 — Escrita nas tabelas financeiras: SOMENTE internos
--
-- Policies RESTRITIVAS: entram em AND com o que já existe. Se sobrou alguma
-- policy antiga de INSERT/UPDATE/DELETE aberta demais, ela deixa de valer.
-- SELECT não é tocado — as leituras do portal do proprietário continuam iguais.
-- service_role tem BYPASSRLS, então as rotas internas continuam funcionando.
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
    -- pula tabelas que não existem neste projeto
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      RAISE NOTICE 'tabela % não existe — ignorada', t;
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS "restr_insert_interno" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "restr_update_interno" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "restr_delete_interno" ON public.%I', t);

    EXECUTE format(
      'CREATE POLICY "restr_insert_interno" ON public.%I AS RESTRICTIVE '
      'FOR INSERT TO authenticated WITH CHECK (public.is_interno())', t);
    EXECUTE format(
      'CREATE POLICY "restr_update_interno" ON public.%I AS RESTRICTIVE '
      'FOR UPDATE TO authenticated USING (public.is_interno()) WITH CHECK (public.is_interno())', t);
    EXECUTE format(
      'CREATE POLICY "restr_delete_interno" ON public.%I AS RESTRICTIVE '
      'FOR DELETE TO authenticated USING (public.is_interno())', t);

    RAISE NOTICE 'escrita restrita a internos em %', t;
  END LOOP;
END $$;


-- =============================================================================
-- PARTE 4 — profiles: cada um enxerga o próprio perfil; escrita só por interno
--
-- Sem isto, um proprietário logado consegue listar nome e papel de todo mundo —
-- inclusive descobrir quais contas são analista, que é o alvo de um ataque.
-- =============================================================================
DROP POLICY IF EXISTS "restr_select_proprio_ou_interno" ON public.profiles;
CREATE POLICY "restr_select_proprio_ou_interno" ON public.profiles
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_interno());

DROP POLICY IF EXISTS "restr_insert_interno" ON public.profiles;
CREATE POLICY "restr_insert_interno" ON public.profiles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.is_interno());

-- UPDATE do próprio perfil segue permitido (nome, etc.). A troca de PAPEL é
-- barrada pelo trigger da PARTE 1, que policy nenhuma consegue expressar.
DROP POLICY IF EXISTS "restr_update_proprio_ou_interno" ON public.profiles;
CREATE POLICY "restr_update_proprio_ou_interno" ON public.profiles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR public.is_interno())
  WITH CHECK (id = (SELECT auth.uid()) OR public.is_interno());

DROP POLICY IF EXISTS "restr_delete_interno" ON public.profiles;
CREATE POLICY "restr_delete_interno" ON public.profiles
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.is_interno());


-- =============================================================================
-- PARTE 5 — audit_log imutável para sessões de usuário
-- A escrita é exclusiva do service_role (lib/audit.ts). Assim ninguém forja nem
-- apaga entrada — o log continua confiável mesmo se uma conta interna cair.
-- =============================================================================
DROP POLICY IF EXISTS "restr_audit_somente_service_role" ON public.audit_log;
CREATE POLICY "restr_audit_somente_service_role" ON public.audit_log
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_interno())      -- leitura: interno
  WITH CHECK (false);              -- escrita: ninguém via JWT de usuário


-- =============================================================================
-- PARTE 6 — Realtime transmite APENAS amenitiz_reservas
--
-- Cada tabela na publication supabase_realtime vira um fluxo ao vivo de
-- INSERT/UPDATE/DELETE. Mesmo com a RLS filtrando linha a linha, publicar o que
-- não é usado só amplia a superfície. O portal só precisa de amenitiz_reservas.
-- =============================================================================
DO $$
DECLARE t record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'publication supabase_realtime não existe — nada a fazer';
    RETURN;
  END IF;

  FOR t IN
    SELECT tablename FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename <> 'amenitiz_reservas'
  LOOP
    EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t.tablename);
    RAISE NOTICE 'removida do Realtime: %', t.tablename;
  END LOOP;
END $$;


-- =============================================================================
-- PARTE 7 — Papel anon sem nenhum privilégio de tabela
--
-- A chave sb_publishable_ é pública por design e roda como 'anon'. Hoje a RLS já
-- barra tudo (testado: 0 linhas em 11 tabelas), mas revogar o GRANT é a trava de
-- baixo nível: mesmo que uma policy futura seja escrita errada, o anon não passa.
--
-- Seguro para este projeto: /home, /login e /login-proprietario só chamam
-- supabase.auth.signInWithPassword — nenhuma página pública lê tabela.
-- =============================================================================
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname, c.relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'p')
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.relname);
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;


-- =============================================================================
-- VERIFICAÇÃO FINAL — rode e confirme cada linha
-- =============================================================================

-- V1. Toda tabela do public com RLS ligada (esperado: 0 linhas)
SELECT 'V1 FALHOU: RLS desligada em ' || c.relname AS problema
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

-- V2. Nenhum privilégio de tabela sobrando para anon (esperado: 0 linhas)
SELECT 'V2 FALHOU: anon ainda tem ' || privilege_type || ' em ' || table_name AS problema
FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public';

-- V3. Realtime só com amenitiz_reservas (esperado: só essa linha)
SELECT 'V3: Realtime publica ' || tablename AS estado
FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public';

-- V4. Trigger anti-escalonamento instalado (esperado: 1 linha)
SELECT 'V4: trigger ' || tgname || ' ativo em profiles' AS estado
FROM pg_trigger WHERE tgrelid = 'public.profiles'::regclass
  AND tgname = 'trg_impedir_escalonamento_role' AND NOT tgisinternal;

-- V5. Trigger de signup entrega 'pendente' (esperado: 1 linha, contendo 'pendente')
SELECT 'V5: handle_new_user insere -> ' ||
       CASE WHEN prosrc LIKE '%pendente%' THEN 'pendente OK'
            ELSE '*** ' || left(prosrc, 200) || ' ***' END AS estado
FROM pg_proc WHERE proname = 'handle_new_user';

-- V6. Policies restritivas de escrita no lugar (esperado: 3 por tabela financeira)
SELECT c.relname AS tabela, count(*) AS policies_restritivas_escrita
FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT pol.polpermissive AND pol.polname LIKE 'restr_%'
GROUP BY c.relname ORDER BY c.relname;

-- V7. Ninguém com papel indevido (esperado: só a equipe conhecida)
SELECT p.role, p.full_name, u.email, u.created_at, u.last_sign_in_at
FROM public.profiles p JOIN auth.users u ON u.id = p.id
ORDER BY u.created_at DESC;

-- V8. Contas de Auth sem profile (esperado: 0 linhas)
SELECT 'V8 FALHOU: auth.users sem profile -> ' || u.email AS problema
FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

SELECT '035 aplicada — blindagem pós-incidente' AS status;

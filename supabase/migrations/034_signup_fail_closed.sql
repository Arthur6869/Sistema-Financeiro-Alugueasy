-- =============================================================================
-- Migration 034: Fecha o auto-cadastro privilegiado (INCIDENTE DE SEGURANÇA)
--
-- CONTEXTO
--   O trigger handle_new_user() (migration 002) inseria role = 'analista' — o
--   papel de ACESSO TOTAL — para TODO novo usuário do Supabase Auth. Como o
--   endpoint público /auth/v1/signup fica habilitado por padrão e é acessível
--   por qualquer um com a chave anônima (que é pública), qualquer pessoa podia
--   se cadastrar e receber CRUD completo sobre todos os dados financeiros.
--
-- CORREÇÃO (defesa em profundidade — a trava definitiva é desabilitar signup
--           no painel do Supabase; ver bloco "AÇÃO NO PAINEL" abaixo)
--   1. Novo papel 'pendente' = SEM acesso a nada (nem interno, nem portal).
--   2. handle_new_user() passa a inserir 'pendente' por padrão.
--      O fluxo legítimo (/api/usuarios) faz upsert do papel real logo em
--      seguida, então continua funcionando normalmente.
--   3. Queries de resposta a incidente para localizar/rebaixar/apagar as contas
--      criadas indevidamente.
--
-- COMO APLICAR
--   Supabase Dashboard → projeto rlkmljeatapayiroggrp → SQL Editor → cole e rode.
-- Data: 2026-07-28
-- =============================================================================
-- ROLLBACK:
--   -- Reverter o default do trigger para 'analista' NÃO é recomendado.
--   -- Se precisar, recrie handle_new_user() com VALUES(..., 'analista').
-- =============================================================================


-- =============================================================================
-- PARTE 1 — Papel 'pendente' (sem privilégios) no CHECK de profiles
-- =============================================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'analista', 'proprietario', 'pendente'));


-- =============================================================================
-- PARTE 2 — Trigger fail-closed: novo usuário nasce SEM acesso
-- is_interno() só reconhece admin/analista, e as policies de proprietário
-- exigem vínculo em proprietario_apartamentos — logo 'pendente' não lê nada.
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
    'pendente'            -- ANTES era 'analista' (acesso total) — causa do incidente
  );
  RETURN new;
END;
$$;


-- =============================================================================
-- PARTE 3 — RESPOSTA A INCIDENTE (rode manualmente, revisando cada passo)
-- =============================================================================

-- 3a. Contas de Auth mais recentes — identifique as que NÃO são da equipe:
--   SELECT u.id, u.email, u.created_at, u.last_sign_in_at, p.role, p.full_name
--   FROM auth.users u
--   LEFT JOIN public.profiles p ON p.id = u.id
--   ORDER BY u.created_at DESC
--   LIMIT 50;

-- 3b. Qualquer conta indevida que TENHA ficado como 'analista'/'admin':
--     rebaixe imediatamente para 'pendente' (troque os emails pelos reais):
--   UPDATE public.profiles SET role = 'pendente'
--   WHERE id IN (
--     SELECT id FROM auth.users WHERE email IN ('intruso@exemplo.com')
--   );

-- 3c. O que a conta invasora fez (auditoria de operações destrutivas/sensíveis):
--   SELECT created_at, acao, tabela, registros_afetados, detalhes
--   FROM public.audit_log
--   WHERE usuario_id IN (SELECT id FROM auth.users WHERE email = 'intruso@exemplo.com')
--   ORDER BY created_at DESC;

-- 3d. Apagar a conta invasora de vez (remove do Auth; cascata limpa profile/vínculos).
--     Prefira apagar pelo painel (Authentication → Users) para ter confirmação:
--   DELETE FROM auth.users WHERE email IN ('intruso@exemplo.com');


-- =============================================================================
-- AÇÃO NO PAINEL DO SUPABASE (OBRIGATÓRIA — é o que realmente bloqueia o signup)
-- =============================================================================
--   Authentication → Sign In / Providers → Email
--     • DESLIGUE "Allow new users to sign up"  (enable_signup = false)
--   (Opcional) Authentication → Providers: desabilite provedores sociais não usados.
--   Assim o endpoint /auth/v1/signup passa a recusar qualquer novo cadastro.
-- =============================================================================

SELECT '034 aplicada — signup fail-closed (trigger => pendente) + papel pendente' AS status;

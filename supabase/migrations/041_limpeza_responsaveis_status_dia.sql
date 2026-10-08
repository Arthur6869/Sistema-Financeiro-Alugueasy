-- =============================================================================
-- 041 — Limpeza: vários responsáveis por registro + status "limpo hoje"
--
-- Ajustes pedidos em 07/10/2026 sobre a camada operacional (040):
--   1. Quem finaliza escolhe TODAS as pessoas que fizeram a limpeza (uma ou
--      mais). O registro guarda todos os nomes em `responsaveis` (jsonb
--      [{id, nome}]). `operador_id/operador_nome` continuam = quem registrou.
--   2. A lista de imóveis mostra ícone verde quando o imóvel foi limpo HOJE
--      (fuso de São Paulo). No dia seguinte a cor zera sozinha — é calculado
--      pela data da última limpeza, nada precisa rodar à noite. O histórico
--      continua em `limpezas`.
--
-- Para a pessoa escolher os colegas, nasce `listar_equipe_limpeza()`: devolve
-- só id + nome das contas operacionais ativas. A RLS de `profiles` NÃO muda
-- (operacional continua lendo só o próprio perfil).
-- Aditiva: nenhuma policy dos papéis existentes é tocada.
-- =============================================================================


-- PARTE 1 — coluna de responsáveis
ALTER TABLE public.limpezas
  ADD COLUMN IF NOT EXISTS responsaveis jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.limpezas DROP CONSTRAINT IF EXISTS limpezas_responsaveis_array;
ALTER TABLE public.limpezas
  ADD CONSTRAINT limpezas_responsaveis_array CHECK (jsonb_typeof(responsaveis) = 'array');

-- Registros anteriores à 041 (se houver): responsável = quem registrou.
UPDATE public.limpezas
   SET responsaveis = jsonb_build_array(jsonb_build_object('id', operador_id, 'nome', operador_nome))
 WHERE responsaveis = '[]'::jsonb;


-- PARTE 2 — equipe de limpeza (para o seletor de responsáveis)
CREATE OR REPLACE FUNCTION public.listar_equipe_limpeza()
RETURNS TABLE (id uuid, nome text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id, coalesce(nullif(trim(p.full_name), ''), 'Sem nome')
  FROM profiles p
  WHERE p.role = 'operacional'
    AND coalesce(p.ativo, true) = true
    AND (public.is_operacional_ativo() OR public.is_interno())
  ORDER BY 2;
$$;

REVOKE EXECUTE ON FUNCTION public.listar_equipe_limpeza() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_equipe_limpeza() TO authenticated, service_role;


-- PARTE 3 — lista de imóveis com status do dia
-- O tipo de retorno muda (duas colunas novas), então é DROP + CREATE.
DROP FUNCTION IF EXISTS public.listar_imoveis_limpeza();

CREATE FUNCTION public.listar_imoveis_limpeza()
RETURNS TABLE (
  apartamento_id          uuid,
  empreendimento          text,
  numero                  text,
  ultima_limpeza_em       timestamptz,
  ultima_limpeza_por      text,
  ultima_limpeza_completa boolean,
  limpa_hoje              boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    a.id,
    e.nome,
    a.numero,
    ul.finalizada_em,
    -- primeiros nomes de todos os responsáveis; cai no registrador se vazio
    coalesce(
      (SELECT string_agg(split_part(t.r->>'nome', ' ', 1), ', ' ORDER BY t.ord)
         FROM jsonb_array_elements(ul.responsaveis) WITH ORDINALITY AS t(r, ord)),
      split_part(ul.operador_nome, ' ', 1)
    ),
    ul.completa,
    coalesce(
      (ul.finalizada_em AT TIME ZONE 'America/Sao_Paulo')::date
        = (now() AT TIME ZONE 'America/Sao_Paulo')::date,
      false
    )
  FROM apartamentos a
  JOIN empreendimentos e ON e.id = a.empreendimento_id
  LEFT JOIN LATERAL (
    SELECT l.finalizada_em, l.operador_nome, l.responsaveis, l.completa
    FROM limpezas l
    WHERE l.apartamento_id = a.id
    ORDER BY l.finalizada_em DESC
    LIMIT 1
  ) ul ON true
  WHERE public.is_interno() OR public.is_operacional_ativo()
  ORDER BY e.nome, a.numero;
$$;

REVOKE EXECUTE ON FUNCTION public.listar_imoveis_limpeza() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_imoveis_limpeza() TO authenticated, service_role;


-- =============================================================================
-- VERIFICAÇÃO
-- =============================================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'limpezas' AND column_name = 'responsaveis';
-- SELECT proname, has_function_privilege('anon', oid, 'EXECUTE') FROM pg_proc
--  WHERE proname IN ('listar_equipe_limpeza', 'listar_imoveis_limpeza');

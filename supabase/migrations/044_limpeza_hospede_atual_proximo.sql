-- =============================================================================
-- 044 — Limpeza: hóspede atual e próximo, com datas (só o primeiro nome)
--
-- Pedido de 08/10/2026: a lista da equipe mostra quem está no imóvel e quem
-- vai entrar, com entrada/saída de cada um. Decisão de minimização: a tabela
-- de ocupação guarda APENAS o primeiro nome do titular da reserva (nada de
-- sobrenome, e-mail ou telefone) — é o suficiente para a equipe saber com
-- quem está falando ao bater na porta. Para tirar o nome da tela depois,
-- basta o app/site ignorarem as colunas `hospede_atual`/`proximo_hospede`.
--
-- Aditiva: nenhuma policy muda; só a função da lista ganha colunas.
-- =============================================================================


-- PARTE 1 — primeiro nome na ocupação (o sync passa a gravar; backfill abaixo)
ALTER TABLE public.limpeza_ocupacao
  ADD COLUMN IF NOT EXISTS hospede text NULL;

UPDATE public.limpeza_ocupacao o
   SET hospede = left(nullif(split_part(trim(r.raw_data->'booker'->>'first_name'), ' ', 1), ''), 40)
  FROM public.amenitiz_reservas r
 WHERE r.booking_id = o.booking_id
   AND o.hospede IS NULL;


-- PARTE 2 — lista de imóveis com hóspede atual e próximo
-- Colunas novas no fim: hospede_atual, hospedado_desde, hospedes_atuais,
-- proximo_hospede, proxima_saida. O resto é igual à 043.
DROP FUNCTION IF EXISTS public.listar_imoveis_limpeza();

CREATE FUNCTION public.listar_imoveis_limpeza()
RETURNS TABLE (
  unidade_id               uuid,
  apartamento_id           uuid,
  empreendimento           text,
  numero                   text,
  ultima_limpeza_em        timestamptz,
  ultima_limpeza_por       text,
  ultima_limpeza_completa  boolean,
  limpa_hoje               boolean,
  situacao                 text,
  hospedado_ate            date,
  saida_hoje               boolean,
  entrada_hoje             boolean,
  ultima_saida             date,
  proxima_entrada          date,
  proxima_entrada_hospedes int,
  ocupacao_atualizada_em   timestamptz,
  hospede_atual            text,
  hospedado_desde          date,
  hospedes_atuais          int,
  proximo_hospede          text,
  proxima_saida            date
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH hoje AS (
    SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d
  ),
  base AS (
    SELECT
      u.id, u.apartamento_id, u.empreendimento, u.numero,
      ul.finalizada_em, ul.responsaveis, ul.operador_nome, ul.completa,
      (ul.finalizada_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia_limpeza,
      oc.hospedado_ate, oc.saida_hoje, oc.entrada_hoje, oc.ultima_saida,
      em_curso.checkin  AS hospedado_desde,
      em_curso.hospede  AS hospede_atual,
      em_curso.hospedes AS hospedes_atuais,
      px.checkin  AS proxima_entrada,
      px.checkout AS proxima_saida,
      px.hospede  AS proximo_hospede,
      px.hospedes AS proxima_entrada_hospedes,
      h.d
    FROM limpeza_unidades u
    CROSS JOIN hoje h
    LEFT JOIN LATERAL (
      SELECT l.finalizada_em, l.operador_nome, l.responsaveis, l.completa
      FROM limpezas l
      WHERE l.unidade_id = u.id
      ORDER BY l.finalizada_em DESC
      LIMIT 1
    ) ul ON true
    LEFT JOIN LATERAL (
      SELECT
        max(o.checkout) FILTER (WHERE o.checkin < h.d AND o.checkout > h.d)          AS hospedado_ate,
        coalesce(bool_or(o.checkout = h.d), false)                                  AS saida_hoje,
        coalesce(bool_or(o.checkin = h.d), false)                                   AS entrada_hoje,
        max(o.checkout) FILTER (WHERE o.checkout <= h.d AND o.checkout >= greatest(h.d - 7, DATE '2026-10-08')) AS ultima_saida
      FROM limpeza_ocupacao o
      WHERE o.room_id = ANY (u.amenitiz_room_ids)
        AND o.status NOT IN ('cancelled', 'canceled', 'no_show')
    ) oc ON true
    -- reserva em curso (a mesma que define hospedado_ate)
    LEFT JOIN LATERAL (
      SELECT o.checkin, o.hospede, o.hospedes
      FROM limpeza_ocupacao o
      WHERE o.room_id = ANY (u.amenitiz_room_ids)
        AND o.status NOT IN ('cancelled', 'canceled', 'no_show')
        AND o.checkin < h.d AND o.checkout > h.d
      ORDER BY o.checkout DESC
      LIMIT 1
    ) em_curso ON true
    -- próxima entrada a partir de hoje
    LEFT JOIN LATERAL (
      SELECT o.checkin, o.checkout, o.hospede, o.hospedes
      FROM limpeza_ocupacao o
      WHERE o.room_id = ANY (u.amenitiz_room_ids)
        AND o.status NOT IN ('cancelled', 'canceled', 'no_show')
        AND o.checkin >= h.d
      ORDER BY o.checkin
      LIMIT 1
    ) px ON true
    WHERE u.ativo
      AND (public.is_interno() OR public.is_operacional_ativo())
  )
  SELECT
    b.id,
    b.apartamento_id,
    b.empreendimento,
    b.numero,
    b.finalizada_em,
    coalesce(
      (SELECT string_agg(split_part(t.r->>'nome', ' ', 1), ', ' ORDER BY t.ord)
         FROM jsonb_array_elements(b.responsaveis) WITH ORDINALITY AS t(r, ord)),
      split_part(b.operador_nome, ' ', 1)
    ),
    b.completa,
    coalesce(b.dia_limpeza = b.d, false),
    CASE
      WHEN b.hospedado_ate IS NOT NULL THEN 'ocupado'
      WHEN b.ultima_saida IS NOT NULL AND (b.dia_limpeza IS NULL OR b.dia_limpeza < b.ultima_saida) THEN 'pendente'
      WHEN (b.ultima_saida IS NOT NULL OR b.dia_limpeza = b.d) AND b.completa = false THEN 'incompleta'
      WHEN b.ultima_saida IS NOT NULL OR b.dia_limpeza = b.d THEN 'limpo'
      ELSE 'livre'
    END,
    b.hospedado_ate,
    b.saida_hoje,
    b.entrada_hoje,
    b.ultima_saida,
    b.proxima_entrada,
    b.proxima_entrada_hospedes,
    (SELECT max(o.atualizado_em) FROM limpeza_ocupacao o),
    b.hospede_atual,
    b.hospedado_desde,
    b.hospedes_atuais,
    b.proximo_hospede,
    b.proxima_saida
  FROM base b
  ORDER BY
    b.empreendimento,
    nullif(regexp_replace(b.numero, '\D', '', 'g'), '')::int NULLS LAST,
    b.numero;
$$;

REVOKE EXECUTE ON FUNCTION public.listar_imoveis_limpeza() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_imoveis_limpeza() TO authenticated, service_role;


-- =============================================================================
-- VERIFICAÇÃO
-- =============================================================================
-- SELECT count(*) FILTER (WHERE hospede IS NOT NULL), count(*) FROM limpeza_ocupacao;
-- SELECT numero, situacao, hospede_atual, hospedado_desde, hospedado_ate, proximo_hospede, proxima_entrada, proxima_saida
--   FROM listar_imoveis_limpeza() LIMIT 10;   -- rodar logado como interno

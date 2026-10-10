-- =============================================================================
-- 045 — Sync sem regravação: só grava reservas e ocupação que mudaram
--
-- Contexto (10/10/2026): o Supabase (plano gratuito) avisou quatro vezes que o
-- orçamento de I/O de disco estava sendo consumido. Causa: o cron de reservas
-- (a cada 10 min) regravava as ~500 reservas do mês inteiras (com raw_data)
-- mesmo sem mudança nenhuma — 17 mi de updates em amenitiz_reservas desde
-- 25/05/2026 e 13 mi de páginas sujas para uma tabela de 18 MB — e a ocupação
-- da limpeza apagava e reinseria ~600 linhas por rodada.
--
-- A correção está em lib/sync-amenitiz-core.ts: o sync compara o que vai
-- gravar com o que já está no banco e pula o que é idêntico. Esta migration só
-- dá a coluna que guarda o hash e ajusta o "atualizado há X min" da limpeza.
--
-- Aditiva: nenhuma policy muda. Pode ser aplicada antes ou depois do deploy —
-- sem a coluna o sync avisa no log e volta a gravar tudo (comportamento antigo).
-- =============================================================================


-- PARTE 1 — hash do payload gravado em cada reserva
-- NULL nas linhas existentes: o primeiro sync após o deploy regrava cada uma
-- UMA vez (hash diferente de NULL) e a partir daí só o que mudar.
ALTER TABLE public.amenitiz_reservas
  ADD COLUMN IF NOT EXISTS sync_hash text NULL;

COMMENT ON COLUMN public.amenitiz_reservas.sync_hash IS
  'SHA-1 do payload gravado pelo sync (lib/sync-amenitiz-core.ts). Igual ⇒ o upsert é pulado.';


-- PARTE 2 — "ocupação atualizada em" na lista da limpeza
-- Como linhas idênticas não são mais regravadas, max(atualizado_em) passaria a
-- ser a última MUDANÇA, não o último sync. Combina com ingest_status.ultimo_at
-- (gravado a cada rodada bem-sucedida do cron). Corpo idêntico ao da 044 fora
-- esse campo.
CREATE OR REPLACE FUNCTION public.listar_imoveis_limpeza()
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
    greatest(
      (SELECT max(o.atualizado_em) FROM limpeza_ocupacao o),
      (SELECT s.ultimo_at FROM ingest_status s WHERE s.id = 'global')
    ),
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

-- =============================================================================
-- VERIFICAÇÃO
-- =============================================================================
-- SELECT count(*) FILTER (WHERE sync_hash IS NOT NULL), count(*) FROM amenitiz_reservas;
-- SELECT n_tup_upd, n_tup_hot_upd FROM pg_stat_user_tables WHERE relname = 'amenitiz_reservas';
--   (n_tup_upd deve parar de crescer ~500 por rodada do cron)

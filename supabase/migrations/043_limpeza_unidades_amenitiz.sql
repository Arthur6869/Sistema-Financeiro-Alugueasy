-- =============================================================================
-- 043 — Limpeza: imóveis vindos da Amenitiz + ocupação (entrada/saída)
--
-- Pedido de 08/10/2026:
--   1. A lista da equipe de limpeza tem de ser a dos quartos que a Amenitiz
--      opera HOJE, e não o cadastro financeiro de `apartamentos` (que guarda
--      imóveis antigos: ASA SUL 104, AMAZE 211, BRISAS A113/A115/A117/B119/
--      E016/E020, EASY 218, ESSENCE 301, FUSION 1709, MERCURE 1311/1419,
--      VISION 1605, ATHOS 908 e variantes duplicadas como ATHOS 19M e
--      CULLINAN 218C/404C). Recapitulação feita contra a tela "Categorias de
--      quartos" da Amenitiz + a API de reservas (set/2026 a jan/2027).
--   2. A lista mostra quando o hóspede está no imóvel e quando ele saiu:
--      saiu e ainda não houve limpeza = PENDENTE; limpo depois da saída = PRONTO.
--
-- Desenho: o cadastro de limpeza fica SEPARADO do financeiro.
--   - `limpeza_unidades`: uma linha por unidade física, com os IDs de quarto
--     da Amenitiz que a ocupam. `apartamento_id` liga ao cadastro financeiro
--     quando existe (itens extras do checklist); é nulo para quartos ainda sem
--     cadastro financeiro (FUSION 318, VISION 1016, SAINT MORITZ 613).
--   - `limpeza_ocupacao`: entrada/saída por (reserva, quarto), gravada pelo
--     sync da Amenitiz (lib/sync-amenitiz-core.ts) com TODOS os quartos — o
--     sync financeiro descarta quartos que não reconhece (SM 701/1106/1808) e
--     atribui reservas de grupo a um só apartamento; a limpeza precisa de
--     todos. Sem nome nem contato do hóspede: só datas, status e nº de pessoas.
--
-- Nada no financeiro muda: `apartamentos`, `amenitiz_reservas`, diárias e
-- policies dos outros papéis ficam intactos.
-- =============================================================================


-- PARTE 1 — unidades de limpeza
CREATE TABLE IF NOT EXISTS public.limpeza_unidades (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empreendimento     text NOT NULL,
  numero             text NOT NULL,
  apartamento_id     uuid NULL REFERENCES public.apartamentos(id) ON DELETE SET NULL,
  amenitiz_room_ids  text[] NOT NULL DEFAULT '{}',
  ativo              boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empreendimento, numero)
);

ALTER TABLE public.limpeza_unidades ENABLE ROW LEVEL SECURITY;

-- Equipe interna lê; ninguém grava pela API (ajustes por migration/SQL Editor).
-- O operacional só enxerga as unidades pela função listar_imoveis_limpeza().
DROP POLICY IF EXISTS "limpeza_unidades_select" ON public.limpeza_unidades;
CREATE POLICY "limpeza_unidades_select" ON public.limpeza_unidades
  FOR SELECT TO authenticated
  USING (public.is_interno());

-- Quartos ativos na Amenitiz em 08/10/2026. Nomes como a equipe conhece
-- (Amenitiz); a terceira e a quarta colunas ligam ao cadastro financeiro.
-- Metropolitan 1615/1615A também são vendidos juntos ("1615 e 1615A",
-- room 037dc1ea): uma reserva desse anúncio ocupa as duas unidades.
-- Vision 1016 = quarto e4a90e7d, que até 12/03 era o anúncio do Park Sul
-- Essence 204 e de 16/05 a 29/06 o ASA SUL 104 ("SQS 414"); desde 30/06 a
-- Amenitiz o chama de "Vision". Sem vínculo financeiro aqui de propósito.
-- SM 701 = quarto 968a704e, que até jul/2026 era o "Fusion 1709".
-- Saint Moritz 613 ainda não tem reserva nem ID de quarto conhecido.
INSERT INTO public.limpeza_unidades (empreendimento, numero, apartamento_id, amenitiz_room_ids)
SELECT v.emp, v.num, a.id, v.rooms
FROM (VALUES
  ('Park Sul Essence', '302',   'ESSENCE',      '302',   ARRAY['d7246fb8-b10a-4fb4-9c9f-a6877838a115']),
  ('Park Sul Essence', '404',   'ESSENCE',      '404',   ARRAY['d38e32f2-1a9b-494b-96fd-79d53263c4f2']),
  ('Park Sul Essence', '502',   'ESSENCE',      '502',   ARRAY['69c92507-7d68-470e-95a0-7e5cd063d814']),
  ('Park Sul Essence', '504',   'ESSENCE',      '504',   ARRAY['c23f4610-fbf5-4248-829a-7b49b1c38f7b']),
  ('Park Sul Essence', '602',   'ESSENCE',      '602',   ARRAY['6c86f26b-a5a5-4708-98f0-b37677d06bd8']),
  ('Park Sul Essence', '603',   'ESSENCE',      '603',   ARRAY['92d0cc7b-de8a-43da-843b-399e69fff3e4']),
  ('Park Sul Essence', '702',   'ESSENCE',      '702',   ARRAY['fb44713a-cc07-4334-9bba-cc44c365de63']),
  ('Metropolitan',     '316A',  'METROPOLITAN', '316A',  ARRAY['6b216f01-0504-4a64-b27f-db1e9438f6a0']),
  ('Metropolitan',     '604A',  'METROPOLITAN', '604A',  ARRAY['edf610fb-b301-459c-b79d-a3029f9bf451']),
  ('Metropolitan',     '1214A', 'METROPOLITAN', '1214A', ARRAY['0773b5ed-5800-433c-8677-1f3b46999c6f']),
  ('Metropolitan',     '1605',  'METROPOLITAN', '1605',  ARRAY['e0d8176e-805a-457f-9258-c2119f7419c4']),
  ('Metropolitan',     '1615',  'METROPOLITAN', '1615',  ARRAY['8b6d724d-4853-4979-a29c-2ce33e5e5201', '037dc1ea-79a1-4ae0-be38-159b84951331']),
  ('Metropolitan',     '1615A', 'METROPOLITAN', '1615A', ARRAY['cf425c8e-445e-41fb-8cc0-899fd99d75d9', '037dc1ea-79a1-4ae0-be38-159b84951331']),
  ('Metropolitan',     '1701',  'METROPOLITAN', '1701',  ARRAY['64cd95af-3478-4ad4-adb3-20ad72237c17']),
  ('Metropolitan',     '1701A', 'METROPOLITAN', '1701A', ARRAY['df34ab90-7c27-4f5c-874d-6b852525cbf3']),
  ('Athos Bulcão',     '03M',   'ATHOS',        '3',     ARRAY['9e594063-d2a6-41dd-aac0-f8c38fd99364']),
  ('Athos Bulcão',     '18M',   'ATHOS',        '18',    ARRAY['93eee3f7-794a-4d9b-bdc0-14c510632bfa']),
  ('Athos Bulcão',     '19M',   'ATHOS',        '19',    ARRAY['6e90d78d-daca-4b9a-a779-3528780a9b7f']),
  ('Athos Bulcão',     '809',   'ATHOS',        '809',   ARRAY['d0c42787-c69a-4bac-a65c-2df161a1d44c']),
  ('Athos Bulcão',     '812',   'ATHOS',        '812',   ARRAY['4460cedb-4cb2-4f26-b104-3d19cfc76532']),
  ('Athos Bulcão',     '910',   'ATHOS',        '910',   ARRAY['9eccac74-8804-4690-8db6-a28f6b734a67']),
  ('Athos Bulcão',     '1016',  'ATHOS',        '1016',  ARRAY['27ebb147-a8bc-4852-9fb5-20c4193f7939']),
  ('Athos Bulcão',     '1101',  'ATHOS',        '1101',  ARRAY['762ab4fb-6069-4968-9ca4-d7f6f6f56342']),
  ('Athos Bulcão',     '1115',  'ATHOS',        '1115',  ARRAY['817e8b5b-8315-4ce6-94bc-93ec6f14356b']),
  ('Athos Bulcão',     '1209',  'ATHOS',        '1209',  ARRAY['806d43eb-f08d-45e2-9e09-21ca1a4f4878']),
  ('Nobile',           '19',    'NOBILE',       '19',    ARRAY['f0bb5cd9-c5c2-40b2-98b3-9b3ba1422d4d']),
  ('Nobile',           '718',   'NOBILE',       '718',   ARRAY['299cc207-3044-494f-ab97-770b80624f07']),
  ('Nobile',           '803',   'NOBILE',       '803',   ARRAY['468805a9-db1d-4d58-9faa-4adf58189b0e']),
  ('Mercure',          '906',   'MERCURE',      '906',   ARRAY['9f7e9c18-34cb-453b-9981-8e3ec7c337dc']),
  ('Mercure',          '1011',  'MERCURE',      '1011',  ARRAY['8aa40863-59a9-4562-90af-ffd7a89931ad']),
  ('Mercure',          '1119',  'MERCURE',      '1119',  ARRAY['a75e5a13-25b3-4847-b6f3-3529df5f3760']),
  ('Mercure',          '1309',  'MERCURE',      '1309',  ARRAY['8c49536f-f153-43ae-bff0-9fb93fe01cf4']),
  ('Mercure',          '1312',  'MERCURE',      '1312',  ARRAY['be8db07d-fa47-4b38-8fc9-d61ace76a92d']),
  ('Mercure',          '1322',  'MERCURE',      '1322',  ARRAY['20b7088d-774b-4601-b1ca-f627707f6f5b']),
  ('Mercure',          '1420',  'MERCURE',      '1420',  ARRAY['113ad813-8466-4118-80b5-8192e049900e']),
  ('Mercure',          '1421',  'MERCURE',      '1421',  ARRAY['a071507e-11b5-4420-a3ae-49f34a7b3aea']),
  ('Mercure',          '1422',  'MERCURE',      '1422',  ARRAY['46e1ebc4-a6ed-4726-8bf7-b942d3165740']),
  ('Vision',           '220',   'VISION',       '220',   ARRAY['c9b3c489-1338-45a9-89c2-8ac77748f389']),
  ('Vision',           '1016',  NULL,           NULL,    ARRAY['e4a90e7d-15f4-4874-86fe-498e6741ddc8']),
  ('Vision',           '1315',  'VISION',       '1315',  ARRAY['067f1b17-1a3d-42ed-b6b7-939e80f7cb94']),
  ('Fusion',           '318',   NULL,           NULL,    ARRAY['aa6acd47-1973-4ae5-bbaf-5381bfa984d6']),
  ('Fusion',           '412',   'FUSION',       '412',   ARRAY['7724f305-1237-489b-a944-5727f667e2f3']),
  ('Fusion',           '722',   'FUSION',       '722',   ARRAY['508a63b7-6181-4824-a8fc-1b295fc20b3d']),
  ('Fusion',           '1216',  'FUSION',       '1216',  ARRAY['31941774-245d-46d2-b556-3b9cb5b95398']),
  ('Fusion',           '1415',  'FUSION',       '1415',  ARRAY['8759772d-4e95-49ef-aed6-0b05622e7c9d']),
  ('Fusion',           '1501',  'FUSION',       '1501',  ARRAY['8352b7de-7753-4af5-a179-95dcfc502743']),
  ('Saint Moritz',     '613',   NULL,           NULL,    ARRAY[]::text[]),
  ('Saint Moritz',     '701',   'SAINT MORITZ', '701',   ARRAY['968a704e-20fa-4432-85e4-34657adee7aa']),
  ('Saint Moritz',     '806',   'SAINT MORITZ', '806',   ARRAY['c0d1aa38-08d3-4085-8162-48ed1b47d26a']),
  ('Saint Moritz',     '1106',  'SAINT MORITZ', '1106',  ARRAY['d9da4fcc-b843-4230-ab0f-d34c268f765f']),
  ('Saint Moritz',     '1808',  'SAINT MORITZ', '1808',  ARRAY['2513d65e-bba1-4750-abe8-5d188bc7f03b']),
  ('Ramada',           '106',   'RAMADA',       '106',   ARRAY['6b923082-dac5-4b53-b679-2fbe18ce3c4f']),
  ('Ramada',           '606',   'RAMADA',       '606',   ARRAY['a2477c2a-0e0c-4343-8d55-ff6e0b5bbc70']),
  ('Ramada',           '1207',  'RAMADA',       '1207',  ARRAY['7dbc48d6-0d22-4343-9b14-2b54876fc78a']),
  ('Cullinan',         '218',   'CULLINAN',     '218',   ARRAY['7b476766-037d-4541-a0db-ed93590c3b7a']),
  ('Cullinan',         '304',   'CULLINAN',     '304',   ARRAY['2074ddab-4708-45c4-918d-4d990543d625']),
  ('Cullinan',         '404',   'CULLINAN',     '404',   ARRAY['d6816d8a-32a7-4c4c-933b-179192daa31d']),
  ('Cullinan',         '611',   'CULLINAN',     '611',   ARRAY['eec1cd65-160b-4f4d-9f28-c80e865102f2']),
  ('Cullinan',         '803',   'CULLINAN',     '803',   ARRAY['d2148886-251a-4f51-a3cf-57eb968cdce3']),
  ('Cullinan',         '916',   'CULLINAN',     '916',   ARRAY['65b20b8a-70f2-4790-b795-9d9b5dc90058']),
  ('Cullinan',         '1304',  'CULLINAN',     '1304',  ARRAY['b5bd8440-d74d-45fc-ade9-723861afe6f4']),
  ('Link Noroeste',    '104',   'LINK',         '104',   ARRAY['da16ed3a-cf0e-41b6-a109-9cf0353fe20b']),
  ('Link Noroeste',    '204',   'LINK',         '204',   ARRAY['2d964afe-2d5f-4e4f-81e9-f4ec311d9089']),
  ('Easy Noroeste',    '117',   'EASY',         '117',   ARRAY['11a3fb95-9c04-4215-a043-149c72380715']),
  ('Easy Noroeste',    '216',   'EASY',         '216',   ARRAY['950a4fdf-68d5-4577-a7ec-c377d5133bf0']),
  ('Easy Noroeste',    '217',   'EASY',         '217',   ARRAY['3a88290b-a900-4fd3-a4a2-236f04b62e46']),
  ('Brisas do Lago',   'D137',  'BRISAS',       'D137',  ARRAY['f0caa1ec-50ec-42b5-9b29-7fb0ae9fab01']),
  ('Brisas do Lago',   'D138',  'BRISAS',       'D138',  ARRAY['64e4757c-5a32-4423-bc26-393364ec6813'])
) AS v(emp, num, db_emp, db_num, rooms)
LEFT JOIN public.empreendimentos e ON e.nome = v.db_emp
LEFT JOIN public.apartamentos a ON a.empreendimento_id = e.id AND a.numero = v.db_num
ON CONFLICT (empreendimento, numero) DO UPDATE
  SET apartamento_id    = EXCLUDED.apartamento_id,
      amenitiz_room_ids = EXCLUDED.amenitiz_room_ids,
      ativo             = true;


-- PARTE 2 — limpezas passam a apontar para a unidade
ALTER TABLE public.limpezas
  ADD COLUMN IF NOT EXISTS unidade_id uuid NULL REFERENCES public.limpeza_unidades(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS limpezas_unidade_idx ON public.limpezas (unidade_id, finalizada_em DESC);

-- Registros anteriores (até aqui só existe 1: ATHOS 3 em 07/10/2026)
UPDATE public.limpezas l
   SET unidade_id = u.id
  FROM public.limpeza_unidades u
 WHERE l.unidade_id IS NULL
   AND u.apartamento_id = l.apartamento_id;


-- PARTE 3 — ocupação (entrada/saída por quarto), alimentada pelo sync
CREATE TABLE IF NOT EXISTS public.limpeza_ocupacao (
  booking_id     text NOT NULL,
  room_id        text NOT NULL,
  checkin        date NOT NULL,
  checkout       date NOT NULL,
  status         text NOT NULL,
  hospedes       int  NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, room_id)
);

CREATE INDEX IF NOT EXISTS limpeza_ocupacao_room_idx ON public.limpeza_ocupacao (room_id, checkout);

-- Sem policy: só service_role (sync) grava e só a função abaixo lê.
ALTER TABLE public.limpeza_ocupacao ENABLE ROW LEVEL SECURITY;

-- Carga inicial a partir do que o sync financeiro já gravou (o cron de
-- reservas completa o resto — inclusive SM 701/1106/1808 — na próxima rodada).
INSERT INTO public.limpeza_ocupacao (booking_id, room_id, checkin, checkout, status, hospedes)
SELECT r.booking_id, rm->>'individual_room_id', r.checkin, r.checkout, r.status,
       nullif(coalesce((r.raw_data->>'adults')::int, 0) + coalesce((r.raw_data->>'children')::int, 0), 0)
FROM public.amenitiz_reservas r
CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.raw_data->'rooms', '[]'::jsonb)) rm
WHERE r.checkout >= current_date - 14
  AND rm->>'individual_room_id' IS NOT NULL
ON CONFLICT (booking_id, room_id) DO NOTHING;


-- PARTE 4 — lista de imóveis da limpeza com a situação de cada unidade
--
-- situacao:
--   'ocupado'    hóspede hospedado (entrou antes de hoje e sai depois de hoje)
--   'pendente'   houve saída nos últimos 7 dias e nenhuma limpeza depois dela
--                (inclui a saída de HOJE: limpar assim que o hóspede sair)
--   'incompleta' a limpeza depois da saída foi registrada com itens faltando
--   'limpo'      limpo depois da última saída (ou hoje, sem saída recente)
--   'livre'      sem hóspede, sem saída recente e sem limpeza hoje — sem ação
-- Só contam saídas dos últimos 7 dias E a partir de 08/10/2026, primeiro dia
-- de uso do registro de limpeza: saídas anteriores foram limpas fora do
-- sistema e acusariam ~16 imóveis como pendentes no primeiro dia.
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
  ocupacao_atualizada_em   timestamptz
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
      px.checkin AS proxima_entrada, px.hospedes AS proxima_entrada_hospedes,
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
    LEFT JOIN LATERAL (
      SELECT o.checkin, o.hospedes
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
      -- daqui para baixo: se houve saída recente, a última limpeza é posterior a ela
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
    (SELECT max(o.atualizado_em) FROM limpeza_ocupacao o)
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
-- SELECT count(*) FROM limpeza_unidades WHERE ativo;                -- 68
-- SELECT empreendimento, numero FROM limpeza_unidades
--  WHERE apartamento_id IS NULL;                                    -- Vision 1016, Fusion 318, Saint Moritz 613
-- SELECT situacao, count(*) FROM listar_imoveis_limpeza() GROUP BY 1;  -- rodar logado como interno
-- SELECT unidade_id FROM limpezas;                                  -- ATHOS 3 → Athos Bulcão 03M

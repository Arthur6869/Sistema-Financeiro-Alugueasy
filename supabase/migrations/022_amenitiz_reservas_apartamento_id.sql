-- =============================================================================
-- Migration 022: Promove mapeamento quarto→apartamento para FK real
-- Objetivo: Adicionar amenitiz_reservas.apartamento_id (uuid FK → apartamentos.id)
--           para tornar o isolamento de RLS por FK e não por JOIN de texto.
--           A coluna é nullable — reservas sem match permanecem com NULL (seguro:
--           nenhum proprietário as vê, pois a policy exige FK não-nula).
-- Tabelas afetadas: amenitiz_reservas (ADD COLUMN + UPDATE backfill)
-- Data: 2026-06-29
-- =============================================================================
-- ROLLBACK (executar em ordem inversa se precisar desfazer):
--   ALTER TABLE amenitiz_reservas DROP COLUMN IF EXISTS apartamento_id;
-- =============================================================================

-- 1. Adicionar a coluna FK (nullable)
ALTER TABLE amenitiz_reservas
  ADD COLUMN IF NOT EXISTS apartamento_id uuid REFERENCES apartamentos(id);

-- =============================================================================
-- 2. Backfill idempotente — replica a lógica de sync-amenitiz-core.ts
--
-- O sync armazena em individual_room_number o número normalizado do apartamento
-- conforme o banco (ex: "204", "A113").
-- O individual_room_name contém o prefixo do empreendimento antes do " - "
-- (ex: "ESSENCE 204 - Studio" → prefixo "ESSENCE 204" → começa com "ESSENCE ").
-- Isso espelha exatamente o mapa AMENITIZ_EMP_MAP + parseNomeQuarto.
--
-- Ordem de prioridade nos prefixos (maior especificidade primeiro):
--   BRISAS DO LAGO > MERCURE LIDER > METROPOLITAN > ATHOS BULCAO > ATHOS
-- =============================================================================

-- PASSO A: Via nome do quarto → prefixo de empreendimento + número normalizado
UPDATE amenitiz_reservas r
SET apartamento_id = a.id
FROM apartamentos a
JOIN empreendimentos e ON e.id = a.empreendimento_id
WHERE r.apartamento_id IS NULL
  AND r.individual_room_number IS NOT NULL
  AND r.individual_room_number NOT LIKE 'room:%'
  AND upper(e.nome) = (
    CASE
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'BRISAS DO LAGO %'  THEN 'BRISAS'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'METROPOLITAN %'    THEN 'METROPOLITAN'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'MERCURE LIDER %'   THEN 'MERCURE'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'CULLINAN %'        THEN 'CULLINAN'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'ESSENCE %'         THEN 'ESSENCE'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'NOBILE %'          THEN 'NOBILE'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'FUSION %'          THEN 'FUSION'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'RAMADA %'          THEN 'RAMADA'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'VISION %'          THEN 'VISION'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'EASY %'            THEN 'EASY'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'AB %'              THEN 'ATHOS'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'ATHOS BULCAO %'    THEN 'ATHOS'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'ATHOS BULCÃO %'    THEN 'ATHOS'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'ATHOS %'           THEN 'ATHOS'
      WHEN upper(split_part(r.individual_room_name, ' - ', 1)) LIKE 'MERCURE %'         THEN 'MERCURE'
      ELSE NULL
    END
  )
  AND upper(a.numero) = upper(r.individual_room_number);

-- PASSO B: Via amenitiz_room_id no raw_data (para casos "room:xxxxxxxx")
-- Quando o sync não conseguiu parsear o nome (ex: "Brisas do Lago - Apartamento..."),
-- ele usa o fallback pelo individual_room_id e salva "room:<primeiros-8-chars>".
-- Aqui usamos raw_data->rooms->0->individual_room_id para recuperar o UUID completo.
UPDATE amenitiz_reservas r
SET apartamento_id = a.id
FROM apartamentos a
WHERE r.apartamento_id IS NULL
  AND r.individual_room_number LIKE 'room:%'
  AND a.amenitiz_room_id IS NOT NULL
  AND a.amenitiz_room_id = (r.raw_data -> 'rooms' -> 0 ->> 'individual_room_id');

-- =============================================================================
-- 3. Relatório de cobertura — execute APÓS o backfill e reporte o resultado
-- =============================================================================
SELECT
  COUNT(*) FILTER (WHERE apartamento_id IS NOT NULL) AS mapeadas,
  COUNT(*) FILTER (WHERE apartamento_id IS NULL)     AS nao_mapeadas,
  COUNT(*)                                            AS total,
  round(
    COUNT(*) FILTER (WHERE apartamento_id IS NOT NULL)::numeric / NULLIF(COUNT(*), 0) * 100,
    1
  ) AS cobertura_pct
FROM amenitiz_reservas;

-- Para inspecionar as não-mapeadas (debug):
-- SELECT booking_id, individual_room_name, individual_room_number
-- FROM amenitiz_reservas
-- WHERE apartamento_id IS NULL
-- ORDER BY checkin DESC
-- LIMIT 50;

SELECT '022 aplicada — apartamento_id adicionado a amenitiz_reservas' AS status;

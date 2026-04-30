-- Migration 007: mapear amenitiz_room_id dos apartamentos BRISAS pendentes
-- UUIDs obtidos via fetch-amenitiz-rooms.ts em 29/04/2026
--
-- Quartos BRISAS encontrados na API Amenitiz (individual_room_id → nome):
--   64e4757c-5a32-4423-bc26-393364ec6813  →  Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago
--   f0caa1ec-50ec-42b5-9b29-7fb0ae9fab01  →  Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago 2
--   950a4fdf-68d5-4577-a7ec-c377d5133bf0  →  Brisas do Lago A113
--   2d964afe-2d5f-4e4f-81e9-f4ec311d9089  →  Brisas do Lago A115
--   edf610fb-b301-459c-b79d-a3029f9bf451  →  Brisas do Lago A117
--   da16ed3a-cf0e-41b6-a109-9cf0353fe20b  →  Brisas do Lago B119
--
-- Pendentes confirmados: B119 (mapeado abaixo)
-- Pendentes sem nome explícito na API: D137, D138, E020
--   → D137 provavelmente = "Vista do Lago" (64e4757c) — VERIFICAR MANUALMENTE
--   → D138 provavelmente = "Vista do Lago 2" (f0caa1ec) — VERIFICAR MANUALMENTE
--   → E020 não apareceu nas reservas dos últimos 4 meses — VERIFICAR NO PAINEL AMENITIZ

-- B119 → mapeamento confirmado (nome exato na API)
UPDATE apartamentos
SET amenitiz_room_id = 'da16ed3a-cf0e-41b6-a109-9cf0353fe20b'
WHERE numero = 'B119'
  AND empreendimento_id = (
    SELECT id FROM empreendimentos
    WHERE nome ILIKE '%brisas%' LIMIT 1
  );

-- D137 → provavelmente "Vista do Lago" — confirmar no painel Amenitiz antes de executar
-- UPDATE apartamentos
-- SET amenitiz_room_id = '64e4757c-5a32-4423-bc26-393364ec6813'
-- WHERE numero = 'D137'
--   AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%brisas%' LIMIT 1);

-- D138 → provavelmente "Vista do Lago 2" — confirmar no painel Amenitiz antes de executar
-- UPDATE apartamentos
-- SET amenitiz_room_id = 'f0caa1ec-50ec-42b5-9b29-7fb0ae9fab01'
-- WHERE numero = 'D138'
--   AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%brisas%' LIMIT 1);

-- E020 → não encontrado nas reservas dos últimos 4 meses
-- Acessar Amenitiz Dashboard > Configurações > Quartos para localizar este quarto
-- e obter o individual_room_id antes de executar.

-- Verificação após executar:
SELECT numero, amenitiz_room_id
FROM apartamentos
WHERE empreendimento_id = (
  SELECT id FROM empreendimentos WHERE nome ILIKE '%brisas%' LIMIT 1
)
ORDER BY numero;

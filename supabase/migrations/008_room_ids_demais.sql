-- Migration 008: mapear amenitiz_room_id dos demais apartamentos pendentes
-- UUIDs obtidos via fetch-amenitiz-rooms.ts em 29/04/2026
-- 12 de 13 apartamentos mapeados; 1 não encontrado nas reservas dos últimos 4 meses.
--
-- Não encontrados (sem reservas nos últimos 4 meses — verificar no painel Amenitiz):
--   ATHOS apt 11
--   METROPOLITAN apt 1701-1701A: API retornou "Metropolitan 1701" (64cd95af) e
--     "Metropolitan 1701A" (df34ab90) separados — não há room combinado como 1615.
--     O registro no banco tem numero='1701 - 1701A'. Verificar se deve ser dividido em
--     dois registros ou se um dos rooms cobre ambos.

-- FUSION 1709
UPDATE apartamentos
SET amenitiz_room_id = '968a704e-20fa-4432-85e4-34657adee7aa'
WHERE numero = '1709'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%fusion%' LIMIT 1);

-- NOBILE 803
UPDATE apartamentos
SET amenitiz_room_id = '468805a9-db1d-4d58-9faa-4adf58189b0e'
WHERE numero = '803'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%nobile%' LIMIT 1);

-- ATHOS 812
UPDATE apartamentos
SET amenitiz_room_id = '4460cedb-4cb2-4f26-b104-3d19cfc76532'
WHERE numero = '812'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%athos%' LIMIT 1);

-- ATHOS 1209
UPDATE apartamentos
SET amenitiz_room_id = '806d43eb-f08d-45e2-9e09-21ca1a4f4878'
WHERE numero = '1209'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%athos%' LIMIT 1);

-- ATHOS 1101
UPDATE apartamentos
SET amenitiz_room_id = '762ab4fb-6069-4968-9ca4-d7f6f6f56342'
WHERE numero = '1101'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%athos%' LIMIT 1);

-- ATHOS 1016
UPDATE apartamentos
SET amenitiz_room_id = '27ebb147-a8bc-4852-9fb5-20c4193f7939'
WHERE numero = '1016'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%athos%' LIMIT 1);

-- ATHOS 11 → não encontrado nas reservas dos últimos 4 meses
-- Verificar no painel Amenitiz e descomentar após obter o UUID:
-- UPDATE apartamentos
-- SET amenitiz_room_id = 'UUID-AQUI'
-- WHERE numero = '11'
--   AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%athos%' LIMIT 1);

-- CULLINAN 1304
UPDATE apartamentos
SET amenitiz_room_id = 'b5bd8440-d74d-45fc-ade9-723861afe6f4'
WHERE numero = '1304'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%cullinan%' LIMIT 1);

-- VISION 220
UPDATE apartamentos
SET amenitiz_room_id = 'c9b3c489-1338-45a9-89c2-8ac77748f389'
WHERE numero = '220'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%vision%' LIMIT 1);

-- RAMADA 106
UPDATE apartamentos
SET amenitiz_room_id = '6b923082-dac5-4b53-b679-2fbe18ce3c4f'
WHERE numero = '106'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%ramada%' LIMIT 1);

-- RAMADA 606
UPDATE apartamentos
SET amenitiz_room_id = 'a2477c2a-0e0c-4343-8d55-ff6e0b5bbc70'
WHERE numero = '606'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%ramada%' LIMIT 1);

-- METROPOLITAN 1615A - 1615 (room combinado "1615 e 1615A" na API)
UPDATE apartamentos
SET amenitiz_room_id = '037dc1ea-79a1-4ae0-be38-159b84951331'
WHERE numero = '1615A - 1615'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%metropolitan%' LIMIT 1);

-- METROPOLITAN 1701 - 1701A
-- API retornou rooms separados. Mapeando para "Metropolitan 1701" (room principal).
-- Se a unidade 1701A for tratada separadamente no sistema, criar registro adicional.
UPDATE apartamentos
SET amenitiz_room_id = '64cd95af-3478-4ad4-adb3-20ad72237c17'
WHERE numero = '1701 - 1701A'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%metropolitan%' LIMIT 1);

-- Verificação final: apartamentos ainda sem room_id após executar ambas as migrations
SELECT a.numero, e.nome AS empreendimento
FROM apartamentos a
JOIN empreendimentos e ON e.id = a.empreendimento_id
WHERE a.amenitiz_room_id IS NULL
ORDER BY e.nome, a.numero;

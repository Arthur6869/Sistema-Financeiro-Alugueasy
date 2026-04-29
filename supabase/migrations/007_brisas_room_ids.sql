-- Migration 007: mapear amenitiz_room_id dos apartamentos pendentes do BRISAS
-- Executar SOMENTE após confirmar os mapeamentos no painel Amenitiz
--
-- Estado atual (verificado em 29/04/2026):
--   A113 → 950a4fdf-68d5-4577-a7ec-c377d5133bf0  ✅ já mapeado
--   A115 → 2d964afe-2d5f-4e4f-81e9-f4ec311d9089  ✅ já mapeado
--   A117 → edf610fb-b301-459c-b79d-a3029f9bf451  ✅ já mapeado
--   E016 → b5bd8440-d74d-45fc-ade9-723861afe6f4  ✅ já mapeado
--   B119 → NULL  ← pendente
--   D137 → NULL  ← pendente
--   D138 → NULL  ← pendente
--   E020 → NULL  ← pendente
--
-- Room IDs Amenitiz conhecidos pendentes de mapeamento (UUIDs COMPLETOS necessários):
--   "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago"   → começa com 64e4757c-...
--   "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago 2" → começa com f0caa1ec-...
--
-- AÇÃO NECESSÁRIA ANTES DE EXECUTAR:
--   1. Acessar Amenitiz Dashboard > Acomodações > listar todos os quartos do hotel
--   2. Para cada quarto, obter o UUID completo (36 chars: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
--   3. Confirmar qual número de apartamento (B119 / D137 / D138 / E020) corresponde a cada quarto
--   4. Substituir os placeholders abaixo e executar no Supabase SQL Editor
--
-- SUBSTITUIR os UUIDs e números abaixo pelos valores reais:

-- Quarto "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago" (64e4757c-...)
UPDATE apartamentos
SET amenitiz_room_id = '64e4757c-PREENCHER-UUID-COMPLETO'
WHERE numero = 'PREENCHER_NUMERO_APT'  -- ex: 'B119'
  AND empreendimento_id = '0ffb7da7-5d8d-406f-8ab3-f29ac46bf0c8';  -- BRISAS

-- Quarto "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago 2" (f0caa1ec-...)
UPDATE apartamentos
SET amenitiz_room_id = 'f0caa1ec-PREENCHER-UUID-COMPLETO'
WHERE numero = 'PREENCHER_NUMERO_APT'  -- ex: 'D137'
  AND empreendimento_id = '0ffb7da7-5d8d-406f-8ab3-f29ac46bf0c8';  -- BRISAS

-- NOTA: Se D138 e E020 também tiverem room_ids no Amenitiz, adicionar UPDATEs aqui

-- Verificação — executar após os UPDATEs:
SELECT numero, amenitiz_room_id
FROM apartamentos
WHERE empreendimento_id = '0ffb7da7-5d8d-406f-8ab3-f29ac46bf0c8'
ORDER BY numero;

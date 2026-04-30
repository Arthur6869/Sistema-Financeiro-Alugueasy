-- Migration 009: room_ids pendentes — requerem verificação manual no painel Amenitiz
--
-- Apartamentos sem reservas nos últimos 4 meses — UUID não encontrado
-- automaticamente via fetch-amenitiz-rooms.ts (29/04/2026).
-- Verificar em: Amenitiz Dashboard > Configurações > Propriedade > Quartos
--
-- PASSO A PASSO:
-- 1. Acessar https://app.amenitiz.io
-- 2. Menu: Configurações > Propriedade > Quartos (ou similar)
-- 3. Localizar cada quarto abaixo pelo nome
-- 4. Copiar o ID do quarto (individual_room_id — formato UUID)
-- 5. Substituir os placeholders e executar no Supabase SQL Editor
--
-- Alternativa via MCP: usar a tool set_amenitiz_room_id com o UUID obtido
-- ⚠️ NÃO EXECUTAR com placeholders

-- ATHOS apt 11
-- Buscar quarto com nome próximo de "AB 11" ou "Athos" + "11" no painel
UPDATE apartamentos
SET amenitiz_room_id = 'PREENCHER-UUID-ATHOS-APT-11'
WHERE numero = '11'
  AND empreendimento_id = (
    SELECT id FROM empreendimentos WHERE nome ILIKE '%athos%' LIMIT 1
  );

-- BRISAS D137
-- Candidato provável: "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago"
-- UUID: 64e4757c-5a32-4423-bc26-393364ec6813 — confirmar no painel Amenitiz
UPDATE apartamentos
SET amenitiz_room_id = 'PREENCHER-UUID-BRISAS-D137'
WHERE numero = 'D137'
  AND empreendimento_id = (
    SELECT id FROM empreendimentos WHERE nome ILIKE '%brisas%' LIMIT 1
  );

-- BRISAS D138
-- Candidato provável: "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago 2"
-- UUID: f0caa1ec-50ec-42b5-9b29-7fb0ae9fab01 — confirmar no painel Amenitiz
UPDATE apartamentos
SET amenitiz_room_id = 'PREENCHER-UUID-BRISAS-D138'
WHERE numero = 'D138'
  AND empreendimento_id = (
    SELECT id FROM empreendimentos WHERE nome ILIKE '%brisas%' LIMIT 1
  );

-- BRISAS E020
-- Não apareceu nas reservas dos últimos 4 meses.
-- Localizar no painel Amenitiz pelo nome ou número do quarto.
UPDATE apartamentos
SET amenitiz_room_id = 'PREENCHER-UUID-BRISAS-E020'
WHERE numero = 'E020'
  AND empreendimento_id = (
    SELECT id FROM empreendimentos WHERE nome ILIKE '%brisas%' LIMIT 1
  );

-- Verificação após executar:
SELECT
  e.nome AS empreendimento,
  a.numero,
  a.amenitiz_room_id,
  CASE WHEN a.amenitiz_room_id IS NULL THEN '❌ pendente' ELSE '✅ ok' END AS status
FROM apartamentos a
JOIN empreendimentos e ON e.id = a.empreendimento_id
WHERE e.nome ILIKE '%athos%' OR e.nome ILIKE '%brisas%'
ORDER BY e.nome, a.numero;

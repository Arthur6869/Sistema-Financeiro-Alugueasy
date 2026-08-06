-- Migration 029: mapear amenitiz_room_id de BRISAS D137/D138 (pendência da 007)
--
-- A migration 007 deixou D137/D138 comentados com palpite INVERTIDO. A
-- confirmação veio da planilha de conferência de junho/2026 (08/07/2026):
--   - D138 tem a reserva manual de R$ 7.700 (líq. 6.930) → quarto
--     "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago" (64e4757c)
--   - D137 tem as 19 reservas confirmadas de junho com taxa Booking 16%
--     batendo centavo a centavo → quarto "...Vista do Lago 2" (f0caa1ec)
--
-- Sem este mapeamento o sync descartava TODAS as reservas desses quartos
-- (o parser de nome não entende o formato e não havia fallback por room_id).
-- Aplicado em produção via service role em 08/07/2026.

UPDATE apartamentos
SET amenitiz_room_id = 'f0caa1ec-50ec-42b5-9b29-7fb0ae9fab01' -- Vista do Lago 2
WHERE numero = 'D137'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%brisas%' LIMIT 1);

UPDATE apartamentos
SET amenitiz_room_id = '64e4757c-5a32-4423-bc26-393364ec6813' -- Vista do Lago
WHERE numero = 'D138'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE nome ILIKE '%brisas%' LIMIT 1);

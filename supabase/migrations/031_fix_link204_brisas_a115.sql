-- Migration 031: reservas do "Link Noroeste - 204" anteriores a 29/05/2026
-- pertencem ao BRISAS A115
--
-- Complemento da migration 025 e da regra TRANSFERENCIAS_ANUNCIO de 07/07:
-- na época sabia-se que o anúncio "Link Noroeste - 204" era de outro imóvel
-- até 28/05/2026, mas não QUAL — as reservas antigas ficaram com FK nula
-- (invisíveis em todos os portais). Em 27/07/2026 o usuário identificou o
-- imóvel antigo pela aba Cobranças da Amenitiz: "Brisas do Lago A115".
-- (A "colisão" de room_id com A115 citada na migration 025 não era erro de
-- atribuição — o quarto ERA o A115, renomeado para Link Noroeste 204.)
--
-- Correção: 89 reservas (jan–mai/2026, todas com FK nula) → BRISAS A115,
-- com taxa Booking recalculada (13% LINK → 16% BRISAS). Airbnb (0%) e
-- Alugueasy (10%) não mudam de taxa.
--
-- DIÁRIAS NÃO FORAM ALTERADAS: o A115 já tem diárias jan–abr/2026 geradas
-- com estas reservas a 16% (janeiro bate centavo a centavo: R$ 6.134,91).
-- Maio do A115 não tem diária — o portal usa o fallback por reservas.
--
-- Aplicado em produção em 27/07/2026 via scripts/fix-link204-brisas-a115.ts
-- (service role). IDs: LINK 204 = 60c336ad-cecc-423e-8864-281fb09149a7,
-- BRISAS A115 = 2e73943f-54ba-468b-a641-f13f522d025e.

-- Booking: vincula ao A115 + recalcula taxa/valor (13% → 16%)
UPDATE amenitiz_reservas
SET apartamento_id = '2e73943f-54ba-468b-a641-f13f522d025e',
    taxa_aplicada  = 0.16,
    valor_liquido  = round(valor_bruto * 0.84, 2)
WHERE apartamento_id IS NULL
  AND individual_room_name ILIKE '%noroeste - 204%'
  AND checkin < '2026-05-29'
  AND plataforma_normalizada = 'Booking';

-- Demais plataformas: só vincula a FK (taxa inalterada)
UPDATE amenitiz_reservas
SET apartamento_id = '2e73943f-54ba-468b-a641-f13f522d025e'
WHERE apartamento_id IS NULL
  AND individual_room_name ILIKE '%noroeste - 204%'
  AND checkin < '2026-05-29';

-- Rollback (se necessário): desvincular novamente e restaurar taxa 13%
-- UPDATE amenitiz_reservas
-- SET apartamento_id = NULL,
--     taxa_aplicada  = CASE WHEN plataforma_normalizada = 'Booking' THEN 0.13 ELSE taxa_aplicada END,
--     valor_liquido  = CASE WHEN plataforma_normalizada = 'Booking' THEN round(valor_bruto * 0.87, 2) ELSE valor_liquido END
-- WHERE apartamento_id = '2e73943f-54ba-468b-a641-f13f522d025e'
--   AND individual_room_name ILIKE '%noroeste - 204%'
--   AND checkin < '2026-05-29';

-- Migration 030: reservas do "LINK Noroeste - 104" anteriores a 03/05/2026
-- pertencem ao BRISAS B119
--
-- O anúncio "LINK Noroeste - 104" na Amenitiz era, até 02/05/2026, o imóvel
-- BRISAS B119 (aba Cobranças das reservas antigas mostra "Brisas do Lago -
-- B119"; confirmado pelo usuário em 27/07/2026). Como a API devolve o nome
-- ATUAL do quarto, syncs recentes de meses passados atribuíram 63 reservas
-- (dez/2025–abr/2026) ao LINK 104 indevidamente — o portal do proprietário
-- do LINK 104 mostrava faturamento desde janeiro, antes do imóvel existir.
--
-- Correção espelhada em TRANSFERENCIAS_ANUNCIO (lib/sync-amenitiz-core.ts):
-- check-in < 2026-05-03 → BRISAS B119, com taxa Booking recalculada
-- (LINK 13% → BRISAS 16%). Airbnb (0%) e Alugueasy (10%) não mudam de taxa.
--
-- DIÁRIAS NÃO FORAM ALTERADAS: o B119 já tinha diárias fev–abr/2026 geradas
-- com estas reservas a 16% (mar e abr batem centavo a centavo); o LINK 104
-- não tinha diárias antes de mai/2026. Ajustar aqui contaria em dobro.
--
-- Aplicado em produção em 27/07/2026 via scripts/fix-link104-brisas-b119.ts
-- (service role). IDs: LINK 104 = 89fdfaac-e11e-425b-ae5a-788130dee2ed,
-- BRISAS B119 = 0162f9fe-fad3-4c08-9298-9e875834905e.

-- Booking: muda FK + recalcula taxa/valor (13% → 16%)
UPDATE amenitiz_reservas
SET apartamento_id = '0162f9fe-fad3-4c08-9298-9e875834905e',
    taxa_aplicada  = 0.16,
    valor_liquido  = round(valor_bruto * 0.84, 2)
WHERE apartamento_id = '89fdfaac-e11e-425b-ae5a-788130dee2ed'
  AND checkin < '2026-05-03'
  AND plataforma_normalizada = 'Booking';

-- Demais plataformas: só muda a FK (taxa inalterada)
UPDATE amenitiz_reservas
SET apartamento_id = '0162f9fe-fad3-4c08-9298-9e875834905e'
WHERE apartamento_id = '89fdfaac-e11e-425b-ae5a-788130dee2ed'
  AND checkin < '2026-05-03';

-- Rollback (se necessário): reverter FK e taxa 13% para as mesmas linhas
-- UPDATE amenitiz_reservas
-- SET apartamento_id = '89fdfaac-e11e-425b-ae5a-788130dee2ed',
--     taxa_aplicada  = CASE WHEN plataforma_normalizada = 'Booking' THEN 0.13 ELSE taxa_aplicada END,
--     valor_liquido  = CASE WHEN plataforma_normalizada = 'Booking' THEN round(valor_bruto * 0.87, 2) ELSE valor_liquido END
-- WHERE apartamento_id = '0162f9fe-fad3-4c08-9298-9e875834905e'
--   AND checkin < '2026-05-03' AND checkin >= '2025-12-29';

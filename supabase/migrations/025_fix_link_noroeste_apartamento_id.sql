-- Migration 025: corrigir apartamento_id errado para "Link Noroeste - 204"
--
-- Problema: o sync antigo tentava fazer lookup pelo individual_room_id do Amenitiz.
-- O room_id de "Link Noroeste - 204" colide com o amenitiz_room_id de BRISAS A115
-- no banco (provavelmente atribuído errado na migration 022), fazendo com que
-- 35 reservas do apt LINK 204 ficassem associadas ao apt BRISAS A115.
--
-- Apartamento correto: LINK 204 → id = '60c336ad-cecc-423e-8864-281fb09149a7'

UPDATE amenitiz_reservas
SET apartamento_id = '60c336ad-cecc-423e-8864-281fb09149a7'
WHERE individual_room_name = 'Link Noroeste - 204';

-- Rollback (se necessário):
-- UPDATE amenitiz_reservas
-- SET apartamento_id = '2e73943f-54ba-468b-a641-f13f522d025e'  -- BRISAS A115 (errado)
-- WHERE individual_room_name = 'Link Noroeste - 204';

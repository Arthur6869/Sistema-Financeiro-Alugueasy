-- Migration 032: reserva direta AlugEasy de R$ 2.400 no LINK 204 (19–21/05/2026)
--
-- No calendário da Amenitiz o período existe apenas como BLOQUEIO rotulado
-- "reserva 2400" — bloqueios não vêm na API de reservas, então o sync nunca
-- capturou e o valor não aparecia em lugar nenhum.
--
-- Apesar de as datas serem anteriores ao corte de 29/05 do anúncio (migration
-- 031), o usuário confirmou em 27/07/2026 que o hóspede ficou no imóvel
-- físico do LINK 204 — por isso o lançamento vai para o LINK 204, e o script
-- fix-link204-brisas-a115.ts passou a excluir booking_id 'manual%'.
--
-- Taxa de reserva direta AlugEasy: 10% → líquido R$ 2.160. Maio é mês
-- fechado (portal usa diárias como fonte primária), então a diária de
-- mai/2026 do LINK 204 foi ajustada: R$ 487 → R$ 2.647.
--
-- Aplicado em produção em 27/07/2026 via
-- scripts/add-reserva-manual-link204-mai2026.ts (service role).

INSERT INTO amenitiz_reservas (
  booking_id, hotel_uuid, status, source, plataforma_normalizada,
  checkin, checkout, individual_room_number, individual_room_name,
  valor_bruto, taxa_aplicada, valor_liquido, nome_hospede,
  mes_competencia, ano_competencia, apartamento_id, raw_data
) VALUES (
  'manual-link204-19mai2026',
  '<AMENITIZ_HOTEL_UUID>',  -- preenchido pelo script a partir do env
  'confirmed', 'manual', 'Alugueasy',
  '2026-05-19', '2026-05-21', '204', 'Link Noroeste - 204',
  2400.00, 0.10, 2160.00,
  'Reserva direta AlugEasy — bloqueio "reserva 2400"',
  5, 2026,
  '60c336ad-cecc-423e-8864-281fb09149a7',  -- LINK 204
  '{"origem":"lancamento_manual","motivo":"bloqueio Amenitiz \"reserva 2400\" 19-21/05/2026"}'::jsonb
) ON CONFLICT (booking_id) DO NOTHING;

UPDATE diarias
SET valor = valor + 2160.00
WHERE apartamento_id = '60c336ad-cecc-423e-8864-281fb09149a7'
  AND data = '2026-05-01';

-- Rollback (se necessário):
-- DELETE FROM amenitiz_reservas WHERE booking_id = 'manual-link204-19mai2026';
-- UPDATE diarias SET valor = valor - 2160.00
-- WHERE apartamento_id = '60c336ad-cecc-423e-8864-281fb09149a7' AND data = '2026-05-01';

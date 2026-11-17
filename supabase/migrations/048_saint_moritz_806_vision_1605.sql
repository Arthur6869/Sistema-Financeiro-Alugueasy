-- Migration 048: reservas do quarto "SM 806" (Amenitiz c0d1aa38) com check-in
-- ANTES de 29/09/2026 pertencem ao VISION 1605 — não ao SAINT MORITZ 806
--
-- COMO APLICAR: Supabase → SQL Editor → colar este arquivo inteiro → Run.
-- Pode rodar mais de uma vez sem efeito colateral (os WHERE deixam de casar
-- depois da primeira execução). Ordem ideal: deploy do sync (regra em
-- TRANSFERENCIAS_ANUNCIO) primeiro, depois este arquivo — mas setembro
-- converge sozinho no cron diário após o deploy; só jul/ago dependem daqui.
--
-- O quarto c0d1aa38 era o "Vision 1605" (sublocação) até o check-in de
-- 30/06/2026 e foi renomeado "SM 806" na Amenitiz. Como a API devolve sempre o
-- nome ATUAL do quarto, as reservas de 01/07 a 28/09/2026 foram gravadas:
--   · jul/2026 (11 reservas) no MERCURE 1311 — na época o nome "SM 806" não
--     casava com prefixo nenhum e o room id resolvia para o 1311;
--   · ago–set/2026 (17 reservas) no SAINT MORITZ 806 — inflando o portal do
--     proprietário com receita anterior ao início do contrato.
-- O SAINT MORITZ 806 começou no check-in de 29/09/2026 (Wagner Dallacqua,
-- primeira reserva do calendário "Hotel Saint Moritz 806"; print da Amenitiz
-- enviado pelo usuário em 17/11/2026). Regra de sucessão correspondente em
-- TRANSFERENCIAS_ANUNCIO (lib/sync-amenitiz-core.ts), mesmo corte.
--
-- Taxas recalculadas como o sync faria para o VISION 1605 (sub):
--   · reserva direta (Alugueasy): 10% → 0% (sub é isenta, regra de 16/10/2026);
--   · Booking com check-in < 01/08/2026: 16% (MERCURE) → 13% (VISION);
--   · Airbnb (18,21%) e Booking ≥ 01/08 (15% nos dois imóveis): só o vínculo.
--
-- Diárias: apaga a de jul/2026 do MERCURE 1311 (2.188,27) e a de ago/2026 do
-- SAINT MORITZ 806 (4.026,99); set/2026 do 806 passa de 826,47 para 610,47
-- (só a reserva de 29/09); VISION 1605 ganha jul 2.240,73 · ago 4.097,99 ·
-- set 240,00. O cron diário cobre só mês corrente + 2 anteriores, por isso
-- jul/ago precisam desta correção direta.
--
-- Trigger trg_telegram_reserva não dispara: só reage a cancelamento ou troca
-- de datas, e aqui mudam apartamento_id, taxa, valor e número do quarto.
--
-- IDs: VISION 1605 = e4a431db-a70f-44e1-9737-31d05ddb1360
--      SAINT MORITZ 806 = df5c7ee8-83d4-42c6-bc40-bb3fa577f1b7
--      MERCURE 1311 = 65c4e8f6-52c4-498a-aa51-d2153c5cef55

-- 1) Reserva direta: vínculo + taxa 0 (7 linhas: 6 ativas + 1 cancelada)
UPDATE amenitiz_reservas
SET apartamento_id = 'e4a431db-a70f-44e1-9737-31d05ddb1360',
    individual_room_number = '1605',
    taxa_aplicada = 0,
    valor_liquido = valor_bruto
WHERE raw_data->'rooms'->0->>'individual_room_id' = 'c0d1aa38-08d3-4085-8162-48ed1b47d26a'
  AND checkin < '2026-09-29'
  AND apartamento_id IN ('df5c7ee8-83d4-42c6-bc40-bb3fa577f1b7', '65c4e8f6-52c4-498a-aa51-d2153c5cef55')
  AND plataforma_normalizada = 'Alugueasy';

-- 2) Booking antes do reajuste: vínculo + 13% (1 linha: 841493289)
UPDATE amenitiz_reservas
SET apartamento_id = 'e4a431db-a70f-44e1-9737-31d05ddb1360',
    individual_room_number = '1605',
    taxa_aplicada = 0.13,
    valor_liquido = valor_bruto * 0.87
WHERE raw_data->'rooms'->0->>'individual_room_id' = 'c0d1aa38-08d3-4085-8162-48ed1b47d26a'
  AND checkin < '2026-08-01'
  AND apartamento_id IN ('df5c7ee8-83d4-42c6-bc40-bb3fa577f1b7', '65c4e8f6-52c4-498a-aa51-d2153c5cef55')
  AND plataforma_normalizada = 'Booking';

-- 3) Demais plataformas (Airbnb e Booking ≥ 01/08): só o vínculo (20 linhas)
UPDATE amenitiz_reservas
SET apartamento_id = 'e4a431db-a70f-44e1-9737-31d05ddb1360',
    individual_room_number = '1605'
WHERE raw_data->'rooms'->0->>'individual_room_id' = 'c0d1aa38-08d3-4085-8162-48ed1b47d26a'
  AND checkin < '2026-09-29'
  AND apartamento_id IN ('df5c7ee8-83d4-42c6-bc40-bb3fa577f1b7', '65c4e8f6-52c4-498a-aa51-d2153c5cef55');

-- 4) Diárias
DELETE FROM diarias
WHERE id IN ('4a0ed92e-8365-41ed-982b-5f3292fd8008',   -- MERCURE 1311 jul/2026 (2.188,27)
             'c9c418b0-c2bd-436a-80b5-daae41185c14');  -- SAINT MORITZ 806 ago/2026 (4.026,99)

UPDATE diarias SET valor = 610.47
WHERE id = '574bdc1c-3e05-400d-87fb-d979ee57eabe' AND valor = 826.47;  -- SAINT MORITZ 806 set/2026

INSERT INTO diarias (apartamento_id, data, valor, tipo_gestao)
SELECT apartamento_id, date_trunc('month', checkin)::date, round(sum(valor_liquido)::numeric, 2), 'sub'
FROM amenitiz_reservas
WHERE apartamento_id = 'e4a431db-a70f-44e1-9737-31d05ddb1360'
  AND checkin >= '2026-07-01' AND checkin < '2026-09-29'
  AND status NOT IN ('cancelled', 'canceled', 'no_show')
GROUP BY 1, 2
ON CONFLICT (apartamento_id, data, tipo_gestao) DO UPDATE SET valor = EXCLUDED.valor;

-- CONFERÊNCIA (esperado: 806 só a partir de 2026-09; VISION 1605 com jul/ago/set)
-- SELECT e.nome, a.numero, to_char(d.data,'YYYY-MM') mes, d.valor
-- FROM diarias d JOIN apartamentos a ON a.id = d.apartamento_id JOIN empreendimentos e ON e.id = a.empreendimento_id
-- WHERE a.id IN ('e4a431db-a70f-44e1-9737-31d05ddb1360','df5c7ee8-83d4-42c6-bc40-bb3fa577f1b7','65c4e8f6-52c4-498a-aa51-d2153c5cef55')
--   AND d.data >= '2026-07-01' ORDER BY 1,2,3;

-- ─── ROLLBACK (valores originais, para reverter à mão se preciso) ───────────
-- jul/2026 → MERCURE 1311, individual_room_number 'room:c0d1aa38':
--   37600164 208.5645 | 128287573 198.7497 | 4094652932 208.5645 | 1200138519 246.1879
--   6414410931 170.1232 | 9037715253 161.1263 | 7664529846 189.7528 | 5094682606 208.5645 (Airbnb 0.1821)
--   9078167378 188.10 | 5986141436 225.00 (Alugueasy 0.10) | 841493289 183.54 (Booking 0.16)
-- ago–set/2026 → SAINT MORITZ 806, individual_room_number '806':
--   1727092876 208.5645 | 4298257135 170.1232 | 4181109437 211.8361 | 2526994609 193.0244
--   3488446109 193.0244 | 2990491980 588.0701 (Airbnb 0.1821)
--   1054903761 175.95 | 4770612531 180.149 | 9297803547 237.5325 | 8443270858 756.6615
--   1886517066 279.9135 | 7795076918 193.1455 (Booking 0.15)
--   1680720952 171.00 | 2182034630 225.00 | 2610962425 243.00 | 4300381451 603.00 (cancelada)
--   5612592752 216.00 (Alugueasy 0.10)
-- diárias: MERCURE 1311 2026-07-01 2188.27 adm | SAINT MORITZ 806 2026-08-01 4026.99 adm
--          SAINT MORITZ 806 2026-09-01 826.47 adm | apagar as 3 do VISION 1605 (jul/ago/set 2026)

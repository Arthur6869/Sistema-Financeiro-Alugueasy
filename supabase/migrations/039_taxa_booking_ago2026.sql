-- Migration 039: reajuste da taxa Booking a partir de agosto/2026
--
-- Tabela DEFINITIVA enviada pelo usuário em 05/10/2026 (substitui o print de
-- 08/09/2026, que dava VISION em 18%):
--   18%: ESSENCE, METROPOLITAN, MERCURE, CULLINAN, BRISAS
--   15%: EASY, SAINT MORITZ, RAMADA, LINK, ATHOS, VISION, NOBILE, FUSION
--   Fora da lista de 05/10, mantidos como no print de 08/09:
--     ASA SUL 15% · AMAZE 13% · MERCURE 1419 15% (exceção do MERCURE).
--   AlugEasy continua 10%; Airbnb continua 18,21% (migration 033).
--
-- Vigência: reservas com CHECK-IN >= 01/08/2026 (confirmada em 08/09/2026).
-- Julho/2026 e anteriores (prestações já entregues) NÃO são alterados.
--
-- Código: lib/amenitiz.ts (TAXA_BOOKING_DESDE_AGO_2026 + TAXA_BOOKING_VIGENCIA;
-- calcularValorLiquido recebe o check-in). O gerador de planilha
-- (lib-prestacao.mjs, TAXAS_BOOKING) repete a tabela — manter os três iguais.
--
-- Aplicar em produção (SQL editor do Supabase) DEPOIS do deploy: antes dele o
-- cron de 5 min com o código antigo reescreve as reservas com 13/16%.
--
-- Relação com o sync completo diário (05:00): ele regenera reservas E diárias
-- do mês corrente + 2 anteriores do zero. Com o código novo deployado, em
-- out/2026 ele já corrige ago, set e out sozinho; esta migration antecipa a
-- correção (sem esperar as 05:00) e é a garantia para AGOSTO caso o deploy só
-- aconteça em novembro (quando agosto sai da janela). Não conta em dobro: se
-- rodar antes do sync, o sync recria as diárias do zero; se rodar depois, o
-- delta é zero. Idempotente (só toca linhas cuja taxa difere da nova). Só
-- reservas COM vínculo de apartamento — as sem FK não entram em prestação.

BEGIN;

-- 1) Delta por apartamento/competência ANTES de reescrever as reservas
--    (depois do UPDATE o valor antigo não existe mais para comparar).
CREATE TEMP TABLE _delta_booking_ago2026 ON COMMIT DROP AS
SELECT r.apartamento_id,
       make_date(r.ano_competencia, r.mes_competencia, 1) AS data,
       round(sum(r.valor_liquido - round(r.valor_bruto * (1 - n.taxa), 2)), 2) AS delta
FROM amenitiz_reservas r
JOIN apartamentos a ON a.id = r.apartamento_id
JOIN empreendimentos e ON e.id = a.empreendimento_id
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN upper(e.nome) = 'MERCURE' AND a.numero = '1419' THEN 0.15
    WHEN upper(e.nome) IN ('ESSENCE', 'METROPOLITAN', 'MERCURE', 'CULLINAN', 'BRISAS') THEN 0.18
    WHEN upper(e.nome) = 'AMAZE' THEN 0.13
    ELSE 0.15 -- EASY, SAINT MORITZ, RAMADA, LINK, ATHOS, VISION, NOBILE, FUSION, ASA SUL
  END AS taxa
) n
WHERE r.plataforma_normalizada = 'Booking'
  AND r.checkin >= '2026-08-01'
  AND coalesce(lower(r.status), '') NOT IN ('cancelled', 'canceled', 'no_show')
  AND r.taxa_aplicada <> n.taxa
  -- Competências FECHADAS (ago e set/2026). O mês corrente (out/2026) é
  -- regenerado pelo sync com o código novo — ajustar aqui contaria duas vezes.
  AND r.ano_competencia = 2026 AND r.mes_competencia IN (8, 9)
GROUP BY 1, 2;

-- 2) Reservas — taxa e líquido pela tabela nova
UPDATE amenitiz_reservas r
SET taxa_aplicada = n.taxa,
    valor_liquido = round(r.valor_bruto * (1 - n.taxa), 2)
FROM apartamentos a
JOIN empreendimentos e ON e.id = a.empreendimento_id
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN upper(e.nome) = 'MERCURE' AND a.numero = '1419' THEN 0.15
    WHEN upper(e.nome) IN ('ESSENCE', 'METROPOLITAN', 'MERCURE', 'CULLINAN', 'BRISAS') THEN 0.18
    WHEN upper(e.nome) = 'AMAZE' THEN 0.13
    ELSE 0.15
  END AS taxa
) n
WHERE r.apartamento_id = a.id
  AND r.plataforma_normalizada = 'Booking'
  AND r.checkin >= '2026-08-01'
  AND r.taxa_aplicada <> n.taxa;

-- 3) Diárias de ago e set/2026 (meses fechados) reduzidas pelo delta
UPDATE diarias d
SET valor = round(d.valor - x.delta, 2)
FROM _delta_booking_ago2026 x
WHERE d.apartamento_id = x.apartamento_id
  AND d.data = x.data;

COMMIT;

-- Conferência pós-aplicação (deve voltar 18% em ESSENCE/METROPOLITAN/MERCURE/
-- CULLINAN/BRISAS, 13% no AMAZE e 15% no resto):
-- SELECT upper(e.nome) AS emp, r.taxa_aplicada, count(*)
-- FROM amenitiz_reservas r
-- JOIN apartamentos a ON a.id = r.apartamento_id
-- JOIN empreendimentos e ON e.id = a.empreendimento_id
-- WHERE r.plataforma_normalizada = 'Booking' AND r.checkin >= '2026-08-01'
-- GROUP BY 1, 2 ORDER BY 1, 2;

-- Rollback (se necessário) — volta à tabela de 06/07/2026 e desfaz as diárias:
-- os deltas precisam ser somados de volta ANTES de reescrever as reservas,
-- pelo mesmo padrão do bloco 1 (com as taxas antigas no CASE).

-- Migration 033: taxa Airbnb 18,21% a partir de junho/2026
--
-- Definida pelo usuário em 27/07/2026: o Airbnb passa a ter taxa de 18,21%
-- para TODOS os empreendimentos. Até mai/2026 o valor da API era tratado
-- como já líquido (taxa 0%) — competências jan–mai/2026 NÃO foram alteradas
-- (prestações já entregues).
--
-- Código: lib/amenitiz.ts (TAXA_AIRBNB = 0.1821). Dados: reservas Airbnb com
-- check-in >= 01/06/2026 recalculadas (líquido = bruto × 0,8179) e diárias
-- de jun/2026 ajustadas pelo delta por apartamento (38 apartamentos,
-- desconto total de R$ 19.466,85 em junho). Diárias de julho não foram
-- ajustadas: o full sync diário regenera o mês corrente com o código novo.
--
-- Aplicado em produção em 27/07/2026 via
-- scripts/aplicar-taxa-airbnb-jun2026.ts (service role, idempotente).

UPDATE amenitiz_reservas
SET taxa_aplicada = 0.1821,
    valor_liquido = round(valor_bruto * 0.8179, 2)
WHERE plataforma_normalizada = 'Airbnb'
  AND taxa_aplicada = 0
  AND checkin >= '2026-06-01';

-- Diárias de jun/2026: ajustadas pelo script (delta por apartamento —
-- não reproduzível em SQL puro sem recalcular por reserva).

-- Rollback (se necessário):
-- UPDATE amenitiz_reservas
-- SET taxa_aplicada = 0, valor_liquido = valor_bruto
-- WHERE plataforma_normalizada = 'Airbnb'
--   AND taxa_aplicada = 0.1821
--   AND checkin >= '2026-06-01';
-- (e somar de volta os deltas nas diárias de jun/2026 — ver log do script)

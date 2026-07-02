-- =============================================================================
-- Migration 027: Índices de suporte + seed de categorias_repassaveis
--
-- 1. Índice em amenitiz_syncs(mes, ano, status) — a função periodo_sincronizado()
--    (migration 024) faz SELECT EXISTS por (mes, ano, status='concluido') a cada
--    avaliação de RLS; sem índice, vira scan sequencial conforme a tabela cresce.
--
-- 2. Índice em amenitiz_reservas(apartamento_id) — as policies de RLS do portal
--    (migration 023) fazem join por apartamento_id em cada consulta do proprietário.
--
-- 3. Seed de categorias_repassaveis — a tabela nasceu vazia (deny-by-default,
--    migration 023). Enquanto estiver vazia o proprietário não vê NENHUM custo
--    no portal. Descomente e ajuste a lista abaixo com as categorias que devem
--    aparecer para o proprietário (decisão de negócio — conferir com o analista).
--
-- Data: 2026-07-01
-- =============================================================================
-- ROLLBACK:
--   DROP INDEX IF EXISTS idx_amenitiz_syncs_periodo_status;
--   DROP INDEX IF EXISTS idx_amenitiz_reservas_apartamento;
--   DELETE FROM categorias_repassaveis;  -- (se o seed tiver sido aplicado)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_amenitiz_syncs_periodo_status
  ON amenitiz_syncs (mes, ano, status);

CREATE INDEX IF NOT EXISTS idx_amenitiz_reservas_apartamento
  ON amenitiz_reservas (apartamento_id);

-- Seed: todas as categorias já existentes em custos são repassáveis.
-- Racional (02/07/2026): o email de extrato enviado aos proprietários
-- (lib/enviar-extrato-core.ts) calcula lucro/repasse com TODOS os custos dos
-- apartamentos vinculados; seedar todas as categorias existentes torna o
-- portal consistente com o email. Categorias NOVAS continuam deny-by-default:
-- precisam ser adicionadas aqui explicitamente pelo analista.
INSERT INTO categorias_repassaveis (categoria)
SELECT DISTINCT categoria FROM custos WHERE categoria IS NOT NULL
ON CONFLICT (categoria) DO NOTHING;

SELECT '027 aplicada — índices criados + categorias existentes seedadas' AS status;

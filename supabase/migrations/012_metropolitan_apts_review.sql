-- =============================================================================
-- Migration: 012_metropolitan_apts_review.sql
-- Data: 30/04/2026
-- Descrição: Documentação e análise dos apartamentos METROPOLITAN com notação
--            dupla. NÃO faz alterações automáticas — requer revisão manual.
--
-- Diagnóstico (30/04/2026):
--   O empreendimento METROPOLITAN tem 8 apartamentos no banco, incluindo
--   3 com notação dupla que se sobrepõem:
--
--   id=23bc00b8  numero="1615A - 1615"  room_id=037dc1ea  (combinado)
--   id=8de19d7a  numero="1615"          room_id=8b6d724d  (individual)
--   id=532c7d1b  numero="1615A"         room_id=cf425c8e  (individual)
--
--   id=676b98bf  numero="1701 - 1701A"  room_id=NULL      (combinado, sem sync)
--   id=6a0fabc4  numero="1701"          room_id=64cd95af  (individual)
--   id=4ea3f166  numero="1701A"         room_id=df34ab90  (individual)
--
-- Impacto:
--   1. O sync Amenitiz captura as reservas de 1615A-1615, 1615A e 1615 como
--      3 rooms separados → 3 diárias distintas → pode duplicar receita.
--   2. O apt "1701 - 1701A" tem room_id=NULL → não é capturado no sync.
--      Essa receita (estimada em ~R$ 5.000-10.000/mês) está ausente do banco.
--
-- Ação requerida (manual — confirmar no Amenitiz antes de executar):
--   OPÇÃO A: Os combinados (1615A-1615 e 1701-1701A) são suítes físicas distintas
--            → apenas adicionar o amenitiz_room_id para "1701 - 1701A"
--
--   OPÇÃO B: Os combinados são aliases dos individuais
--            → remover os registros combinados (verificar se não há diárias associadas)
--
-- Para aplicar OPÇÃO A (adicionar room_id para 1701-1701A):
--   UPDATE public.apartamentos
--   SET amenitiz_room_id = '<UUID-do-Amenitiz>'
--   WHERE id = '676b98bf-...' -- id completo: ver banco
--   AND numero = '1701 - 1701A';
--
-- Para verificar diárias associadas aos combinados antes de remover:
--   SELECT COUNT(*), SUM(valor) FROM diarias
--   WHERE apartamento_id IN (
--     '23bc00b8-...',  -- 1615A - 1615
--     '676b98bf-...'   -- 1701 - 1701A
--   );
-- =============================================================================

-- Esta migration é somente informativa (sem DDL automático).
-- Execute os comandos acima manualmente após confirmar a situação no Amenitiz.

SELECT
  numero,
  tipo_gestao,
  amenitiz_room_id IS NOT NULL AS tem_room_id,
  id
FROM public.apartamentos
WHERE empreendimento_id = (
  SELECT id FROM public.empreendimentos WHERE nome ILIKE '%METROPOLITAN%' LIMIT 1
)
ORDER BY numero;

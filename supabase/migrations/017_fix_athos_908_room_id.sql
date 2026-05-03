-- Migration 017: corrigir amenitiz_room_id incorreto do ATHOS apt 908
--
-- PROBLEMA DETECTADO:
--   Migration 006 atribuiu UUID '806d43eb-f08d-45e2-9e09-21ca1a4f4878' ao apt 908.
--   Migration 008 (fetch real da API Amenitiz em 29/04/2026) confirmou que esse UUID
--   pertence ao ATHOS apt 1209, não ao 908.
--
--   Isso causava dois problemas:
--   1. aptMapByRoomId colide — dois apts com o mesmo UUID, um perde o fallback
--   2. Reservas do quarto "908" que não parseem pelo nome caíam para o apt errado
--
-- SOLUÇÃO:
--   Limpar o UUID incorreto do apt 908.
--   O UUID correto do quarto 908 no Amenitiz deve ser obtido no painel e inserido abaixo.
--
-- APÓS OBTER O UUID:
--   UPDATE apartamentos
--   SET amenitiz_room_id = 'UUID-CORRETO-DO-APT-908'
--   WHERE numero = '908'
--     AND empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ATHOS');

UPDATE apartamentos
SET amenitiz_room_id = NULL
WHERE numero = '908'
  AND empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ATHOS')
  AND amenitiz_room_id = '806d43eb-f08d-45e2-9e09-21ca1a4f4878';

-- Verificação: confirmar que 1209 manteve o UUID correto e 908 está NULL
SELECT
  a.numero,
  a.amenitiz_room_id,
  CASE
    WHEN a.amenitiz_room_id IS NULL THEN '⚠️ UUID pendente — obter no painel Amenitiz'
    ELSE '✅ ok'
  END AS status
FROM apartamentos a
JOIN empreendimentos e ON e.id = a.empreendimento_id
WHERE upper(e.nome) = 'ATHOS'
  AND a.numero IN ('908', '1209')
ORDER BY a.numero;

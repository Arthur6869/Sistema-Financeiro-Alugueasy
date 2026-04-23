-- ============================================================
-- CORRETIVO: Faturamento Janeiro 2026
-- Execute no Supabase > SQL Editor
-- Valores extraídos das planilhas RESULTADO ADM MES e RESULTADO SUB MES
-- ============================================================

-- 1. VERIFICAR o que está no banco agora (opcional, para diagnóstico)
SELECT
  e.nome AS empreendimento,
  d.tipo_gestao,
  d.data,
  d.valor
FROM diarias d
JOIN apartamentos a ON d.apartamento_id = a.id
JOIN empreendimentos e ON a.empreendimento_id = e.id
WHERE d.data >= '2026-01-01' AND d.data <= '2026-01-31'
ORDER BY e.nome, d.tipo_gestao;


-- 2. LIMPAR registros existentes de janeiro/2026
DELETE FROM diarias
WHERE data >= '2026-01-01' AND data <= '2026-01-31';


-- 3. INSERIR valores ADM corretos (RESULTADO ADM MES)
-- Usa o primeiro apartamento de cada empreendimento como referência mensal
WITH first_apt AS (
  SELECT DISTINCT ON (e.id)
    a.id   AS apt_id,
    UPPER(unaccent(e.nome)) AS emp_nome_norm
  FROM empreendimentos e
  JOIN apartamentos a ON a.empreendimento_id = e.id
  ORDER BY e.id, a.numero
),
valores_adm (emp_nome, valor) AS (
  VALUES
    ('ESSENCE',      53664.02),
    ('EASY',         10846.41),
    ('CULLINAN',      3905.32),
    ('ATHOS',         6107.50),
    ('NOBILE',        2417.61),
    ('FUSION',       13995.07),
    ('MERCURE',       9228.07),
    ('METROPOLITAN', 29140.77),
    ('BRISAS',       20088.83)
)
INSERT INTO diarias (apartamento_id, data, valor, tipo_gestao)
SELECT
  fa.apt_id,
  '2026-01-01'::date,
  va.valor,
  'adm'
FROM valores_adm va
JOIN first_apt fa
  ON fa.emp_nome_norm LIKE '%' || va.emp_nome || '%'
  OR va.emp_nome LIKE '%' || fa.emp_nome_norm || '%';


-- 4. INSERIR valores SUB corretos (RESULTADO SUB MES)
WITH first_apt AS (
  SELECT DISTINCT ON (e.id)
    a.id   AS apt_id,
    UPPER(unaccent(e.nome)) AS emp_nome_norm
  FROM empreendimentos e
  JOIN apartamentos a ON a.empreendimento_id = e.id
  ORDER BY e.id, a.numero
),
valores_sub (emp_nome, valor) AS (
  VALUES
    ('ESSENCE',      11145.01),
    ('CULLINAN',     27627.93),
    ('ATHOS',        22296.86),
    ('NOBILE',        4645.16),
    ('FUSION',        2901.46),
    ('METROPOLITAN',  3918.36),
    ('BRISAS',       26075.28),
    ('MERCURE',      27361.48)
)
INSERT INTO diarias (apartamento_id, data, valor, tipo_gestao)
SELECT
  fa.apt_id,
  '2026-01-01'::date,
  vs.valor,
  'sub'
FROM valores_sub vs
JOIN first_apt fa
  ON fa.emp_nome_norm LIKE '%' || vs.emp_nome || '%'
  OR vs.emp_nome LIKE '%' || fa.emp_nome_norm || '%';


-- 5. VERIFICAR resultado final (deve dar 275.365,24)
SELECT
  SUM(CASE WHEN tipo_gestao = 'adm' THEN valor ELSE 0 END) AS total_adm,
  SUM(CASE WHEN tipo_gestao = 'sub' THEN valor ELSE 0 END) AS total_sub,
  SUM(valor) AS total_geral
FROM diarias
WHERE data >= '2026-01-01' AND data <= '2026-01-31';

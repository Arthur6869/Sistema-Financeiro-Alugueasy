-- Tabela para armazenar a quantidade de diárias variáveis por competência (mês/ano)
-- Usado no módulo Custos Operacionais para calcular custo variável mensal
CREATE TABLE IF NOT EXISTS custos_operacionais_variaveis (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes     integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano     integer NOT NULL CHECK (ano BETWEEN 2020 AND 2100),
  diarias integer NOT NULL DEFAULT 0 CHECK (diarias >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mes, ano)
);

ALTER TABLE custos_operacionais_variaveis ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário autenticado
CREATE POLICY "autenticado_le_custos_op_variaveis"
  ON custos_operacionais_variaveis FOR SELECT
  USING (auth.role() = 'authenticated');

-- Escrita: apenas analista (operador do sistema)
CREATE POLICY "analista_escreve_custos_op_variaveis"
  ON custos_operacionais_variaveis FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'analista'
    )
  );

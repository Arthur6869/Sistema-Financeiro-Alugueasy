-- Migration 014: Portal do Proprietário
-- Cria vínculo entre usuário proprietário e seus apartamentos

-- 1. Expandir constraint de role em profiles para incluir 'proprietario'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'analista', 'proprietario'));

-- 2. Tabela de vínculos proprietário → apartamento
CREATE TABLE IF NOT EXISTS proprietario_apartamentos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  apartamento_id  uuid NOT NULL REFERENCES apartamentos(id) ON DELETE CASCADE,
  ativo           boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (proprietario_id, apartamento_id)
);

-- 3. RLS na nova tabela
ALTER TABLE proprietario_apartamentos ENABLE ROW LEVEL SECURITY;

-- Proprietário vê apenas seus próprios vínculos
CREATE POLICY "proprietario_ve_seus_vinculos"
  ON proprietario_apartamentos FOR SELECT
  USING (proprietario_id = auth.uid());

-- Analista gerencia todos os vínculos (WITH CHECK necessário para INSERT)
CREATE POLICY "analista_gerencia_vinculos"
  ON proprietario_apartamentos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'analista'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'analista'
    )
  );

-- 4. RLS em custos: proprietário lê apenas seus apts
CREATE POLICY "proprietario_le_custos"
  ON custos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proprietario_apartamentos pa
      WHERE pa.apartamento_id = custos.apartamento_id
        AND pa.proprietario_id = auth.uid()
        AND pa.ativo = true
    )
  );

-- 5. RLS em diarias: proprietário lê apenas seus apts
CREATE POLICY "proprietario_le_diarias"
  ON diarias FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM proprietario_apartamentos pa
      WHERE pa.apartamento_id = diarias.apartamento_id
        AND pa.proprietario_id = auth.uid()
        AND pa.ativo = true
    )
  );

-- 6. RLS em amenitiz_reservas: proprietário lê reservas dos seus apts
-- (via individual_room_number → apartamentos.numero)
CREATE POLICY "proprietario_le_reservas"
  ON amenitiz_reservas FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM proprietario_apartamentos pa
      JOIN apartamentos a ON a.id = pa.apartamento_id
      WHERE a.numero = amenitiz_reservas.individual_room_number
        AND pa.proprietario_id = auth.uid()
        AND pa.ativo = true
    )
  );

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_prop_apts_proprietario
  ON proprietario_apartamentos(proprietario_id);
CREATE INDEX IF NOT EXISTS idx_prop_apts_apartamento
  ON proprietario_apartamentos(apartamento_id);

-- Verificação
SELECT 'migration 014 aplicada' as status;

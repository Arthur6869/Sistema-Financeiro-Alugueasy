-- Migration 015: Corrige RLS da tabela proprietario_apartamentos
-- Problema: policy FOR ALL sem WITH CHECK bloqueia INSERT do analista

DROP POLICY IF EXISTS "analista_gerencia_vinculos" ON proprietario_apartamentos;

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

SELECT 'migration 015 aplicada' as status;

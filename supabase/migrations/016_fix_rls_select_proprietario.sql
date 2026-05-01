-- Migration 016: Garante que a policy SELECT do proprietário existe
-- (pode ter ficado fora quando 014 foi aplicada parcialmente)

DROP POLICY IF EXISTS "proprietario_ve_seus_vinculos" ON proprietario_apartamentos;

CREATE POLICY "proprietario_ve_seus_vinculos"
  ON proprietario_apartamentos FOR SELECT
  USING (proprietario_id = auth.uid());

SELECT 'migration 016 aplicada' as status;

-- ativo = false suspende o acesso do proprietário ao portal sem remover o cadastro
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN profiles.ativo IS
  'Quando false, o proprietário é bloqueado no proxy e não consegue acessar o portal. Reversível pelo analista.';

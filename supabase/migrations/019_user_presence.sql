-- Migration 019: Presença (online/offline) por heartbeat
-- Objetivo: permitir que analista veja quem está online via last_seen_at.

CREATE TABLE IF NOT EXISTS user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Manter updated_at em updates (padrão do projeto: simples)
CREATE OR REPLACE FUNCTION public.set_updated_at_presence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_presence_updated_at ON public.user_presence;
CREATE TRIGGER trg_user_presence_updated_at
BEFORE UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_presence();

-- RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Usuário pode ver apenas a própria presença (opcional, mas útil para debug)
DROP POLICY IF EXISTS "usuario_ve_sua_presenca" ON public.user_presence;
CREATE POLICY "usuario_ve_sua_presenca"
  ON public.user_presence FOR SELECT
  USING (user_id = auth.uid());

-- Usuário pode criar/atualizar apenas o próprio heartbeat
DROP POLICY IF EXISTS "usuario_atualiza_sua_presenca" ON public.user_presence;
CREATE POLICY "usuario_atualiza_sua_presenca"
  ON public.user_presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "usuario_atualiza_sua_presenca_update" ON public.user_presence;
CREATE POLICY "usuario_atualiza_sua_presenca_update"
  ON public.user_presence FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Analista pode ver todas as presenças
DROP POLICY IF EXISTS "analista_ve_presencas" ON public.user_presence;
CREATE POLICY "analista_ve_presencas"
  ON public.user_presence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'analista'
    )
  );

-- Índice para queries de "online"
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen
  ON public.user_presence(last_seen_at DESC);

SELECT 'migration 019 aplicada' as status;

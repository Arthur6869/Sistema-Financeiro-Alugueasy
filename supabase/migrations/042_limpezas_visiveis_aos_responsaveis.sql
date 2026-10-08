-- =============================================================================
-- 042 — "Minhas limpezas" inclui as limpezas em que a pessoa foi RESPONSÁVEL
--
-- Depois da 041 uma limpeza pode ter várias pessoas responsáveis, mas a policy
-- de leitura da 040 só liberava para quem REGISTROU (operador_id). Resultado:
-- a colega marcada como responsável não via a limpeza no próprio histórico.
--
-- Esta migration só amplia a leitura do operacional para incluir os registros
-- em que o id dele está em `responsaveis`. Equipe interna continua vendo tudo;
-- proprietário continua sem ver nada. Nenhuma escrita muda.
-- =============================================================================

DROP POLICY IF EXISTS "limpezas_select" ON public.limpezas;
CREATE POLICY "limpezas_select" ON public.limpezas
  FOR SELECT TO authenticated
  USING (
    public.is_interno()
    OR (
      public.is_operacional_ativo()
      AND (
        operador_id = (SELECT auth.uid())
        OR responsaveis @> jsonb_build_array(jsonb_build_object('id', (SELECT auth.uid())))
      )
    )
  );

-- Índice para a busca por responsável (policy acima e filtro da tela /limpezas)
CREATE INDEX IF NOT EXISTS limpezas_responsaveis_gin
  ON public.limpezas USING gin (responsaveis jsonb_path_ops);

-- VERIFICAÇÃO
-- SELECT policyname, qual FROM pg_policies WHERE tablename = 'limpezas' AND policyname = 'limpezas_select';

-- =============================================================================
-- Migration 038: publica `importacoes` no Realtime
--
-- PARA QUE SERVE
--   Hoje o aplicativo mobile só recebe evento ao vivo de `amenitiz_reservas` —
--   a migration 035 removeu todas as outras tabelas da publication de propósito.
--   Consequência prática: quando a equipe importa uma planilha no sistema web,
--   custos e diárias entram no banco mas o celular não fica sabendo. Os números
--   só mudam quando a tela é rebuscada (ao voltar para ela ou puxando para
--   atualizar).
--
-- POR QUE `importacoes` E NÃO `custos`/`diarias`
--   Uma importação insere centenas de linhas em `custos` e `diarias` de uma vez.
--   Publicar essas tabelas transformaria cada importação numa enxurrada de
--   eventos — ruim para a bateria, para os dados móveis e para o servidor de
--   Realtime. Já `importacoes` recebe UMA linha por importação, com o status
--   final. Um evento, preciso, no momento certo.
--
-- SEGURANÇA
--   A tabela não guarda valor financeiro nenhum: só tipo, mês, ano, nome do
--   arquivo, status e quem importou. Além disso a policy `importacoes_select`
--   (migration 036) restringe a leitura a `is_interno()`, e o Realtime avalia a
--   RLS antes de entregar — então o evento chega apenas a contas de admin e
--   analista. Proprietário não recebe nada, o que é o correto: importar é ação
--   de equipe.
--
--   Isso mantém o princípio da 035 (publicar só o que é de fato consumido).
--
-- COMO APLICAR
--   Supabase Dashboard -> projeto rlkmljeatapayiroggrp -> SQL Editor.
--   Cole o arquivo inteiro e execute. A verificação está no fim.
-- Data: 2026-08-06
-- =============================================================================
-- ROLLBACK:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.importacoes;
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'publication supabase_realtime não existe';
  END IF;

  -- Idempotente: rodar de novo não quebra nem duplica.
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'importacoes'
  ) THEN
    RAISE NOTICE 'importacoes já está publicada — nada a fazer';
  ELSE
    ALTER PUBLICATION supabase_realtime ADD TABLE public.importacoes;
    RAISE NOTICE 'importacoes publicada no Realtime';
  END IF;
END $$;

-- O Realtime precisa da linha ANTIGA para avaliar a RLS em UPDATE e DELETE.
-- Sem REPLICA IDENTITY FULL o payload de `old` vem só com a chave primária, e a
-- policy `importacoes_select` não tem como decidir — o evento é descartado em
-- silêncio. Custo: um pouco mais de WAL, irrelevante para uma tabela que recebe
-- poucas linhas por mês.
ALTER TABLE public.importacoes REPLICA IDENTITY FULL;


-- =============================================================================
-- VERIFICAÇÃO
-- =============================================================================

-- V1. O Realtime deve publicar exatamente duas tabelas agora
SELECT tablename AS publicada_no_realtime
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;

-- V2. REPLICA IDENTITY de importacoes deve ser 'f' (full)
-- O cast é obrigatório: relreplident é do tipo "char" e o Postgres não escolhe
-- sozinho qual operador || usar contra um literal de texto.
SELECT 'V2: importacoes replica identity = ' || relreplident::text AS estado
FROM pg_class WHERE oid = 'public.importacoes'::regclass;

-- V3. A leitura continua restrita a interno (esperado: 1 linha, com is_interno)
SELECT pol.polname AS policy, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
WHERE c.relname = 'importacoes' AND pol.polcmd = 'r';

SELECT '038 aplicada — importacoes no Realtime' AS status;

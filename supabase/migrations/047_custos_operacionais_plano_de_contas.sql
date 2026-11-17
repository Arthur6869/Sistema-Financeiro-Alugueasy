-- =============================================================================
-- 047 — Custos operacionais: plano de contas + lançamentos mensais
--
-- ANTES
--   A aba /custos-operacionais mostrava uma lista FIXA escrita no código
--   (R$ 43.509,92/mês, igual em todos os meses) e a única coisa gravada no
--   banco era a quantidade de "diárias avulsas" do mês
--   (custos_operacionais_variaveis — nunca chegou a receber uma linha).
--
-- AGORA
--   Os custos operacionais passam a ser lançados conta a conta, mês a mês, no
--   formato da planilha "Controle Mensal de Custos Operacionais" (aba
--   Lançamentos): cada linha é uma conta, cada coluna é um mês.
--
--   custos_operacionais_contas       → o plano de contas (uma linha por conta)
--   custos_operacionais_lancamentos  → o valor pago em cada mês (conta × mês)
--
-- ESTA MIGRATION É SÓ ESTRUTURA. As contas e os valores NÃO estão aqui de
-- propósito: a planilha traz nome e salário de funcionários, e este arquivo vai
-- para o repositório. Os dados entram direto no banco (carga da planilha ou
-- digitação na aba).
--
-- ACESSO (mesmo desenho das migrations 035–037)
--   leitura  → só interno (admin e analista), via is_interno()
--   escrita  → só analista (admin é somente leitura, por desenho)
--   proprietário, operacional, pendente e chave anônima → nada
--
-- NÃO MEXE em custos_operacionais_variaveis: o Dashboard ainda lê essa tabela.
--
-- Data: 2026-11-06
-- =============================================================================
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.custos_operacionais_lancamentos;
--   DROP TABLE IF EXISTS public.custos_operacionais_contas;
-- =============================================================================


-- ── Plano de contas ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custos_operacionais_contas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            text NOT NULL,                       -- "1.00", "3.01" — rótulo de exibição
  nome              text NOT NULL,
  grupo             text NOT NULL,                       -- "1. Folha de pagamento", "3. Escritório / ocupação"…
  classificacao_dre text NOT NULL DEFAULT 'A definir',   -- "Custo do serviço (CSV)", "Despesa administrativa"…
  tipo              text NOT NULL DEFAULT 'variavel'
                      CHECK (tipo IN ('fixo', 'variavel', 'provisao')),
  dia_vencimento    integer CHECK (dia_vencimento BETWEEN 1 AND 31),
  valor_base        numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_base >= 0),  -- referência: "quanto essa conta costuma ser"
  observacao        text,
  ordem             integer NOT NULL DEFAULT 0,          -- ordem de exibição (a da planilha)
  ativo             boolean NOT NULL DEFAULT true,       -- conta encerrada some dos meses sem valor
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custos_operacionais_contas_codigo_key UNIQUE (codigo),
  CONSTRAINT custos_operacionais_contas_nome_chk CHECK (btrim(nome) <> ''),
  CONSTRAINT custos_operacionais_contas_grupo_chk CHECK (btrim(grupo) <> '')
);

-- ── Valor de cada conta em cada mês ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custos_operacionais_lancamentos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id   uuid NOT NULL REFERENCES public.custos_operacionais_contas(id) ON DELETE RESTRICT,
  mes        integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano        integer NOT NULL CHECK (ano BETWEEN 2020 AND 2100),
  -- Sem valor no mês = sem linha. Zero não é lançamento.
  valor      numeric(12,2) NOT NULL CHECK (valor > 0),
  observacao text,
  origem     text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'planilha')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Uma conta tem no máximo um valor por mês: é isso que impede lançar em dobro
  CONSTRAINT custos_operacionais_lancamentos_conta_mes_key UNIQUE (conta_id, mes, ano)
);

CREATE INDEX IF NOT EXISTS custos_operacionais_lancamentos_periodo_idx
  ON public.custos_operacionais_lancamentos (ano, mes);


-- ── Acesso ───────────────────────────────────────────────────────────────────
ALTER TABLE public.custos_operacionais_contas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_operacionais_lancamentos ENABLE ROW LEVEL SECURITY;

-- A chave anônima não tem o que fazer aqui (a RLS já barraria; isto fecha a porta)
REVOKE ALL ON public.custos_operacionais_contas      FROM anon;
REVOKE ALL ON public.custos_operacionais_lancamentos FROM anon;

DROP POLICY IF EXISTS "custos_op_contas_select_interno" ON public.custos_operacionais_contas;
CREATE POLICY "custos_op_contas_select_interno" ON public.custos_operacionais_contas
  FOR SELECT TO authenticated
  USING (public.is_interno());

DROP POLICY IF EXISTS "custos_op_contas_escrita_analista" ON public.custos_operacionais_contas;
CREATE POLICY "custos_op_contas_escrita_analista" ON public.custos_operacionais_contas
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'analista'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'analista'));

DROP POLICY IF EXISTS "custos_op_lanc_select_interno" ON public.custos_operacionais_lancamentos;
CREATE POLICY "custos_op_lanc_select_interno" ON public.custos_operacionais_lancamentos
  FOR SELECT TO authenticated
  USING (public.is_interno());

DROP POLICY IF EXISTS "custos_op_lanc_escrita_analista" ON public.custos_operacionais_lancamentos;
CREATE POLICY "custos_op_lanc_escrita_analista" ON public.custos_operacionais_lancamentos
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'analista'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (SELECT auth.uid()) AND p.role = 'analista'));


-- ── Conferência (rodar depois de aplicar) ────────────────────────────────────
-- SELECT tablename, policyname, cmd, roles FROM pg_policies
--  WHERE tablename LIKE 'custos_operacionais_%' ORDER BY 1, 2;
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('custos_operacionais_contas', 'custos_operacionais_lancamentos');

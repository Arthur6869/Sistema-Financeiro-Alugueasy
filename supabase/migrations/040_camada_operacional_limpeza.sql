-- =============================================================================
-- 040 — Camada OPERACIONAL (equipe de limpeza) + checklist de limpeza
--
-- Papel novo: 'operacional'. Cada pessoa da limpeza tem o próprio login, vê a
-- lista de imóveis, escolhe um, preenche o checklist e, ao finalizar, a AlugEasy
-- recebe um e-mail (enviado pela rota POST /api/limpezas).
--
-- PRINCÍPIO: esta migration é ADITIVA. Nenhuma policy dos papéis existentes
-- (analista, admin, proprietario) é afrouxada:
--   • is_interno() NÃO muda — continua admin/analista. Incluir 'operacional' nela
--     abriria toda a base financeira para a equipe de limpeza.
--   • O operacional NÃO ganha leitura em apartamentos/empreendimentos (essas
--     tabelas têm taxa de repasse e nome do proprietário). Ele enxerga só
--     id + empreendimento + número, via a função listar_imoveis_limpeza().
--   • O registro de limpeza só é gravado pela API (service_role), depois de
--     validar papel, conta ativa e itens. Sessão de usuário não tem INSERT.
--
-- Única policy existente alterada: user_presence (presença online), que passa a
-- aceitar também operacional ativo — o mesmo OR que já existe para proprietário.
-- =============================================================================


-- =============================================================================
-- PARTE 1 — papel 'operacional' na constraint de profiles
-- Mantém os quatro valores atuais (034 adicionou 'pendente').
-- =============================================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'analista', 'proprietario', 'pendente', 'operacional'));


-- =============================================================================
-- PARTE 2 — is_operacional_ativo()
-- Mesmo molde de is_proprietario_ativo() (037): SECURITY DEFINER, search_path
-- fixo, conta suspensa (profiles.ativo = false) não passa.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_operacional_ativo()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'operacional'
      AND coalesce(ativo, true) = true
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_operacional_ativo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_operacional_ativo() TO authenticated, service_role;


-- =============================================================================
-- PARTE 3 — presença online (user_presence)
-- A restritiva da 037 só aceitava interno ou proprietário ativo; sem isto o
-- heartbeat do operacional falharia (silenciosamente) e ele apareceria sempre
-- offline na tela de usuários. Apenas acrescenta um OR.
-- =============================================================================
DROP POLICY IF EXISTS "restr_presenca_papel_valido" ON public.user_presence;
CREATE POLICY "restr_presenca_papel_valido" ON public.user_presence
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_interno() OR public.is_proprietario_ativo() OR public.is_operacional_ativo())
  WITH CHECK (public.is_interno() OR public.is_proprietario_ativo() OR public.is_operacional_ativo());


-- =============================================================================
-- PARTE 4 — checklist modelo (itens que aparecem para a limpeza)
-- apartamento_id NULL = item padrão, vale para todos os imóveis.
-- apartamento_id preenchido = item extra só daquele imóvel.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.limpeza_checklist_itens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartamento_id uuid NULL REFERENCES public.apartamentos(id) ON DELETE CASCADE,
  area           text NOT NULL CHECK (length(trim(area)) > 0),
  descricao      text NOT NULL CHECK (length(trim(descricao)) > 0),
  ordem          integer NOT NULL DEFAULT 0,
  ativo          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS limpeza_checklist_itens_apt_idx
  ON public.limpeza_checklist_itens (apartamento_id);

ALTER TABLE public.limpeza_checklist_itens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.limpeza_checklist_itens FROM anon;

DROP POLICY IF EXISTS "checklist_select" ON public.limpeza_checklist_itens;
CREATE POLICY "checklist_select" ON public.limpeza_checklist_itens
  FOR SELECT TO authenticated
  USING (public.is_interno() OR public.is_operacional_ativo());

-- Escrita do modelo: só analista (admin é somente leitura, como no resto).
DROP POLICY IF EXISTS "checklist_insert_analista" ON public.limpeza_checklist_itens;
CREATE POLICY "checklist_insert_analista" ON public.limpeza_checklist_itens
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'analista'));

DROP POLICY IF EXISTS "checklist_update_analista" ON public.limpeza_checklist_itens;
CREATE POLICY "checklist_update_analista" ON public.limpeza_checklist_itens
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'analista'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'analista'));

DROP POLICY IF EXISTS "checklist_delete_analista" ON public.limpeza_checklist_itens;
CREATE POLICY "checklist_delete_analista" ON public.limpeza_checklist_itens
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'analista'));

-- Modelo inicial — só semeia se a tabela estiver vazia (reaplicar não duplica).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.limpeza_checklist_itens) THEN
    INSERT INTO public.limpeza_checklist_itens (area, descricao, ordem) VALUES
      ('Quarto',          'Trocar roupa de cama (lençol, fronhas e edredom)',            10),
      ('Quarto',          'Arrumar a cama',                                              20),
      ('Quarto',          'Tirar o pó de móveis, cabeceira e criados-mudos',             30),
      ('Quarto',          'Conferir e limpar armários e gavetas',                        40),
      ('Quarto',          'Varrer/aspirar e passar pano no chão',                        50),
      ('Banheiro',        'Limpar e desinfetar o vaso sanitário',                       110),
      ('Banheiro',        'Limpar pia, torneira e espelho',                             120),
      ('Banheiro',        'Limpar box e chuveiro',                                      130),
      ('Banheiro',        'Trocar toalhas e tapete',                                    140),
      ('Banheiro',        'Repor papel higiênico, sabonete e amenities',                150),
      ('Banheiro',        'Esvaziar a lixeira e trocar o saco',                         160),
      ('Cozinha',         'Lavar e guardar louças e utensílios',                        210),
      ('Cozinha',         'Limpar fogão/cooktop e bancada',                             220),
      ('Cozinha',         'Limpar micro-ondas e geladeira (descartar sobras)',          230),
      ('Cozinha',         'Limpar pia e torneira',                                      240),
      ('Cozinha',         'Repor detergente, esponja e pano de prato',                  250),
      ('Cozinha',         'Esvaziar o lixo e trocar o saco',                            260),
      ('Sala e varanda',  'Tirar o pó de móveis, TV e superfícies',                     310),
      ('Sala e varanda',  'Limpar sofá e almofadas',                                    320),
      ('Sala e varanda',  'Limpar vidros, janelas e varanda',                           330),
      ('Sala e varanda',  'Varrer/aspirar e passar pano no chão',                       340),
      ('Vistoria final',  'Testar ar-condicionado, TV e controles',                     410),
      ('Vistoria final',  'Conferir lâmpadas e tomadas',                                420),
      ('Vistoria final',  'Verificar danos ou itens faltando (anotar nas observações)', 430),
      ('Vistoria final',  'Desligar luzes e aparelhos e fechar as janelas',             440),
      ('Vistoria final',  'Trancar a porta e deixar a chave no local combinado',        450);
  END IF;
END $$;


-- =============================================================================
-- PARTE 5 — limpezas registradas
-- Os itens ficam como "foto" em jsonb: se o modelo mudar depois, o histórico
-- continua mostrando exatamente o que a pessoa marcou naquele dia.
-- operador e imóvel também têm cópia em texto, para o histórico sobreviver à
-- exclusão do usuário ou do apartamento (FK vira NULL, o nome fica).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.limpezas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  apartamento_id   uuid NULL REFERENCES public.apartamentos(id) ON DELETE SET NULL,
  imovel           text NOT NULL,
  operador_id      uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  operador_nome    text NOT NULL,
  iniciada_em      timestamptz NULL,
  finalizada_em    timestamptz NOT NULL DEFAULT now(),
  itens            jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_itens      integer NOT NULL CHECK (total_itens > 0),
  itens_concluidos integer NOT NULL CHECK (itens_concluidos >= 0),
  completa         boolean GENERATED ALWAYS AS (itens_concluidos = total_itens) STORED,
  observacao       text NULL,
  email_enviado    boolean NOT NULL DEFAULT false,
  email_erro       text NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT limpezas_concluidos_ate_total CHECK (itens_concluidos <= total_itens),
  CONSTRAINT limpezas_itens_array CHECK (jsonb_typeof(itens) = 'array')
);

CREATE INDEX IF NOT EXISTS limpezas_finalizada_idx ON public.limpezas (finalizada_em DESC);
CREATE INDEX IF NOT EXISTS limpezas_operador_idx   ON public.limpezas (operador_id, finalizada_em DESC);
CREATE INDEX IF NOT EXISTS limpezas_apt_idx        ON public.limpezas (apartamento_id, finalizada_em DESC);

ALTER TABLE public.limpezas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.limpezas FROM anon;

-- Leitura: equipe interna vê todas; operacional ativo vê só as próprias.
DROP POLICY IF EXISTS "limpezas_select" ON public.limpezas;
CREATE POLICY "limpezas_select" ON public.limpezas
  FOR SELECT TO authenticated
  USING (
    public.is_interno()
    OR (operador_id = (SELECT auth.uid()) AND public.is_operacional_ativo())
  );

-- Sem policy de INSERT/UPDATE para sessão de usuário: a gravação passa
-- obrigatoriamente pela API (service_role), que valida tudo antes.
-- Analista pode apagar um registro lançado por engano.
DROP POLICY IF EXISTS "limpezas_delete_analista" ON public.limpezas;
CREATE POLICY "limpezas_delete_analista" ON public.limpezas
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND role = 'analista'));


-- =============================================================================
-- PARTE 6 — listar_imoveis_limpeza()
-- Única janela do operacional para os imóveis: id, empreendimento, número e a
-- última limpeza (quando e por quem — primeiro nome). Nada financeiro.
-- Proprietário, pendente ou conta suspensa recebem zero linhas.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.listar_imoveis_limpeza()
RETURNS TABLE (
  apartamento_id     uuid,
  empreendimento     text,
  numero             text,
  ultima_limpeza_em  timestamptz,
  ultima_limpeza_por text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    a.id,
    e.nome,
    a.numero,
    ul.finalizada_em,
    split_part(ul.operador_nome, ' ', 1)
  FROM apartamentos a
  JOIN empreendimentos e ON e.id = a.empreendimento_id
  LEFT JOIN LATERAL (
    SELECT l.finalizada_em, l.operador_nome
    FROM limpezas l
    WHERE l.apartamento_id = a.id
    ORDER BY l.finalizada_em DESC
    LIMIT 1
  ) ul ON true
  WHERE public.is_interno() OR public.is_operacional_ativo()
  ORDER BY e.nome, a.numero;
$$;

REVOKE EXECUTE ON FUNCTION public.listar_imoveis_limpeza() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_imoveis_limpeza() TO authenticated, service_role;


-- =============================================================================
-- VERIFICAÇÃO — rode depois de aplicar
-- =============================================================================
-- V1. constraint com 5 papéis
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'profiles_role_check';
-- V2. funções novas são SECURITY DEFINER e anon não executa
-- SELECT proname, prosecdef, has_function_privilege('anon', oid, 'EXECUTE') AS anon_exec
-- FROM pg_proc WHERE proname IN ('is_operacional_ativo', 'listar_imoveis_limpeza');
-- V3. modelo semeado
-- SELECT area, count(*) FROM limpeza_checklist_itens GROUP BY area ORDER BY min(ordem);

CREATE TABLE IF NOT EXISTS amenitiz_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano integer NOT NULL CHECK (ano >= 2020),
  status text NOT NULL CHECK (status IN ('concluido', 'erro', 'em_andamento'))
    DEFAULT 'em_andamento',
  total_reservas integer DEFAULT 0,
  faturamento_bruto numeric DEFAULT 0,
  faturamento_liquido numeric DEFAULT 0,
  erro_mensagem text,
  sincronizado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS amenitiz_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amenitiz_id text NOT NULL,
  hotel_uuid text NOT NULL,
  apartamento_numero text,
  empreendimento_nome text,
  check_in date NOT NULL,
  check_out date NOT NULL,
  status text,
  plataforma text,                -- 'booking' | 'airbnb' | 'alugueasy' | 'direct'
  valor_bruto numeric DEFAULT 0,
  taxa_aplicada numeric DEFAULT 0, -- percentual aplicado (0, 0.10, 0.13, 0.16)
  valor_liquido numeric DEFAULT 0, -- valor após desconto da taxa
  nome_hospede text,
  mes_competencia integer,
  ano_competencia integer,
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(amenitiz_id)
);

ALTER TABLE amenitiz_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenitiz_reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "syncs_select" ON amenitiz_syncs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "syncs_all" ON amenitiz_syncs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "reservas_select" ON amenitiz_reservas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "reservas_all" ON amenitiz_reservas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

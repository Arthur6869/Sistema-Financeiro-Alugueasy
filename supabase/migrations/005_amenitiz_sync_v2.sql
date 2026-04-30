-- Recriar tabelas Amenitiz com schema correto (campos reais da API)
-- Seguro apagar pois as tabelas anteriores foram criadas vazias (API não estava acessível)

DROP TABLE IF EXISTS amenitiz_reservas;
DROP TABLE IF EXISTS amenitiz_syncs;

CREATE TABLE amenitiz_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano integer NOT NULL CHECK (ano >= 2020),
  status text NOT NULL
    CHECK (status IN ('concluido', 'erro', 'em_andamento'))
    DEFAULT 'em_andamento',
  total_reservas integer DEFAULT 0,
  faturamento_bruto numeric DEFAULT 0,
  faturamento_liquido numeric DEFAULT 0,
  erro_mensagem text,
  sincronizado_por uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE amenitiz_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id text NOT NULL,             -- ID da reserva na Amenitiz
  hotel_uuid text NOT NULL,
  status text,                          -- 'confirmed' | 'cancelled' | 'no_show'
  source text,                          -- plataforma retornada pela API: 'manual' | 'booking' | 'airbnb'
  plataforma_normalizada text,          -- 'Booking' | 'Airbnb' | 'Alugueasy'
  checkin date NOT NULL,
  checkout date NOT NULL,
  individual_room_number text,          -- número do apartamento (rooms[0].individual_room_number)
  individual_room_name text,            -- nome completo do quarto
  valor_bruto numeric DEFAULT 0,        -- parseFloat(total_amount_after_tax)
  taxa_aplicada numeric DEFAULT 0,      -- percentual aplicado: 0, 0.10, 0.13, 0.16
  valor_liquido numeric DEFAULT 0,      -- valor após desconto da taxa
  nome_hospede text,                    -- "Nome Sobrenome — +55 11 99999-9999"
  email_hospede text,
  phone_hospede text,
  mes_competencia integer,
  ano_competencia integer,
  raw_data jsonb,                       -- resposta completa para auditoria
  created_at timestamptz DEFAULT now(),
  UNIQUE(booking_id)
);

ALTER TABLE amenitiz_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenitiz_reservas ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado
CREATE POLICY "syncs_select" ON amenitiz_syncs
  FOR SELECT TO authenticated USING (true);

-- Escrita: apenas analista (quem faz CRUD neste sistema)
CREATE POLICY "syncs_analista" ON amenitiz_syncs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'analista'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'analista'));

CREATE POLICY "reservas_select" ON amenitiz_reservas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "reservas_analista" ON amenitiz_reservas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'analista'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'analista'));

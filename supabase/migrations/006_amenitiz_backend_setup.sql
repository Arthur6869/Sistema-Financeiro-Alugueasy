-- =============================================================================
-- Migration: 006_amenitiz_backend_setup.sql
-- Data: 09/04/2026
-- Descrição: Adiciona colunas necessárias para o backend da integração Amenitiz:
--   1. tipo_gestao  → classificação ADM / SUB por apartamento
--   2. amenitiz_room_id → UUID estável do quarto na API Amenitiz (individual_room_id)
--
-- COMO APLICAR:
--   1. Acesse https://app.supabase.com/project/rlkmljeatapayiroggrp
--   2. Vá em SQL Editor
--   3. Cole e execute este script completo
--
-- ⚠️ IDEMPOTENTE: seguro re-executar (usa IF NOT EXISTS / IF column not exists)
-- =============================================================================


-- =============================================================================
-- PASSO 1: Adicionar coluna tipo_gestao em apartamentos
-- 'adm' = Administração (AlugEasy gerencia)
-- 'sub' = Sublocação (AlugEasy aluga do proprietário)
-- =============================================================================
ALTER TABLE public.apartamentos
  ADD COLUMN IF NOT EXISTS tipo_gestao text
    CHECK (tipo_gestao IN ('adm', 'sub'))
    DEFAULT 'adm';


-- =============================================================================
-- PASSO 2: Adicionar coluna amenitiz_room_id em apartamentos
-- individual_room_id retornado pela API Amenitiz — identificador estável
-- Usado como fallback quando o nome do quarto não segue o padrão de parsing
-- =============================================================================
ALTER TABLE public.apartamentos
  ADD COLUMN IF NOT EXISTS amenitiz_room_id text;

CREATE UNIQUE INDEX IF NOT EXISTS apartamentos_amenitiz_room_id_idx
  ON public.apartamentos (amenitiz_room_id)
  WHERE amenitiz_room_id IS NOT NULL;


-- =============================================================================
-- PASSO 3: Atualizar amenitiz_room_id para todos os quartos conhecidos
-- Fonte: API Amenitiz — /bookings/checkin (individual_room_id confirmado)
-- =============================================================================

-- ATHOS (AB)
UPDATE public.apartamentos a SET amenitiz_room_id = '9e594063-d2a6-41dd-aac0-f8c38fd99364'
WHERE a.numero = '3' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ATHOS');

UPDATE public.apartamentos a SET amenitiz_room_id = '762ab4fb-6069-4968-9ca4-d7f6f6f56342'
WHERE a.numero = '1101' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ATHOS');

UPDATE public.apartamentos a SET amenitiz_room_id = '817e8b5b-8315-4ce6-94bc-93ec6f14356b'
WHERE a.numero = '1115' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ATHOS');

UPDATE public.apartamentos a SET amenitiz_room_id = '93eee3f7-794a-4d9b-bdc0-14c510632bfa'
WHERE a.numero = '18' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ATHOS');

UPDATE public.apartamentos a SET amenitiz_room_id = '6e90d78d-daca-4b9a-a779-3528780a9b7f'
WHERE a.numero = '19' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ATHOS');

UPDATE public.apartamentos a SET amenitiz_room_id = 'd0c42787-c69a-4bac-a65c-2df161a1d44c'
WHERE a.numero = '809' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ATHOS');

UPDATE public.apartamentos a SET amenitiz_room_id = '806d43eb-f08d-45e2-9e09-21ca1a4f4878'
WHERE a.numero = '908' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ATHOS');

UPDATE public.apartamentos a SET amenitiz_room_id = '9eccac74-8804-4690-8db6-a28f6b734a67'
WHERE a.numero = '910' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ATHOS');

-- BRISAS (com apt número)
UPDATE public.apartamentos a SET amenitiz_room_id = '950a4fdf-68d5-4577-a7ec-c377d5133bf0'
WHERE a.numero = 'A113' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'BRISAS');

UPDATE public.apartamentos a SET amenitiz_room_id = '2d964afe-2d5f-4e4f-81e9-f4ec311d9089'
WHERE a.numero = 'A115' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'BRISAS');

UPDATE public.apartamentos a SET amenitiz_room_id = 'edf610fb-b301-459c-b79d-a3029f9bf451'
WHERE a.numero = 'A117' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'BRISAS');

UPDATE public.apartamentos a SET amenitiz_room_id = 'da16ed3a-cf0e-41b6-a109-9cf0353fe20b'
WHERE a.numero = 'B119' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'BRISAS');

UPDATE public.apartamentos a SET amenitiz_room_id = 'b5bd8440-d74d-45fc-ade9-723861afe6f4'
WHERE a.numero = 'E016' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'BRISAS');

-- BRISAS sem número (nome genérico — mapear pelo numero correto no banco)
-- ⚠️ AÇÃO MANUAL: substitua '???' pelo numero correto do apartamento no banco
-- room_id 64e4757c = "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago"
-- room_id f0caa1ec = "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago 2"
-- UPDATE public.apartamentos a SET amenitiz_room_id = '64e4757c-5a32-4423-bc26-393364ec6813'
-- WHERE a.numero = '???' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'BRISAS');
-- UPDATE public.apartamentos a SET amenitiz_room_id = 'f0caa1ec-50ec-42b5-9b29-7fb0ae9fab01'
-- WHERE a.numero = '???' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'BRISAS');

-- CULLINAN
UPDATE public.apartamentos a SET amenitiz_room_id = '7b476766-037d-4541-a0db-ed93590c3b7a'
WHERE a.numero = '218' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'CULLINAN');

UPDATE public.apartamentos a SET amenitiz_room_id = '2074ddab-4708-45c4-918d-4d990543d625'
WHERE a.numero = '304' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'CULLINAN');

UPDATE public.apartamentos a SET amenitiz_room_id = 'd6816d8a-32a7-4c4c-933b-179192daa31d'
WHERE a.numero = '404' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'CULLINAN');

UPDATE public.apartamentos a SET amenitiz_room_id = 'eec1cd65-160b-4f4d-9f28-c80e865102f2'
WHERE a.numero = '611' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'CULLINAN');

UPDATE public.apartamentos a SET amenitiz_room_id = 'd2148886-251a-4f51-a3cf-57eb968cdce3'
WHERE a.numero = '803' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'CULLINAN');

UPDATE public.apartamentos a SET amenitiz_room_id = '65b20b8a-70f2-4790-b795-9d9b5dc90058'
WHERE a.numero = '916' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'CULLINAN');

-- EASY
UPDATE public.apartamentos a SET amenitiz_room_id = '11a3fb95-9c04-4215-a043-149c72380715'
WHERE a.numero = '117' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'EASY');

UPDATE public.apartamentos a SET amenitiz_room_id = '3a88290b-a900-4fd3-a4a2-236f04b62e46'
WHERE a.numero = '217' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'EASY');

UPDATE public.apartamentos a SET amenitiz_room_id = '31941774-245d-46d2-b556-3b9cb5b95398'
WHERE a.numero = '218' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'EASY');

-- ESSENCE
UPDATE public.apartamentos a SET amenitiz_room_id = 'e4a90e7d-15f4-4874-86fe-498e6741ddc8'
WHERE a.numero = '204' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ESSENCE');

UPDATE public.apartamentos a SET amenitiz_room_id = '067f1b17-1a3d-42ed-b6b7-939e80f7cb94'
WHERE a.numero = '301' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ESSENCE');

UPDATE public.apartamentos a SET amenitiz_room_id = 'd7246fb8-b10a-4fb4-9c9f-a6877838a115'
WHERE a.numero = '302' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ESSENCE');

UPDATE public.apartamentos a SET amenitiz_room_id = 'd38e32f2-1a9b-494b-96fd-79d53263c4f2'
WHERE a.numero = '404' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ESSENCE');

UPDATE public.apartamentos a SET amenitiz_room_id = '69c92507-7d68-470e-95a0-7e5cd063d814'
WHERE a.numero = '502' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ESSENCE');

UPDATE public.apartamentos a SET amenitiz_room_id = 'c23f4610-fbf5-4248-829a-7b49b1c38f7b'
WHERE a.numero = '504' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ESSENCE');

UPDATE public.apartamentos a SET amenitiz_room_id = '6c86f26b-a5a5-4708-98f0-b37677d06bd8'
WHERE a.numero = '602' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ESSENCE');

UPDATE public.apartamentos a SET amenitiz_room_id = '92d0cc7b-de8a-43da-843b-399e69fff3e4'
WHERE a.numero = '603' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ESSENCE');

UPDATE public.apartamentos a SET amenitiz_room_id = 'fb44713a-cc07-4334-9bba-cc44c365de63'
WHERE a.numero = '702' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'ESSENCE');

-- FUSION
UPDATE public.apartamentos a SET amenitiz_room_id = '8759772d-4e95-49ef-aed6-0b05622e7c9d'
WHERE a.numero = '1415' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'FUSION');

UPDATE public.apartamentos a SET amenitiz_room_id = '8352b7de-7753-4af5-a179-95dcfc502743'
WHERE a.numero = '1501' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'FUSION');

UPDATE public.apartamentos a SET amenitiz_room_id = '7724f305-1237-489b-a944-5727f667e2f3'
WHERE a.numero = '412' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'FUSION');

UPDATE public.apartamentos a SET amenitiz_room_id = '508a63b7-6181-4824-a8fc-1b295fc20b3d'
WHERE a.numero = '722' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'FUSION');

-- MERCURE
UPDATE public.apartamentos a SET amenitiz_room_id = '8c49536f-f153-43ae-bff0-9fb93fe01cf4'
WHERE a.numero = '1309' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'MERCURE');

UPDATE public.apartamentos a SET amenitiz_room_id = 'c0d1aa38-08d3-4085-8162-48ed1b47d26a'
WHERE a.numero = '1311' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'MERCURE');

UPDATE public.apartamentos a SET amenitiz_room_id = 'be8db07d-fa47-4b38-8fc9-d61ace76a92d'
WHERE a.numero = '1312' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'MERCURE');

UPDATE public.apartamentos a SET amenitiz_room_id = '20b7088d-774b-4601-b1ca-f627707f6f5b'
WHERE a.numero = '1322' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'MERCURE');

UPDATE public.apartamentos a SET amenitiz_room_id = '8aa40863-59a9-4562-90af-ffd7a89931ad'
WHERE a.numero = '1419' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'MERCURE');

UPDATE public.apartamentos a SET amenitiz_room_id = '113ad813-8466-4118-80b5-8192e049900e'
WHERE a.numero = '1420' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'MERCURE');

UPDATE public.apartamentos a SET amenitiz_room_id = 'a071507e-11b5-4420-a3ae-49f34a7b3aea'
WHERE a.numero = '1421' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'MERCURE');

UPDATE public.apartamentos a SET amenitiz_room_id = '46e1ebc4-a6ed-4726-8bf7-b942d3165740'
WHERE a.numero = '1422' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'MERCURE');

UPDATE public.apartamentos a SET amenitiz_room_id = '9f7e9c18-34cb-453b-9981-8e3ec7c337dc'
WHERE a.numero = '906' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'MERCURE');

-- METROPOLITAN
UPDATE public.apartamentos a SET amenitiz_room_id = '0773b5ed-5800-433c-8677-1f3b46999c6f'
WHERE a.numero = '1214A' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'METROPOLITAN');

UPDATE public.apartamentos a SET amenitiz_room_id = 'e0d8176e-805a-457f-9258-c2119f7419c4'
WHERE a.numero = '1605' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'METROPOLITAN');

UPDATE public.apartamentos a SET amenitiz_room_id = '8b6d724d-4853-4979-a29c-2ce33e5e5201'
WHERE a.numero = '1615' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'METROPOLITAN');

-- Unidade combinada 1615 + 1615A (pode estar cadastrada como "1615 E 1615A" ou similar)
UPDATE public.apartamentos a SET amenitiz_room_id = '037dc1ea-79a1-4ae0-be38-159b84951331'
WHERE a.numero IN ('1615 E 1615A','1615-1615A','1615/1615A')
AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'METROPOLITAN');

UPDATE public.apartamentos a SET amenitiz_room_id = 'cf425c8e-445e-41fb-8cc0-899fd99d75d9'
WHERE a.numero = '1615A' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'METROPOLITAN');

UPDATE public.apartamentos a SET amenitiz_room_id = '64cd95af-3478-4ad4-adb3-20ad72237c17'
WHERE a.numero = '1701' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'METROPOLITAN');

UPDATE public.apartamentos a SET amenitiz_room_id = 'df34ab90-7c27-4f5c-874d-6b852525cbf3'
WHERE a.numero = '1701A' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'METROPOLITAN');

-- NOBILE
UPDATE public.apartamentos a SET amenitiz_room_id = 'f0bb5cd9-c5c2-40b2-98b3-9b3ba1422d4d'
WHERE a.numero = '19' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'NOBILE');

UPDATE public.apartamentos a SET amenitiz_room_id = '299cc207-3044-494f-ab97-770b80624f07'
WHERE a.numero = '718' AND a.empreendimento_id = (SELECT id FROM empreendimentos WHERE upper(nome) = 'NOBILE');


-- =============================================================================
-- VERIFICAÇÃO (execute após o script para conferir)
-- =============================================================================
-- SELECT
--   emp.nome,
--   a.numero,
--   a.tipo_gestao,
--   a.amenitiz_room_id IS NOT NULL AS tem_room_id
-- FROM apartamentos a
-- JOIN empreendimentos emp ON emp.id = a.empreendimento_id
-- ORDER BY emp.nome, a.numero;

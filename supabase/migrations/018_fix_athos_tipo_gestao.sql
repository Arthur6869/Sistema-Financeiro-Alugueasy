-- Corrige tipo_gestao dos apartamentos 1101 e 812 do ATHOS
-- Esses apartamentos estavam marcados como 'adm' mas são 'sub'
-- Confirmado pelo portal do proprietário e pelo padrão de diárias importadas

UPDATE apartamentos
SET tipo_gestao = 'sub'
WHERE numero IN ('1101', '812')
  AND empreendimento_id = (
    SELECT id FROM empreendimentos WHERE nome = 'ATHOS'
  );

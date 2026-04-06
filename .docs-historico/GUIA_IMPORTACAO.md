# 📌 Guia Prático — Importação dos Dados Limpos de Fevereiro

## ⚡ Resumo Executivo

Seus dados de fevereiro tinham **3 problemas críticos**:

1. ❌ **Arquivo de CUSTOS ADM tinha "JAN" em vez de "FEV"** — dados sendo atribuídos ao mês errado!
2. ❌ **409 linhas vazias** inflacionando os dados
3. ❌ **Categorias duplicadas** (Papelira vs Papeleira) fragmentando os relatórios

**Solução:** ✅ Todos os 4 arquivos foram limpos e corrigidos. Agora estão prontos para uso.

---

## 🧹 ANTES DE TUDO: Limpar Dados Antigos Incorretos

Se você já importou dados de fevereiro (e eles estavam incorretos), **execute este script primeiro**:

```bash
cd "c:\Users\arthu\OneDrive\Documentos\Sistema-Financeiro-Alugueasy"
node cleanup-database.js
```

O script irá:
1. ✅ Verificar se há dados antigos de fevereiro/2026 no banco
2. ✅ Mostrar quantos registros encontrou
3. ✅ Permitir você escolher se quer deletar ou não
4. ✅ Gerar relatório de o que foi removido

**Não apague o script — você pode usar novamente se precisar!**

---

## 🚀 Passo-a-Passo para Importar

### **Passo 1: Acessar a Página de Importação**
- Acesse seu sistema no endereço: `http://localhost:3000` (ou seu domínio)
- Clique em **"Importar"** no menu lateral (apenas admins podem acessar)
- Deve aparecer 4 cards: Custos ADM, Custos SUB, Diárias ADM, Diárias SUB

### **Passo 2: Importar Custos ADM**
1. Clique no card **"Custos ADM"**
2. Selecione o arquivo: `Dados-Fevereiro-Limpos/_  COFERENCIA DE CUSTOS - ADM - FEV.xlsx`
3. Confirme o mês = `Fevereiro` e ano = `2026`
4. Clique em **Upload**
5. ✅ Deve aparecer: `"Importação concluída com sucesso"`

### **Passo 3: Importar Custos SUB**
1. Clique no card **"Custos SUB"**
2. Selecione: `Dados-Fevereiro-Limpos/COFERENCIA DE CUSTOS - SUB - FEV.xlsx`
3. Confirme mês e ano
4. Upload ✅

### **Passo 4: Importar Diárias ADM**
1. Clique no card **"Diárias ADM"**
2. Selecione: `Dados-Fevereiro-Limpos/_  COFERENCIA DE DIARIAS - ADM - FEV.xlsx`
3. Upload ✅

### **Passo 5: Importar Diárias SUB**
1. Clique no card **"Diárias SUB"**
2. Selecione: `Dados-Fevereiro-Limpos/COFERENCIA DE DIARIAS - SUB - FEV.xlsx`
3. Upload ✅

---

## ✅ Verificação Pós-Importação

### **1. Verificar Histórico de Importações**
- Volte para a página `/importar`
- Rolei até a seção **"Histórico de Importações"**
- Deve mostrar 4 registros com status **"Concluído"**:
  - `custos_adm` | Fev/2026 | Concluído
  - `custos_sub` | Fev/2026 | Concluído
  - `diarias_adm` | Fev/2026 | Concluído
  - `diarias_sub` | Fev/2026 | Concluído

### **2. Verificar Dashboard**
- Clique em **"Dashboard"** (primeira página)
- Verifique os 4 KPIs no topo:
  - **Faturamento Total:** Deve ter valor > 0
  - **Lucro Líquido:** Faturamento - Custos
  - **Empreendimentos:** 8 (ou quantos estão ativos)
  - **Custos Totais:** Deve ter valor > 0

### **3. Visualizar Dados por Tipo**
- **/custos** → Deve mostrar linha de custos de fevereiro por categoria
- **/diarias** → Deve mostrar receitas de fevereiro por apartamento
- **/relatorio** → Gráfico e tabela com dados de fevereiro

### **4. Check de Empreendimentos**
- Acesse `/empreendimentos`
- Clique em um empreendimento (ex: ESSENCE)
- Veja a tabela de apartamentos e custos associados
- Valores devem corresponder aos arquivos importados

---

## ⚠️ Se Houver Problemas...

### **Cenário 1: Dados Ainda Aparecem Incorretos**

**Causa provável:** Dados antigos (com mês errado) ainda estão no banco

**Solução:**
1. Acesse `/custos` ou `/diarias`
2. **Procure por registros de JAN/2026** (podem estar filtrados por padrão como FEV)
3. **Delete todos os registros de fevereiro/2026** que pareçam duplicados ou incorretos
4. Re-importe usando os arquivos de `Dados-Fevereiro-Limpos/`

### **Cenário 2: Upload Falha com Erro**

**Verificar:**
- [ ] O arquivo é `.xlsx`? (não `.xls` ou `.csv`)
- [ ] O arquivo está na pasta `Dados-Fevereiro-Limpos/`?
- [ ] Você está logado como **admin**?
- [ ] O arquivo não está corrompido?

**Se persistir:** Tente re-executar a limpeza:
```bash
cd "c:\Users\arthu\OneDrive\Documentos\Sistema-Financeiro-Alugueasy"
node clean-excel-files.js
```

### **Cenário 3: Faltam Empreendimentos**

Se o sistema disser "Empreendimento não encontrado", significa que a aba do Excel não corresponde a um empreendimento registrado.

**Verificar:**
- Acesse `/empreendimentos`
- Confirme que existem: ESSENCE, EASY, CULLINAN, ATHOS, NOBILE, FUSION, RAMADA, BRISAS, etc.
- Se faltar algum, crie-o antes de importar

---

## 📊 Esperado vs Atual

### **Antes da Limpeza:**
```
❌ CUSTOS ADM tinha "JAN" em vez de "FEV"
❌ 409 linhas vazias
❌ Categorias duplicadas ("Papelira" vs "Papeleira")
❌ Dashboard mostrando dados de janeiro em fevereiro
```

### **Depois da Limpeza:**
```
✅ Todos os meses corrigidos para "FEV"
✅ Linhas vazias removidas
✅ Categorias padronizadas para "Papelaria"
✅ Dashboard mostra valores corretos de fevereiro
```

---

## 📞 Próximos Passos Recomendados

1. **Importar os 4 arquivos limpos** — Siga o guia acima
2. **Validar no Dashboard** — Veja se KPIs fazem sentido
3. **Se achar novos problemas na **página `/relatorio`** — Anote e reporte
4. **Criar backup** dos arquivos limpos em local seguro

---

## 🔗 Links Úteis

- **Dashboard:** `/`
- **Página de Importação:** `/importar`
- **Custos:** `/custos`
- **Diárias:** `/diarias`
- **Relatório:** `/relatorio`
- **Empreendimentos:** `/empreendimentos`

---

**✨ Seus dados estão prontos para importação!**

Qualquer dúvida, consulte o arquivo `RELATORIO_LIMPEZA_DADOS.md` para detalhes técnicos.

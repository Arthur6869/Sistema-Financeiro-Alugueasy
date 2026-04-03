# 🔧 COMO USAR O SCRIPT DE LIMPEZA DE DADOS

## ⚡ Resumo Rápido

Se seus dados de fevereiro aparecem **incorretos ou duplicados**, siga este guia simples.

---

## 📋 Pré-requisito

Certifique-se que seu arquivo `.env.local` tem as credenciais do Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://rlkmljeatapayiroggrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_BtRcD5i2vJm4-nAyO5Iuvg_XcXjsYRS
```

---

## 🎯 Passo-a-Passo

### **1. Abra o Terminal**
- Windows: `Windows + R` → `cmd` → Enter
- Mac: `Cmd + Espaço` → digitar `terminal` → Enter
- Linux: `Ctrl + Alt + T`

### **2. Navegue até a pasta do projeto**
```bash
cd "c:\Users\arthu\OneDrive\Documentos\Sistema-Financeiro-Alugueasy"
```

### **3. Execute o script de limpeza**
```bash
node cleanup-database.js
```

### **4. Siga as instruções na tela**

O script vai mostrar:
```
🔍 Analisando dados no banco de dados...

📊 DADOS ENCONTRADOS NO BANCO:

   ✓ Registros de CUSTOS (mes=2, ano=2026): 120
   ✓ Registros de DIÁRIAS (2026-02-*): 80
   ⚠️  Registros de CUSTOS (mes=1, ano=2026 - INCORRETOS): 45
```

Escolha uma opção:
```
1. Deletar APENAS dados incorretos (mes=1, ano=2026)
2. Deletar TODOS os dados de fevereiro/2026 (custos + diárias)
3. Visualizar dados antes de deletar
4. Cancelar (não fazer nada)

Escolha uma opção (1-4): _
```

---

## 🎯 Recomendação

**Digite 2** para deletar TODOS os dados e começar do zero com os arquivos limpos.

```
Digite: 2
```

Depois confirme:
```
Digite: SIM
```

---

## ✅ Resultado Esperado

```
✅ Limpeza completa!
   • Deletados 165 registros de CUSTOS
   • Deletados 80 registros de DIÁRIAS
   Agora importe os arquivos de Dados-Fevereiro-Limpos/
```

---

## 📚 Próximos Passos

Após limpar o banco, siga o `GUIA_IMPORTACAO.md`:

1. [x] Limpar dados antigas ← **VOCÊ ESTÁ AQUI**
2. [ ] Importar arquivos limpos
3. [ ] Validar no Dashboard
4. [ ] Conferir relatório

---

## ⚠️ Se der erro...

### Erro: "Cannot find module 'supabase'"
```bash
npm install
node cleanup-database.js
```

### Erro: "Credentials not found"
Verifique se `.env.local` tem as variáveis corretas (veja seção Pré-requisito acima)

### Erro: "Connection refused"
Aguarde alguns segundos e tente novamente. Pode ser que você está offline.

---

## 🆘 Suporte

Se algo não funcionar:
1. Anote a mensagem de erro
2. Verifique `.env.local` tem credenciais
3. Tente novamente
4. Se persistir, rode: `npm install`

---

**Pronto! Seu banco de dados será limpo e os dados estarão prontos para importação! ✨**

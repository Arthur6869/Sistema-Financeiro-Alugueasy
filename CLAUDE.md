# CLAUDE.md — AlugEasy Sistema Financeiro

> Este arquivo é lido automaticamente pelo Claude quando ele abre o projeto.
> Contém referências às regras de desenvolvimento que devem ser seguidas por qualquer agente de IA.

---

## Regras do projeto

As regras completas de arquitetura, banco de dados, rotas e padrões de código estão documentadas em:

👉 **[AGENTS.md](./AGENTS.md)**

Leia o arquivo `AGENTS.md` **antes de qualquer código** neste projeto.

---

## Documentação técnica

A documentação técnica completa do sistema (schema do banco, componentes, bugs conhecidos, pipeline de importação) está em:

👉 **[documentação.md](./documentação.md)**

---

## Resumo rápido para o agente

- Framework: **Next.js 16.2.1** com **App Router** (não Pages Router)
- Banco: **Supabase** — projeto `rlkmljeatapayiroggrp` — região `sa-east-1`
- Rota principal do dashboard: **`/`** (não `/dashboard`)
- Usuário autenticado = `createClient()` do `@/lib/supabase/server`
- Componentes client-side = `createClient()` do `@/lib/supabase/client`
- Status em `importacoes`: **`'concluido'`** ou **`'erro'`** (nunca `'sucesso'`)
- Campo tipo em `importacoes`: **`tipo`** (nunca `tipo_planilha`)

# 📄 Documentação Técnica — Sistema Financeiro AlugEasy

> **Versão:** 1.0.0-alpha  
> **Última atualização:** 27/03/2026  
> **Projeto Supabase:** `rlkmljeatapayiroggrp` — Região: `sa-east-1` (São Paulo)  
> **Build:** ✅ Compila sem erros TypeScript (Next.js 16.2.1 / Turbopack)

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estrutura de Arquivos](#4-estrutura-de-arquivos)
5. [Banco de Dados — Schema Completo](#5-banco-de-dados--schema-completo)
6. [Rotas e Páginas](#6-rotas-e-páginas)
7. [Componentes Principais](#7-componentes-principais)
8. [Variáveis de Ambiente](#8-variáveis-de-ambiente)
9. [Middleware de Autenticação](#9-middleware-de-autenticação)
10. [Pipeline de Importação de Planilhas](#10-pipeline-de-importação-de-planilhas)
11. [Controle de Acesso por Role](#11-controle-de-acesso-por-role)
12. [Bugs Conhecidos](#12-bugs-conhecidos)
13. [Como Rodar Localmente](#13-como-rodar-localmente)
14. [Governança e Segurança](#14-governança-e-segurança)

---

## 1. Visão Geral

**Objetivo:** Automatizar a ingestão, o armazenamento e a visualização do histórico financeiro (Faturamento via Diárias, Custos operacionais e Lucro Líquido) da empresa AlugEasy. O sistema substitui o controle manual em planilhas Excel isoladas por um pipeline centralizado com banco de dados relacional, dashboard interativo e controle rigoroso de acesso.

**Área Responsável:** Análise de Dados / TI Interna  
**Acesso:** Restrito — requer login com usuário previamente cadastrado no Supabase Auth  
**Dados gerenciados:** Planilhas Excel mensais de conferência (Custos ADM, Custos SUB, Diárias ADM, Diárias SUB)

---

## 2. Arquitetura do Sistema

O sistema segue uma arquitetura de três camadas:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CAMADA DE VISUALIZAÇÃO                      │
│   Browser → Next.js App Router → Componentes React + Recharts  │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP / Supabase JS SDK
┌──────────────────────────────▼──────────────────────────────────┐
│                     CAMADA DE APLICAÇÃO                         │
│   Server Components (SSR)   │   Client Components              │
│   API Route /api/import     │   proxy.ts (middleware)          │
└──────────────────────────────┬──────────────────────────────────┘
                               │ PostgreSQL via Supabase SDK
┌──────────────────────────────▼──────────────────────────────────┐
│                     CAMADA DE DADOS                             │
│   Supabase Auth (JWT + cookies)   │   PostgreSQL 17            │
│   Row Level Security (RLS)        │   6 tabelas públicas       │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Autenticação

```
Requisição HTTP
      ↓
proxy.ts (middleware)
      ↓
¿ Autenticado? ─── NÃO ──→ redirect /login
      │
     SIM
      ↓
¿ Rota é /login? ─── SIM ──→ redirect /
      │
     NÃO
      ↓
Server Component busca dados no Supabase
      ↓
Renderiza página com dados
```

---

## 3. Stack Tecnológico

| Camada | Tecnologia | Versão | Propósito |
|---|---|---|---|
| Framework | Next.js App Router | 16.2.1 | SSR, rotas, API routes |
| Linguagem | TypeScript | 5.x | Tipagem estática |
| UI Runtime | React | 19.2.4 | Renderização de interface |
| Estilização | Tailwind CSS v4 | 4.x | Classes utilitárias |
| Componentes | shadcn/ui | 4.x | Card, Badge, Table, Button, Input etc. |
| Banco de Dados | Supabase (PostgreSQL 17) | cloud | Armazenamento relacional |
| Autenticação | Supabase Auth | cloud | JWT via cookies httpOnly |
| Gráficos | Recharts | 3.8.1 | BarChart, LineChart |
| Excel | SheetJS (xlsx) | 0.18.5 | Parsing de planilhas `.xlsx` |
| Ícones | Lucide React | 1.7.0 | Ícones SVG |
| Fontes | Google Fonts — Inter | via next/font | Tipografia da interface |

---

## 4. Estrutura de Arquivos

```
Sistema-Financeiro-Alugueasy/
│
├── app/                              # Diretório principal do Next.js App Router
│   │
│   ├── (auth)/                       # Grupo de rotas públicas (sem sidebar)
│   │   └── login/
│   │       └── page.tsx              # Página de login (email + senha)
│   │
│   ├── (dashboard)/                  # Grupo de rotas protegidas (com sidebar)
│   │   ├── layout.tsx                # Layout: verifica auth → renderiza sidebar
│   │   ├── page.tsx                  # Dashboard: KPIs + gráfico de barras
│   │   ├── apartamentos/
│   │   │   └── page.tsx              # Tabela de unidades registradas
│   │   ├── custos/
│   │   │   └── page.tsx              # Tabela de despesas por período
│   │   ├── diarias/
│   │   │   └── page.tsx              # Tabela de receitas de diárias
│   │   ├── empreendimentos/
│   │   │   └── page.tsx              # Cards de empreendimentos cadastrados
│   │   ├── importar/
│   │   │   └── page.tsx              # Upload de planilhas Excel (admin only)
│   │   ├── relatorio/
│   │   │   ├── page.tsx              # Relatório: últimos 6 meses + pivot de custos
│   │   │   └── charts.tsx            # Gráfico de linha (client component)
│   │   └── usuarios/
│   │       └── page.tsx              # Lista de usuários do sistema (admin only)
│   │
│   ├── api/
│   │   └── import/
│   │       └── route.ts              # POST: recebe .xlsx, processa e grava no banco
│   │
│   ├── globals.css                   # Estilos globais + tokens CSS do Tailwind/shadcn
│   └── layout.tsx                   # Root layout: <html>, <body>, TooltipProvider
│
├── components/
│   ├── app-sidebar.tsx               # Sidebar de navegação (client component)
│   ├── dashboard-charts.tsx          # Gráfico de barras do dashboard (client component)
│   └── ui/                          # Componentes shadcn/ui: card, badge, table, button, input, tooltip...
│
├── lib/
│   ├── constants.ts                  # MESES, MESES_ABREV, ANOS, formatCurrency()
│   ├── utils.ts                      # cn() = clsx + tailwind-merge
│   └── supabase/
│       ├── client.ts                 # createBrowserClient (uso em Client Components)
│       └── server.ts                 # createServerClient (uso em Server Components e API Routes)
│
├── public/
│   └── logo-alugueasy.png            # Logo da empresa (usada no sidebar e login)
│
├── proxy.ts                          # Middleware Next.js: protege rotas com verificação de sessão
├── next.config.ts                    # Configuração do Next.js
├── tsconfig.json                     # Configuração TypeScript
├── package.json                      # Dependências e scripts npm
├── .env.local                        # Variáveis de ambiente locais (NÃO versionado)
├── .gitignore                        # Arquivos ignorados pelo Git
│
├── README.md                         # Guia de início rápido e visão geral
├── documentação.md                   # ← Este arquivo (documentação técnica completa)
├── AGENTS.md                         # Regras para agentes de IA no projeto
└── CLAUDE.md                         # Referência ao AGENTS.md para Claude
```

---

## 5. Banco de Dados — Schema Completo

O banco de dados é **PostgreSQL 17** hospedado no Supabase, projeto `rlkmljeatapayiroggrp` na região `sa-east-1`.

### 5.1 Tabela `profiles`

Estende `auth.users` do Supabase adicionando nome completo e papel (role) de cada usuário.

| Coluna | Tipo | Restrição | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK · FK → `auth.users.id` | ID espelhado do Auth |
| `full_name` | `text` | NOT NULL | Nome completo do usuário |
| `role` | `text` | CHECK: `'admin'\|'analista'` | Papel no sistema |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data de criação |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Última atualização |

**Trigger automático:** Ao criar um novo usuário no Supabase Auth, o trigger `on_auth_user_created` executa a função `handle_new_user()`, que insere automaticamente uma linha na tabela `profiles` com `role = 'analista'` como padrão.

---

### 5.2 Tabela `empreendimentos`

Representa grupos de imóveis (condomínios, edificações).

| Coluna | Tipo | Restrição | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK · DEFAULT `gen_random_uuid()` | Identificador único |
| `nome` | `text` | NOT NULL · UNIQUE | Nome do empreendimento |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data de criação |

---

### 5.3 Tabela `apartamentos`

Unidades individuais vinculadas a um empreendimento.

| Coluna | Tipo | Restrição | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK · DEFAULT `gen_random_uuid()` | Identificador único |
| `empreendimento_id` | `uuid` | FK → `empreendimentos.id` ON DELETE CASCADE | Empreendimento pai |
| `numero` | `text` | NOT NULL | Número ou código da unidade |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data de criação |

**UNIQUE:** `(empreendimento_id, numero)` — impede duplicatas de número dentro do mesmo empreendimento.

---

### 5.4 Tabela `custos`

Despesas operacionais mensais por apartamento.

| Coluna | Tipo | Restrição | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK · DEFAULT `gen_random_uuid()` | Identificador único |
| `apartamento_id` | `uuid` | FK → `apartamentos.id` ON DELETE CASCADE | Unidade de referência |
| `mes` | `integer` | CHECK: `1–12` | Mês de competência |
| `ano` | `integer` | CHECK: `>= 2020` | Ano de competência |
| `categoria` | `text` | NOT NULL | Nome da categoria (ex: "Amenitiz", "Limpeza") |
| `valor` | `numeric` | DEFAULT `0` | Valor do custo em R$ |
| `tipo_gestao` | `text` | CHECK: `'adm'\|'sub'` | Tipo de gestão do imóvel |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data de criação |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Última atualização |

> ⚠️ **Bug #8:** Sem constraint UNIQUE — reimportação da mesma planilha duplica os dados.

---

### 5.5 Tabela `diarias`

Receitas de diárias (faturamento) por apartamento.

| Coluna | Tipo | Restrição | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK · DEFAULT `gen_random_uuid()` | Identificador único |
| `apartamento_id` | `uuid` | FK → `apartamentos.id` ON DELETE CASCADE | Unidade de referência |
| `data` | `date` | NOT NULL | Data de referência (normalmente 1º do mês) |
| `valor` | `numeric` | DEFAULT `0` | Receita total de diárias em R$ |
| `tipo_gestao` | `text` | CHECK: `'adm'\|'sub'` | Tipo de gestão |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data de criação |

> ⚠️ **Bug #8:** Sem constraint UNIQUE — reimportação duplica os dados.

---

### 5.6 Tabela `importacoes`

Log de histórico de cada upload de planilha realizado.

| Coluna | Tipo | Restrição | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK · DEFAULT `gen_random_uuid()` | Identificador único |
| `tipo` | `text` | CHECK: `'custos_adm'\|'custos_sub'\|'diarias_adm'\|'diarias_sub'` | Tipo da planilha importada |
| `mes` | `integer` | NOT NULL | Mês de competência da planilha |
| `ano` | `integer` | NOT NULL | Ano de competência da planilha |
| `nome_arquivo` | `text` | NOT NULL | Nome original do arquivo `.xlsx` |
| `status` | `text` | CHECK: `'concluido'\|'erro'` · DEFAULT `'concluido'` | Resultado da importação |
| `importado_por` | `uuid` | FK → `auth.users.id` · nullable | UUID do usuário que fez o upload |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data/hora da importação |

---

### 5.7 Políticas de Row Level Security (RLS)

RLS está **habilitado em todas as 6 tabelas**. As políticas garantem que dados financeiros sejam sempre acessados com autenticação.

| Tabela | Ação | Quem pode executar |
|---|---|---|
| `profiles` | SELECT | Próprio usuário **ou** qualquer admin |
| `profiles` | UPDATE | Apenas admins |
| `empreendimentos` | SELECT | Qualquer usuário autenticado |
| `empreendimentos` | INSERT / UPDATE / DELETE | Apenas admins |
| `apartamentos` | SELECT | Qualquer usuário autenticado |
| `apartamentos` | INSERT / UPDATE / DELETE | Apenas admins |
| `custos` | SELECT | Qualquer usuário autenticado |
| `custos` | INSERT / UPDATE / DELETE | Apenas admins |
| `diarias` | SELECT | Qualquer usuário autenticado |
| `diarias` | INSERT / UPDATE / DELETE | Apenas admins |
| `importacoes` | SELECT | Qualquer usuário autenticado |
| `importacoes` | INSERT / UPDATE / DELETE | Apenas admins |

---

## 6. Rotas e Páginas

### 6.1 Rotas Públicas (sem autenticação)

| Rota | Arquivo | Descrição |
|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` | Formulário de autenticação. Após login bem-sucedido, redireciona para `/` |

### 6.2 Rotas Protegidas (exigem usuário autenticado)

| Rota | Arquivo | Acesso | Descrição |
|---|---|---|---|
| `/` | `(dashboard)/page.tsx` | Todos | Dashboard com 4 KPIs (Faturamento, Lucro, Empreendimentos, Custos) e gráfico por empreendimento |
| `/empreendimentos` | `(dashboard)/empreendimentos/page.tsx` | Todos | Cards com nome e contagem de apartamentos por empreendimento |
| `/apartamentos` | `(dashboard)/apartamentos/page.tsx` | Todos | Tabela com número, empreendimento e data de cadastro de cada unidade |
| `/custos` | `(dashboard)/custos/page.tsx` | Todos | Tabela com período, imóvel, categoria, tipo de gestão e valor de cada custo |
| `/diarias` | `(dashboard)/diarias/page.tsx` | Todos | Tabela com data, imóvel, tipo de gestão e valor de cada receita |
| `/relatorio` | `(dashboard)/relatorio/page.tsx` | Todos | KPIs ADM vs SUB + gráfico de linha (6 meses) + tabela pivot Categoria × Mês |
| `/importar` | `(dashboard)/importar/page.tsx` | **Admin only** | 4 cards de upload (Custos ADM/SUB, Diárias ADM/SUB) + histórico de importações |
| `/usuarios` | `(dashboard)/usuarios/page.tsx` | **Admin only** | Tabela de usuários com nome, role e data de cadastro |

### 6.3 API Routes (backend)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/import` | Recebe arquivo `.xlsx` via FormData, processa e grava dados no banco |

**Parâmetros esperados no FormData:**

| Campo | Tipo | Valores aceitos |
|---|---|---|
| `file` | `File` | Arquivo `.xlsx` |
| `tipo` | `string` | `custos_adm` · `custos_sub` · `diarias_adm` · `diarias_sub` |
| `mes` | `string` | `1` a `12` *(atualmente ignorado — hardcoded no servidor)* |
| `ano` | `string` | Ex: `2026` *(atualmente ignorado — hardcoded no servidor)* |

---

## 7. Componentes Principais

### `AppSidebar` — `components/app-sidebar.tsx`

**Tipo:** Client Component  
**Props:** `role: string`, `fullName: string`, `email: string`

Renderiza a barra lateral de navegação com:
- Logo da AlugEasy no topo
- Menu principal: Dashboard, Empreendimentos, Apartamentos, Custos, Diárias
- Seção "Administração" visível **apenas para admins**: Importar e Usuários
- Rodapé com avatar (inicial do nome), badge de role e botão de logout

O item ativo é detectado via `usePathname()`. O logout chama `supabase.auth.signOut()` e redireciona para `/login`.

---

### `DashboardCharts` — `components/dashboard-charts.tsx`

**Tipo:** Client Component  
**Props:** `data: { empreendimento: string; faturamento: number; lucro: number }[]`

Gráfico de barras agrupadas (Recharts `BarChart`) comparando Faturamento e Lucro por empreendimento, para o período exibido no dashboard.

---

### `RelatorioLineChart` — `app/(dashboard)/relatorio/charts.tsx`

**Tipo:** Client Component  
**Props:** `data: { label: string; faturamento: number; custos: number; lucro: number }[]`

Gráfico de linhas (Recharts `LineChart`) com 3 séries:
- 🔵 Faturamento (`#193660`)
- 🔴 Custos (`#ef4444`)
- 🟢 Lucro (`#22c55e`)

Exibe evolução dos últimos 6 meses no Relatório Analítico.

---

## 8. Variáveis de Ambiente

Arquivo: `.env.local` (na raiz do projeto — **não comitar no Git**)

```env
NEXT_PUBLIC_SUPABASE_URL=https://rlkmljeatapayiroggrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_BtRcD5i2vJm4-nAyO5Iuvg_XcXjsYRS
```

> ⚠️ **Atenção:** O arquivo atual tem espaços em branco no final de cada linha. Isso pode causar falhas silenciosas de conexão em alguns ambientes de deploy (Vercel, Railway). Remover os espaços.

---

## 9. Middleware de Autenticação

**Arquivo:** `proxy.ts` (raiz do projeto)

O middleware intercepta **todas** as requisições antes de chegarem às páginas. Utiliza o `@supabase/ssr` para verificar a sessão a partir dos cookies da requisição.

**Rotas excluídas do middleware** (matcher):
- `_next/static` e `_next/image` (assets internos do Next.js)
- `favicon.ico` e `logo-alugueasy.png` (arquivos públicos)
- `api/import` (a API route cuida sua própria segurança — *atualmente não cuida, bug #5*)
- Arquivos com extensão de imagem (`.png`, `.jpg`, `.svg`, etc.)

**Lógica de redirecionamento:**

```
/login + usuário autenticado  →  redirect para /
Qualquer rota + não autenticado  →  redirect para /login
Demais casos  →  passa normalmente
```

> ⚠️ **Nota:** O arquivo está nomeado `proxy.ts`. O Next.js procura por `middleware.ts` automaticamente. Verificar se existe um `middleware.ts` que importa e re-exporta este arquivo.

---

## 10. Pipeline de Importação de Planilhas

### Formato das planilhas Excel

As planilhas seguem o padrão de **colunas em pares**: número do apartamento e descição/valor alternados.

**Planilhas de Custos (`custos_adm`, `custos_sub`):**
```
| 101   | Descrição | 102   | Descrição | 103   | ...
|-------|-----------|-------|-----------|-------|
| 30.00 | Amenitiz  | 30.00 | Amenitiz  | 25.00 |
| 15.00 | Limpeza   | 20.00 | Limpeza   | 18.00 |
```

**Planilhas de Diárias (`diarias_adm`, `diarias_sub`):**
```
| 101      | (vazio) | 102      | (vazio) |
|----------|---------|----------|---------|
| 1500.00  |         | 2200.00  |         |
```

### Processamento na API (`/api/import`)

1. **Recebe** o arquivo via `FormData`
2. **Lê o buffer** com `XLSX.read()` e converte para array 2D com `sheet_to_json`
3. **Garante empreendimento padrão** `"Residencial AlugEasy"` (cria se não existir)
4. **Percorre colunas** em pares (`col = 0, 2, 4, ...`)
5. **Garante apartamento** — cria se não existir com `maybeSingle()` + insert
6. **Para custos:** percorre linhas da linha 1 em diante, extrai valor numérico e categoria
7. **Para diárias:** lê apenas a linha 1 (valor total do mês)
8. **Registra** na tabela `importacoes` com resultado da operação

### Tipos de planilha e what they write

| `tipo` | `tipo_gestao` gravado | Tabela destino |
|---|---|---|
| `custos_adm` | `'adm'` | `custos` |
| `custos_sub` | `'sub'` | `custos` |
| `diarias_adm` | `'adm'` | `diarias` |
| `diarias_sub` | `'sub'` | `diarias` |

---

## 11. Controle de Acesso por Role

| Funcionalidade | `admin` | `analista` |
|---|---|---|
| Visualizar Dashboard (`/`) | ✅ | ✅ |
| Ver Empreendimentos | ✅ | ✅ |
| Ver Apartamentos | ✅ | ✅ |
| Ver Custos | ✅ | ✅ |
| Ver Diárias | ✅ | ✅ |
| Ver Relatório Analítico | ✅ | ✅ |
| Importar Planilhas | ✅ | ❌ (rota protegida pelo sidebar) |
| Ver Usuários | ✅ | ❌ (redirect para `/` no servidor) |
| Escrever no banco (via RLS) | ✅ | ❌ |

---

## 12. Bugs Conhecidos

> Todos os problemas abaixo foram identificados em análise técnica de 27/03/2026 e **ainda não foram corrigidos**.

| # | Severidade | Descrição | Arquivo |
|---|---|---|---|
| B1 | 🔴 Crítico | Código usa `tipo_planilha` e `status: 'sucesso'` — campos/valores inválidos na tabela `importacoes` (deve ser `tipo` e `status: 'concluido'`). Toda importação falha ao registrar o log. | `api/import/route.ts` L112 |
| B2 | 🔴 Crítico | `mes` e `ano` hardcoded como `1` e `2026`. Sistema impossível de usar em outros meses. | `api/import/route.ts` L43-45 |
| B3 | 🔴 Crítico | Após login, redireciona para `/dashboard` que não existe — gera erro 404. Deveria ir para `/`. | `login/page.tsx` L35 |
| B4 | 🔴 Crítico | Analistas que tentam acessar `/usuarios` são redirecionados para `/dashboard` (404). Deveria redirecionar para `/`. | `usuarios/page.tsx` L27 |
| B5 | 🔴 Segurança | Rota `/api/import` está excluída do middleware e não verifica autenticação internamente — endpoint público que aceita dados de qualquer origem. | `proxy.ts` L50 + `route.ts` |
| B6 | 🟠 Alto | Dashboard, Custos e Diárias filtram dados fixos de Janeiro/2026. Sem filtro dinâmico por período. | `page.tsx`, `custos/page.tsx`, `diarias/page.tsx` |
| B7 | 🟠 Alto | Página de Importar inicializa `historico` como array vazio e nunca busca dados reais da tabela `importacoes`. | `importar/page.tsx` L61 |
| B8 | 🟠 Alto | Tabelas `custos` e `diarias` sem constraint UNIQUE. Reimportar a mesma planilha duplica todos os registros sem aviso. | Banco de dados |
| B9 | 🔴 Segurança | Função `handle_new_user()` sem `SET search_path = public` — vulnerável a search_path injection (aviso oficial do Supabase). | Supabase / trigger |
| B10 | 🟡 Médio | Arquivo `.env.local` tem espaços em branco no final das variáveis — pode quebrar conexão em deploy. | `.env.local` |

---

## 13. Como Rodar Localmente

```bash
# 1. Clonar o repositório
git clone <url-do-repositorio>

# 2. Entrar na pasta
cd Sistema-Financeiro-Alugueasy

# 3. Instalar dependências
npm install

# 4. Configurar variáveis de ambiente
# Criar .env.local com as credenciais do Supabase

# 5. Iniciar servidor de desenvolvimento
npm run dev
# Acesse: http://localhost:3000

# 6. Build de produção (verificação)
npm run build

# 7. Rodar produção local
npm start
```

**Credenciais de acesso** (solicitar ao administrador):
- E-mail e senha de um usuário cadastrado no Supabase Auth deste projeto

---

## 14. Governança e Segurança

### Autenticação
- Supabase Auth com email/senha
- Tokens JWT armazenados em cookies httpOnly gerenciados pelo `@supabase/ssr`
- Sessão validada em cada requisição pelo middleware

### Autorização
- **Row Level Security (RLS):** Ativo em todas as 6 tabelas. Nenhum dado pode ser lido ou modificado sem sessão válida.
- **Roles:** Dois perfis — `admin` (leitura e escrita) e `analista` (somente leitura)
- **Verificação dupla:** Controle no frontend (sidebar/redirect) **e** no banco (RLS)

### Backups
- Backup automático nativo do Supabase (plano free: retenção diária)
- Recomendado: arquivar planilhas originais `.xlsx` mensalmente em local seguro

### Dados sensíveis
- Dados financeiros reais — acesso restrito a usuários cadastrados
- Chave Anon Key é pública por design (prefixo `NEXT_PUBLIC_`) mas sem permissões de escrita para a role `anon`
- Service Role Key **não é utilizada** no frontend — nunca expor

---

> **REGRA:** Esta documentação deve ser atualizada **sempre** que houver mudanças no schema do banco, novas rotas, alterações de regras de negócio ou correções de bugs.
# Documentação Técnica — Sistema Financeiro AlugEasy

> **Versão:** 2.2.0
> **Última atualização:** 28/04/2026 (auditoria completa de implementação)
> **Projeto Supabase:** `rlkmljeatapayiroggrp` — Região: `sa-east-1` (São Paulo)
> **Build:** Next.js 16.2.1 / Turbopack — compilação TypeScript sem erros

> Última consolidação: abril/2026 — absorveu SISTEMA_COMPLETO.md,
> DASHBOARD_AMENITIZ_UPDATES.md, ANALISE-SISTEMA-MCP.md, CONTEXT.md,
> estrutura-projeto.md

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Estrutura de Arquivos](#4-estrutura-de-arquivos)
5. [Banco de Dados — Schema Completo](#5-banco-de-dados--schema-completo)
6. [Rotas e Páginas](#6-rotas-e-páginas)
7. [Componentes Principais](#7-componentes-principais)
8. [API Routes](#8-api-routes)
9. [Pipeline de Importação de Planilhas](#9-pipeline-de-importação-de-planilhas)
10. [Controle de Acesso por Role](#10-controle-de-acesso-por-role)
11. [Variáveis de Ambiente](#11-variáveis-de-ambiente)
12. [Middleware de Autenticação](#12-middleware-de-autenticação)
13. [Bugs Conhecidos](#13-bugs-conhecidos)
14. [Como Rodar Localmente](#14-como-rodar-localmente)
15. [Governança e Segurança](#15-governança-e-segurança)

---

## 1. Visão Geral

**Objetivo:** Automatizar a ingestão, o armazenamento e a visualização do histórico financeiro (Faturamento via Diárias, Custos operacionais e Lucro Líquido) da empresa AlugEasy. O sistema substitui o controle manual em planilhas Excel isoladas por um pipeline centralizado com banco de dados relacional, dashboard interativo e controle rigoroso de acesso.

**Área Responsável:** Análise de Dados / TI Interna
**Acesso:** Restrito — requer login com usuário previamente cadastrado no Supabase Auth
**Dados gerenciados:** Planilhas Excel mensais de conferência (Custos ADM, Custos SUB, Diárias ADM, Diárias SUB)

### O que o sistema faz atualmente

- Importa planilhas Excel mensais de 4 tipos: Custos ADM, Custos SUB, Diárias ADM, Diárias SUB
- Armazena dados por empreendimento e apartamento no Supabase
- Exibe dashboard com KPIs financeiros filtráveis por mês/ano
- Apresenta relatório analítico dos últimos 6 meses com gráficos
- Controla usuários com dois perfis: admin (leitura e escrita) e analista (somente leitura)
- Permite exportação de dados para planilhas (XLSX)
- Gerencia empreendimentos e apartamentos com criação e exclusão

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
│   API Routes /api/*         │   proxy.ts (middleware)          │
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
| Componentes | shadcn/ui | 4.x | Card, Badge, Table, Button etc. |
| Banco de Dados | Supabase (PostgreSQL 17) | cloud | Armazenamento relacional |
| Autenticação | Supabase Auth | cloud | JWT via cookies httpOnly |
| Gráficos | Recharts | 3.8.1 | BarChart, LineChart |
| Excel (importação) | SheetJS (xlsx) | 0.18.5 | Parsing de planilhas `.xlsx` |
| Excel (exportação) | SheetJS (xlsx) | 0.18.5 | Geração de planilhas `.xlsx` |
| PDF | @react-pdf/renderer | latest | Geração de PDFs server-side |
| Ícones | Lucide React | 1.7.0 | Ícones SVG |
| Fontes | Google Fonts — Inter | via next/font | Tipografia da interface |
| Forms | React Hook Form | 7.72.0 | Gerenciamento de formulários |
| Validação | Zod | 4.3.6 | Validação de schemas |

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
│   │   ├── page.tsx                  # Dashboard: 4 KPIs + gráfico de barras
│   │   ├── apartamentos/
│   │   │   └── page.tsx              # Redireciona para /empreendimentos
│   │   ├── custos/
│   │   │   └── page.tsx              # Tabela de despesas com filtro mês/ano
│   │   ├── diarias/
│   │   │   └── page.tsx              # Tabela de receitas com filtro mês/ano
│   │   ├── empreendimentos/
│   │   │   └── page.tsx              # Visão detalhada por empreendimento (tabs)
│   │   ├── importar/
│   │   │   └── page.tsx              # Upload de planilhas Excel (admin only)
│   │   ├── relatorio/
│   │   │   ├── page.tsx              # Relatório: últimos 6 meses + pivot de custos
│   │   │   └── charts.tsx            # Gráfico de linha (client component)
│   │   └── usuarios/
│   │       └── page.tsx              # Lista de usuários do sistema (admin only)
│   │
│   ├── api/
│   │   ├── import/
│   │   │   └── route.ts              # POST: recebe .xlsx, processa e grava no banco
│   │   └── clear/
│   │       └── route.ts              # DELETE: limpa dados de um período (mês/ano)
│   │
│   ├── globals.css                   # Estilos globais + tokens CSS do Tailwind/shadcn
│   └── layout.tsx                    # Root layout: <html>, <body>, TooltipProvider
│
├── components/
│   ├── layout/
│   │   └── app-sidebar.tsx           # Sidebar de navegação (client component)
│   ├── charts/
│   │   ├── dashboard-charts.tsx      # Gráfico de barras do dashboard
│   │   ├── empreendimentos-list-charts.tsx  # Gráfico da lista de empreendimentos
│   │   ├── empreendimento-detail-charts.tsx # Gráfico de detalhe por empreendimento
│   │   └── apartamento-charts.tsx    # Gráfico por apartamento
│   ├── modals/
│   │   ├── criar-empreendimento-modal.tsx   # Modal de criação de empreendimento
│   │   └── criar-apartamento-modal.tsx      # Modal de criação de apartamento
│   ├── shared/
│   │   ├── month-year-filter.tsx     # Seletor de mês/ano (client component)
│   │   ├── delete-button.tsx         # Botão de exclusão com confirmação
│   │   └── limpar-dados-button.tsx   # Botão para limpar dados de um período
│   └── ui/                           # Componentes shadcn/ui
│       ├── card.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── table.tsx
│       ├── avatar.tsx
│       ├── dropdown-menu.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── sidebar.tsx
│       ├── skeleton.tsx
│       ├── tooltip.tsx
│       └── chart.tsx
│
├── hooks/
│   └── use-mobile.ts                 # Hook para detectar breakpoint mobile
│
├── lib/
│   ├── constants.ts                  # MESES, MESES_ABREV, ANOS, formatCurrency()
│   ├── utils.ts                      # cn() = clsx + tailwind-merge
│   └── supabase/
│       ├── client.ts                 # createBrowserClient (Client Components)
│       └── server.ts                 # createServerClient (Server Components e API Routes)
│
├── public/
│   └── logo-alugueasy.png            # Logo da empresa
│
├── proxy.ts                          # Middleware Next.js: protege rotas com verificação de sessão
├── next.config.ts                    # Configuração do Next.js
├── tsconfig.json                     # Configuração TypeScript
├── components.json                   # Configuração shadcn/ui
├── package.json                      # Dependências e scripts npm
├── .env.local                        # Variáveis de ambiente (NÃO versionado)
├── .gitignore
│
├── README.md                         # Guia de início rápido
├── documentação.md                   # Este arquivo — documentação técnica completa
├── AGENTS.md                         # Regras para agentes de IA no projeto
└── CLAUDE.md                         # Referência ao AGENTS.md para Claude Code
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
| `role` | `text` | CHECK: `'admin'|'analista'` | Papel no sistema |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data de criação |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Última atualização |

**Trigger automático:** `on_auth_user_created` executa `handle_new_user()` ao criar usuário no Auth, inserindo automaticamente uma linha em `profiles` com `role = 'analista'` como padrão.

> ⚠️ **Bug #9 (Segurança):** A função `handle_new_user()` não tem `SET search_path = public` — vulnerável a search_path injection (aviso oficial do Supabase).

---

### 5.2 Tabela `empreendimentos`

Representa grupos de imóveis (condomínios, edificações).

| Coluna | Tipo | Restrição | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK · DEFAULT `gen_random_uuid()` | Identificador único |
| `nome` | `text` | NOT NULL · UNIQUE | Nome do empreendimento |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data de criação |

**Empreendimentos suportados na importação:** ESSENCE, EASY, CULLINAN, ATHOS, NOBILE, FUSION, MERCURE, METROPOLITAN, RAMADA, BRISAS, VISION

---

### 5.3 Tabela `apartamentos`

Unidades individuais vinculadas a um empreendimento.

| Coluna | Tipo | Restrição | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK · DEFAULT `gen_random_uuid()` | Identificador único |
| `empreendimento_id` | `uuid` | FK → `empreendimentos.id` ON DELETE CASCADE | Empreendimento pai |
| `numero` | `text` | NOT NULL | Número ou código da unidade |
| `taxa_repasse` | `numeric` | DEFAULT 0 | Percentual de repasse (ex: 15 para 15%) |
| `tipo_repasse` | `text` | CHECK: 'lucro'|'faturamento' | Base de cálculo do repasse |
| `nome_proprietario` | `text` | nullable | Nome do proprietário para o PDF |
| `modelo_contrato` | `text` | CHECK: 'administracao'|'sublocacao' | Modelo do contrato |
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
| `tipo_gestao` | `text` | CHECK: `'adm'|'sub'` | Tipo de gestão do imóvel |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data de criação |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Última atualização |

> ⚠️ **Bug #8:** Sem constraint UNIQUE — reimportação da mesma planilha duplica os dados. A API faz DELETE antes do INSERT para mitigar, mas não é uma solução completa.

---

### 5.5 Tabela `diarias`

Receitas de diárias (faturamento) por apartamento.

| Coluna | Tipo | Restrição | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK · DEFAULT `gen_random_uuid()` | Identificador único |
| `apartamento_id` | `uuid` | FK → `apartamentos.id` ON DELETE CASCADE | Unidade de referência |
| `data` | `date` | NOT NULL | Data de referência (normalmente 1º do mês) |
| `valor` | `numeric` | DEFAULT `0` | Receita total de diárias em R$ |
| `tipo_gestao` | `text` | CHECK: `'adm'|'sub'` | Tipo de gestão |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data de criação |

> ⚠️ **Bug #8:** Sem constraint UNIQUE — mesmo risco de duplicação da tabela `custos`.

---

### 5.6 Tabela `importacoes`

Log de histórico de cada upload de planilha realizado.

| Coluna | Tipo | Restrição | Descrição |
|---|---|---|---|
| `id` | `uuid` | PK · DEFAULT `gen_random_uuid()` | Identificador único |
| `tipo` | `text` | CHECK: `'custos_adm'|'custos_sub'|'diarias_adm'|'diarias_sub'` | Tipo da planilha |
| `mes` | `integer` | NOT NULL | Mês de competência da planilha |
| `ano` | `integer` | NOT NULL | Ano de competência da planilha |
| `nome_arquivo` | `text` | NOT NULL | Nome original do arquivo `.xlsx` |
| `status` | `text` | CHECK: `'concluido'|'erro'` · DEFAULT `'concluido'` | Resultado da importação |
| `importado_por` | `uuid` | FK → `auth.users.id` · nullable | UUID do usuário que fez o upload |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data/hora da importação |

> **Atenção:** Os valores válidos são **`'concluido'`** e **`'erro'`** — nunca `'sucesso'`. O campo é **`tipo`** — nunca `tipo_planilha`.

---

### 5.7 Políticas de Row Level Security (RLS)

RLS está **habilitado em todas as 6 tabelas**.

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

### 6.1 Rotas Públicas

| Rota | Arquivo | Descrição |
|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` | Formulário email + senha. Redireciona para `/` após login bem-sucedido. Valida variáveis de ambiente. |

### 6.2 Rotas Protegidas

| Rota | Arquivo | Acesso | Descrição |
|---|---|---|---|
| `/` | `(dashboard)/page.tsx` | Todos | Dashboard principal com 4 KPIs, gráfico de barras por empreendimento, cards de detalhe. Filtrável por mês/ano via searchParams. |
| `/empreendimentos` | `(dashboard)/empreendimentos/page.tsx` | Todos | Visão em tabs: lista de empreendimentos com métricas financeiras e detalhe por empreendimento com apartamentos. Criação e exclusão de empreendimentos e apartamentos. |
| `/apartamentos` | `(dashboard)/apartamentos/page.tsx` | Todos | Redireciona para `/empreendimentos`. |
| `/custos` | `(dashboard)/custos/page.tsx` | Todos | Tabela de despesas filtrável por mês/ano. Colunas: Imóvel, Categoria, Gestão (ADM/SUB), Valor. |
| `/diarias` | `(dashboard)/diarias/page.tsx` | Todos | Tabela de receitas filtrável por mês/ano. Colunas: Data, Imóvel, Gestão (ADM/SUB), Valor. |
| `/relatorio` | `(dashboard)/relatorio/page.tsx` | Todos | Relatório analítico: últimos 6 meses automáticos, gráfico de linha (Faturamento/Custos/Lucro), tabela pivot (Categorias × Meses), KPIs ADM vs SUB. |
| `/prestacao-contas` | `(dashboard)/prestacao-contas/page.tsx` | Todos | Visualização de prestação de contas por apartamento com geração de PDF |
| `/importar` | `(dashboard)/importar/page.tsx` | **Admin only** | Upload de planilhas Excel em 4 tipos. Histórico de importações buscado do banco. |
| `/usuarios` | `(dashboard)/usuarios/page.tsx` | **Admin only** | Lista de todos os usuários com nome, role e data de cadastro. |

### 6.3 Detalhes das Páginas

#### Dashboard (`/`)

**Tipo:** Server Component com `searchParams`

KPIs exibidos:
- **Faturamento Total** — soma de `diarias.valor` para o período
- **Custos Totais** — soma de `custos.valor` para o período
- **Lucro Líquido** — Faturamento − Custos
- **Margem (%)** — (Lucro / Faturamento) × 100

Seções:
- Filtro de mês/ano (MonthYearFilter)
- 4 cards KPI
- Gráfico de barras (Faturamento e Lucro por empreendimento)
- Cards de detalhe por empreendimento
- Botão "Limpar Dados" (admin only)

#### Empreendimentos (`/empreendimentos`)

**Tipo:** Server Component — arquivo extenso (~11k+ linhas)

Funcionalidades:
- Toggle de visualização: Lista / Detalhe
- **Visão Lista:** Cards por empreendimento com Faturamento, Custos, Lucro, contagem de apartamentos
- **Visão Detalhe:** Para cada empreendimento: breakdown ADM/SUB, tabela de apartamentos com métricas individuais, gráficos
- Modal "Criar Empreendimento" (admin only)
- Modal "Criar Apartamento" (admin only)
- Botão de exclusão de empreendimento com cascata (admin only)
- Botão de exclusão de apartamento (admin only)

#### Relatório (`/relatorio`)

**Tipo:** Server Component

Calcula automaticamente os últimos 6 meses a partir da data atual. Para cada mês:
- Faturamento total (ADM + SUB)
- Custos totais (ADM + SUB)
- Lucro Líquido

Também exibe:
- KPIs separados ADM vs SUB
- Tabela pivot: Categoria de custo × Mês (últimos 6 meses)
- Gráfico de linha com 3 séries

#### Importar (`/importar`)

**Tipo:** Server Component (verificação admin) + lógica Client

- 4 cards de upload: Custos ADM, Custos SUB, Diárias ADM, Diárias SUB
- Cada card tem: seletor de mês, seletor de ano, input de arquivo `.xlsx`, botão enviar
- Histórico de importações buscado da tabela `importacoes`
- Botão de exclusão de registro do histórico

---

## 7. Componentes Principais

### `AppSidebar` — `components/layout/app-sidebar.tsx`

**Tipo:** Client Component
**Props:** `role: string`, `fullName: string`, `email: string`

Barra lateral colapsível com:
- Logo AlugEasy no topo
- Itens de navegação: Dashboard, Empreendimentos, Custos, Diárias, Relatório
- Seção "Administração" (apenas admins): Importar, Usuários
- Rodapé com avatar, badge de role, botão de logout
- Detecção de rota ativa via `usePathname()`
- Logout via `supabase.auth.signOut()` → redirect `/login`

---

### `DashboardCharts` — `components/charts/dashboard-charts.tsx`

**Tipo:** Client Component
**Props:** `data: { empreendimento: string; faturamento: number; lucro: number }[]`

Gráfico de barras agrupadas (Recharts `BarChart`):
- Barra azul: Faturamento (`#193660`)
- Barra verde: Lucro (`#22c55e`)
- Exibe comparativo por empreendimento para o período filtrado

---

### `RelatorioLineChart` — `app/(dashboard)/relatorio/charts.tsx`

**Tipo:** Client Component
**Props:** `data: { label: string; faturamento: number; custos: number; lucro: number }[]`

Gráfico de linhas (Recharts `LineChart`) com 3 séries:
- Faturamento — azul `#193660`
- Custos — vermelho `#ef4444`
- Lucro — verde `#22c55e`

---

### `MonthYearFilter` — `components/shared/month-year-filter.tsx`

**Tipo:** Client Component
**Props:** `mes: number`, `ano: number`

Dois dropdowns (mês e ano) que atualizam os `searchParams` da URL via `useRouter` / `usePathname` / `useSearchParams`, forçando re-renderização do Server Component pai com os novos valores.

---

### `DeleteButton` — `components/shared/delete-button.tsx`

**Tipo:** Client Component
**Props:** `table: 'empreendimentos' | 'apartamentos'`, `id: string`, `label: string`

Ícone de lixeira que abre confirmação antes de deletar. Executa `supabase.from(table).delete()` via cliente browser. Chama `router.refresh()` após sucesso.

---

### `LimparDadosButton` — `components/shared/limpar-dados-button.tsx`

**Tipo:** Client Component
**Props:** `mes: number`, `ano: number`

Chama `DELETE /api/clear?mes={mes}&ano={ano}`. Retorna alerta com contagem de registros deletados. Visível apenas quando `mes > 0` e `ano > 0`.

---

### `CriarEmpreendimentoModal` — `components/modals/criar-empreendimento-modal.tsx`

**Tipo:** Client Component

Modal com input de nome. Insere na tabela `empreendimentos` via `supabase.from().insert()`. Chama `router.refresh()` ao confirmar.

---

### `CriarApartamentoModal` — `components/modals/criar-apartamento-modal.tsx`

**Tipo:** Client Component

Modal para criação de apartamento associado a um empreendimento. Campos: número do apartamento, empreendimento_id (implícito pelo contexto). Insere na tabela `apartamentos`.

---

### Componentes shadcn/ui disponíveis

`Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`, `Badge`, `Button`, `Input`, `Label`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `Tooltip`, `TooltipContent`, `TooltipTrigger`, `TooltipProvider`, `Avatar`, `AvatarFallback`, `DropdownMenu`, `Separator`, `Sheet`, `Sidebar`, `Skeleton`

---

## 8. API Routes

### POST `/api/import`

**Arquivo:** `app/api/import/route.ts`

Recebe planilha Excel, processa e grava dados financeiros no banco.

**Autenticação:** Verifica sessão via `supabase.auth.getUser()`. Retorna 401 se não autenticado. Verifica `role === 'admin'` no profile. Retorna 403 se não admin.

**FormData esperado:**

| Campo | Tipo | Descrição |
|---|---|---|
| `file` | `File` | Arquivo `.xlsx` ou `.csv` |
| `tipo` | `string` | `custos_adm`, `custos_sub`, `diarias_adm` ou `diarias_sub` |
| `mes` | `string` | Número do mês (`1`–`12`) |
| `ano` | `string` | Ano (ex: `2026`) |

**Resposta de sucesso:**
```json
{
  "success": true,
  "tipo": "custos_adm",
  "mes": 3,
  "ano": 2026,
  "arquivo": "custos-marco-2026.xlsx",
  "registros": 42
}
```

**Lógica de deduplicação:** Antes de inserir, executa DELETE dos registros existentes para `(mes, ano, tipo_gestao)`, evitando duplicação por reimportação.

---

### GET `/api/prestacao-contas-pdf`

**Arquivo:** `app/api/prestacao-contas-pdf/route.ts`

Gera PDF de prestação de contas para um apartamento/período. Verifica autenticação e retorna o PDF com headers de download.

### DELETE `/api/clear`

**Arquivo:** `app/api/clear/route.ts`

Limpa todos os dados financeiros de um período (mês + ano).

**Autenticação:** Mesma verificação de autenticação e role admin do `/api/import`.

**Query params:** `mes` e `ano` (ambos obrigatórios)

**Exemplo:** `DELETE /api/clear?mes=3&ano=2026`

**O que deleta:**
1. Registros em `diarias` onde `data` está dentro do mês/ano informado
2. Registros em `custos` onde `mes` e `ano` coincidem
3. Registros em `importacoes` onde `mes` e `ano` coincidem

**Resposta:**
```json
{
  "success": true,
  "removed": {
    "diarias": 38,
    "custos": 55,
    "importacoes": 4
  }
}
```

### POST `/api/obsidian/sync`

**Arquivo:** `app/api/obsidian/sync/route.ts`

Sincroniza contexto técnico do projeto para uma nota no Obsidian local (API em `https://127.0.0.1:27124` por padrão).

**Autenticação:**
- Usuário logado com `role = 'analista'`, ou
- Chamada interna com header `x-alugueasy-internal-key` válido (`ALUGUEASY_INTERNAL_API_KEY`)

**Body JSON (opcional):**

| Campo | Tipo | Descrição |
|---|---|---|
| `notePath` | `string` | Caminho relativo da nota no vault (padrão: `AlugEasy/Sistema-Financeiro-Contexto.md`) |
| `includeFiles` | `string[]` | Lista de arquivos do projeto para embutir no contexto |

**Exemplo:**
```json
{
  "notePath": "AlugEasy/Contexto-MCP.md",
  "includeFiles": ["README.md", "AGENTS.md", "documentação.md"]
}
```

**Resposta de sucesso:**
```json
{
  "success": true,
  "message": "Contexto sincronizado com Obsidian com sucesso.",
  "notePath": "AlugEasy/Contexto-MCP.md",
  "apiBase": "https://127.0.0.1:27124",
  "filesIncluded": ["README.md", "AGENTS.md", "documentação.md"],
  "charsSent": 124532
}
```

---

## 9. Pipeline de Importação de Planilhas

### Formato das planilhas de Custos

Cada sheet da planilha corresponde a um empreendimento. O processamento busca a linha que contém `TOTAL:` para extrair o valor total do empreendimento.

```
Sheet: "ESSENCE"
| Categoria   | Valor   | ...
|-------------|---------|
| Amenitiz    | 30.00   |
| Limpeza     | 45.00   |
| TOTAL:      | 75.00   |  ← linha extraída
```

### Formato das planilhas de Diárias

A planilha contém um sheet chamado `"RESULTADO"`. O processamento percorre as linhas buscando o valor `FAT` associado ao nome do empreendimento.

```
Sheet: "RESULTADO"
| Empreendimento | FAT     | ...
|----------------|---------|
| ESSENCE        | 1500.00 |
| EASY           | 2200.00 |
```

### Empreendimentos reconhecidos na importação

```
ESSENCE, EASY, CULLINAN, ATHOS, NOBILE, FUSION,
MERCURE, METROPOLITAN, RAMADA, BRISAS, VISION
```

O parser faz matching por nome (case insensitive) entre o nome na planilha e os empreendimentos cadastrados no banco.

### Fluxo completo de importação

```
1. Admin seleciona tipo (custos_adm|sub ou diarias_adm|sub)
2. Admin seleciona mês e ano
3. Admin faz upload do arquivo .xlsx
4. Frontend → POST /api/import (FormData)
5. API verifica autenticação e role admin
6. SheetJS lê o buffer do arquivo
7. Carrega todos empreendimentos e apartamentos em memória
8. [Custos] Processa cada sheet como um empreendimento
9. [Diárias] Processa sheet "RESULTADO", extrai FAT por empreendimento
10. DELETE registros existentes para (mes, ano, tipo_gestao)
11. INSERT novos registros em custos ou diarias
12. INSERT log em importacoes com status 'concluido'
13. Retorna JSON com contagem de registros inseridos
```

### Tipos de planilha e destino no banco

| `tipo` | `tipo_gestao` gravado | Tabela destino |
|---|---|---|
| `custos_adm` | `'adm'` | `custos` |
| `custos_sub` | `'sub'` | `custos` |
| `diarias_adm` | `'adm'` | `diarias` |
| `diarias_sub` | `'sub'` | `diarias` |

---

## 10. Controle de Acesso por Role

| Funcionalidade | `admin` | `analista` |
|---|---|---|
| Visualizar Dashboard (`/`) | ✅ | ✅ |
| Ver Empreendimentos | ✅ | ✅ |
| Ver Custos | ✅ | ✅ |
| Ver Diárias | ✅ | ✅ |
| Ver Relatório Analítico | ✅ | ✅ |
| Criar Empreendimento/Apartamento | ✅ | ❌ (RLS bloqueia) |
| Excluir Empreendimento/Apartamento | ✅ | ❌ (RLS bloqueia) |
| Importar Planilhas (`/importar`) | ✅ | ❌ (redirect na página) |
| Ver Usuários (`/usuarios`) | ✅ | ❌ (redirect para `/`) |
| Limpar dados do período | ✅ | ❌ (API verifica role) |
| Escrever no banco (via RLS) | ✅ | ❌ |

**Camadas de proteção para admins:**
1. **Sidebar** — Itens admin ocultos para analistas
2. **Server Component** — Verificação de role + redirect no servidor
3. **RLS** — Banco bloqueia INSERT/UPDATE/DELETE para não-admins
4. **API Routes** — Verificação manual de autenticação e role

---

## 11. Variáveis de Ambiente

Arquivo: `.env.local` (raiz do projeto — **não comitar no Git**)

```env
NEXT_PUBLIC_SUPABASE_URL=https://rlkmljeatapayiroggrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
OBSIDIAN_API_BASE=https://127.0.0.1:27124
OBSIDIAN_API_TOKEN=...
```

As variáveis são prefixadas com `NEXT_PUBLIC_` pois precisam ser acessadas tanto no servidor quanto no cliente. A segurança dos dados é garantida pelo RLS do Supabase, não pelo sigilo da chave anon.

> ⚠️ **Atenção:** O arquivo atual pode ter espaços em branco no final de cada linha. Isso causa falhas silenciosas de conexão em alguns ambientes de deploy. Remover os espaços.

---

## 12. Middleware de Autenticação

**Arquivo:** `proxy.ts` (raiz do projeto)

O middleware intercepta **todas** as requisições antes de chegarem às páginas. Utiliza `@supabase/ssr` para verificar a sessão a partir dos cookies da requisição.

**Rotas excluídas do middleware** (matcher):
- `_next/static` e `_next/image` — assets internos do Next.js
- `favicon.ico` e `logo-alugueasy.png` — arquivos públicos
- `api/import` — a API route deve verificar autenticação internamente
- Arquivos com extensão de imagem (`.png`, `.jpg`, `.svg`, etc.)

**Lógica de redirecionamento:**

| Situação | Ação |
|---|---|
| `/login` + usuário autenticado | Redirect para `/` |
| Qualquer rota protegida + não autenticado | Redirect para `/login` |
| Demais casos | Passa normalmente |

> **Nota:** O arquivo está nomeado `proxy.ts`. O Next.js detecta middleware pelo nome `middleware.ts`. Verificar se existe importação/reexportação adequada.

---

## 13. Bugs Conhecidos

| # | Severidade | Status | Descrição | Arquivo |
|---|---|---|---|---|
| B1 | 🔴 Crítico | Corrigido | Código usava `tipo_planilha` e `status: 'sucesso'` — campos inválidos na tabela `importacoes`. | `api/import/route.ts` |
| B2 | 🔴 Crítico | Corrigido | `mes` e `ano` hardcoded como `1` e `2026`. | `api/import/route.ts` |
| B3 | 🔴 Crítico | A verificar | Após login, pode redirecionar para `/dashboard` (não existe). Deve redirecionar para `/`. | `login/page.tsx` |
| B4 | 🔴 Crítico | A verificar | Analistas em `/usuarios` podem ser redirecionados para `/dashboard` em vez de `/`. | `usuarios/page.tsx` |
| B5 | 🔴 Segurança | Parcialmente corrigido | `/api/import` está excluído do middleware. A API agora verifica autenticação internamente. | `proxy.ts` + `route.ts` |
| B6 | 🟠 Alto | Corrigido | Dashboard, Custos e Diárias tinham filtro fixo Janeiro/2026. Agora usam `searchParams` dinâmicos. | `page.tsx`, `custos/`, `diarias/` |
| B7 | 🟠 Alto | Corrigido | Página de Importar inicializava `historico` como array vazio. Agora busca dados reais do banco. | `importar/page.tsx` |
| B8 | 🟠 Alto | Corrigido | Constraints UNIQUE adicionadas via migration `001`. API usa `upsert` com `onConflict` como camada extra. | `supabase/migrations/001_...sql` + `api/import/route.ts` |
| B9 | 🔴 Segurança | Corrigido | Função `handle_new_user()` recriada com `SET search_path = public` via migration `002`. | `supabase/migrations/002_...sql` |
| B10 | 🟡 Médio | A verificar | `.env.local` pode ter espaços no final das variáveis. | `.env.local` |

---

## 14. Como Rodar Localmente

```bash
# 1. Clonar o repositório
git clone <url-do-repositorio>
cd Sistema-Financeiro-Alugueasy

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
# Criar .env.local com as credenciais do Supabase:
# NEXT_PUBLIC_SUPABASE_URL=https://rlkmljeatapayiroggrp.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon do projeto>

# 4. Iniciar servidor de desenvolvimento
npm run dev
# Acesse: http://localhost:3000

# 5. Build de produção (verificação de erros TypeScript)
npm run build

# 6. Rodar em modo produção local
npm start
```

**Credenciais de acesso:** solicitar ao administrador um e-mail e senha de usuário cadastrado no Supabase Auth do projeto `rlkmljeatapayiroggrp`.

---

## 15. Governança e Segurança

### Autenticação
- Supabase Auth com email/senha
- Tokens JWT armazenados em cookies httpOnly gerenciados pelo `@supabase/ssr`
- Sessão validada em cada requisição pelo middleware `proxy.ts`

### Autorização
- **Row Level Security (RLS):** Ativo em todas as 6 tabelas. Nenhum dado pode ser lido ou modificado sem sessão válida.
- **Roles:** Dois perfis — `admin` (leitura e escrita) e `analista` (somente leitura)
- **Verificação em camadas:** frontend (sidebar/redirect) + servidor (Server Component) + banco (RLS) + API (verificação manual)

### Dados sensíveis
- Dados financeiros reais — acesso restrito a usuários cadastrados
- Chave Anon Key é pública por design (`NEXT_PUBLIC_`) mas sem permissões de escrita para a role `anon`
- Service Role Key **não é utilizada** no frontend — nunca expor

### Backups
- Backup automático nativo do Supabase (plano free: retenção diária)
- Recomendado: arquivar planilhas `.xlsx` originais mensalmente em local seguro

---

---

## 16. MCP Server

O `mcp-server/` expõe o sistema como tools MCP para agentes de IA (Claude Desktop, Claude Code).

- **Entry point:** `mcp-server/src/index.ts` — stdio transport
- **Cliente Supabase:** service role key (bypassa RLS) — **nunca** a anon key
- **Build:** `cd mcp-server && npm run build` → `dist/`
- **Config:** copiar `.env.example` → `.env` com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`
- **Docs completas:** `mcp-server/README.md`

### Tools implementadas

| Tool | Módulo | Descrição |
|---|---|---|
| `get_kpis` | financeiro | KPIs agregados: faturamento, custos, lucro, margem |
| `get_kpis_por_empreendimento` | financeiro | KPIs por empreendimento (ordenado por faturamento) |
| `get_custos_detalhados` | financeiro | Custos agrupados por categoria com filtros |
| `get_relatorio_semestral` | financeiro | Últimos 6 meses com variação MoM |
| `list_empreendimentos` | imoveis | Todos os empreendimentos com contagem de apartamentos |
| `list_apartamentos` | imoveis | Apartamentos com taxa_repasse e tipo_repasse |
| `get_prestacao_contas` | imoveis | Prestação mensal (espelha lógica de /prestacao-contas) |

### Notas de bug resolvido (consolidado de CONTEXT.md, 23/04/2026)

- 2 apartamentos do empreendimento Brisas sem `amenitiz_room_id` (room_id `64e4757c` e `f0caa1ec`) — verificar se foram corrigidos com UPDATE no banco

---

## 17. Mapa Completo do Sistema (Cérebro da Documentação)

Esta seção consolida o estado **real implementado no código** para servir como referência central do projeto.

### 17.1 Arquitetura atual (implementação)

- Frontend e backend no mesmo monorepo Next.js App Router (`app/`, `components/`, `lib/`)
- Páginas protegidas em `app/(dashboard)` e login em `app/(auth)/login/page.tsx`
- Sessão/autenticação via Supabase SSR (`lib/supabase/server.ts`, `lib/supabase/client.ts`)
- Proteção global de rotas no middleware (`middleware.ts`)
- APIs de negócio em `app/api/*`
- Servidor MCP separado para consumo por agentes (`mcp-server/`)

### 17.2 Mapa funcional implementado por domínio

#### Dashboard e indicadores
- Dashboard principal em `app/(dashboard)/page.tsx`
- KPIs de faturamento, custos, lucro e margem
- Gráficos e cards por empreendimento (`components/charts/dashboard-charts.tsx`)
- Filtro global de período por mês/ano (`components/shared/month-year-filter.tsx`)

#### Empreendimentos e apartamentos
- Página de gestão e análise em `app/(dashboard)/empreendimentos/page.tsx`
- Cadastro de empreendimento (`components/modals/criar-empreendimento-modal.tsx`)
- Cadastro de apartamento (`components/modals/criar-apartamento-modal.tsx`)
- Edição de parâmetros de repasse (`components/modals/editar-apartamento-repasse-modal.tsx`)
- Exclusão com confirmação (`components/shared/delete-button.tsx`)

#### Custos e diárias
- Custos mensais em `app/(dashboard)/custos/page.tsx`
- Diárias/receitas em `app/(dashboard)/diarias/page.tsx`
- Tabelas com totalização e filtros de período

#### Relatório analítico
- Relatório semestral em `app/(dashboard)/relatorio/page.tsx`
- Gráfico de linha com tendência em `app/(dashboard)/relatorio/charts.tsx`
- Visão consolidada e comparativa por período

#### Importação e sincronização
- Página de importação em `app/(dashboard)/importar/page.tsx`
- Upload/processamento via `POST /api/import` (`app/api/import/route.ts`)
- Limpeza de dados por período via `DELETE /api/clear` (`app/api/clear/route.ts`)
- Sync Amenitiz via `GET/POST /api/amenitiz-sync` (`app/api/amenitiz-sync/route.ts`)
- Sync local de planilhas via `GET/POST /api/sync-local` (`app/api/sync-local/route.ts`)

#### Prestação de contas e PDF
- Prestação de contas em `app/(dashboard)/prestacao-contas/page.tsx`
- Geração de PDF via `GET /api/prestacao-contas-pdf` (`app/api/prestacao-contas-pdf/route.tsx`)
- Template PDF em `components/pdf/prestacao-contas-pdf.tsx`

#### Usuários e administração
- Gestão de usuários em `app/(dashboard)/usuarios/page.tsx`
- Fluxo client de usuários em `app/(dashboard)/usuarios/usuarios-client.tsx`
- Criação de usuários via `POST /api/usuarios` (`app/api/usuarios/route.ts`)

### 17.3 Rotas implementadas

#### Pública
- `/login`

#### Protegidas (autenticado)
- `/`
- `/empreendimentos`
- `/apartamentos` (redireciona para `/empreendimentos`)
- `/custos`
- `/custos/manual`
- `/diarias`
- `/relatorio`
- `/prestacao-contas`
- `/executar-migration`

#### APIs implementadas
- `POST /api/import`
- `GET/POST /api/custos-manual`
- `PATCH/DELETE /api/custos-manual/:id`
- `DELETE /api/clear`
- `GET/POST /api/amenitiz-sync`
- `GET/POST /api/sync-local`
- `POST /api/usuarios`
- `GET /api/prestacao-contas-pdf`
- `POST /api/run-migration`

### 17.4 Banco de dados e integrações já em uso

- Núcleo: `profiles`, `empreendimentos`, `apartamentos`, `custos`, `diarias`, `importacoes`
- Integração Amenitiz: `amenitiz_syncs`, `amenitiz_reservas`
- Migrations em `supabase/migrations/*` (constraints, segurança de trigger, setup Amenitiz, prestação de contas)
- Integração externa principal: Amenitiz (`lib/amenitiz.ts`)
- MCP com service role key em `mcp-server/src/supabase.ts`

### 17.5 Utilitários compartilhados importantes

- Constantes e formatação: `lib/constants.ts`
- Parser de planilhas: `lib/xlsx-parser.ts`
- Sidebar e navegação por perfil: `components/layout/app-sidebar.tsx`
- Ações compartilhadas (`components/shared/*`): limpar dados, sync, gerar PDF, exclusão

### 17.6 Scripts e comandos operacionais

#### App principal
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

#### MCP server
- `cd mcp-server && npm run build`
- `cd mcp-server && npm run dev`
- `cd mcp-server && npm run start`
- `cd mcp-server && npm run typecheck`

#### Script de inicialização MCP local
- `.claude/start-alugueasy-mcp.ps1`

### 17.7 Pontos de atenção (estado atual)

- Há divergências históricas de documentação versus implementação em papel/permissões (`admin` vs `analista`)
- Parte da documentação ainda cita `proxy.ts`, enquanto implementação ativa usa `middleware.ts`
- Endpoint de importação e permissões devem ser sempre validados em conjunto (UI + API + RLS)
- Rotas administrativas e destrutivas (`/api/clear`, `/api/run-migration`) exigem controle operacional rigoroso

### 17.8 Resumo executivo do que está implementado

- Sistema financeiro completo com autenticação, autorização, dashboard, relatórios e gestão de cadastros
- Pipeline de importação e sincronização de dados financeiros por período
- Lançamento manual de custos por competência, empreendimento e apartamento (com edição/exclusão)
- Prestação de contas com geração de PDF
- Integração Amenitiz para dados de reservas/faturamento
- Exposição dos dados por MCP server para uso por agentes de IA

### 17.9 Lançamento Manual de Custos

Fluxo implementado para permitir inserir custos diretamente no sistema sem planilha.
O upload por planilha/PDF permanece ativo como opção paralela.

#### Rotas e componentes
- Tela: `/custos/manual` (`app/(dashboard)/custos/manual/page.tsx`)
- Sidebar: item "Lançamento Manual" em `components/layout/app-sidebar.tsx`
- Componentes:
  - `components/custos/manual-cost-filters.tsx`
  - `components/custos/manual-cost-form.tsx`
  - `components/custos/manual-cost-table.tsx`
  - `components/custos/manual-cost-actions.tsx`

#### APIs
- `GET /api/custos-manual`: lista lançamentos por `mes`, `ano`, `tipo_gestao` e opcionalmente `empreendimento_id`
- `POST /api/custos-manual`: cria lançamento manual
- `PATCH /api/custos-manual/:id`: edita lançamento manual
- `DELETE /api/custos-manual/:id`: exclui lançamento manual

#### Regras de duplicidade
- Bloqueia duplicado exato para a mesma competência:
  - `apartamento_id`, `mes`, `ano`, `categoria`, `tipo_gestao`, `valor`
- Retorna erro amigável (`409`) em tentativas de duplicação.
- Custos diferentes no mesmo período podem coexistir.

#### Schema da tabela `custos` (metadados de origem)
Migration: `supabase/migrations/013_custos_manual_metadata.sql`
- `origem` (`manual` | `importacao`) default `importacao`
- `observacao` (`text`, nullable)
- `criado_por` (`uuid`, nullable, FK para `auth.users.id`)

#### Permissões
- Leitura: usuário autenticado.
- Criação/edição/exclusão manual: perfil `analista`.
- Lançamentos de origem `importacao` não são editados/excluídos pela tela manual.

#### Troubleshooting rápido
- Erro de coluna inexistente (`origem`/`observacao`/`criado_por`): aplicar migration 013.
- Erro 403 ao salvar: usuário não está com perfil `analista`.
- Erro 409 ao salvar/editar: já existe custo idêntico na mesma competência.

---

---

## 18. Portal do Proprietário

### Visão geral

Módulo separado dentro do mesmo Next.js que oferece ao proprietário do imóvel uma visão financeira de seus apartamentos — sem acesso ao sistema interno (dashboard, importação, relatórios).

### Roles

| Role | Acesso | Criado por |
|---|---|---|
| `proprietario` | Restrito ao portal `/proprietario` | Analista em `/usuarios` |
| `admin` / `analista` | Sistema interno — bloqueados no portal | — |

### Fluxo de acesso

```
Login → middleware detecta role → 'proprietario' → redirect /proprietario
                                 → 'admin'/'analista' → passa normalmente
Proprietário tenta acessar rota interna → redirect /proprietario (middleware)
Admin/analista tenta acessar /proprietario → redirect / (middleware)
```

### Rotas do portal

| Rota | Arquivo | Descrição |
|---|---|---|
| `/proprietario` | `app/(proprietario)/proprietario/page.tsx` | Dashboard: KPIs, cards por apt, gráfico 6 meses |
| `/proprietario/extrato` | `app/(proprietario)/proprietario/extrato/page.tsx` | Extrato detalhado por apt com custos por categoria |
| `/proprietario/historico` | `app/(proprietario)/proprietario/historico/page.tsx` | Tabela últimos 12 meses |

### Banco de dados — nova tabela

**`proprietario_apartamentos`** (`supabase/migrations/014_portal_proprietario.sql`)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` | PK |
| `proprietario_id` | `uuid` | FK `auth.users.id` |
| `apartamento_id` | `uuid` | FK `apartamentos.id` |
| `ativo` | `boolean` | Soft delete — false = sem acesso |
| `created_at` | `timestamptz` | — |

UNIQUE: `(proprietario_id, apartamento_id)`

### Segurança

- RLS em `proprietario_apartamentos`: proprietário lê apenas seus próprios; analista gerencia todos
- RLS em `custos`: policy `proprietario_le_custos` — subquery via vínculo ativo
- RLS em `diarias`: policy `proprietario_le_diarias` — subquery via vínculo ativo
- RLS em `amenitiz_reservas`: policy `proprietario_le_reservas` — JOIN apartamentos via número
- Middleware (`middleware.ts` → `proxy.ts`): bloqueia acesso cruzado entre portais por role

### Componentes criados

| Componente | Arquivo | Tipo |
|---|---|---|
| `LogoutButton` | `components/proprietario/logout-button.tsx` | Client |
| `EvolucaoChart` | `components/proprietario/evolucao-chart.tsx` | Client (Recharts) |
| `CadastrarProprietarioModal` | `components/modals/cadastrar-proprietario-modal.tsx` | Client |
| `GerenciarProprietarioModal` | `components/modals/gerenciar-proprietario-modal.tsx` | Client |

### APIs criadas/atualizadas

| Endpoint | Verbo | Descrição |
|---|---|---|
| `/api/proprietario-apartamentos` | GET | Lista vínculos de um proprietário |
| `/api/proprietario-apartamentos` | POST | Vincula novos apartamentos (upsert) |
| `/api/proprietario-apartamentos` | DELETE | Soft delete de vínculo (ativo=false) |
| `/api/proprietario-apartamentos` | PATCH | Sincroniza lista completa de apts ativos |
| `/api/usuarios` | POST | Agora aceita `role: 'proprietario'` + `apartamento_ids[]` |

### Cálculo de repasse (igual à prestação de contas)

```
base = tipo_repasse === 'faturamento' ? faturamento : lucro
repasse = base * (taxa_repasse / 100)
valor_proprietario = lucro - repasse
```

### Como testar

1. Aplicar `supabase/migrations/014_portal_proprietario.sql` no Supabase SQL Editor
2. Acessar `/usuarios` como analista
3. Criar um proprietário via "Novo Proprietário" — vincular apartamentos
4. Fazer logout e logar com as credenciais do proprietário
5. Sistema redireciona automaticamente para `/proprietario`
6. Verificar que o proprietário não consegue acessar `/`, `/custos`, etc.

---

> **REGRA:** Esta documentação deve ser atualizada **sempre** que houver mudanças no schema do banco, novas rotas, alterações de regras de negócio, novos componentes ou correções de bugs.

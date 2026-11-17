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
| `origem` | `text` | CHECK: `'manual'\|'importacao'` DEFAULT `'importacao'` | Fonte do lançamento |
| `observacao` | `text` | nullable | Observação livre do analista |
| `criado_por` | `uuid` | FK → `auth.users` nullable | Usuário que criou o registro (lançamentos manuais) |
| `created_at` | `timestamptz` | DEFAULT `now()` | Data de criação |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Última atualização |

> ⚠️ **Bug #8:** Sem constraint UNIQUE — reimportação da mesma planilha duplica os dados. A API faz DELETE antes do INSERT para mitigar, mas não é uma solução completa.

> 📌 **Regra de origem:** registros com `origem='importacao'` são protegidos contra edição/exclusão via API manual. Somente registros com `origem='manual'` podem ser editados/excluídos pela tela de lançamento manual.

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

### 5.8 Tabela `proprietario_apartamentos`

Criada na migration `014_portal_proprietario.sql`. Vincula usuários com role `proprietario` aos seus imóveis.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | Identificador único |
| `proprietario_id` | uuid FK → auth.users | Usuário proprietário |
| `apartamento_id` | uuid FK → apartamentos | Apartamento vinculado |
| `ativo` | boolean DEFAULT true | Soft delete — desativar em vez de deletar |
| `created_at` | timestamptz | Data do vínculo |

UNIQUE: `(proprietario_id, apartamento_id)`

---

### 5.7 Políticas de Row Level Security (RLS)

RLS está **habilitado em todas as 7 tabelas**.

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
| `/custos/manual` | `(dashboard)/custos/manual/page.tsx` | **Analista** | Lançamento manual individual com filtros de contexto, formulário com categorias, edição inline e histórico do período. |
| `/diarias` | `(dashboard)/diarias/page.tsx` | Todos | Tabela de receitas filtrável por mês/ano. Colunas: Data, Imóvel, Gestão (ADM/SUB), Valor. |
| `/relatorio` | `(dashboard)/relatorio/page.tsx` | Todos | Relatório analítico: últimos 6 meses automáticos, gráfico de linha (Faturamento/Custos/Lucro), tabela pivot (Categorias × Meses), KPIs ADM vs SUB. |
| `/prestacao-contas` | `(dashboard)/prestacao-contas/page.tsx` | Todos | Visualização de prestação de contas por apartamento com geração de PDF |
| `/importar` | `(dashboard)/importar/page.tsx` | **Admin only** | Upload de planilhas Excel em 4 tipos. Histórico de importações buscado do banco. |
| `/usuarios` | `(dashboard)/usuarios/page.tsx` | **Admin only** | Lista usuários internos (admin/analista) e proprietários. Permite cadastrar e gerenciar vínculos de proprietários. |

### 6.4 Rotas do Portal do Proprietário

Grupo de rotas isolado `app/(proprietario)/` — layout e UX completamente separados do sistema interno.

| Rota | Arquivo | Acesso | Descrição |
|------|---------|--------|-----------|
| `/proprietario` | `app/(proprietario)/proprietario/page.tsx` | `proprietario` | Dashboard: 5 KPIs (faturamento, custos, lucro, **taxa AlugEasy**, repasse), cards por apt se >1, gráfico de evolução dos últimos 6 meses |
| `/proprietario/extrato` | `app/(proprietario)/proprietario/extrato/page.tsx` | `proprietario` | Extrato detalhado com custos por categoria, cálculo de repasse, botão PDF por apartamento, estados vazios quando sem dados |
| `/proprietario/historico` | `app/(proprietario)/proprietario/historico/page.tsx` | `proprietario` | Tabela dos últimos 12 meses com status pills (Em andamento/Fechado/Sem dados), linha de totais acumulados |

**Componentes exclusivos do portal:**
- `components/proprietario/evolucao-chart.tsx` — Recharts LineChart (Faturamento/Lucro/Repasse)
- `components/proprietario/logout-button.tsx` — Client component com signOut + redirect
- `components/modals/cadastrar-proprietario-modal.tsx` — Multi-select de apts por empreendimento
- `components/modals/gerenciar-proprietario-modal.tsx` — Checkbox para editar vínculos ativos

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

**Arquivo:** `app/api/prestacao-contas-pdf/route.tsx` · **Template:** `components/pdf/prestacao-contas-pdf.tsx`

Gera o PDF de prestação de contas para um apartamento/período no **modelo oficial do gerador de planilhas** (ago/2026): faixa azul-marinho `#1F3864` no cabeçalho de todas as páginas com o código do documento (`PC-<ADM|SUB>-<AAAAMM>-APT<numero>`), e as seções na ordem — resumo financeiro em 5 caixas, 6 indicadores (ocupação, diária média, RevPAR…), calendário de ocupação colorido por plataforma (Booking `#0070C0` · Airbnb `#FF6B35` · Alugueasy `#00B050`) com "Leitura do mês" 100% determinística, apuração DRE, bloco de repasse; no detalhamento, receita do bruto ao líquido, receita por canal com taxa efetiva, tabela de reservas (LGPD: primeiro nome + inicial; reserva que cruza o mês entra rateada com `(*)`), custos Recorrente/Eventual com comparação à média dos meses em operação (uso interno do histórico — **sem** receita histórica no PDF, decisão definitiva), prévia do próximo mês e glossário.

Verifica autenticação (cookie ou Bearer) e posse do imóvel quando o role é `proprietario`; números financeiros vêm de `calcularKPIs()` (`lib/calcular-kpis.ts`) — os mesmos do portal. Retorna o PDF com headers de download (`Prestacao_<EMP>_Apt-<N>_<Mes>-<Ano>.pdf`).

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

### GET/POST `/api/custos-manual`

**Arquivo:** `app/api/custos-manual/route.ts`

**GET** — Lista lançamentos de custos do período com filtros. Requer autenticação.

**Query params:** `mes`, `ano`, `tipo_gestao` (obrigatórios) + `empreendimento_id` (opcional)

**POST** — Insere um lançamento manual. Requer `role = 'analista'`. Valida duplicata exata (mesmo `apartamento_id`, `mes`, `ano`, `categoria`, `tipo_gestao`, `valor`) e retorna `409` se encontrada. Grava com `origem='manual'` e `criado_por=user.id`.

---

### PATCH/DELETE `/api/custos-manual/[id]`

**Arquivo:** `app/api/custos-manual/[id]/route.ts`

**PATCH** — Edita `categoria`, `valor` e `observacao` de um lançamento. Requer `role = 'analista'`. Guard verifica `origem='manual'` antes de qualquer mutação — lançamentos importados são protegidos.

**DELETE** — Remove o lançamento por `id`. Mesma guarda de `origem='manual'`.

---

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

### Atualizações de 01/07/2026 (rodada de melhorias)

**Autenticação centralizada** — `lib/api-auth.ts` exporta `requireAnalista()`, que
encapsula o padrão `getUser() → select role → 403`. Usado por todas as rotas que
exigem analista (15+ rotas). Rotas com fallback interno (`x-alugueasy-internal-key`)
preservam o fallback e usam o helper apenas no ramo de sessão.

**Rotas removidas:**
- `POST /api/run-migration` e página `/executar-migration` — obsoletas (migration 003 já aplicada); removidas por risco de execução de SQL arbitrário.
- `POST /api/amenitiz-webhook` — endpoint desabilitado (Bloco 2 não concluído); recuperável no histórico git quando o Bloco 2 for retomado.

**`POST /api/teste-extrato`** — email de teste agora vai para o **email do analista logado** (antes: hardcoded).

**`DELETE /api/clear`** — fluxo auditado (migration 028): lê snapshot **paginado** (contorna o cap db-max-rows de 1000 linhas via `lib/supabase-fetch-all.ts`), **aborta se a leitura ou a gravação do snapshot falhar** (nada é apagado sem recuperação garantida), grava `clear_periodo_snapshot` em `audit_log` ANTES dos deletes, executa os deletes com `count: 'exact'` e registra `clear_periodo_resultado` com contagens reais + falhas (ou `clear_periodo_erro` em exceção). Também apaga `amenitiz_reservas` e `amenitiz_syncs` do período.

**`GET /api/exportar-xlsx?tabela=custos|reservas&mes&ano`** — novo export plano (uma linha por registro) para contabilidade, paginado via `fetchAllRows` (sem truncamento do db-max-rows). Acesso: admin ou analista.

**Performance:**
- `lib/sync-amenitiz-core.ts` — upsert de reservas em **lotes de 500** (antes: 1 round trip por reserva). Erros de upsert agora são detectados e marcam o sync como `erro` (antes: silenciosos).
- `app/api/agente-fechamento` — envio de extratos em lotes paralelos de 2 (`Promise.allSettled`; limite de 2 req/s do Resend).
- `lib/enviar-extrato-core.ts` — agregação por apartamento via `Map` (antes: filter O(N×M)).
- `lib/supabase-fetch-all.ts` — helper `fetchAllRows()` para leituras completas paginadas (o `.limit(N)` do PostgREST é capado pelo db-max-rows).

**UI:**
- Toasts globais via `sonner` (`<Toaster />` em `app/layout.tsx`) em todo CRUD.
- `loading.tsx` com skeletons em 8 rotas; estados vazios nas tabelas editáveis.
- Painel **Reconciliação de Dados** na página Importar (`components/importar/sync-status-panel.tsx`): último sync, reservas sem `apartamento_id`, apts sem `room_id`.
- Painel de **alertas proativos** no topo do dashboard (`lib/alertas.ts` + `components/dashboard/alertas-panel.tsx`): room_ids faltando, sync com erro, `categorias_repassaveis` vazia, margem < 10%.
- Botões "Exportar XLSX" nas páginas Custos e Reservas.

**Migrations novas:** 027 (índices `amenitiz_syncs(mes,ano,status)` e `amenitiz_reservas(apartamento_id)` + seed de `categorias_repassaveis` com todas as categorias existentes) e 028 (`audit_log`). **Ambas aplicadas em produção em 02/07/2026.**

---

### Crons — pg_cron no Supabase (02/07/2026)

Os crons do `vercel.json` **nunca executaram**: o Vercel Cron faz requisições **GET**
e as rotas de cron só têm handler **POST** (além do plano Hobby limitar a 1 execução
diária). Foram substituídos por 3 jobs `pg_cron` + `pg_net` no banco Supabase, que
fazem POST autenticado com a chave interna (guardada no **Supabase Vault** como
`alugueasy_internal_api_key`):

| Job | Cron (UTC) | Chamada |
|---|---|---|
| `amenitiz-reservas-5min` | `*/10 * * * *` (era `*/5`; reduzido em 05/10/2026) | `POST /api/amenitiz-sync-cron?modo=reservas` — sync leve, só upsert de `amenitiz_reservas` (não-destrutivo, alimenta o realtime do portal) |
| `amenitiz-sync-diario` | `0 8 * * *` (05:00 BRT) | `POST /api/amenitiz-sync-cron` — sync completo (diárias + logs) |
| `agente-fechamento-mensal` | `0 11 1 * *` (08:00 BRT dia 1) | `POST /api/agente-fechamento` |

Gerenciamento: `SELECT * FROM cron.job;` e histórico em `cron.job_run_details` /
respostas HTTP em `net._http_response`. O `vercel.json` não tem mais a chave `crons`.

**Orçamento de E/S de disco (05/10 e 10/10/2026).** O Supabase avisou que o
orçamento de I/O estava sendo consumido. Causa: o sync regravava as ~500
reservas do mês inteiras (com `raw_data`) a cada rodada, mesmo sem mudança —
17 mi de updates em `amenitiz_reservas` para 8,7 mil linhas, autovacuum a cada
10 min — e a ocupação da limpeza apagava e reinseria ~600 linhas por rodada.
Correção (migration `045_sync_sem_regravacao.sql` + `lib/sync-amenitiz-core.ts`):
cada reserva guarda em `sync_hash` o SHA-1 do payload gravado; o sync consulta
os hashes e só faz upsert do que é novo ou mudou (sem a coluna, avisa no log e
grava tudo). A ocupação da limpeza compara a assinatura de cada reserva com o
que está no banco antes de regravar. O JSON do cron passou a trazer
`reservas_gravadas` e `reservas_inalteradas` por período. Como linhas iguais
não são mais tocadas, `listar_imoveis_limpeza()` calcula "ocupação atualizada
em" com `greatest(max(atualizado_em), ingest_status.ultimo_at)`.
Conferência: `n_tup_upd` de `amenitiz_reservas` em `pg_stat_user_tables` deve
parar de crescer entre rodadas. Verificado em 10/10/2026 (commits 4e40c13 e
3f23374): rodada das 15:50 UTC gravou 0 e pulou 346 inalteradas.
Armadilha: a API da Amenitiz devolve `booking_id` como **número** (a interface
`AmenitizReserva` diz `string`) e o banco devolve text — todo Map/lookup por
booking_id precisa de `String()` dos dois lados, senão nada casa.

### Rotação de chaves Supabase (02/07/2026)

As chaves **legadas** (JWT `anon` / `service_role`) foram **desabilitadas** — a
service_role antiga estava exposta no histórico do git (`.claude/settings.json`) e
está morta (retorna 401). O app usa as chaves novas:
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_...`
- `SUPABASE_SERVICE_ROLE_KEY` = `sb_secret_...`
Atualizadas em `.env.local`, `mcp-server/.env` e nas envs da Vercel (Production +
Preview). Se precisar de novas chaves: Dashboard → Settings → API Keys.

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

> **Nota sobre semântica invertida:** neste sistema, `analista` é o operador com acesso total ao sistema interno; `admin` é somente-leitura. `proprietario` só acessa o portal próprio.

| Funcionalidade | `analista` | `admin` | `proprietario` |
|---|---|---|---|
| Dashboard interno (`/`) | ✅ | ✅ | ❌ → redirect `/proprietario` |
| Ver Empreendimentos | ✅ | ✅ | ❌ |
| Ver Custos / Diárias | ✅ | ✅ | ❌ |
| Ver Relatório Analítico | ✅ | ✅ | ❌ |
| Criar Empreendimento/Apartamento | ✅ | ❌ (RLS) | ❌ |
| Importar Planilhas (`/importar`) | ✅ | ❌ (redirect) | ❌ |
| Gerenciar Usuários (`/usuarios`) | ✅ | ❌ (redirect) | ❌ |
| Limpar dados do período | ✅ | ❌ (API verifica) | ❌ |
| Portal `/proprietario` | ❌ → redirect `/` | ❌ → redirect `/` | ✅ |
| Ver seus apartamentos | N/A | N/A | ✅ (RLS filtra) |
| Ver dados de outros proprietários | N/A | N/A | ❌ (RLS bloqueia) |
| Baixar PDF do extrato | N/A | N/A | ✅ (seus apts) |

**Camadas de proteção:**
1. **proxy.ts (middleware)** — redireciona por role antes de renderizar qualquer página
2. **Layout Server Component** — `DashboardLayout` expulsa `proprietario`; `(proprietario)/layout.tsx` expulsa não-proprietários
3. **RLS** — banco filtra dados por `proprietario_apartamentos.proprietario_id = auth.uid()`
4. **API Routes** — verificam autenticação e role individualmente

---

### 10.1 Camada operacional (limpeza) — out/2026

Quarto papel de acesso, `operacional`, para a equipe de limpeza (migration 040).

| Ponto | Comportamento |
|---|---|
| Login | `/login-operacional` no site; no app, o mesmo login único roteia para `/operacional` |
| O que vê | Lista de imóveis (empreendimento + número + última limpeza) via `listar_imoveis_limpeza()`, o checklist, os nomes dos colegas via `listar_equipe_limpeza()` e as limpezas que registrou ou em que foi marcado como responsável (migration 042) |
| O que não vê | Valores, custos, diárias, reservas, proprietários, taxa de repasse — RLS devolve zero linhas |
| Fluxo | Escolhe o imóvel → marca o checklist → marca quem fez (uma ou mais pessoas) → finaliza → `POST /api/limpezas` grava e envia e-mail |
| Responsáveis | `limpezas.responsaveis` guarda todos os nomes (migration 041); a pessoa logada já vem marcada e adiciona colegas via `listar_equipe_limpeza()` |
| Status do dia | Imóvel limpo hoje aparece com ícone verde (âmbar se a limpeza de hoje ficou incompleta); é calculado pela data em São Paulo, então zera sozinho no dia seguinte e o registro fica no histórico |
| Item não marcado | Permitido, mas a observação vira obrigatória; o e-mail chega como "Limpeza INCOMPLETA" |
| Cadastro | Analista, em `/usuarios` → bloco "Equipe Operacional" (criar, redefinir senha, desativar, excluir) |
| Controle | `/limpezas` (analista e admin) com filtro por período, pessoa e incompletas |
| Checklist | Modelo editável pelo analista em `/limpezas/checklist`; item pode valer para todos ou para um imóvel |
| Histórico | Cada limpeza guarda a cópia dos itens (`itens` jsonb): mudar o modelo não altera registros antigos |
| Conta desativada | `profiles.ativo = false` → proxy desloga e a RLS zera tudo (`is_operacional_ativo()`) |

Teste sem aplicar: `scripts/dryrun-migration-040.sql` roda a migration dentro de um bloco que termina
em erro proposital (tudo é desfeito) e compara o que analista, admin e proprietário enxergam antes e depois.

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
| B11 | 🟠 Alto | Corrigido | Constraint `profiles_role_check` não incluía `'proprietario'` — bloqueava cadastro de proprietários. | `migration 014` |
| B12 | 🟠 Alto | Corrigido | RLS policy `FOR ALL` sem `WITH CHECK` bloqueava INSERT do analista em `proprietario_apartamentos`. | `migration 015` |
| B13 | 🟠 Alto | Corrigido | Policy SELECT `proprietario_ve_seus_vinculos` não foi criada na aplicação parcial da migration 014 — portal mostrava "Nenhum apartamento vinculado" mesmo com dados corretos. | `migration 016` |
| B14 | 🟡 Baixo | Prevenido | Edição acidental de custos importados via tela manual — campo `origem` com CHECK constraint + guard na API impede qualquer mutação em registros de origem `'importacao'`. | `migration 013` + `api/custos-manual/[id]/route.ts` |

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
- PDF no modelo oficial do gerador de planilhas (ago/2026): página 1 executiva (resumo em caixas, indicadores, calendário de ocupação por plataforma com "Leitura do mês" determinística, apuração DRE, bloco de repasse) + detalhamento (bruto→líquido, receita por canal, reservas com LGPD e rateio de virada de mês, custos Recorrente/Eventual, prévia do próximo mês, glossário)
- Os números financeiros do PDF saem de `calcularKPIs()` — mesma regra do portal; o histórico de 6 meses é usado só internamente para a média de custos dos meses em operação (nunca exibir receita histórica — decisão definitiva)

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
| `/proprietario/extrato` | `app/(proprietario)/proprietario/extrato/page.tsx` | **Rentabilidade** (nome exibido; a rota mantém "extrato") — detalhado por apt com custos por categoria |
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
| `AssistenteAlugEasy` ("Alu") | `components/proprietario/assistente-alugueasy.tsx` | Client |
| `DesempenhoImovelChart` | `components/proprietario/desempenho-imovel-chart.tsx` | Client (Recharts) — faturamento × custos + lucro por imóvel no Histórico, com seletor e totais 12m |

### APIs criadas/atualizadas

| Endpoint | Verbo | Descrição |
|---|---|---|
| `/api/proprietario-apartamentos` | GET | Lista vínculos de um proprietário |
| `/api/proprietario-apartamentos` | POST | Vincula novos apartamentos (upsert) |
| `/api/proprietario-apartamentos` | DELETE | Soft delete de vínculo (ativo=false) |
| `/api/proprietario-apartamentos` | PATCH | Sincroniza lista completa de apts ativos |
| `/api/usuarios` | POST | Agora aceita `role: 'proprietario'` + `apartamento_ids[]` |
| `/api/usuarios` | GET | Retorna email de um proprietário (`user_id`) para edição no modal |
| `/api/usuarios` | PATCH | Analista atualiza email e/ou senha de proprietário via `auth.admin.updateUserById` |
| `/api/presenca` | POST | Heartbeat do usuário logado (atualiza `user_presence.last_seen_at`) |
| `/api/presenca` | GET | Analista lista presenças e status online/offline (janela de 90s) |

### Cálculo de repasse (igual à prestação de contas)

```
base = tipo_repasse === 'faturamento' ? faturamento : lucro
repasse = base * (taxa_repasse / 100)
valor_proprietario = lucro - repasse
```

### Assistente virtual "Alu" (onboarding do portal)

Assistente 100% client-side montada no layout do portal (`app/(proprietario)/layout.tsx`) — sem acesso a banco ou APIs.

**Funções:**

1. **Tour guiado por página (encadeado)** — cada página do portal tem seu próprio tour, definido no mapa `TOURS` do componente (chave = pathname). No último passo de cada página, um botão "Continuar" leva à próxima via `?tour=1` (Início → Extrato → Histórico). Alvos por página, marcados com `data-tour`:
   - `/proprietario`: `periodo`, `kpis`, `repasse`, `evolucao`, `ocupacao`, `atalhos`, `navegacao`/`navegacao-mobile`
   - `/proprietario/extrato`: `ext-periodo`, `ext-card-head`, `ext-faturamento`, `ext-custos`, `ext-lucro`, `ext-taxa`, `ext-repasse`, `ext-pdf` (marcados apenas no 1º cartão de apartamento)
   - `/proprietario/historico`: `his-grafico`, `his-imovel`, `his-tabela`
   Passos cujo alvo não existe na tela (ex.: mês sem dados) são pulados automaticamente. Em páginas sem tour próprio, iniciar o tour navega para `/proprietario?tour=1`.
2. **Ajuda rápida** — painel estilo chat com respostas prontas (indicadores, cálculo do repasse, troca de mês, linhas do Extrato, página Histórico, Administração × Sublocação, download do PDF, painel de ocupação, tempo real, contato).

**Comportamento:**

- Botão flutuante verde (canto inferior direito; acima da bottom nav no mobile)
- Abre sozinha na **primeira visita** ao `/proprietario` (flag `alu_bemvindo_visto` no localStorage; `alu_tour_visto` marca tour concluído/pulado)
- Durante o tour a página fica bloqueada por overlay (z-index 99–110) e o alvo recebe spotlight com borda verde

**Manutenção:** ao criar uma nova seção em qualquer página do portal, adicionar `data-tour="..."` no elemento e um passo no tour daquela rota em `TOURS`; novas dúvidas frequentes entram no array `FAQS` do componente.

**Avatar:** `public/alu-avatar.png` (256×256, recorte do rosto) — usado no botão flutuante, no cabeçalho do painel e no tooltip do tour. Se o arquivo não existir, o componente cai automaticamente no fallback (ícone/letra). A arte completa da mascote (com textos de apresentação) está em `public/alu-apresentacao.png` e é exibida na página `/proprietario/bem-vindo` (painel direito em telas largas, no lugar do antigo mockup CSS) junto com um cartão "Conheça a ALU".

### Como testar

1. Aplicar `supabase/migrations/014_portal_proprietario.sql` no Supabase SQL Editor
2. Acessar `/usuarios` como analista
3. Criar um proprietário via "Novo Proprietário" — vincular apartamentos
4. Fazer logout e logar com as credenciais do proprietário
5. Sistema redireciona automaticamente para `/proprietario`
6. Verificar que o proprietário não consegue acessar `/`, `/custos`, etc.

---


---

## Taxa AlugEasy da reserva direta (10%) — só em administração (16/10/2026)

Não confundir com a taxa de administração da seção seguinte. Esta é a taxa de
plataforma aplicada no sync sobre reserva direta (source manual / alugueasy /
amenitiz → `plataforma_normalizada = 'Alugueasy'`). Regra informada pelo
usuário em 16/10/2026: **cobrada só em imóveis `tipo_gestao = 'adm'`; em
`'sub'` a reserva direta é isenta e o imóvel paga apenas Booking e Airbnb.**

- `lib/amenitiz.ts`: `taxaAlugEasyPara(tipoGestao)` (0 para `'sub'`, 0,10 nos
  demais); `calcularValorLiquido(..., checkin, tipoGestao)` e
  `getTaxasPlataforma(emp, apt, ref, tipoGestao)` recebem o tipo do imóvel.
  Sem tipo conhecido (imóvel não cadastrado) vale a regra de adm.
- `lib/sync-amenitiz-core.ts`: resolve o `aptInfo` ANTES de calcular a taxa e
  passa `aptInfo.tipoGestao`. Reservas de imóveis sub passam a ser gravadas
  com `taxa_aplicada = 0` e `valor_liquido = valor_bruto`; as diárias seguem.
- Portal web (`occupancy-panel.tsx`) e app (`mobile/src/components/ocupacao.tsx`):
  o badge "AlugEasy 10%" nas TAXAS do imóvel some para sublocação (ficam só
  Booking e Airbnb). Textos do botão de sync, da tela Importar e das notas do
  XLSX de conferência dizem "10% só em administração".
- Histórico: migration `046_sub_sem_taxa_alugueasy.sql` devolve o descontado
  (318 reservas de 52 imóveis sub, dez/2025–out/2026, R$ 25.498,86) nas
  reservas e nas diárias. Idempotente e reversível; aplicar DEPOIS do deploy.
- Nota: `apartamentos.modelo_contrato` é `'administracao'` para todos os 85
  imóveis — a distinção real é `tipo_gestao` (33 adm / 52 sub).

## Taxa de administração AlugEasy (imóveis ADM)

Cada imóvel de **administração** tem o seu próprio percentual, gravado em
`apartamentos.taxa_repasse` (e `tipo_repasse`, hoje sempre `'lucro'`).
A taxa incide sobre o **lucro** do imóvel (faturamento − custos repassáveis) e é
a receita da AlugEasy sobre aquele contrato.

| Empreendimento | Apartamentos | Taxa |
|---|---|---|
| EASY | 117 | 15% |
| LINK | 104, 204 | 20% |
| ASA SUL | 104 | 20% |
| CULLINAN | 611 | 17% |
| ATHOS | 910 | 17% |
| NOBILE | 718 | 18% |
| FUSION | 722, 1415, 1501 | 18% |
| MERCURE | 1312 | 12% |
| METROPOLITAN | 1615-1615A, 1605, 1701-1701A | 15% |
| RAMADA | 106, 606 | 18% |
| BRISAS | D137, D138 | 18% |

Imóveis de **sublocação** têm `taxa_repasse = 0` — não há taxa de administração,
o resultado inteiro é da AlugEasy.

### Regra única: `lib/calcular-kpis.ts`

```ts
calcularTaxaCarteira(apartamentos, diarias, custos)
// → { faturamento, custos, lucro, taxaAlugEasy, valorProprietario }

rotuloTaxaCarteira(apartamentos)
// → "15% sobre o lucro" | "12% a 15% sobre o lucro" | '' (carteira sem taxa)
```

O cálculo é **imóvel a imóvel**: soma-se a taxa de cada apartamento, nunca uma
taxa única aplicada ao total da carteira. Qualquer tela nova que mostre repasse
deve usar estas funções (ou `calcularKPIs`/`somarKPIs`, que seguem a mesma regra)
em vez de recalcular localmente.

### Onde a taxa aparece

| Tela | O que mostra |
|---|---|
| `/proprietario` | KPI "Taxa AlugEasy" com o valor do período e o percentual |
| `/proprietario/extrato` | Linha "Taxa AlugEasy (X% sobre lucro)" por apartamento |
| `/proprietario/historico` | Coluna "Repasse AlugEasy" mês a mês |
| App mobile (`proprietario.tsx`, `historico.tsx`, `rentabilidade.tsx`) | Mesmos números, via `@sistema/calcular-kpis` |
| `/prestacao-contas` e PDF | Linha "(−) Taxa Alugueasy [X%]" |

### Bug corrigido — taxa do primeiro imóvel valia para a carteira inteira

O histórico do portal (12 meses), o gráfico de evolução (6 meses) e as duas telas
equivalentes do app aplicavam `apartamentos[0].taxa_repasse` a **todos** os imóveis
do proprietário. Carteiras com percentuais diferentes ficavam erradas — e divergiam
do Extrato, que já calculava por imóvel.

Exemplo real (jul/2026, carteira MERCURE 1312 a 12% + três METROPOLITAN a 15%):
taxa exibida era R$ 3.701,30 em vez de R$ 4.473,99 — R$ 772,69 a menos por mês.

Corrigido com `calcularTaxaCarteira` nos quatro pontos.

## Landing pública `/home` — redesenho com GSAP (06/11/2026)

Página de entrada dos três portais. É pública (`PUBLIC_ROUTES` em `proxy.ts`) e
não lê nada do banco: todos os números exibidos são ilustrativos.

| Arquivo | Papel |
|---|---|
| `app/home/page.tsx` | Server component: aplica as fontes de `lib/fontes-marca.ts` e renderiza a landing |
| `components/landing/landing-page.tsx` | Estrutura: navegação, hero, faixa do fluxo, funcionalidades, portais, fechamento |
| `components/landing/como-funciona-section.tsx` | As 5 etapas + extrato de exemplo |
| `components/landing/exemplo-extrato.ts` | Constante `EXEMPLO` (valores ilustrativos), usada também no login do proprietário |
| `lib/fontes-marca.ts` | Instrument Serif + Geist Mono via `next/font`, compartilhadas com as telas de login |
| `components/landing/use-landing-motion.ts` | **Toda** a animação (um único `useGSAP`) |
| `components/landing/landing.css` | Estilos — folha global, tudo com prefixo `.lp-` |

Dependências novas: `gsap` 3.15 e `@gsap/react`. Desde a 3.13 todos os plugins
(ScrollSmoother, SplitText, DrawSVG) vêm no pacote público e são gratuitos.

| Plugin | Uso na página |
|---|---|
| ScrollSmoother | Rolagem suave e parallax (`data-speed`) — só desktop |
| ScrollTrigger | Prévia do dashboard que "deita" ao rolar, extrato fixado que se preenche por etapa, portais em leque, barra de progresso, estado da navegação |
| SplitText | Títulos revelados linha a linha (`data-split`) |
| DrawSVG | Linha do gráfico no cartão "Dashboard financeiro" |

### Regras para quem for mexer

1. **Fontes só via `next/font`.** A CSP (`next.config.ts`) bloqueia o `@import` do
   Google Fonts — era por isso que a serifa nunca carregava. Importe sempre de
   `lib/fontes-marca.ts`. O `@import` bloqueado ainda existe nas quatro páginas de
   `/proprietario` (lá o título continua caindo em Georgia).
2. **`position: fixed` fica fora de `#smooth-wrapper`** (navegação e barra de
   progresso). Dentro dele o elemento passaria a rolar com o conteúdo.
3. **`position: sticky` não funciona com o smoother ativo.** O extrato usa `pin` do
   ScrollTrigger; o `sticky` do CSS só vale quando `.lp-root` não tem `data-smooth`.
4. **Hover usa a propriedade `translate`, não `transform`.** O GSAP grava
   `translate: none` inline em tudo que anima; por isso as entradas de uma vez só
   terminam com `clearProps` e o leque dos portais move um `.lp-portal-slot` em
   volta do cartão.
5. **Estado inicial escondido é sempre aplicado pelo GSAP, nunca pelo CSS.** Com
   `prefers-reduced-motion` nada anima e a página aparece completa (extrato
   preenchido, `sticky` nativo).
6. **O extrato segue a conta real** de `components/pdf/prestacao-contas-pdf.tsx`:
   receita − custos = lucro; lucro − administração AlugEasy = repasse. Os valores
   e a taxa do exemplo ficam em `EXEMPLO` (`components/landing/exemplo-extrato.ts`).

### Como conferir visualmente

O servidor de desenvolvimento responde 403 em `/_next/*` para qualquer origem que
não seja `localhost` — um navegador rodando em Docker (`host.docker.internal`)
recebe o HTML mas nunca hidrata, e as animações não rodam. Use um navegador local.

## Telas de login — redesenho no padrão da landing (06/11/2026)

`/login` (equipe interna, azul), `/login-proprietario` (verde) e
`/login-operacional` (verde-água) usam a mesma moldura e as mesmas peças; a cor
de cada portal entra por `data-tom` no elemento raiz.

| Arquivo | Papel |
|---|---|
| `app/(auth)/login/page.tsx`, `app/login-proprietario/page.tsx`, `app/login-operacional/page.tsx` | **Autenticação** de cada portal (signIn, checagem de papel, redirecionamento) + montagem da tela |
| `components/login/login-shell.tsx` | Moldura (`LoginShell`) e peças: `LoginCabecalho`, `CampoEmail`, `CampoSenha`, `Alerta`, `AvisoDaUrl`, `BotaoEntrar` |
| `components/login/login-visuais.tsx` | Prévia ilustrativa do painel colorido, uma por portal |
| `components/login/use-login-motion.ts` | Animação (GSAP: SplitText, DrawSVG, timelines) |
| `components/login/login.css` | Estilos — folha global, tudo com prefixo `.lg-` |

### O que cada tela mostra

| Portal | Prévia do painel | Particularidade |
|---|---|---|
| Interno | Mini dashboard (KPIs e barras) | Botões Analista/Admin trocam a prévia e o texto de ajuda |
| Proprietário | Extrato de exemplo com "Seu repasse" | Mesmo `EXEMPLO` da landing |
| Operacional | Checklist sendo marcado, em laço, pelas 4 etapas | No celular as etapas aparecem resumidas abaixo do formulário |

Abaixo de 960px o painel vira uma faixa no topo e o formulário, uma folha por cima
(a prévia some). Com `prefers-reduced-motion` nada anima.

### Regras para quem for mexer

1. **A autenticação não mora nos componentes compartilhados.** `components/login/`
   é só apresentação; `handleLogin` continua em cada `page.tsx`.
2. **Os botões Analista/Admin não entram no login.** Quem define o acesso é
   `profiles.role`. Eles só ilustram o que cada perfil faz — o texto abaixo deles
   diz isso ao usuário, e deve continuar dizendo.
3. **A entrada do formulário anima `opacity`, nunca `autoAlpha`.** `autoAlpha` aplica
   `visibility: hidden`, e campo invisível não recebe foco: o e-mail deixaria de vir
   focado no desktop e a digitação nos primeiros instantes se perderia.
4. **`?erro=` na URL vira aviso.** `AvisoDaUrl` traduz o código que o `proxy.ts` manda
   (`sem_acesso` no interno, `conta_desativada` nos outros dois). Ele usa
   `useSearchParams`, então fica sozinho dentro de um `<Suspense>` — o resto da
   página continua pré-renderizado. Código novo no proxy → mensagem nova no
   `AVISOS_URL` da página correspondente.
5. **Campos com fonte de 16px.** Menos que isso e o iOS dá zoom ao focar.
6. **Foco automático só no desktop.** No celular ele abriria o teclado por cima da tela.

### Como testar sem enviar credenciais

Para exercitar o erro de login em teste automatizado, intercepte
`*supabase.co/auth/v1/token` e responda `400 {"msg":"Invalid login credentials"}`
no próprio navegador de teste — a tela reage igual e nada chega ao Supabase.

## Área interna — moldura responsiva e Dashboard redesenhado (06/11/2026)

Primeira aba da área interna atualizada para a identidade da landing e do login.
As demais abas ainda usam o visual antigo; a moldura (menu) já vale para todas.

### Correção: valores com 3 casas decimais

`formatCurrency` (`lib/constants.ts`) só definia o **mínimo** de casas; o
`toLocaleString` então mostrava até 3. Valores rateados (reserva que cruza o mês)
apareciam como `R$ 180.027,588`. Agora mínimo e máximo andam juntos — vale para
todas as telas que formatam moeda.

### Moldura (todas as abas internas)

| Arquivo | Papel |
|---|---|
| `app/(dashboard)/layout.tsx` | Autenticação e papel — inalterado, só passou a usar o `AppShell` |
| `components/layout/app-shell.tsx` | Menu + conteúdo; aplica as fontes da marca |
| `components/layout/app-sidebar.tsx` | Menu lateral |

- **≥ 1024px:** o menu fica fixo e acompanha a rolagem (antes o rodapé com o
  usuário/sair só aparecia no fim da página). Continua recolhível.
- **< 1024px:** vira gaveta, aberta por uma barra fixa de 56px no topo (o `main`
  tem `pt-14` por isso). Esc e clique fora fecham.
- Itens, ordem, `buildHref` (mantém `mes`/`ano` entre abas), logout e a seção
  "Administração" só para analista: iguais.

### Tokens de design (`app/globals.css`)

Cores e fontes da marca viraram utilitários do Tailwind — **use estes em vez de hex
solto** ao atualizar as outras abas:

| Utilitário | Uso |
|---|---|
| `marca-950…600`, `marca-100`, `marca-50` | Azul da marca (menu, botões, destaques) |
| `creme`, `creme-escuro`, `areia`, `linha` | Fundo da página, divisórias, detalhe |
| `tinta`, `tinta-suave`, `apagado` | Texto: principal, secundário, legenda |
| `font-titulo` / `font-rotulo` | Serifa dos títulos / mono dos rótulos |
| `serie-faturamento`, `serie-custo-reservas`, `serie-custo-op`, `serie-lucro` | **Cores de gráfico** |
| `positivo` / `negativo` | Estado — sempre com sinal ou rótulo, nunca só a cor |

**Cores de gráfico:** o conjunto foi validado nessa ordem (luminosidade, croma,
distinção para daltônicos, contraste ≥ 3:1 sobre branco). Duas regras saem daí:
o azul `#193660` da marca **não** serve para barra/linha (escuro demais para ser
lido como cor — por isso `serie-faturamento` é `#2a63b8`), e **lucro (verde) nunca
fica ao lado de custo de reservas (laranja)**: os dois se confundem para quem tem
protanopia. Cada série tem a mesma cor em toda tela.

### Dashboard (`/`)

`app/(dashboard)/page.tsx` continua calculando tudo; os componentes só exibem.
Mudou o que ele entrega: saíram `chartData`/`custosPct` (sem uso) e entraram
`fonteFaturamento`, `podeEditar` (papel = analista) e `avisos`.

| Arquivo (`components/dashboard/`) | Papel |
|---|---|
| `dashboard-content.tsx` | Estado da tela: período, ocultar valores, filtros cruzados, animação |
| `periodo-nav.tsx` | Setas mês a mês + seletores (mantém `mes=0`/`ano=0` = "Todos") + "Mês atual" |
| `kpis.tsx` | Os 4 indicadores e a barra "Para onde vai o faturamento" |
| `ranking-empreendimentos.tsx` | Faturamento × lucro em barras horizontais ordenáveis |
| `por-gestao.tsx` | Faturamento por Administração / Sublocação |
| `tabela-apartamentos.tsx` | Tabela com busca, filtros e ordenação; cartões no celular |
| `valor.tsx` | `Valor` (respeita "ocultar valores"), `NumeroAnimado`, formatação, `Segmentado` |
| `alertas-panel.tsx` | Pendências (agora dentro da área do dashboard) |

Removidos por não terem mais uso: `components/charts/dashboard-charts.tsx` (gráfico
de colunas) e `components/dashboard/censored-value.tsx`.

#### Decisões que valem lembrar

1. **Nenhum número novo é calculado no cliente.** Custo por empreendimento
   (`fat − luc`), contagem de apartamentos, totais por gestão e totais do filtro são
   somas do que a página já mandou.
2. **"Sem apartamento vinculado".** A soma dos apartamentos pode ficar abaixo do
   faturamento total (reservas/diárias sem `apartamento_id`). A diferença aparece
   escrita no cartão de gestão, para a conta fechar.
3. **"Lucro parcial".** Com faturamento e nenhum custo de reservas lançado, a tela
   avisa que o lucro só desconta os custos operacionais.
4. **Ocultar valores** (antes "censura") passa por `Valor` + contexto; os gráficos
   borram e as dicas ficam desligadas. O texto continua no HTML — serve para
   compartilhar tela, não é controle de acesso. O efeito de esconder o valor ao
   passar o mouse foi retirado (atrapalhava ler a tabela).
5. **Admin não vê "Limpar dados"** nem o atalho de importação — a API já recusava;
   agora o botão não aparece. **O painel de pendências também é só do analista**
   (pedido do usuário em 06/11/2026): para os demais papéis a página nem roda o
   `verificarAlertas`.
6. **Com prejuízo no período**, a barra de composição mostra do que são feitos os
   custos (não existe "fatia de lucro" negativa).

#### Movimento (GSAP)

Entrada única dos cartões, números que contam do valor anterior ao novo na troca de
período, barras que crescem da base e linhas do ranking que deslizam ao reordenar
(plugin Flip). Durante a troca de período o conteúdo antigo fica esmaecido no lugar
(`useTransition`) em vez de piscar. Com `prefers-reduced-motion` nada anima.

#### Como conferir uma tela que exige login

Para ver o layout sem credenciais: criar uma rota temporária **dentro de `/home/`**
(é pública no `proxy.ts`) que renderize `AppShell` + o componente com dados
fictícios, conferir e **apagar a rota** — e também a pasta que o servidor de dev gera
em `.next/dev/types/app/home/<rota>`, senão o `tsc` acusa módulo inexistente.

## Aba Empreendimentos redesenhada (06/11/2026)

Segunda aba no padrão novo. `app/(dashboard)/empreendimentos/page.tsx` continua
sendo quem consulta e soma (consultas e agregações **idênticas** às anteriores); o
JSX saiu de lá e foi para três componentes, um por nível da URL:

| URL | Componente (`components/empreendimentos/`) | Mostra |
|---|---|---|
| `/empreendimentos` | `lista-empreendimentos.tsx` | Ranking faturamento × custos + todos os empreendimentos (cards ou linhas) |
| `?emp=<id>` | `detalhe-empreendimento.tsx` | Indicadores, tabela Administração × Sublocação, ranking e lista de apartamentos |
| `?emp=<id>&apt=<id>` | `detalhe-apartamento.tsx` | Indicadores, faturamento por dia, custos por categoria, diárias e custos |

Peças de apoio: `fin.tsx` (tipo `Fin`, selos, barras, alternância Cards/Linhas) e
`ranking-financeiro.tsx` (barras horizontais ordenáveis, usado nos dois primeiros níveis).

### `PaginaInterna` — casca das abas (`components/painel/pagina.tsx`)

Fundo creme, título em serifa, voltar, período e ações numa linha, conteúdo
esmaecido enquanto o período troca, e as animações de entrada/barras. **As próximas
abas devem começar por ela.** O Dashboard ainda tem a própria casca (é anterior).

`PeriodoNav` ganhou `permitirTodos` (padrão `true`): com `false` somem "Todos os
meses/anos" — para abas que consultam um mês específico.

### O que mudou além do visual

1. **Valores com 3 casas** (`R$ 15.128,936`): a página tinha um formatador próprio
   com o mesmo defeito do `formatCurrency` antigo. Agora tudo passa por `moeda()`.
2. **"Todos os meses" não quebra mais a aba.** O menu carrega `mes=0` na URL quando
   o Dashboard está em "Todos os meses"; aqui isso zerava os custos (a consulta
   filtrava `mes = 0`) e o título virava "undefined 2026". Mês fora de 1–12 agora
   cai no mês atual — mesmo critério de `/prestacao-contas`.
3. **Admin não vê criar/excluir.** A RLS já recusava; os botões só geravam erro.
   O repasse continua visível como texto (regra que já existia no modal).
4. **Gráficos trocados** (os três arquivos de `components/charts/` desta aba foram
   removidos):
   - colunas "Faturamento vs Custos" + "Lucro líquido" → um ranking horizontal com
     as duas barras e o lucro escrito ao lado (nome inteiro, ordenável);
   - roscas ADM × SUB de duas fatias → tabela Administração × Sublocação;
   - área "Evolução do faturamento" → uma coluna por dia (diária é valor por dia,
     não curva; a linha sugeria faturamento em dia sem hospedagem);
   - pizza de custos (até 10 cores) → barras ordenadas por categoria, uma cor.
5. **Custo deixou de ser vermelho.** Vermelho ficou reservado para prejuízo; custo
   usa a cor da série (`serie-custo-reservas`).
6. **Cartão inteiro clicável sem aninhar botão em link:** o link do título cobre o
   cartão (`after:absolute after:inset-0`) e excluir/repasse ficam por cima (`z-10`).

### Ponto de atenção que NÃO foi alterado

No detalhe do empreendimento, o total vem de `finMap` (diárias **+** reservas
Amenitiz dos apartamentos sem diária), mas os apartamentos da lista usam só
`diarias`/`custos`. Num mês sem diárias importadas, a soma dos apartamentos pode
ficar abaixo do total do empreendimento. É regra de cálculo, fica para decisão.

---

## Aba Custos redesenhada + correção da tabela vazia (06/11/2026)

### O erro: cabeçalho com 314 lançamentos, tabela com "0 registro(s)"

A tabela antiga (`custos-editavel-tabela.tsx`, removida) copiava os lançamentos
para um estado **só na montagem**: `useState(custos)`. Trocar de mês não desmonta a
tela — o servidor mandava a lista nova, o cabeçalho (renderizado no servidor)
mudava, e a tabela continuava com a lista do mês em que a aba foi aberta. Abrindo
num mês sem custos e indo para um mês com custos, ficava em zero. O botão
"Atualizar" tinha o mesmo defeito (`router.refresh()` não alcançava o estado).

**Correção:** `tela-custos.tsx` é a única dona das linhas e o estado acompanha o
que chega do servidor (padrão "ajustar estado quando a prop muda", sem `useEffect`):

```ts
const [linhas, setLinhas] = useState(custos)
const [recebido, setRecebido] = useState(custos)
if (recebido !== custos) { setRecebido(custos); setLinhas(custos) }
```

O mesmo defeito existe em **Diárias** e **Reservas**. Lá entrou a correção mínima
(`key` com o período no componente, em `diarias/page.tsx` e `reservas/page.tsx`),
que resolve a troca de mês; o "Atualizar" dessas duas abas ainda não recarrega —
fica para o redesenho delas.

### Componentes (`components/custos/`)

| Arquivo | Papel |
|---|---|
| `tela-custos.tsx` | Tela inteira: estado das linhas, indicadores, rankings, `PATCH`/`DELETE` em `/api/custos/[id]`, estados de vazio e de erro |
| `ranking-custos.tsx` | Barras horizontais ordenadas (por categoria e por empreendimento); clicar filtra |
| `grade-custos.tsx` | Lançamentos: ordenar, buscar, filtrar, agrupar com subtotal, paginar, editar na linha |
| `components/painel/campo-moeda.tsx` | Campo de valor em reais com máscara — reutilizável nas próximas abas |

`app/(dashboard)/custos/page.tsx` consulta e entrega; a tela soma no navegador
(para os números acompanharem uma edição sem recarregar).

### Bibliotecas novas

- **`@tanstack/react-table` 9.3.1** — motor da grade (ordenação, filtros, agrupamento
  com soma, expansão, paginação); o HTML é nosso. **É a versão 9, com API diferente
  da 8:** `useTable({ features, columns, data })`, recursos registrados em
  `tableFeatures({...})` junto com seus `create*RowModel()`, estado em
  `tabela.state.<fatia>`. `features` e `colunas` ficam no escopo do módulo. A
  documentação vem no pacote: `node_modules/@tanstack/react-table/skills`.
- **`react-number-format` 5.4.5** — máscara de moeda (`CampoMoeda`). Devolve número;
  acabou o `parseFloat(texto.replace(',', '.'))`, que lia "1.234,50" como 1,234.

### O que mudou além do visual

1. **Tabela acompanha o mês** (o erro acima) e **"Atualizar" funciona**.
2. **`mes=0` não zera a aba:** mês fora de 1–12 cai no mês atual; `PeriodoNav` com
   `permitirTodos={false}`.
3. **Consulta em páginas de 1.000:** o banco corta em 1.000 linhas por consulta, sem
   avisar. Hoje são ~300 por mês; a página agora busca até acabar.
4. **Erro de consulta aparece como erro**, não como "mês sem custos".
5. **Total com 2 casas** (formatador local trocado por `moeda()`).
6. **Sugestões de categoria:** a consulta de sugestões para em 1.000 linhas ordenadas
   por nome (pode trazer só o começo do alfabeto); a tela completa com as categorias
   do próprio mês.
7. **Filtros gestão e origem separados** (antes era um seletor só: ADM, SUB,
   importação **ou** manual — não dava para combinar).
8. **Busca sem acento** e também por apartamento e observação.
9. **Filtro cruzado:** clicar numa categoria filtra a grade e recalcula o ranking de
   empreendimentos (e vice-versa). Cada ranking obedece à escolha do outro, nunca à
   própria. Trocar de mês limpa os filtros.
10. **"Lançamento manual" só para analista** (a API já recusava os demais).

### Comportamentos que podem surpreender

- Com a grade ordenada por valor, um lançamento editado **muda de posição** (pode ir
  para outra página). O aviso "Custo atualizado" confirma a gravação.
- Agrupado não pagina: cada grupo é uma linha com contagem e subtotal; os grupos
  vêm do maior para o menor.
- No celular a grade vira lista de cartões (`md:hidden`); a tabela existe a partir de 768px.

---

## Aba Custos Operacionais: plano de contas e valores por mês (06/11/2026)

### Antes e agora

**Antes:** a aba mostrava uma lista fixa escrita no código — 10 itens, R$ 43.509,92,
igual em todos os meses — mais um contador de "diárias avulsas × R$ 250" gravado em
`custos_operacionais_variaveis` (tabela que nunca recebeu uma linha). Nenhum custo
operacional real estava no sistema.

**Agora:** os custos são lançados conta a conta, mês a mês, no formato da planilha
"Controle Mensal de Custos Operacionais" (aba *Lançamentos*: cada linha é uma conta,
cada coluna um mês).

### ⚠ Estado em 06/11/2026: migration 047 e carga AINDA NÃO APLICADAS

O código está pronto, mas as tabelas não existem em produção — a aplicação pelo
agente foi recusada, fica para o analista. Enquanto isso a aba abre no estado
"Falta criar a estrutura no banco". Ordem:

1. Rodar `supabase/migrations/047_custos_operacionais_plano_de_contas.sql` no SQL Editor.
2. Rodar `dados custos operacionais/carga-custos-operacionais-2026.sql` (fora do git).
3. Conferir: 48 contas, 80 valores; jul 38.909,87 · ago 16.971,82 · set 63.910,30 · out 56.584,63.

Os dois arquivos foram validados num PostgreSQL descartável local (inclusive rodando
duas vezes e testando o acesso por papel), não na produção.

### Banco (migration 047 — só estrutura)

| Tabela | O que guarda |
|---|---|
| `custos_operacionais_contas` | Plano de contas: `codigo` (único), `nome`, `grupo`, `classificacao_dre`, `tipo` (`fixo`/`variavel`/`provisao`), `dia_vencimento`, `valor_base`, `observacao`, `ordem`, `ativo` |
| `custos_operacionais_lancamentos` | Valor da conta no mês: `conta_id`, `mes`, `ano`, `valor` (> 0), `origem` (`manual`/`planilha`). `UNIQUE (conta_id, mes, ano)` |

- Sem valor no mês = sem linha (zero não é lançamento). A chave única impede lançar em dobro.
- Conta com valor lançado não pode ser apagada (`ON DELETE RESTRICT`); encerra-se com `ativo = false`.
- RLS: leitura `is_interno()`; escrita só analista; `REVOKE ALL … FROM anon`.
- **A migration não traz contas nem valores de propósito:** a planilha tem nome e
  salário de funcionários e a migration vai para o repositório.

### Carga da planilha (jul–out/2026)

Lidas 48 contas e 80 valores. A soma do que foi digitado **não bate com o "TOTAL
GERAL" da planilha**, e a diferença é exata e explicada:

| Mês | Sistema | Planilha | Diferença | Motivo |
|---|---|---|---|---|
| jul | 38.909,87 | 35.756,68 | 3.153,19 | Financiamento Ramada fora do subtotal |
| ago | 16.971,82 | 15.193,65 | 1.778,17 | Ramada (1.720,85) + combustível digitado como texto (57,32) |
| set | 63.910,30 | 62.190,43 | 1.719,87 | Ramada |
| out | 56.584,63 | 55.505,04 | 1.079,59 | Ramada |

- **Financiamento Ramada:** a fórmula "SUBTOTAL — Consórcios" soma só as duas linhas
  de consórcio; a linha do financiamento, criada depois, ficou de fora.
- **Combustível de agosto:** a célula contém o texto `29,06+28,26` (soma sem o `=`).

Ajustes feitos na leitura (linhas criadas à mão na planilha, incompletas):

- `Financiamento Ramada` repetia o código 5.02 → entrou como **5.03**; o valor base e a
  observação eram cópia da linha de cima → entrou sem os dois.
- A conta 1.01 (uma linha de operação nova) sem classificação/tipo → herdou da conta de cima (CSV, fixo, dia 10).
- `Seguro Saúde` sem classificação → "Custo do serviço (CSV)", no grupo 2.
- `Uber` (grupo "4.Transportes") → grupo "4. Veículos / operação".
- O bloco 5 virou "5. Consórcios e financiamentos".
- Linhas de memória, subtotais e encargos calculados que deram zero não viram lançamento.

**Julho** veio preenchido com os valores do levantamento de 29/07/2026 (a própria
planilha diz que é "exemplo") — entrou como está. **Agosto** está incompleto (só 10 contas).

### Tela (`components/custos-operacionais/`)

| Arquivo | Papel |
|---|---|
| `tela-custos-operacionais.tsx` | Estado, indicadores, gravações, estados de vazio/erro/sem estrutura |
| `evolucao-ano.tsx` | 12 colunas do ano; a tracejada é a soma dos valores base; clicar abre o mês |
| `contas-do-mes.tsx` | Contas por grupo com subtotal; lançar na linha; variação contra o valor base |
| `dialogo-conta.tsx` | Criar/editar/encerrar conta |
| `components/painel/dialogo.tsx` | Diálogo acessível (Base UI) — reutilizável |
| `lib/custos-operacionais.ts` | Tipos e validação compartilhados com as rotas |

`RankingCustos` (da aba Custos) ganhou `cor`, `dica`, `vazio` e `controle` e é usado
aqui para "custos por grupo / DRE / vencimento".

- A página carrega o plano e os valores do **ano inteiro** (para o gráfico e para o
  mês anterior); a tela recorta o mês.
- **Lançar:** clicar no valor → campo; `Enter` grava e desce para a conta de baixo;
  sair do campo grava; `Esc` desiste; campo vazio/zero tira o valor do mês. Grava em
  segundo plano, sem travar a digitação.
- **Variação vs. base:** acima de 10% (`TOLERANCIA_BASE`, a mesma regra da planilha)
  vira aviso com seta e sinal.
- Conta encerrada só aparece no mês em que tem valor.
- Tipo, vencimento e mês anterior são colunas só em tela ≥ 1280px; abaixo disso tipo e
  vencimento vão para a linha da conta.

### Rotas

| Rota | O que faz |
|---|---|
| `PUT /api/custos-operacionais/lancamentos` | `{conta_id, mes, ano, valor}` — grava; `valor` nulo/0 remove |
| `POST /api/custos-operacionais/contas` | Cria conta (entra no fim do grupo) |
| `PATCH /api/custos-operacionais/contas/[id]` | Altera/encerra conta |

Todas exigem analista e gravam com a sessão do usuário (a RLS repete a regra).
`GET/POST /api/custos-operacionais` (diárias avulsas) continua existindo, sem uso na web.

### O que NÃO mudou — decisão pendente

- **Dashboard** (`app/(dashboard)/page.tsx:160`) e **app mobile**
  (`mobile/src/app/equipe/index.tsx:19`, `custos-operacionais.tsx`) continuam usando
  R$ 43.509,92/mês fixos + diárias × R$ 250. Trocar pelo valor real muda o lucro
  exibido, e agosto está incompleto — fica para decisão do usuário.
- O contador de diárias avulsas saiu da aba web (virou a conta "Diarias extras").

### Armadilha de layout encontrada

Texto `sr-only` dentro de uma área `overflow-x-auto` **escapa dela** (é `absolute` e o
bloco de contenção fica fora) e cria rolagem lateral na página inteira. A área rolável
precisa de `relative`.

> **REGRA:** Esta documentação deve ser atualizada **sempre** que houver mudanças no schema do banco, novas rotas, alterações de regras de negócio, novos componentes ou correções de bugs.

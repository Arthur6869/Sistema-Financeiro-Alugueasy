# 🏠 AlugEasy — Sistema Financeiro

Sistema web interno de gestão financeira para imóveis por temporada. Substitui o controle manual em planilhas Excel por um dashboard centralizado com banco de dados relacional, visualizações interativas e controle de acesso por perfil de usuário.

---

## ✨ Funcionalidades

- 🔐 **Autenticação segura** com email/senha via Supabase Auth
- 📊 **Dashboard** com KPIs de Faturamento, Custos e Lucro do mês
- 🏢 **Gestão de Empreendimentos e Apartamentos** — visualize todas as unidades
- 💰 **Custos** — histórico completo de despesas por unidade e categoria
- 🌙 **Diárias** — receita por unidade com tipo de gestão (ADM/SUB)
- 📈 **Relatório Analítico** — evolução dos últimos 6 meses com gráfico de linha e tabela pivot
- 📤 **Importação de Planilhas** — upload direto de arquivos `.xlsx` (apenas Admin)
- 👥 **Gestão de Usuários** — visão dos perfis cadastrados (apenas Admin)

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Node.js 20+
- npm 10+
- Conta no [Supabase](https://supabase.com)

### 1. Clonar e instalar dependências

```bash
git clone <repositório>
cd Sistema-Financeiro-Alugueasy
npm install
```

### 2. Configurar variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
OBSIDIAN_API_BASE=https://127.0.0.1:27124
OBSIDIAN_API_TOKEN=seu_token_da_api_local_do_obsidian
```

> As credenciais do projeto atual estão em `.env.local` (arquivo não versionado).

`OBSIDIAN_API_BASE` e `OBSIDIAN_API_TOKEN` habilitam a sincronização de contexto do projeto para o Obsidian via rota `POST /api/obsidian/sync`.

### 3. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

### 4. Build de produção

```bash
npm run build
npm start
```

---

## 📁 Estrutura do Projeto

```
.
├── app/
│   ├── (auth)/login/          # Página de login
│   ├── (dashboard)/           # Área protegida do sistema
│   │   ├── layout.tsx         # Layout com sidebar
│   │   ├── page.tsx           # Dashboard principal
│   │   ├── empreendimentos/   # Lista de empreendimentos
│   │   ├── apartamentos/      # Lista de unidades
│   │   ├── custos/            # Tabela de despesas
│   │   ├── diarias/           # Tabela de receitas
│   │   ├── relatorio/         # Análise dos últimos 6 meses
│   │   ├── importar/          # Upload de planilhas (admin)
│   │   └── usuarios/          # Usuários do sistema (admin)
│   ├── api/import/            # API Route para processar Excel
│   ├── globals.css            # Estilos globais
│   └── layout.tsx             # Root layout
│
├── components/
│   ├── app-sidebar.tsx        # Navegação lateral
│   ├── dashboard-charts.tsx   # Gráfico de barras
│   └── ui/                   # Componentes shadcn/ui
│
├── lib/
│   ├── constants.ts           # Constantes globais (meses, formatação)
│   ├── utils.ts               # Utilitários (cn helper)
│   └── supabase/
│       ├── client.ts          # Supabase client (browser)
│       └── server.ts          # Supabase client (servidor/SSR)
│
├── proxy.ts                   # Middleware de proteção de rotas
├── documentação.md            # Documentação técnica completa
├── AGENTS.md                  # Regras para agentes de IA
├── .env.local                 # Variáveis de ambiente (não versionado)
└── package.json               # Dependências
```

---

## 🛠️ Stack Tecnológico

| Tecnologia | Uso | Versão |
|---|---|---|
| Next.js | Framework web (App Router) | 16.2.1 |
| React | Interface de usuário | 19.2.4 |
| TypeScript | Linguagem tipada | 5.x |
| Tailwind CSS v4 | Estilização | 4.x |
| shadcn/ui | Componentes de UI | 4.x |
| Supabase | Banco de dados + Auth | cloud |
| Recharts | Gráficos interativos | 3.8.1 |
| SheetJS (xlsx) | Leitura de planilhas Excel | 0.18.5 |
| Lucide React | Ícones | 1.7.0 |

---

## 👥 Perfis de Acesso

| Funcionalidade | Admin | Analista |
|---|---|---|
| Ver Dashboard, Relatório, Listas | ✅ | ✅ |
| Importar Planilhas Excel | ✅ | ❌ |
| Ver página de Usuários | ✅ | ❌ |
| Escrever dados no banco | ✅ | ❌ |

---

## 📊 Banco de Dados

O sistema utiliza **Supabase (PostgreSQL 17)** com as seguintes tabelas:

- `profiles` — perfis e roles dos usuários
- `empreendimentos` — grupos de imóveis
- `apartamentos` — unidades individuais
- `custos` — despesas mensais por unidade
- `diarias` — receitas de diárias por unidade
- `importacoes` — histórico de uploads de planilhas

> Todas as tabelas possuem **Row Level Security (RLS)** habilitado.

Para detalhes completos do schema, veja [`documentação.md`](./documentação.md).

---

## ⚠️ Bugs Conhecidos

Existem **10 problemas identificados** no sistema atual. Os mais críticos:

- Login redireciona para `/dashboard` (404) — deve ir para `/`
- Campos errados na tabela `importacoes` na rota de upload
- Mês/ano hardcoded em Janeiro/2026 na importação
- Rota de importação não valida autenticação do usuário

Veja a lista completa em [`documentação.md`](./documentação.md) — Seção 12.

---

## 📄 Documentação

- **[`documentação.md`](./documentação.md)** — Documentação técnica completa: schema, rotas, componentes, bugs, segurança
- **[`AGENTS.md`](./AGENTS.md)** — Regras para agentes de IA que trabalham neste projeto

---

## 📌 Notas Importantes

- O projeto usa **Next.js 16** com **App Router** — APIs podem diferir das versões anteriores
- O middleware de autenticação está em `proxy.ts` (verifique se existe `middleware.ts` importando-o)
- Planilhas Excel devem seguir o formato específico das conferências AlugEasy (pares de colunas: número do apto / valor)

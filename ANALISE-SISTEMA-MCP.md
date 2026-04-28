# Análise Completa do Sistema — AlugEasy Financeiro
## Proposta de MCP Server para Diagnóstico por IA

> **Gerado em:** 27/04/2026
> **Finalidade:** Visão panorâmica do sistema atual + proposta de integração com agentes de IA via Model Context Protocol (MCP)

---

## Índice

1. [Visão Executiva](#1-visão-executiva)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitetura do Sistema](#3-arquitetura-do-sistema)
4. [Banco de Dados — Mapa Completo](#4-banco-de-dados--mapa-completo)
5. [Rotas e Páginas](#5-rotas-e-páginas)
6. [API Routes — Backend](#6-api-routes--backend)
7. [Pipeline de Importação de Planilhas](#7-pipeline-de-importação-de-planilhas)
8. [Integração Amenitiz](#8-integração-amenitiz)
9. [Controle de Acesso (RLS + Roles)](#9-controle-de-acesso-rls--roles)
10. [Componentes e UI](#10-componentes-e-ui)
11. [Bugs Conhecidos e Riscos Técnicos](#11-bugs-conhecidos-e-riscos-técnicos)
12. [Pontos Fortes do Sistema](#12-pontos-fortes-do-sistema)
13. [Gaps e Oportunidades de Melhoria](#13-gaps-e-oportunidades-de-melhoria)
14. [Proposta: MCP Server para Diagnóstico por IA](#14-proposta-mcp-server-para-diagnóstico-por-ia)
15. [Roadmap Sugerido](#15-roadmap-sugerido)

---

## 1. Visão Executiva

O **Sistema Financeiro AlugEasy** é uma aplicação web interna que centraliza o controle financeiro de imóveis administrados pela empresa. Ele substitui um processo manual baseado em planilhas Excel isoladas por um pipeline estruturado com banco relacional, dashboard interativo e controle de acesso por papéis.

### O que o sistema faz hoje

| Funcionalidade | Status |
|---|---|
| Importação de planilhas Excel (4 tipos: Custos ADM/SUB, Diárias ADM/SUB) | ✅ Funcionando |
| Dashboard com KPIs financeiros filtráveis por mês/ano | ✅ Funcionando |
| Relatório analítico dos últimos 6 meses com gráficos | ✅ Funcionando |
| Gestão de empreendimentos e apartamentos (CRUD) | ✅ Funcionando |
| Controle de acesso por roles (admin/analista) | ✅ Funcionando |
| Exportação de dados para XLSX | ✅ Funcionando |
| Geração de PDF de prestação de contas por apartamento | ✅ Funcionando |
| Sincronização automática com API Amenitiz | ✅ Funcionando |
| Cálculo de taxas por plataforma (Booking, Airbnb, Manual) | ✅ Funcionando |
| Log de importações com histórico | ✅ Funcionando |

### Escala atual

- **11 empreendimentos** cadastrados e reconhecidos pelo parser
- **~60+ apartamentos** mapeados com UUIDs Amenitiz
- **6 migrations** aplicadas no banco
- **8 tabelas** no schema público
- **9 API Routes** distintas

---

## 2. Stack Tecnológico

| Camada | Tecnologia | Versão | Papel no sistema |
|---|---|---|---|
| Framework | **Next.js App Router** | 16.2.1 | SSR, rotas, API Routes |
| Linguagem | **TypeScript** | 5.x | Tipagem estática |
| Runtime UI | **React** | 19.2.4 | Renderização de interface |
| Estilização | **Tailwind CSS v4** | 4.x | Classes utilitárias |
| Componentes | **shadcn/ui v4** | 4.x | Cards, Tabelas, Badges etc. |
| Banco de Dados | **Supabase (PostgreSQL 17)** | cloud | Armazenamento relacional |
| Autenticação | **Supabase Auth** | cloud | JWT via cookies httpOnly |
| Gráficos | **Recharts** | 3.8.1 | BarChart, LineChart |
| Excel I/O | **SheetJS (xlsx)** | 0.18.5 | Parsing e geração de .xlsx |
| PDF | **@react-pdf/renderer** | 4.3.3 | Prestação de contas PDF |
| Ícones | **Lucide React** | 1.7.0 | Ícones SVG |
| Formulários | **React Hook Form** | 7.72.0 | Gerenciamento de formulários |
| Validação | **Zod** | 4.3.6 | Schemas de validação |
| API Externa | **Amenitiz API** | REST | Reservas hoteleiras |

---

## 3. Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE VISUALIZAÇÃO                        │
│  Browser → Next.js App Router → React 19 + Recharts + shadcn/ui     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTP / Supabase JS SDK
┌────────────────────────────────▼────────────────────────────────────┐
│                        CAMADA DE APLICAÇÃO                           │
│  Server Components (SSR)   │  Client Components  │  API Routes       │
│  proxy.ts (middleware)     │  Hooks customizados │  /api/*           │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ PostgreSQL via Supabase SDK
┌────────────────────────────────▼────────────────────────────────────┐
│                        CAMADA DE DADOS                               │
│  Supabase Auth (JWT + cookies)  │  PostgreSQL 17 — 8 tabelas        │
│  Row Level Security (RLS)       │  6 migrations aplicadas           │
└──────────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│                     INTEGRAÇÃO EXTERNA                               │
│  Amenitiz API REST  (reservas, room_ids, valores brutos/líquidos)   │
└──────────────────────────────────────────────────────────────────────┘
```

### Fluxo de autenticação

```
Request HTTP
      ↓
proxy.ts (middleware Supabase SSR)
      ↓
¿ Autenticado? ─── NÃO ──→ redirect /login
      │
     SIM
      ↓
¿ É /login? ─── SIM ──→ redirect /
      │
     NÃO
      ↓
Server Component verifica role no banco
      ↓
Renderiza página ou redirect
```

---

## 4. Banco de Dados — Mapa Completo

### 4.1 Diagrama de Relacionamentos

```
auth.users (Supabase nativo)
      │
      ├──────────────────────────────────────────────┐
      ▼                                              ▼
  profiles                                     importacoes
  id (fk auth.users)                           importado_por (fk auth.users)
  full_name
  role ('admin'|'analista')

empreendimentos
  id (uuid PK)
  nome (UNIQUE)
      │
      ▼
  apartamentos
  id (uuid PK)
  empreendimento_id (fk)
  numero
  taxa_repasse
  tipo_repasse ('lucro'|'faturamento')
  nome_proprietario
  modelo_contrato ('administracao'|'sublocacao')
  tipo_gestao ('adm'|'sub')
  amenitiz_room_id (uuid UNIQUE) ◄── link com Amenitiz
      │
      ├──────────────────────┐
      ▼                      ▼
   custos                  diarias
   mes, ano                data
   categoria               valor
   valor                   tipo_gestao
   tipo_gestao
                           amenitiz_reservas
                           booking_id (UNIQUE)
                           status, source
                           checkin, checkout
                           valor_bruto, taxa_aplicada, valor_liquido
                           mes_competencia, ano_competencia
                           raw_data (jsonb)

amenitiz_syncs
  log de cada sincronização realizada
```

### 4.2 Tabelas e Restrições Críticas

| Tabela | Registros esperados | Restrições de valor críticas |
|---|---|---|
| `profiles` | 1 por usuário | `role` = `'admin'` ou `'analista'` apenas |
| `empreendimentos` | 11 cadastros | `nome` UNIQUE |
| `apartamentos` | ~60+ unidades | UNIQUE `(empreendimento_id, numero)` · `amenitiz_room_id` UNIQUE |
| `custos` | Centenas por mês | UNIQUE `(apartamento_id, mes, ano, categoria, tipo_gestao)` |
| `diarias` | Dezenas por mês | UNIQUE `(apartamento_id, data, tipo_gestao)` |
| `importacoes` | 1 registro por upload | `status` = `'concluido'` ou `'erro'` · `tipo` = `'custos_adm'|'custos_sub'|'diarias_adm'|'diarias_sub'` |
| `amenitiz_reservas` | Centenas por mês | `booking_id` UNIQUE |
| `amenitiz_syncs` | 1 por sincronização | log imutável |

### 4.3 RLS — Políticas ativas

| Tabela | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `profiles` | Próprio usuário ou qualquer admin | Apenas admins |
| `empreendimentos` | Qualquer autenticado | Apenas admins |
| `apartamentos` | Qualquer autenticado | Apenas admins |
| `custos` | Qualquer autenticado | Apenas admins |
| `diarias` | Qualquer autenticado | Apenas admins |
| `importacoes` | Qualquer autenticado | Apenas admins |
| `amenitiz_reservas` | Qualquer autenticado | Apenas analistas (para sync) |
| `amenitiz_syncs` | Qualquer autenticado | Apenas analistas (para sync) |

### 4.4 Migrations aplicadas

| Migration | O que fez |
|---|---|
| `001` | Adicionou constraints UNIQUE em `custos` e `diarias` para evitar duplicatas |
| `002` | Corrigiu vulnerabilidade `search_path injection` na função `handle_new_user()` |
| `003` | Adicionou colunas de repasse e contrato em `apartamentos` para prestação de contas |
| `004` | Criou tabelas iniciais `amenitiz_syncs` e `amenitiz_reservas` |
| `005` | Recriou `amenitiz_reservas` com schema correto (campos reais da API Amenitiz) |
| `006` | Adicionou `tipo_gestao` e `amenitiz_room_id` em `apartamentos` + mapeou ~60 UUIDs |

---

## 5. Rotas e Páginas

### 5.1 Mapa completo de rotas

| Rota | Tipo | Acesso | Descrição |
|---|---|---|---|
| `/login` | Public | Todos | Formulário email+senha |
| `/` | Protected | Autenticados | Dashboard: 4 KPIs + gráfico de barras por empreendimento |
| `/empreendimentos` | Protected | Autenticados | CRUD empreendimentos + apartamentos, métricas financeiras |
| `/apartamentos` | Protected | Autenticados | Redireciona para `/empreendimentos` |
| `/custos` | Protected | Autenticados | Tabela de despesas com filtro mês/ano |
| `/diarias` | Protected | Autenticados | Tabela de receitas com filtro mês/ano |
| `/relatorio` | Protected | Autenticados | Análise histórica dos últimos 6 meses (gráfico + pivot) |
| `/prestacao-contas` | Protected | Autenticados | Prestação de contas por apartamento + geração de PDF |
| `/importar` | Protected | **Admin only** | Upload de planilhas Excel (4 tipos) + histórico |
| `/usuarios` | Protected | **Admin only** | Lista e cadastro de usuários |
| `/executar-migration` | Protected | Admin | Executa migrations manualmente |

### 5.2 Detalhes das páginas principais

#### Dashboard (`/`)
- **KPIs:** Faturamento Total, Custos Totais, Lucro Líquido, Margem (%)
- **Filtro:** `MonthYearFilter` — atualiza via `searchParams` da URL
- **Gráficos:** `DashboardCharts` — barras por empreendimento (Faturamento e Lucro)
- **Admin extras:** Botão "Limpar Dados" e botão "Sincronizar Amenitiz"
- **Fonte de dados:** tabelas `diarias` + `amenitiz_reservas` + `custos`

#### Empreendimentos (`/empreendimentos`)
- **Toggle:** Visão Lista / Visão Detalhe
- **Lista:** Cards com Faturamento, Custos, Lucro, contagem de apartamentos
- **Detalhe:** Breakdown ADM/SUB, tabela de apartamentos com métricas individuais, gráficos
- **Modais:** Criar Empreendimento, Criar Apartamento, Editar Repasse
- **Admin extras:** botões de exclusão com cascata no banco

#### Relatório (`/relatorio`)
- Calcula automaticamente os últimos 6 meses a partir da data atual
- **Gráfico de linha:** Faturamento / Custos / Lucro por mês
- **Tabela pivot:** Categoria de custo × Mês
- **KPIs separados:** ADM vs SUB

#### Prestação de Contas (`/prestacao-contas`)
- Seleção de apartamento + período
- Cálculo de: Faturamento, Custos, Lucro, Repasse ao proprietário
- Botão de geração de PDF via `/api/prestacao-contas-pdf`

---

## 6. API Routes — Backend

### `POST /api/import`
Importa planilha Excel. Requer role `admin`.

**Fluxo:**
1. Recebe `FormData` com `file`, `tipo`, `mes`, `ano`
2. Valida autenticação e role admin
3. SheetJS lê o buffer do arquivo
4. Carrega empreendimentos e apartamentos em memória
5. Processa cada aba (custos) ou sheet "RESULTADO" (diárias)
6. Extrai valores com 3 estratégias de fallback para localizar linhas de total
7. DELETE dos registros existentes para `(mes, ano, tipo_gestao)`
8. INSERT dos novos registros + log em `importacoes`

**Parser sofisticado:**
- Normalização de nomes de empreendimento
- Parsing de valores monetários (R$, vírgulas, pontos)
- Múltiplos formatos de layout suportados
- Zeros à esquerda em número de apartamento

---

### `DELETE /api/clear`
Limpa dados de um período completo. Requer role `admin`.

Deleta: `diarias`, `custos`, `importacoes`, `amenitiz_reservas`, `amenitiz_syncs`

---

### `POST /api/amenitiz-sync`
Sincroniza reservas da API Amenitiz para o banco local.

**Fluxo:**
1. Recebe `{ mes, ano }` no body
2. Chama `fetchTodasReservasMes(mes, ano)` em `lib/amenitiz.ts`
3. Merge de 3 endpoints: `/bookings/checkin`, `/bookings/created`, `/bookings/updated`
4. Para cada reserva: extrai `individual_room_id`, busca apartamento no banco
5. Calcula `valor_liquido` com base na plataforma e empreendimento
6. Upsert em `amenitiz_reservas` por `booking_id`
7. Registra log em `amenitiz_syncs`

---

### `GET /api/prestacao-contas-pdf`
Gera PDF de prestação de contas. Retorna `application/pdf` para download.

---

### `GET|POST /api/apartamentos`
CRUD de apartamentos. GET lista todos; POST cria novo.

---

### `GET|POST /api/usuarios`
Gerenciamento de usuários. Requer admin.

---

### `POST /api/migrate` e `POST /api/run-migration`
Executam migrations SQL no banco via API. Uso interno.

---

## 7. Pipeline de Importação de Planilhas

### Tipos e destinos

| `tipo` enviado | `tipo_gestao` gravado | Tabela destino |
|---|---|---|
| `custos_adm` | `'adm'` | `custos` |
| `custos_sub` | `'sub'` | `custos` |
| `diarias_adm` | `'adm'` | `diarias` |
| `diarias_sub` | `'sub'` | `diarias` |

### Formato das planilhas de Custos

```
Sheet: "ESSENCE"         ← nome da aba = nome do empreendimento
| Apartamento | 101 | 102 | 103 | ...
|-------------|-----|-----|-----|
| Amenitiz    | 30  | 25  | 40  |
| Limpeza     | 45  | 50  | 35  |
| TOTAL:      | 75  | 75  | 75  | ← linha extraída
```

### Formato das planilhas de Diárias

```
Sheet: "RESULTADO"
| Empreendimento | FAT     | ...
|----------------|---------|
| ESSENCE        | 1500.00 |
| EASY           | 2200.00 |
```

### Estratégias de localização de totais (3 camadas)

1. Procura linha com texto `TOTAL:` ou `Total`
2. Procura última linha com valor numérico
3. Soma todas as linhas numéricas como fallback

### Empreendimentos reconhecidos

```
ESSENCE · EASY · CULLINAN · ATHOS · NOBILE · FUSION
MERCURE · METROPOLITAN · RAMADA · BRISAS · VISION
```

---

## 8. Integração Amenitiz

### Tabela de taxas por plataforma

| Empreendimento | Booking | Airbnb | Manual/Direto |
|---|---|---|---|
| Essence, Metropolitan, Cullinan, Brisas, Mercure | 16% | 0% | 10% |
| Easy, Athos, Nobile, Fusion, Ramada, Vision | 13% | 0% | 10% |
| Mercure apt 1419 | 13% (exceção) | 0% | 10% |

### Funções principais em `lib/amenitiz.ts`

| Função | Descrição |
|---|---|
| `extrairEmpreendimento(roomName)` | Parse `"Brisas do Lago - Apt 101"` → `"BRISAS DO LAGO"` |
| `calcularValorLiquido(...)` | Aplica taxa por plataforma e retorna `{ valorLiquido, taxaAplicada, plataformaNormalizada }` |
| `fetchTodasReservasMes(mes, ano)` | Busca 3 endpoints em paralelo e faz merge por `booking_id` |
| `testConnection()` | Diagnóstico de conectividade com a API Amenitiz |

### Mapeamento de apartamentos

A migration `006` mapeou ~60 apartamentos com `amenitiz_room_id` (UUID estável da API):

| Empreendimento | Apartamentos mapeados |
|---|---|
| ATHOS | 8 unidades |
| BRISAS | 5 unidades |
| CULLINAN | 6 unidades |
| EASY | 3 unidades |
| ESSENCE | 9 unidades |
| FUSION | 4 unidades |
| MERCURE | 9 unidades |
| METROPOLITAN | 8 unidades |
| NOBILE | 2 unidades |

---

## 9. Controle de Acesso (RLS + Roles)

### Diferença semântica dos roles (IMPORTANTE)

> **`analista`** = operador do sistema → tem permissão de escrita (importações, sync)
> **`admin`** = gestor → leitura + gerenciamento estrutural (criar empreendimentos, usuarios)

| Funcionalidade | `admin` | `analista` |
|---|---|---|
| Ver Dashboard, Relatório, Custos, Diárias | ✅ | ✅ |
| Criar/Excluir Empreendimento ou Apartamento | ✅ | ❌ RLS bloqueia |
| Importar Planilhas | ✅ | ❌ redirect na página |
| Gerenciar Usuários | ✅ | ❌ redirect para `/` |
| Limpar dados do período | ✅ | ❌ API verifica role |
| Sincronizar Amenitiz | ✅ | ✅ |
| Gerar PDF prestação de contas | ✅ | ✅ |

### Camadas de proteção

```
1. Sidebar     → itens admin ficam ocultos para analistas
2. Page        → Server Component verifica role + redirect
3. RLS         → PostgreSQL bloqueia INSERT/UPDATE/DELETE
4. API Route   → verificação manual de autenticação e role
```

---

## 10. Componentes e UI

### Componentes de dados

| Componente | Tipo | Props principais |
|---|---|---|
| `DashboardCharts` | Client | `data: { empreendimento, faturamento, lucro }[]` |
| `RelatorioLineChart` | Client | `data: { label, faturamento, custos, lucro }[]` |
| `EmpreendimentosListCharts` | Client | Lista de empreendimentos com métricas |
| `EmpreendimentoDetailCharts` | Client | Detalhe por empreendimento |
| `ApartamentoCharts` | Client | Métricas por unidade |

### Componentes interativos

| Componente | Função |
|---|---|
| `MonthYearFilter` | Dropdowns que atualizam `searchParams` via `useRouter` |
| `DeleteButton` | Confirma antes de deletar via Supabase client |
| `LimparDadosButton` | Chama `DELETE /api/clear` com contagem de retorno |
| `AmenitizSyncButton` | Dispara `POST /api/amenitiz-sync` |
| `GerarPdfButton` | Abre PDF via `/api/prestacao-contas-pdf` |
| `CriarEmpreendimentoModal` | Insere em `empreendimentos` + `router.refresh()` |
| `CriarApartamentoModal` | Insere em `apartamentos` + `router.refresh()` |
| `EditarApartamentoRepasseModal` | Edita taxas de repasse do apartamento |
| `CadastrarUsuarioModal` | Cria usuário via `/api/usuarios` |

### Componentes shadcn/ui disponíveis

`Card · CardContent · CardHeader · CardTitle · CardDescription`
`Badge · Button · Input · Label · Table · TableBody · TableCell`
`TableHead · TableHeader · TableRow · Tooltip · TooltipContent`
`TooltipTrigger · TooltipProvider · Avatar · AvatarFallback`
`DropdownMenu · Separator · Sheet · Sidebar · Skeleton`

---

## 11. Bugs Conhecidos e Riscos Técnicos

### Bugs ativos

| # | Severidade | Descrição | Arquivo | Impacto |
|---|---|---|---|---|
| B3 | 🔴 Crítico | Após login pode redirecionar para `/dashboard` (rota inexistente) | `login/page.tsx` | Tela branca para usuários |
| B4 | 🔴 Crítico | Analistas em `/usuarios` podem ser redirecionados para `/dashboard` | `usuarios/page.tsx` | Erro 404 |
| B10 | 🟡 Médio | `.env.local` pode ter espaços no final das variáveis | `.env.local` | Falha silenciosa de conexão em deploy |

### Riscos técnicos identificados

| Risco | Descrição | Probabilidade | Impacto |
|---|---|---|---|
| **Parsing frágil de planilhas** | O parser depende de nomes exatos de abas e da existência da linha "TOTAL:" | Alta | Importação falha silenciosamente |
| **Mapeamento Amenitiz hardcoded** | `amenitiz_room_id` foi inserido manualmente na migration `006` | Média | Novos apartamentos não sincronizam |
| **`ANOS` hardcoded** | `lib/constants.ts` tem `ANOS = [2026]` | Alta | Filtros quebrarão em 2027 |
| **Sem tratamento de erro no parser** | Erros no XLSX não retornam mensagem útil ao usuário | Média | Usuário não sabe o que errou |
| **Sem retry na sync Amenitiz** | Se a API falhar a meio, dados ficam parcialmente gravados | Média | Inconsistência nos relatórios |
| **Sem índices de performance** | Não há índices em `custos(mes, ano)` e `diarias(data)` | Baixa (agora) | Lentidão com volume alto |
| **Sem testes automatizados** | Zero cobertura de testes (unit, integration, e2e) | Alta | Regressões invisíveis |
| **Migrations via API** | `/api/migrate` e `/api/run-migration` executam SQL arbitrário | Alta | Risco de segurança em produção |
| **`amenitiz.ts` com hotel_id cacheado em memória** | Reinicialização do servidor limpa o cache | Baixa | Nova tentativa na próxima sync |

---

## 12. Pontos Fortes do Sistema

- **RLS em todas as tabelas** — segurança de dados garantida no banco
- **Parser de planilhas robusto** — suporta múltiplos formatos com 3 estratégias de fallback
- **Integração Amenitiz completa** — merge de 3 endpoints, cálculo de taxas, auditoria com `raw_data`
- **Deduplicação de dados** — constraints UNIQUE + DELETE antes de INSERT
- **Arquitetura de 4 camadas de acesso** — sidebar, page, RLS, API
- **Geração de PDF** — prestação de contas por apartamento
- **Trigger automático** — novos usuários criados no Auth já recebem entry em `profiles`
- **Histórico de importações** — rastreabilidade de quem importou o quê e quando
- **Gráficos interativos** — Recharts com dados reais do banco

---

## 13. Gaps e Oportunidades de Melhoria

### Prioridade Alta

1. **Testes automatizados** — nenhuma cobertura hoje; qualquer mudança pode quebrar silenciosamente
2. **`ANOS` dinâmico** — substituir array fixo `[2026]` por cálculo baseado em `new Date().getFullYear()`
3. **Erros claros na importação** — mostrar qual aba/coluna falhou e por quê
4. **Índices no banco** — `custos(mes, ano)`, `diarias(data)`, `amenitiz_reservas(mes_competencia, ano_competencia)`
5. **Remover `/api/migrate` e `/api/run-migration`** — executar migrations apenas via CLI Supabase

### Prioridade Média

6. **Observabilidade de erros** — integrar Sentry ou similar para capturar exceções em produção
7. **Rate limiting na API** — proteger `/api/import` e `/api/amenitiz-sync` de abuso
8. **Retry automático na sync Amenitiz** — garantir idempotência mesmo com falhas parciais
9. **Notificações** — alertas quando sync falha ou importação retorna erro
10. **Backup das planilhas** — salvar o `.xlsx` original no Supabase Storage

### Prioridade Baixa

11. **Dark mode** — já tem variáveis CSS preparadas pelo shadcn, falta implementar toggle
12. **Paginação nas tabelas** — custos e diárias podem crescer muito sem paginação
13. **Filtro por empreendimento** — dashboard mostra tudo; filtrar por imóvel seria útil
14. **Auditoria de ações** — log de quem criou/deletou empreendimentos e apartamentos

---

## 14. Proposta: MCP Server para Diagnóstico por IA

### O que é o Model Context Protocol (MCP)?

O MCP é um protocolo aberto criado pela Anthropic que permite que agentes de IA (Claude, Cursor, outros) se conectem a servidores externos para executar ferramentas, ler contextos e diagnosticar sistemas em tempo real. Em vez de um agente "adivinhar" o que está errado, ele pode **perguntar ao sistema**, **ler logs**, **consultar o banco** e **executar verificações** diretamente.

### Por que criar um MCP Server para o AlugEasy?

O sistema já tem todas as peças para ser monitorado por IA:
- Banco estruturado com dados financeiros
- Logs de importação em `importacoes`
- Logs de sync em `amenitiz_syncs`
- API Routes que retornam JSON
- Regras de negócio documentadas

Falta uma camada que exponha tudo isso de forma que um agente de IA possa **perguntar, diagnosticar e sugerir correções** sem precisar de acesso direto ao código.

---

### Arquitetura proposta do MCP Server

```
┌──────────────────────────────────────────────────────────────────┐
│                    AGENTES DE IA                                  │
│   Claude Code · Cursor · Claude.ai · Agentes customizados        │
└────────────────────────────┬─────────────────────────────────────┘
                             │ MCP Protocol (JSON-RPC 2.0)
┌────────────────────────────▼─────────────────────────────────────┐
│               MCP SERVER — alugueasy-mcp                         │
│   Node.js / TypeScript · Porta 3001 (ou stdio)                   │
│                                                                   │
│   Tools expostos:                                                 │
│   ┌────────────────────────────────────────────────────────┐     │
│   │ diagnose_system       │ check_import_errors            │     │
│   │ check_amenitiz_sync   │ get_financial_summary          │     │
│   │ list_known_bugs       │ validate_database_integrity    │     │
│   │ check_missing_data    │ get_import_history             │     │
│   │ explain_rls_policies  │ check_anos_hardcoded           │     │
│   └────────────────────────────────────────────────────────┘     │
└────────────────────────────┬─────────────────────────────────────┘
                             │ Supabase SDK (service role)
┌────────────────────────────▼─────────────────────────────────────┐
│                    SUPABASE / POSTGRESQL                          │
│  profiles · empreendimentos · apartamentos · custos               │
│  diarias · importacoes · amenitiz_reservas · amenitiz_syncs       │
└──────────────────────────────────────────────────────────────────┘
```

---

### Tools que o MCP Server deve expor

#### `diagnose_system`
> Visão geral de saúde do sistema. Ideal para abrir uma conversa com o agente.

**Retorna:**
- Contagem de registros em cada tabela
- Última importação realizada (data, tipo, status)
- Última sync Amenitiz (data, registros, status)
- Mês/ano com dados mais recentes
- Lista de problemas detectados automaticamente

---

#### `check_import_errors`
> Verifica se há importações com erro nos últimos N meses.

**Parâmetros:** `{ meses?: number }` — padrão: últimos 3 meses

**Retorna:**
- Lista de importações com `status = 'erro'`
- Tipo da planilha, mês/ano, nome do arquivo
- Sugestão de reprocessamento

---

#### `check_amenitiz_sync`
> Verifica a integridade da última sincronização Amenitiz.

**Parâmetros:** `{ mes: number, ano: number }`

**Retorna:**
- Número de reservas sincronizadas
- Apartamentos com `amenitiz_room_id` não mapeados (sem reservas)
- Divergência entre `valor_bruto` e `valor_liquido` (taxas suspeitas)
- Status da última sync

---

#### `validate_database_integrity`
> Verifica consistência interna do banco.

**Checklist executado:**
- Apartamentos sem `empreendimento_id` válido
- Custos com `mes` fora do range 1–12
- Diárias com `valor = 0` (pode indicar erro de importação)
- `amenitiz_reservas` com `booking_id` duplicado
- Profiles com `role` inválido (nem `admin` nem `analista`)
- Empreendimentos sem nenhum apartamento cadastrado

---

#### `get_financial_summary`
> Resumo financeiro de um período.

**Parâmetros:** `{ mes: number, ano: number, tipo?: 'adm'|'sub'|'all' }`

**Retorna:**
- Faturamento total
- Custos totais por categoria
- Lucro líquido
- Margem (%)
- Comparativo com mês anterior

---

#### `check_missing_data`
> Identifica meses com dados incompletos (importações faltando).

**Parâmetros:** `{ ano: number }`

**Retorna:**
- Para cada mês do ano: quais dos 4 tipos de planilha foram importados
- Meses sem nenhuma importação
- Alertas de períodos com apenas ADM ou apenas SUB (suspeito)

---

#### `list_known_bugs`
> Lista os bugs documentados com status atual.

**Retorna:**
- Lista dos bugs do `AGENTS.md` e `documentação.md`
- Para cada bug: severidade, arquivo afetado, se foi corrigido ou não
- Sugestão de próximos passos

---

#### `check_anos_hardcoded`
> Verifica se `lib/constants.ts` está desatualizado.

**Lógica:**
- Lê o valor atual de `ANOS` em `constants.ts`
- Compara com o ano atual
- Retorna aviso se o array não contém o ano corrente

---

#### `get_import_history`
> Histórico de importações com filtros.

**Parâmetros:** `{ mes?: number, ano?: number, tipo?: string, limit?: number }`

**Retorna:** Lista de importações com data, arquivo, usuário, status

---

#### `explain_rls_policies`
> Descreve as políticas de acesso ativas em linguagem natural.

**Retorna:**
- Para cada tabela: quem pode ler, quem pode escrever
- Identifica inconsistências (tabela sem RLS ativo)

---

### Implementação: estrutura de arquivos sugerida

```
mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                  # Ponto de entrada do servidor MCP
│   ├── server.ts                 # Configuração do MCP server (stdio ou HTTP)
│   ├── supabase.ts               # Cliente Supabase com service role key
│   ├── tools/
│   │   ├── diagnose-system.ts
│   │   ├── check-import-errors.ts
│   │   ├── check-amenitiz-sync.ts
│   │   ├── validate-database-integrity.ts
│   │   ├── get-financial-summary.ts
│   │   ├── check-missing-data.ts
│   │   ├── list-known-bugs.ts
│   │   ├── check-anos-hardcoded.ts
│   │   ├── get-import-history.ts
│   │   └── explain-rls-policies.ts
│   └── types/
│       └── index.ts              # Tipos compartilhados
├── .env                          # SUPABASE_SERVICE_ROLE_KEY
└── README.md
```

---

### Dependências necessárias

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.52.0",
    "@modelcontextprotocol/sdk": "^1.12.0",
    "@supabase/supabase-js": "^2.100.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "tsx": "^4"
  }
}
```

---

### Exemplo de código — `src/index.ts`

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { supabase } from "./supabase.js";

const server = new McpServer({
  name: "alugueasy-mcp",
  version: "1.0.0",
});

server.tool(
  "diagnose_system",
  "Verifica a saúde geral do sistema AlugEasy",
  {},
  async () => {
    const [
      { count: totalCustos },
      { count: totalDiarias },
      { count: totalImportacoes },
      { data: ultimaImportacao },
      { data: ultimaSync },
    ] = await Promise.all([
      supabase.from("custos").select("*", { count: "exact", head: true }),
      supabase.from("diarias").select("*", { count: "exact", head: true }),
      supabase.from("importacoes").select("*", { count: "exact", head: true }),
      supabase.from("importacoes").select("*").order("created_at", { ascending: false }).limit(1),
      supabase.from("amenitiz_syncs").select("*").order("created_at", { ascending: false }).limit(1),
    ]);

    const problemas: string[] = [];
    if (!ultimaImportacao?.length) problemas.push("Nenhuma importação realizada ainda");
    if (ultimaImportacao?.[0]?.status === "erro") problemas.push("Última importação resultou em ERRO");

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          totais: { custos: totalCustos, diarias: totalDiarias, importacoes: totalImportacoes },
          ultima_importacao: ultimaImportacao?.[0] ?? null,
          ultima_sync_amenitiz: ultimaSync?.[0] ?? null,
          problemas_detectados: problemas,
        }, null, 2),
      }],
    };
  }
);

server.tool(
  "check_import_errors",
  "Lista importações com erro nos últimos meses",
  { meses: z.number().optional().default(3) },
  async ({ meses }) => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - meses);

    const { data } = await supabase
      .from("importacoes")
      .select("*")
      .eq("status", "erro")
      .gte("created_at", cutoff.toISOString())
      .order("created_at", { ascending: false });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          total_erros: data?.length ?? 0,
          importacoes_com_erro: data ?? [],
        }, null, 2),
      }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

---

### Como configurar no Claude Code

Após criar o servidor, adicionar ao `.claude/settings.json` do projeto:

```json
{
  "mcpServers": {
    "alugueasy": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://rlkmljeatapayiroggrp.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "<service_role_key>"
      }
    }
  }
}
```

Após isso, o Claude Code passa a ter acesso às tools do MCP no contexto deste projeto. Qualquer prompt como "verifique se há erros de importação este mês" ou "qual a saúde do banco agora?" usará as tools automaticamente.

---

### Como configurar no Claude.ai

No Claude Desktop App (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "alugueasy": {
      "command": "node",
      "args": ["/caminho/absoluto/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://rlkmljeatapayiroggrp.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "<service_role_key>"
      }
    }
  }
}
```

---

### Segurança do MCP Server

> ⚠️ **Atenção crítica:** O MCP Server usa a **service role key** do Supabase, que ignora RLS. Isso significa que ele tem acesso total ao banco.

**Medidas obrigatórias:**

1. **Nunca expor o MCP Server publicamente** — rodar apenas em `localhost` ou `stdio`
2. **Somente leitura nas tools** — nenhuma tool deve executar `INSERT`, `UPDATE` ou `DELETE`
3. **Service Role Key nunca no código** — sempre via variável de ambiente
4. **Sem transport HTTP em produção** — usar `StdioServerTransport` apenas
5. **Não commitar `.env` do mcp-server** — adicionar ao `.gitignore`

---

## 15. Roadmap Sugerido

### Fase imediata (1–2 semanas)

- [ ] Corrigir B3 e B4 (`/dashboard` → `/`)
- [ ] Tornar `ANOS` dinâmico em `lib/constants.ts`
- [ ] Remover `/api/migrate` e `/api/run-migration` de produção

### Fase 1 (2–4 semanas) — Observabilidade

- [ ] Criar o **MCP Server** com as 10 tools listadas acima
- [ ] Adicionar índices de performance no banco (`custos(mes,ano)`, `diarias(data)`)
- [ ] Integrar Sentry ou LogFlare para captura de erros em produção

### Fase 2 (1–2 meses) — Qualidade

- [ ] Escrever testes para o parser de planilhas (`lib/xlsx-parser.ts`)
- [ ] Escrever testes para `lib/amenitiz.ts` (cálculo de taxas)
- [ ] Adicionar erros claros no formulário de importação
- [ ] Paginação nas tabelas de Custos e Diárias

### Fase 3 (2–3 meses) — Features

- [ ] Notificações automáticas de erro de sync/importação (email ou Slack)
- [ ] Dashboard de auditoria (quem fez o quê, quando)
- [ ] Comparativo mensal automático (vs. mesmo mês do ano anterior)
- [ ] Filtro por empreendimento no dashboard principal
- [ ] Relatório exportável em PDF consolidado

---

> **Próximo passo recomendado:** Criar o `mcp-server/` e implementar as primeiras 3 tools (`diagnose_system`, `check_import_errors`, `validate_database_integrity`). Com isso, qualquer agente de IA já consegue fazer perguntas ao sistema e identificar problemas em tempo real sem precisar ler o código-fonte.

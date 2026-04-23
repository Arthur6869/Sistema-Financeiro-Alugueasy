# Sistema Financeiro AlugEasy — Visão Completa

> **Documento:** Apresentação geral do sistema, histórico de evolução e pendências  
> **Versão:** 1.0  
> **Data:** 16/04/2026  
> **Projeto Supabase:** `rlkmljeatapayiroggrp` — Região: `sa-east-1` (São Paulo)

---

## Sumário

1. [O que é o sistema](#1-o-que-é-o-sistema)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitetura](#3-arquitetura)
4. [Banco de dados — visão geral](#4-banco-de-dados--visão-geral)
5. [Histórico de evolução — do início até hoje](#5-histórico-de-evolução--do-início-até-hoje)
6. [O que está pronto hoje](#6-o-que-está-pronto-hoje)
7. [O que falta para finalizar](#7-o-que-falta-para-finalizar)
8. [Rotas e páginas do sistema](#8-rotas-e-páginas-do-sistema)
9. [Fluxos principais](#9-fluxos-principais)
10. [Controle de acesso](#10-controle-de-acesso)
11. [Variáveis de ambiente](#11-variáveis-de-ambiente)

---

## 1. O que é o sistema

O **Sistema Financeiro AlugEasy** é uma plataforma web interna criada para centralizar e automatizar o controle financeiro da empresa **AlugEasy** — uma gestora de imóveis para hospedagem por temporada (short stay).

### Problema que resolve

Antes do sistema, o controle financeiro era feito manualmente em planilhas Excel isoladas, uma por mês, sem histórico centralizado, sem comparativos e sem controle de acesso. Cada mês exigia consolidação manual dos dados de múltiplos empreendimentos e apartamentos.

### O que o sistema faz

- **Importa** planilhas Excel mensais de 4 tipos: Custos ADM, Custos SUB, Diárias ADM, Diárias SUB
- **Sincroniza** reservas diretamente da API da Amenitiz (plataforma de gestão de hospedagem)
- **Armazena** todos os dados financeiros por empreendimento e apartamento no Supabase
- **Exibe** dashboard com KPIs financeiros (faturamento, custos, lucro, margem) filtrável por mês/ano
- **Gera** relatórios analíticos com gráficos dos últimos 6 meses
- **Calcula** e exibe prestação de contas por apartamento com valor de repasse ao proprietário
- **Gera PDF** de prestação de contas para cada proprietário
- **Controla** usuários com dois perfis: `analista` (acesso completo + sincronização) e `admin` (somente leitura)
- **Permite** exportação de dados para XLSX

### Empreendimentos gerenciados

| Empreendimento | Observação |
|---|---|
| ESSENCE | — |
| EASY | — |
| CULLINAN | — |
| ATHOS | Aparece como "AB" na Amenitiz |
| NOBILE | — |
| FUSION | — |
| MERCURE | Taxa Booking 16% (exceto apt 1419 → 13%) |
| METROPOLITAN | — |
| RAMADA | — |
| BRISAS | Nome completo na Amenitiz: "Brisas do Lago" |
| VISION | — |

---

## 2. Stack tecnológico

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js App Router | 16.2.1 |
| Runtime | React | 19.2.4 |
| Linguagem | TypeScript | 5.x |
| Estilização | Tailwind CSS v4 | 4.x |
| Componentes UI | shadcn/ui | 4.x |
| Banco de dados | Supabase (PostgreSQL 17) | cloud |
| Autenticação | Supabase Auth + `@supabase/ssr` | cloud |
| Gráficos | Recharts | 3.8.1 |
| Excel (parse/export) | SheetJS (xlsx) | 0.18.5 |
| PDF | @react-pdf/renderer | latest |
| Ícones | Lucide React | 1.7.0 |
| Formulários | React Hook Form | 7.72.0 |
| Validação | Zod | 4.3.6 |

---

## 3. Arquitetura

O sistema segue arquitetura de três camadas com Next.js App Router:

```
┌────────────────────────────────────────────────────────┐
│                  CAMADA DE VISUALIZAÇÃO                 │
│  Browser → Next.js App Router → React + Recharts       │
└─────────────────────────┬──────────────────────────────┘
                          │ HTTP / Supabase JS SDK
┌─────────────────────────▼──────────────────────────────┐
│                  CAMADA DE APLICAÇÃO                    │
│  Server Components (SSR)  │  Client Components         │
│  API Routes /api/*        │  proxy.ts (middleware)     │
└─────────────────────────┬──────────────────────────────┘
                          │ PostgreSQL via Supabase SDK
┌─────────────────────────▼──────────────────────────────┐
│                  CAMADA DE DADOS                        │
│  Supabase Auth (JWT + cookies)  │  PostgreSQL 17        │
│  Row Level Security (RLS)       │  8 tabelas públicas   │
└────────────────────────────────────────────────────────┘
```

### Regra dos clientes Supabase

```ts
// Em Server Components, layouts, api/routes:
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// Em Client Components:
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()  // sem await
```

### Fluxo de autenticação

```
Requisição HTTP
      ↓
proxy.ts (middleware)
      ↓
Autenticado? → NÃO → redirect /login
      ↓ SIM
Rota é /login? → SIM → redirect /
      ↓ NÃO
Server Component busca dados + renderiza página
```

---

## 4. Banco de dados — visão geral

### Tabelas existentes (8 no total)

```
profiles          → usuários do sistema (id, full_name, role)
empreendimentos   → grupos de imóveis (id, nome)
apartamentos      → unidades individuais (id, empreendimento_id, numero,
                    taxa_repasse, tipo_repasse, nome_proprietario,
                    modelo_contrato, tipo_gestao, amenitiz_room_id)
custos            → despesas mensais (id, apartamento_id, mes, ano,
                    categoria, valor, tipo_gestao)
diarias           → receitas de diárias (id, apartamento_id, data,
                    valor, tipo_gestao)
importacoes       → histórico de uploads (id, tipo, mes, ano,
                    nome_arquivo, status, importado_por)
amenitiz_syncs    → log de sincronizações Amenitiz (id, mes, ano,
                    status, total_reservas, faturamento_bruto/liquido)
amenitiz_reservas → reservas individuais Amenitiz (id, booking_id,
                    checkin, checkout, valor_bruto/liquido, plataforma,
                    nome_hospede, mes_competencia, ano_competencia)
```

### Restrições críticas

| Campo | Valores válidos |
|---|---|
| `importacoes.status` | `'concluido'` ou `'erro'` — **nunca** `'sucesso'` |
| `importacoes.tipo` | `'custos_adm'`, `'custos_sub'`, `'diarias_adm'`, `'diarias_sub'` |
| `apartamentos.tipo_gestao` | `'adm'` ou `'sub'` |
| `apartamentos.tipo_repasse` | `'lucro'` ou `'faturamento'` |
| `apartamentos.modelo_contrato` | `'administracao'` ou `'sublocacao'` |
| `profiles.role` | `'admin'` ou `'analista'` |
| `amenitiz_syncs.status` | `'concluido'`, `'erro'` ou `'em_andamento'` |

### Segurança (RLS)

- RLS habilitado em **todas as 8 tabelas**
- SELECT: qualquer usuário autenticado
- INSERT / UPDATE / DELETE: apenas `role = 'admin'` (exceto analistas que usam API com service key)

---

## 5. Histórico de evolução — do início até hoje

### Fase 1 — Fundação do sistema (início)

**O que foi criado:**
- Projeto Next.js com App Router, Tailwind v4 e shadcn/ui
- Configuração do Supabase (projeto `rlkmljeatapayiroggrp`)
- Schema inicial: `profiles`, `empreendimentos`, `apartamentos`, `custos`, `diarias`, `importacoes`
- Middleware de autenticação (`proxy.ts`) com proteção de rotas
- Página de login com Supabase Auth
- Layout com sidebar colapsível (`AppSidebar`)
- Dashboard principal com 4 KPIs (faturamento, custos, lucro, margem)
- Filtro de mês/ano via searchParams
- Tabela de custos (`/custos`) e diárias (`/diarias`)
- Página de empreendimentos com criação e exclusão de empreendimentos e apartamentos
- Pipeline de importação de planilhas Excel (`/importar` + `POST /api/import`)
- Histórico de importações
- Página de usuários (`/usuarios`) — apenas admin
- API de limpeza de dados (`DELETE /api/clear`)

**Bugs corrigidos nessa fase:**
- Redirect incorreto para `/dashboard` (não existe) → corrigido para `/`
- Campo `tipo_planilha` → renomeado para `tipo`
- Status `'sucesso'` → corrigido para `'concluido'`
- Mês e ano hardcoded → passados via FormData
- Filtros fixos no dashboard → substituídos por searchParams dinâmicos
- Histórico de importações vazio → busca real do banco

---

### Fase 2 — Gráficos e Relatório analítico

**O que foi adicionado:**
- Gráfico de barras no dashboard (Recharts `BarChart`) — Faturamento e Lucro por empreendimento
- Gráfico de linha no relatório (`/relatorio`) — 3 séries: Faturamento, Custos, Lucro
- Página de Relatório analítico: últimos 6 meses automáticos, tabela pivot (categorias × meses), KPIs ADM vs SUB
- Componentes de gráfico separados: `dashboard-charts.tsx`, `relatorio/charts.tsx`
- Botão de exportação de dados para XLSX (`SyncPlanilhasButton`)

---

### Fase 3 — Constraints e Segurança (migrations)

**Migrations aplicadas:**

| Migration | O que faz |
|---|---|
| `001_unique_constraints_custos_diarias.sql` | Adiciona UNIQUE em `custos` e `diarias` para evitar duplicação por reimportação |
| `002_fix_trigger_search_path.sql` | Corrige `handle_new_user()` com `SET search_path = public` — elimina vulnerabilidade de search_path injection |

---

### Fase 4 — Prestação de Contas e PDF

**O que foi adicionado:**
- Migration `003_prestacao_contas.sql`: adiciona colunas em `apartamentos` → `taxa_repasse`, `tipo_repasse`, `nome_proprietario`, `modelo_contrato`
- Página `/prestacao-contas`: visualização financeira por apartamento com cálculo de repasse ao proprietário
- Componente `EditarApartamentoRepasseModal`: edição inline dos dados de repasse de cada apartamento
- Componente `GerarPdfButton`: botão para gerar e baixar PDF
- API `GET /api/prestacao-contas-pdf`: gera PDF com @react-pdf/renderer
- Componente `components/pdf/prestacao-contas-pdf.tsx`: layout do PDF

**Cálculo de repasse:**
```
Receita Bruta (diárias)
  − Custos Totais
  = Lucro Líquido
  − Taxa AlugEasy (% sobre lucro OU faturamento, conforme configurado)
  = Valor Líquido ao Proprietário
```

---

### Fase 5 — Integração Amenitiz

**O que foi adicionado:**
- Migration `004_amenitiz_sync.sql`: cria tabelas `amenitiz_syncs` e `amenitiz_reservas`
- Migration `005_amenitiz_sync_v2.sql`: ajustes e índices adicionais
- Migration `006_amenitiz_backend_setup.sql`: adiciona `tipo_gestao` e `amenitiz_room_id` em `apartamentos`, e popula `amenitiz_room_id` com os UUIDs reais de cada quarto na API Amenitiz
- `lib/amenitiz.ts`: interfaces TypeScript, tabela de taxas por plataforma/empreendimento, funções `fetchTodasReservasMes()`, `calcularValorLiquido()`, `testConnection()`
- `POST /api/amenitiz-sync`: endpoint completo de sincronização
  - Busca reservas da API Amenitiz (3 endpoints com merge por booking_id)
  - Aplica taxas de plataforma: Booking.com (13% ou 16% por empreendimento), Airbnb (0%), AlugEasy/Manual (10%)
  - Suporta sincronização total ou parcial por empreendimento
  - Remove diárias antigas do período, insere novas via tabela `diarias`
  - Registra auditoria em `amenitiz_reservas` e log em `amenitiz_syncs`
  - `GET /api/amenitiz-sync`: testa conexão com a API Amenitiz
- Componente `AmenitizSyncButton`: interface para sincronização com seleção de mês/ano e feedback visual
- Dashboard atualizado para usar `amenitiz_reservas` como fonte de faturamento (além da tabela `diarias`)

**Taxas de plataforma configuradas:**

| Plataforma | Taxa |
|---|---|
| Booking.com | 16% (ESSENCE, METROPOLITAN, CULLINAN, BRISAS, MERCURE) |
| Booking.com | 13% (EASY, ATHOS, NOBILE, FUSION, RAMADA, VISION) |
| Booking.com | 13% (MERCURE apt 1419 — caso especial) |
| Airbnb | 0% |
| AlugEasy / Manual | 10% |

---

### Fase 6 — Gestão de Usuários com Cadastro

**O que foi adicionado:**
- `app/api/usuarios/route.ts`: API para criação de usuários via service key (contorna RLS)
- Componente `CadastrarUsuarioModal`: modal para cadastrar novos usuários diretamente pela interface
- Página de usuários refatorada com `UsuariosClient` (client component) para atualização em tempo real após cadastro
- `app/(dashboard)/executar-migration/page.tsx`: página utilitária para executar migrations via interface

---

## 6. O que está pronto hoje

### Funcionalidades completas

| Funcionalidade | Status |
|---|---|
| Login / Logout com Supabase Auth | ✅ Completo |
| Sidebar de navegação com controle de role | ✅ Completo |
| Dashboard com 4 KPIs e gráfico de barras | ✅ Completo |
| Filtro de mês/ano em todas as páginas | ✅ Completo |
| Tabela de custos filtrável | ✅ Completo |
| Tabela de diárias filtrável | ✅ Completo |
| Empreendimentos: listagem, criação, exclusão | ✅ Completo |
| Apartamentos: listagem, criação, exclusão | ✅ Completo |
| Importação de planilhas Excel (4 tipos) | ✅ Completo |
| Histórico de importações | ✅ Completo |
| Limpeza de dados por período | ✅ Completo |
| Relatório analítico (últimos 6 meses + gráfico de linha + pivot) | ✅ Completo |
| Exportação de dados para XLSX | ✅ Completo |
| Prestação de Contas por apartamento | ✅ Completo |
| Configuração de repasse por apartamento | ✅ Completo |
| Geração de PDF de prestação de contas | ✅ Completo |
| Sincronização Amenitiz (reservas + taxas automáticas) | ✅ Completo |
| Mapeamento de quartos Amenitiz → apartamentos do banco | ✅ Completo |
| Auditoria de reservas individuais (amenitiz_reservas) | ✅ Completo |
| Log de sincronizações (amenitiz_syncs) | ✅ Completo |
| Lista de usuários | ✅ Completo |
| Cadastro de novos usuários via interface | ✅ Completo |
| RLS em todas as tabelas | ✅ Completo |
| Constraints UNIQUE para evitar duplicação | ✅ Completo |

### Infraestrutura

| Item | Status |
|---|---|
| Migrations versionadas em `supabase/migrations/` | ✅ 6 migrations |
| Proteção de rotas via middleware (`proxy.ts`) | ✅ Completo |
| Verificação de role em Server Components | ✅ Completo |
| Verificação de role nas API routes | ✅ Completo |
| Trigger de criação automática de profile | ✅ Corrigido (migration 002) |

---

## 7. O que falta para finalizar

### Prioridade Alta

#### 7.1 Corrigir roles invertidos na página de Usuários

**Problema:** Em [app/(dashboard)/usuarios/page.tsx](app/(dashboard)/usuarios/page.tsx:18) a lógica está invertida:

```ts
// Como está HOJE (errado):
if (myProfile?.role !== 'analista') redirect('/')  // ← bloqueia admin, libera analista

// Como deveria ser:
if (myProfile?.role !== 'admin') redirect('/')     // ← bloqueia analista, libera admin
```

A página de usuários é Admin only. O código atual deixa analistas entrarem e bloqueia admins.

> **Contexto:** O sistema usa `analista` como o papel com mais permissões operacionais (pode sincronizar, pode fazer CRUD) e `admin` como somente-leitura. Isso é o inverso do padrão shadcn/ui. Verificar se essa inversão é intencional e padronizar em todo o sistema.

---

#### 7.2 Brisas — quartos sem número padrão (amenitiz_room_id pendente)

Na migration `006`, dois quartos do BRISAS ficaram comentados porque o número do apartamento no banco não era conhecido:

```sql
-- ⚠️ AÇÃO MANUAL: substitua '???' pelo numero correto do apartamento no banco
-- room_id 64e4757c = "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago"
-- room_id f0caa1ec = "Brisas do Lago - Apartamento de 1 Quarto com Vista do Lago 2"
```

Esses apartamentos não têm `amenitiz_room_id` configurado. Reservas deles serão ignoradas na sincronização.

**Ação necessária:** Identificar os números corretos no banco e executar os UPDATEs.

---

#### 7.3 Variável de ambiente AMENITIZ_HOTEL_UUID

O arquivo `app/api/amenitiz-sync/route.ts:248` usa:

```ts
hotel_uuid: process.env.AMENITIZ_HOTEL_UUID!
```

Verificar se `AMENITIZ_HOTEL_UUID` está configurado no `.env.local` e no ambiente de produção (Vercel/servidor). Sem ela, a coluna `hotel_uuid` em `amenitiz_reservas` ficará `undefined`.

---

#### 7.4 Acesso correto à página de Importar para Analistas

A página `/importar` contém o botão `AmenitizSyncButton`, que é a principal ferramenta do dia a dia. Porém, a página ainda verifica se o usuário é `admin` para bloquear acesso — e como os roles estão invertidos no sistema, isso pode estar bloqueando analistas (que deveriam ter acesso).

Verificar e ajustar o guard de acesso em [app/(dashboard)/importar/page.tsx](app/(dashboard)/importar/page.tsx).

---

### Prioridade Média

#### 7.5 Sidebar — item "Prestação de Contas" não aparece

A rota `/prestacao-contas` existe e funciona, mas não está nos itens de navegação da [components/layout/app-sidebar.tsx](components/layout/app-sidebar.tsx). O usuário só acessa se souber a URL diretamente.

**Ação:** Adicionar "Prestação de Contas" ao menu da sidebar.

---

#### 7.6 Sidebar — item "Sincronizar Amenitiz" para acesso rápido

O botão de sincronização Amenitiz está enterrado dentro de `/importar`. Considerar adicionar um item dedicado no menu ou um shortcut mais visível, já que é a operação mais frequente.

---

#### 7.7 PDF de prestação de contas — layout e conteúdo

O PDF é gerado via `GET /api/prestacao-contas-pdf` com `@react-pdf/renderer`. Verificar se:
- O PDF está com layout adequado para envio ao proprietário
- Inclui logo AlugEasy
- Inclui todos os campos necessários (nome proprietário, período, valores, assinatura)
- Funciona corretamente em produção (PDF rendering server-side pode ter limitações em alguns ambientes)

---

#### 7.8 Exportação XLSX — verificar campos exportados

O componente `SyncPlanilhasButton` gera exportação para XLSX. Confirmar se todos os campos relevantes estão sendo exportados corretamente, especialmente após a adição de `amenitiz_reservas` como fonte de dados.

---

#### 7.9 Espaços no .env.local

A documentação registra que `.env.local` pode ter espaços no final das variáveis, causando falhas silenciosas de conexão. Verificar e remover os espaços.

---

### Prioridade Baixa / Melhorias futuras

#### 7.10 Constraint UNIQUE em diarias e custos — verificar migration 001

A migration `001` adicionou constraints UNIQUE. Confirmar se estão aplicadas em produção:

```sql
-- Verificar no Supabase SQL Editor:
SELECT conname FROM pg_constraint WHERE conrelid = 'custos'::regclass AND contype = 'u';
SELECT conname FROM pg_constraint WHERE conrelid = 'diarias'::regclass AND contype = 'u';
```

---

#### 7.11 Página de Relatório — incluir dados Amenitiz

O relatório analítico (`/relatorio`) provavelmente ainda usa a tabela `diarias` como fonte. Após a integração Amenitiz, o faturamento real vem de `amenitiz_reservas`. Verificar se o relatório está consistente com o dashboard.

---

#### 7.12 Edição de apartamentos na página de empreendimentos

O modal `EditarApartamentoRepasseModal` existe, mas verificar se está acessível em `/empreendimentos` para configurar `taxa_repasse`, `tipo_repasse`, `nome_proprietario` e `modelo_contrato` de cada apartamento — dados necessários para a prestação de contas funcionar corretamente.

---

#### 7.13 Sincronização parcial por empreendimento — interface

O endpoint `POST /api/amenitiz-sync` suporta o parâmetro `empreendimento` para sync parcial, mas o `AmenitizSyncButton` não expõe essa opção. Pode ser útil para resincronizar apenas um empreendimento sem reprocessar todos.

---

#### 7.14 Tratamento de erro de reimportação Amenitiz

Se o endpoint de sync Amenitiz for chamado duas vezes para o mesmo mês/ano, ele deleta as diárias antigas e reinsere. Verificar se isso está funcionando corretamente quando há sync parcial (por empreendimento) — não pode deletar diárias de outros empreendimentos.

O código atual usa:
```ts
// Sync parcial: remove apenas apts deste empreendimento
const aptIds = Object.values(aptMapCompleto).map(i => i.id)
await supabase.from('diarias').delete()
  .gte('data', dataInicio).lte('data', dataFim)
  .in('apartamento_id', aptIds)
```
Parece correto, mas merece teste com dados reais.

---

## 8. Rotas e páginas do sistema

| Rota | Tipo | Acesso | Descrição |
|---|---|---|---|
| `/login` | Público | Todos | Login email + senha |
| `/` | Protegido | Todos | Dashboard: 4 KPIs + gráfico |
| `/empreendimentos` | Protegido | Todos | Lista + detalhe de empreendimentos e apartamentos |
| `/custos` | Protegido | Todos | Tabela de despesas filtrável |
| `/diarias` | Protegido | Todos | Tabela de receitas filtrável |
| `/relatorio` | Protegido | Todos | Últimos 6 meses + gráfico de linha + pivot |
| `/prestacao-contas` | Protegido | Todos | Prestação de contas por apartamento + PDF |
| `/importar` | Protegido | Analista | Upload planilhas + Sync Amenitiz |
| `/usuarios` | Protegido | Admin (revisar) | Lista + cadastro de usuários |
| `POST /api/import` | API | Analista | Recebe .xlsx, processa e grava no banco |
| `DELETE /api/clear` | API | Analista | Limpa dados de um período |
| `POST /api/amenitiz-sync` | API | Analista | Sincroniza reservas da Amenitiz |
| `GET /api/amenitiz-sync` | API | Todos auth | Testa conexão com Amenitiz |
| `GET /api/prestacao-contas-pdf` | API | Todos auth | Gera PDF de prestação de contas |
| `GET/POST /api/usuarios` | API | Admin | Listagem e criação de usuários |
| `GET /api/apartamentos` | API | Admin | Busca apartamentos |

---

## 9. Fluxos principais

### Fluxo de importação de planilhas

```
Admin seleciona tipo (custos_adm|sub ou diarias_adm|sub)
  → Seleciona mês e ano
  → Faz upload do .xlsx
  → POST /api/import (FormData)
  → API verifica autenticação e role
  → SheetJS lê o buffer
  → DELETE registros existentes para (mes, ano, tipo_gestao)
  → INSERT novos registros em custos ou diarias
  → INSERT log em importacoes (status: 'concluido')
  → Retorna JSON com contagem de registros
```

### Fluxo de sincronização Amenitiz

```
Analista seleciona mês/ano no AmenitizSyncButton
  → Clica "Sincronizar Reservas"
  → POST /api/amenitiz-sync { mes, ano }
  → API verifica autenticação e role
  → Cria log em amenitiz_syncs (status: 'em_andamento')
  → Busca todos apartamentos com tipo_gestao e amenitiz_room_id
  → Chama fetchTodasReservasMes(mes, ano) — 3 endpoints Amenitiz
  → Para cada reserva (ignorando canceladas/no-shows):
      → Faz parsing do nome do quarto → empreendimento + número
      → Fallback: tenta por amenitiz_room_id
      → Calcula valor_liquido aplicando taxa da plataforma
      → Upsert em amenitiz_reservas (por booking_id)
      → Acumula valor por apartamento_id
  → DELETE diárias antigas do período
  → INSERT novas diárias (por apartamento_id, com tipo_gestao correto)
  → INSERT log em importacoes (tipo: 'diarias_adm', status: 'concluido')
  → Atualiza amenitiz_syncs (status: 'concluido', totais)
  → Retorna resumo: reservas, faturamento bruto/líquido, apts sincronizados/não encontrados
```

### Fluxo de prestação de contas

```
Usuário acessa /prestacao-contas
  → Seleciona apartamento e mês/ano
  → Server Component busca:
      → diarias do apartamento no período
      → custos do apartamento no período
      → dados de repasse (taxa_repasse, tipo_repasse, nome_proprietario)
  → Calcula:
      Receita Bruta = soma diárias
      Custos Totais = soma custos
      Lucro Líquido = Receita - Custos
      Base de cálculo = lucro OU faturamento (conforme tipo_repasse)
      Valor Repasse = Base × (taxa_repasse / 100)
      Valor Líquido ao Proprietário = Lucro - Valor Repasse
  → Exibe cards de KPIs + tabela ADM vs SUB + custos detalhados + resumo de repasse
  → Botão "Gerar PDF" → GET /api/prestacao-contas-pdf → download .pdf
```

---

## 10. Controle de acesso

> **Importante:** No sistema AlugEasy, os roles têm semântica inversa ao padrão convencional:
> - **`analista`** = usuário operacional — acesso completo, incluindo importação e sincronização
> - **`admin`** = somente leitura — não pode fazer operações de escrita

| Funcionalidade | `analista` | `admin` |
|---|---|---|
| Visualizar Dashboard | ✅ | ✅ |
| Ver Empreendimentos / Custos / Diárias / Relatório | ✅ | ✅ |
| Criar / Excluir Empreendimento e Apartamento | ✅ | ❌ (RLS) |
| Importar Planilhas (`/importar`) | ✅ | ❌ |
| Sincronizar Amenitiz | ✅ | ❌ |
| Ver Prestação de Contas | ✅ | ✅ |
| Gerar PDF | ✅ | ✅ |
| Ver Usuários (`/usuarios`) | ✅ (verificar) | ❌ (verificar) |
| Cadastrar Usuários | ✅ (verificar) | ❌ (verificar) |
| Limpar dados do período | ✅ | ❌ |

### Camadas de proteção

1. **Sidebar** — itens sensíveis ocultos por role
2. **Server Component** — verificação de role + redirect no servidor
3. **RLS (Supabase)** — banco bloqueia escrita para roles sem permissão
4. **API Routes** — verificação manual de autenticação e role

---

## 11. Variáveis de ambiente

Arquivo: `.env.local` (raiz do projeto — **não comitar no Git**)

```env
NEXT_PUBLIC_SUPABASE_URL=https://rlkmljeatapayiroggrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon do projeto>
AMENITIZ_API_KEY=<chave da API Amenitiz>
AMENITIZ_HOTEL_UUID=<UUID do hotel na Amenitiz>
SUPABASE_SERVICE_ROLE_KEY=<service role key — apenas server-side>
```

> **Atenção:** `AMENITIZ_HOTEL_UUID` e `AMENITIZ_API_KEY` são necessárias para o sync funcionar.  
> `SUPABASE_SERVICE_ROLE_KEY` é necessária para criar usuários via API (`/api/usuarios`).  
> **Nunca expor a service role key no frontend.**

---

## Resumo visual do estado atual

```
✅ PRONTO                         ⚠️ PRECISA REVISAR / CORRIGIR
─────────────────────────────     ──────────────────────────────────────────
Login / Auth                       Roles invertidos em /usuarios
Dashboard com KPIs                 Sidebar sem item Prestação de Contas
Importação Excel (4 tipos)         Brisas — 2 quartos sem amenitiz_room_id
Sincronização Amenitiz             Variável AMENITIZ_HOTEL_UUID no .env
Prestação de Contas                PDF — verificar layout final
Geração de PDF                     Relatório — verificar se usa amenitiz_reservas
Relatório analítico                Espaços no .env.local
Gestão de Empreendimentos
Gestão de Usuários
Exportação XLSX
RLS + Constraints
6 Migrations aplicadas
```

---

> **Manter este documento atualizado** sempre que novas funcionalidades forem adicionadas, bugs corrigidos ou pendências resolvidas.

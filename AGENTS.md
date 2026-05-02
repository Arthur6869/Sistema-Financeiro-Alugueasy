<!-- BEGIN:nextjs-agent-rules -->
# Regras para Agentes de IA — Sistema Financeiro AlugEasy

## ⚠️ Este é um projeto Next.js 16 com App Router — leia antes de qualquer código

Esta versão do Next.js tem **mudanças significativas** em relação ao que pode estar no seu treinamento. Leia o guia em `node_modules/next/dist/docs/` antes de escrever qualquer código. Respeite as mensagens de deprecação.

---

## 📌 Contexto do Projeto

| Item | Valor |
|---|---|
| Framework | Next.js **16.2.1** com **App Router** |
| Runtime | React 19.2.4 |
| Banco de dados | Supabase (PostgreSQL 17) — projeto `rlkmljeatapayiroggrp` |
| Região Supabase | `sa-east-1` (São Paulo) |
| Estilização | Tailwind CSS **v4** + shadcn/ui v4 |
| Autenticação | `@supabase/ssr` 0.9.0 |

---

## 🏗️ Regras de Arquitetura

### App Router — convenções obrigatórias

- Páginas de servidor: sem `'use client'` — podem `async`, usam `cookies()`, `redirect()`, `createClient()` do server
- Páginas/componentes de cliente: começam com `'use client'` — sem acesso direto ao banco
- **Groups de rotas:** `(auth)` para login, `(dashboard)` para área protegida
- Layouts com autenticação ficam em `app/(dashboard)/layout.tsx`
- API Routes usam `export async function POST(request: NextRequest)` — **sem `pages/api/`**

### Supabase — clientes distintos por contexto

```ts
// ✅ Em Server Components, layouts, api/routes:
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()

// ✅ Em Client Components:
import { createClient } from '@/lib/supabase/client'
const supabase = createClient() // sem await
```

**Nunca** misturar os dois clientes no mesmo arquivo.

---

## 🗄️ Banco de Dados — Regras

### Schema público (tabelas existentes)

```
profiles                    → id (uuid), full_name, role ('admin'|'analista'|'proprietario')
empreendimentos             → id, nome (unique)
apartamentos                → id, empreendimento_id (fk), numero
                               UNIQUE (empreendimento_id, numero)
custos                      → id, apartamento_id (fk), mes, ano, categoria, valor,
                               tipo_gestao ('adm'|'sub'), origem ('manual'|'importacao') DEFAULT 'importacao',
                               observacao (text nullable), criado_por (uuid fk auth.users nullable), created_at
diarias                     → id, apartamento_id (fk), data, valor, tipo_gestao ('adm'|'sub')
importacoes                 → id, tipo ('custos_adm'|'custos_sub'|'diarias_adm'|'diarias_sub'),
                               mes, ano, nome_arquivo, status ('concluido'|'erro'), importado_por
proprietario_apartamentos   → id, proprietario_id (fk auth.users), apartamento_id (fk apartamentos),
                               ativo boolean DEFAULT true
                               UNIQUE (proprietario_id, apartamento_id)
```

### Regra de origem em custos

- Registros importados têm `origem='importacao'` — **NUNCA** editar via PATCH nem excluir via tela manual
- Registros manuais têm `origem='manual'` — editáveis e excluíveis pelo analista via `/api/custos-manual/[id]`
- A API `/api/custos-manual/[id]` verifica `origem` antes de qualquer mutação e retorna `400` se for `'importacao'`
- Ao inserir via `lancar_custo_manual` (MCP), gravar sempre `origem='manual'`

### Restrições que NUNCA devem ser violadas

- `status` em `importacoes` aceita **apenas** `'concluido'` ou `'erro'` — **nunca** `'sucesso'`
- `tipo` em `importacoes` aceita **apenas** `'custos_adm'`, `'custos_sub'`, `'diarias_adm'`, `'diarias_sub'`
- `tipo_gestao` aceita **apenas** `'adm'` ou `'sub'`
- `role` em `profiles` aceita **apenas** `'admin'`, `'analista'` ou `'proprietario'`

### RLS (Row Level Security)

- **Sempre habilitado** em todas as tabelas
- Leitura: qualquer usuário autenticado (`auth.role() = 'authenticated'`)
- Escrita: apenas usuários com `role = 'admin'` na tabela `profiles`
- **Nunca desativar RLS** sem adicionar novas políticas equivalentes

---

## 🛣️ Rotas — Mapa Completo

| Rota | Tipo | Acesso |
|---|---|---|
| `/login` | Público | Todos |
| `/` | Protegido | Autenticados |
| `/empreendimentos` | Protegido | Autenticados |
| `/apartamentos` | Protegido | Autenticados |
| `/custos` | Protegido | Autenticados |
| `/custos/manual` | Protegido | **Apenas analista** |
| `/diarias` | Protegido | Autenticados |
| `/relatorio` | Protegido | Autenticados |
| `/importar` | Protegido | **Apenas admin** |
| `/usuarios` | Protegido | **Apenas admin** |
| `POST /api/import` | API Route | Deve verificar autenticação manualmente |
| `GET /api/custos-manual` | API Route | Autenticado — lista custos manuais com filtros |
| `POST /api/custos-manual` | API Route | **Apenas analista** — insere lançamento manual |
| `PATCH /api/custos-manual/[id]` | API Route | **Apenas analista** — edita lançamento manual |
| `DELETE /api/custos-manual/[id]` | API Route | **Apenas analista** — remove lançamento manual |
| `POST /api/agente-fechamento` | API Route | Analista ou chave interna — executa fechamento mensal completo |
| `GET /api/agente-fechamento` | API Route | Analista ou chave interna — status rápido do mês atual |

> **Importante:** O grupo `(dashboard)` não existe como segmento de URL. A rota raiz é `/`, não `/dashboard`. Ao redirecionar, use sempre `/` para o dashboard.

---

## 🧩 Componentes — Padrões

### shadcn/ui já instalados

Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, Button, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tooltip, TooltipContent, TooltipTrigger, TooltipProvider

### Importação correta

```ts
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
// etc.
```

### Constantes globais (usar em vez de redefinir localmente)

```ts
import { MESES, MESES_ABREV, ANOS, formatCurrency } from '@/lib/constants'
```

---

## 🔴 Bugs Conhecidos — NÃO reproduzir

Ao modificar ou criar código, **evitar repetir os seguintes erros existentes**:

1. **Redirect para `/dashboard`** — rota não existe. Sempre usar `redirect('/')` ou `router.push('/')`
2. **`tipo_planilha`** — campo não existe. Usar `tipo`
3. **`status: 'sucesso'`** — valor inválido. Usar `status: 'concluido'`
4. **`mes`/`ano` hardcoded** — sempre receber do formulário/request
5. **Rota `/api/import` pública** — sempre verificar `user` e `role === 'admin'` no início do handler

---

## 🐛 Bugs Corrigidos — Histórico

| Data | Bug | Causa | Correção |
|---|---|---|---|
| Abr/2026 | Custos jan/2026 errados no dashboard (R$ 187.974 em vez de R$ 205.775) | 7 empreendimentos com dados ausentes ou incorretos após importação parcialmente silenciosa | Migration 010 aplicada manualmente; pipeline blindado com rastreamento de `sheetsIgnorados`; tool `verificar_importacao_custos` adicionada |

---

## ✅ Checklist obrigatório após importar planilhas de custos

Sempre após importar `custos_adm` ou `custos_sub`, verificar via MCP:

```
verificar_importacao_custos { mes: X, ano: Y, tipo_gestao: "adm" }
verificar_importacao_custos { mes: X, ano: Y, tipo_gestao: "sub" }
```

Se qualquer empreendimento aparecer **zerado** ou **ausente**:
1. **NÃO fechar o mês**
2. Verificar se o empreendimento está cadastrado na tabela `empreendimentos`
3. Verificar se os apartamentos desse empreendimento têm `empreendimento_id` correto
4. Verificar o campo `observacao` no último registro de `importacoes` — ele lista as abas ignoradas
5. Reimportar a planilha após corrigir o cadastro

---

## 📝 Padrões de Código

### Server Component buscando dados

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function MinhaPagina() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('tabela').select('*')

  return <div>{/* JSX com dados */}</div>
}
```

### API Route com autenticação

```ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin')
    return NextResponse.json({ error: 'Proibido' }, { status: 403 })

  // lógica principal...
}
```

---

## 📂 Documentação

Sempre manter atualizado após mudanças:
- `documentação.md` — documentação técnica completa (schema, rotas, bugs)
- `README.md` — guia de início rápido
- Este arquivo (`AGENTS.md`) — regras para agentes de IA
---

## 🏠 Portal do Proprietário

### Rotas

| Rota | Acesso | Descrição |
|---|---|---|
| `/proprietario` | `proprietario` | Dashboard com KPIs, cards por apt e gráfico de evolução |
| `/proprietario/extrato` | `proprietario` | Extrato detalhado por apartamento — custos por categoria, cálculo de repasse |
| `/proprietario/historico` | `proprietario` | Tabela dos últimos 12 meses com link para extrato |

### Regras obrigatórias

- Proprietário **NUNCA** acessa rotas fora de `/proprietario` — middleware bloqueia e redireciona
- Admin/analista tentando acessar `/proprietario` → redirecionados para `/`
- Todos os dados são filtrados por `proprietario_apartamentos.ativo = true`
- RLS garante isolamento completo — proprietário não vê dados de outros proprietários
- Cálculo de repasse: igual à prestação de contas (`taxa_repasse` + `tipo_repasse`)
- `tipo_repasse = 'faturamento'` → base do repasse é o faturamento; `'lucro'` → base é o lucro

### Nova tabela

```
proprietario_apartamentos:
  id              uuid PK
  proprietario_id uuid FK auth.users
  apartamento_id  uuid FK apartamentos
  ativo           boolean DEFAULT true   ← soft delete
  UNIQUE (proprietario_id, apartamento_id)
```

### RLS expandida (migration 014)

- `proprietario_apartamentos` → proprietário lê próprios; analista gerencia todos
- `custos` → nova policy `proprietario_le_custos` via subquery na tabela de vínculos
- `diarias` → nova policy `proprietario_le_diarias` via subquery na tabela de vínculos
- `amenitiz_reservas` → nova policy `proprietario_le_reservas` via JOIN apartamentos

### Role expandido

`profiles.role` agora aceita `'admin' | 'analista' | 'proprietario'`

### Gestão de proprietários

- Criação em `/usuarios` → seção "Proprietários" → botão "Novo Proprietário"
- Cada proprietário pode ter N apartamentos (vinculados via `proprietario_apartamentos`)
- `GerenciarProprietarioModal` permite adicionar/remover apartamentos por checkbox sem excluir o usuário

### APIs relacionadas

| Endpoint | Verbo | Descrição |
|---|---|---|
| `/api/proprietario-apartamentos` | GET | Lista vínculos de um proprietário |
| `/api/proprietario-apartamentos` | POST | Vincula novos apartamentos |
| `/api/proprietario-apartamentos` | DELETE | Soft delete de um vínculo (ativo=false) |
| `/api/proprietario-apartamentos` | PATCH | Sincroniza lista completa de apts ativos |

---

## ✅ Decisões de Design — não questionar, só seguir

| Decisão | Motivo |
|---|---|
| `analista` tem mais permissões que `admin` | Sistema inverteu semanticamente por decisão de negócio |
| Guards de acesso usam `role !== 'analista'` para bloquear não-operadores | `analista` = operador do sistema; `admin` = somente leitura |
| Faturamento vem de `diarias.valor` (xlsx importado), não de `amenitiz_reservas` | `diarias` é fonte primária de receita; `amenitiz_reservas` é auxiliar para contagem de noites |
| Sync Amenitiz = DELETE + INSERT (não upsert em `diarias`) | Garantia de consistência no período |
| Redirect após login = `/` (nunca `/dashboard`) | Rota `/dashboard` não existe |
| "Prestação de Contas" já está na sidebar (`navItems`) | Adicionado — não duplicar |
| Portal do Proprietário usa `proxy.ts` para redirecionamento por role | Next.js 16.x usa `proxy.ts` como arquivo de proxy/middleware nativo — NÃO criar `middleware.ts` paralelo |

---

## 🤖 Agente Autônomo de Fechamento

O agente executa automaticamente todo dia 1 do mês às 11h UTC (8h Brasília) via Vercel Cron (`vercel.json`).
Também pode ser executado manualmente em `/importar` ou via MCP tool `executar_fechamento_mensal`.

### Fluxo automático (em ordem)
1. Sync Amenitiz para o mês anterior
2. Verifica custos ADM — alerta se < 5 empreendimentos com dados
3. Verifica custos SUB — alerta se < 5 empreendimentos com dados
4. Calcula KPIs (faturamento, custos, lucro, margem) — alerta se margem < 10%
5. Lista lançamentos manuais pendentes — avisa se houver algum
6. Envia extrato por email para todos os proprietários ativos
7. Notifica analistas por email (via Resend) se houver qualquer alerta

### Autenticação da API
- Usuário logado com `role = 'analista'` via cookie
- Chamada interna com header `x-alugueasy-internal-key` (Vercel Cron + MCP)

### Alertas que disparam notificação ao analista
- `❌` Sync Amenitiz falhou
- `⚠️` Apts sem room_id (faturamento perdido)
- `⚠️` Custos ADM/SUB < 5 empreendimentos
- `❌` Faturamento zerado após sync
- `⚠️` Margem abaixo de 10%
- `ℹ️` Lançamentos manuais presentes no período
- `⚠️` Email não enviado para algum proprietário

### Para ativar em produção
1. Fazer deploy na Vercel — o cron é ativado automaticamente via `vercel.json`
2. Configurar `RESEND_API_KEY` na Vercel para notificações por email
3. Verificar `ALUGUEASY_INTERNAL_API_KEY` e `ALUGUEASY_BASE_URL` nas env vars da Vercel

---

## 🤖 MCP Server

O servidor MCP expõe o sistema AlugEasy como tools para agentes de IA (Claude Desktop, Claude Code).

- **Localização:** `./mcp-server/`
- **Propósito:** permite que agentes consultem KPIs, prestação de contas e dados de imóveis sem acesso direto ao banco
- **Build:** `cd mcp-server && npm run build`
- **Rodar:** `node mcp-server/dist/index.js` (stdio — não abre porta HTTP)
- **Docs completas:** `./mcp-server/README.md`

### Primitivos registrados

| Primitivo | Quantidade | Itens |
|---|---|---|
| **Tools** | 23 | get_kpis, get_kpis_por_empreendimento, get_custos_detalhados, get_relatorio_semestral, list_empreendimentos, list_apartamentos, set_amenitiz_room_id, get_prestacao_contas, sync_amenitiz, get_historico_importacoes, check_ultimo_sync, clear_periodo, enviar_extrato_email, health_check, alert_margem_baixa, check_sync_pendente, resumo_executivo, check_apartamentos_sem_room_id, verificar_importacao_custos, listar_proprietarios, lancar_custo_manual, listar_custos_manuais, executar_fechamento_mensal |
| **Resources** | 4 | alugueasy://schema, alugueasy://empreendimentos, alugueasy://config/taxas, alugueasy://diagnostico/sem-room-id |
| **Prompts** | 3 | relatorio_mensal, fechamento_mes, diagnostico_sistema |

### Tools por módulo

| Tool | Módulo | Descrição |
|---|---|---|
| `get_kpis` | financeiro | KPIs agregados: faturamento, custos, lucro, margem |
| `get_kpis_por_empreendimento` | financeiro | KPIs separados por empreendimento |
| `get_custos_detalhados` | financeiro | Custos agrupados por categoria com filtros |
| `get_relatorio_semestral` | financeiro | Últimos 6 meses com variação MoM |
| `list_empreendimentos` | imoveis | Todos os empreendimentos com contagem de apts |
| `list_apartamentos` | imoveis | Apartamentos com taxa_repasse e tipo_repasse |
| `set_amenitiz_room_id` | imoveis | Mapeia um apt ao UUID Amenitiz sem abrir o Supabase (requer confirmar: true) |
| `get_prestacao_contas` | imoveis | Prestação mensal de um apt (mesma lógica de /prestacao-contas) |
| `sync_amenitiz` | importacao | Sincroniza reservas Amenitiz para um período |
| `get_historico_importacoes` | importacao | Histórico de uploads e syncs por período/tipo |
| `check_ultimo_sync` | importacao | Verifica data do último sync Amenitiz |
| `clear_periodo` | importacao | Remove dados de um período (mês/ano) |
| `health_check` | monitoramento | Testa conectividade Supabase e API Next.js |
| `alert_margem_baixa` | monitoramento | Alerta empreendimentos abaixo de margem mínima |
| `check_sync_pendente` | monitoramento | Verifica se sync está atualizado (< 3 dias) |
| `resumo_executivo` | monitoramento | Resumo completo: KPIs + sync + alertas + tendência |
| `check_apartamentos_sem_room_id` | monitoramento | Lista apartamentos sem amenitiz_room_id (sync parcial) |
| `verificar_importacao_custos` | monitoramento | Valida se todos os empreendimentos têm custos gravados após importação |
| `listar_proprietarios` | monitoramento | Lista usuários com role=proprietario e seus apartamentos vinculados (ativo/inativo) |
| `enviar_extrato_email` | importacao | Envia extrato mensal HTML por email ao proprietário via Resend (requer RESEND_API_KEY configurado) |
| `lancar_custo_manual` | importacao | Insere custos diretamente sem planilha, resolvendo apartamento por nome/empreendimento. Max 50 por chamada. |
| `listar_custos_manuais` | monitoramento | Lista lançamentos manuais (origem=manual) do período para auditoria pré-fechamento. |
| `executar_fechamento_mensal` | importacao | Fluxo completo de fechamento em 1 chamada: sync + custos + KPIs + emails + alerta analista. |

### Cliente Supabase no MCP

O MCP usa **service role key** (não anon key) para bypassar RLS e ter acesso total de leitura.
Nunca usar o cliente `@/lib/supabase/server` do Next.js dentro do MCP — são pacotes separados.

---

## ⚠️ Ação Manual Pendente — room_ids BRISAS/ATHOS/METROPOLITAN

Os seguintes apartamentos precisam de UUID manual do painel Amenitiz
(sem reservas nos últimos 4 meses ou sem room combinado na API):

| Empreendimento | Apt | Arquivo | Observação |
|---|---|---|---|
| BRISAS | D137 | `supabase/migrations/009_room_ids_pendentes.sql` | ⏳ candidato: "Vista do Lago" (64e4757c) |
| BRISAS | D138 | `supabase/migrations/009_room_ids_pendentes.sql` | ⏳ candidato: "Vista do Lago 2" (f0caa1ec) |
| BRISAS | E020 | `supabase/migrations/009_room_ids_pendentes.sql` | ⏳ sem reservas recentes |
| BRISAS | E016 | `supabase/migrations/009_room_ids_pendentes.sql` | ⏳ UUID anterior era de outro empreendimento (corrigido) |
| ATHOS | 11 | `supabase/migrations/009_room_ids_pendentes.sql` | ⏳ sem reservas recentes |
| ATHOS | 908 | `supabase/migrations/009_room_ids_pendentes.sql` | ⏳ UUID anterior era "AB 1209" (corrigido, agora com 1209) |
| METROPOLITAN | 1701 - 1701A | `supabase/migrations/009_room_ids_pendentes.sql` | ⏳ rooms 1701 e 1701A já mapeados individualmente |

**Como resolver:**
1. Acessar Amenitiz Dashboard > Configurações > Quartos
2. Localizar cada quarto pelo nome
3. Copiar o UUID (individual_room_id)
4. Usar a tool MCP `set_amenitiz_room_id` ou aplicar `009_room_ids_pendentes.sql`

---

## 📁 Estrutura de Documentação

| Arquivo | Propósito | Status |
|---|---|---|
| `documentação.md` | Documentação técnica completa (schema, rotas, bugs) | ✅ Ativo |
| `README.md` | Guia de início rápido | ✅ Ativo |
| `AGENTS.md` | Regras para agentes de IA | ✅ Ativo |
| `CLAUDE.md` | Referência ao AGENTS.md para Claude Code | ✅ Ativo |
| `mcp-server/README.md` | Documentação do servidor MCP | ✅ Ativo |

**Regra:** Qualquer nova documentação vai em `documentação.md`.
Não criar novos arquivos .md na raiz sem aprovação explícita.

---

## 🚫 Arquivos que NUNCA devem estar no repositório

- Planilhas Excel (`*.xlsx`, `*.xls`) — ficam no Google Drive
- Dados brutos em pastas (`dados jan/`, `dados fev/`, etc.)
- Scripts Python de análise manual
- Arquivos Obsidian (`*.canvas`, `*.base`, `.obsidian/`)
- Artefatos de build (`dist/`, `.next/`, `*.tsbuildinfo`)
- Variáveis de ambiente (`.env.local`, `.env.production`)
- Arquivos temporários (`*.bak`, `*.old`, `*.tmp`)
- Dados JSON de API brutos (`data.json`, fixtures de reservas)

<!-- END:nextjs-agent-rules -->

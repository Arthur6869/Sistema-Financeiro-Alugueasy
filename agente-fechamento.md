# Agente de Fechamento — Como Foi Construído

## O que é

O Agente de Fechamento é uma funcionalidade que automatiza o processo mensal de fechamento financeiro da AlugEasy. Com um clique, ele executa 6 etapas em sequência, consolida KPIs e envia os extratos para os proprietários.

Não usa LLM nem IA generativa — o nome "agente" reflete o comportamento autônomo: ele toma decisões, detecta anomalias e notifica os responsáveis sem intervenção humana.

---

## Arquivos envolvidos

| Arquivo | Responsabilidade |
|---|---|
| `app/api/agente-fechamento/route.ts` | Backend — orquestra as 6 etapas e retorna o relatório |
| `components/importar/agente-fechamento-button.tsx` | Frontend — UI com seletores, botão e exibição dos resultados |
| `lib/sync-amenitiz-core.ts` | Lógica de sync com a API Amenitiz (chamada na Etapa 1) |
| `lib/enviar-extrato-core.ts` | Lógica de envio de email por proprietário (chamada na Etapa 6) |

---

## Arquitetura

```
[Frontend: AgenteFechamentoButton]
        |
        | POST /api/agente-fechamento  { mes, ano }
        |
[Backend: route.ts]
        |
        ├── Etapa 1: runAmenitizSync()       → lib/sync-amenitiz-core.ts
        ├── Etapa 2: Custos ADM              → Supabase query
        ├── Etapa 3: Custos SUB              → Supabase query
        ├── Etapa 4: KPIs                    → Supabase query (Promise.all)
        ├── Etapa 5: Lançamentos manuais     → Supabase query
        └── Etapa 6: enviarExtratoProprietario() → lib/enviar-extrato-core.ts
                |
                └── Notificação analistas via Resend (se houver alertas)
        |
        | JSON { status_geral, alertas, etapas, kpis, duracao_ms }
        |
[Frontend renderiza resultado]
```

---

## Backend (`route.ts`)

### Autenticação dupla

A rota aceita dois tipos de chamada:

1. **Via sessão de usuário** — verifica se o usuário tem `role = 'analista'` na tabela `profiles`
2. **Via chave interna** — header `x-alugueasy-internal-key` com valor igual à env `ALUGUEASY_INTERNAL_API_KEY` (permite chamada por cron job ou automação externa)

```ts
async function autenticar(request: NextRequest): Promise<boolean> {
  const internalKey = request.headers.get('x-alugueasy-internal-key')
  if (internalKey && internalKey === process.env.ALUGUEASY_INTERNAL_API_KEY) return true
  // ... verifica sessão Supabase + role analista
}
```

### As 6 etapas

Cada etapa é independente e não interrompe as seguintes em caso de falha — o agente sempre termina e reporta o que deu errado.

#### Etapa 1 — Sync Amenitiz
Chama `runAmenitizSync(supabase, mes, ano)` que busca reservas na API Amenitiz e salva na tabela `amenitiz_reservas`. Retorna `total_reservas`, `faturamento_liquido` e a lista de apartamentos não mapeados.

**Alertas gerados:**
- `❌` se o sync falhou
- `⚠️` se há apartamentos sem mapeamento (faturamento perdido)

#### Etapa 2 — Custos ADM
Consulta a tabela `custos` filtrando por `mes`, `ano` e `tipo_gestao = 'adm'`. Conta quantos empreendimentos distintos têm dados.

**Alerta:** `⚠️` se menos de 5 empreendimentos têm custos ADM lançados.

#### Etapa 3 — Custos SUB
Mesma lógica da Etapa 2, mas para `tipo_gestao = 'sub'`.

**Alerta:** `⚠️` se menos de 5 empreendimentos têm custos SUB lançados.

#### Etapa 4 — KPIs
Usa `Promise.all` para buscar faturamento e custos em paralelo:

```ts
const [{ data: fatData }, { data: custData }] = await Promise.all([
  supabase.from('amenitiz_reservas').select('valor_liquido').eq(...),
  supabase.from('custos').select('valor').eq(...),
])
```

Calcula: `lucro = faturamento - custos` e `margem = lucro / faturamento * 100`.

**Alertas:**
- `❌` se faturamento = 0
- `⚠️` se margem < 10%

#### Etapa 5 — Lançamentos manuais
Consulta custos com `origem = 'manual'` para o período. Esses lançamentos precisam de revisão humana antes do fechamento.

**Alerta:** `ℹ️` informativo se existir algum lançamento manual.

#### Etapa 6 — Emails para proprietários
Busca todos os usuários com `role = 'proprietario'` e chama `enviarExtratoProprietario(id, mes, ano)` para cada um. Coleta os que tiveram sucesso e os que falharam.

**Alerta:** `⚠️` listando os proprietários cujo email não foi enviado.

### Sistema de alertas e status geral

Após todas as etapas, o status geral é determinado pela severidade dos alertas acumulados:

```ts
const temErro  = alertas.some(a => a.startsWith('❌'))
const temAviso = alertas.some(a => a.startsWith('⚠️'))
const statusGeral = temErro ? 'erro' : temAviso ? 'aviso' : 'ok'
```

### Notificação de analistas

Se houver qualquer alerta, o agente envia um email de notificação para todos os analistas via Resend. O email inclui os alertas listados e os KPIs do período. Isso garante visibilidade mesmo que ninguém esteja olhando o sistema na hora.

### GET — preview rápido

A rota também expõe um `GET /api/agente-fechamento` que retorna um snapshot do mês anterior (faturamento, custos, lucro, status do último sync) sem executar nada. Serve para exibir um painel de "pronto para fechar?" antes de disparar o agente.

---

## Frontend (`agente-fechamento-button.tsx`)

Componente React client-side (`'use client'`). Estado gerenciado localmente com `useState`.

### Fluxo de execução

1. Usuário seleciona mês e ano (padrão = mês anterior)
2. Clica em "Executar Agente"
3. `loading = true` — botão mostra spinner e texto "Executando... (até 60s)"
4. `fetch('POST /api/agente-fechamento', { mes, ano })`
5. Resposta salva em `relatorio` e renderizada

### Renderização do resultado

Após a execução, o componente exibe em sequência:

| Seção | Conteúdo |
|---|---|
| Header de status | Ícone colorido (verde/âmbar/vermelho) + texto + período + duração em segundos |
| KPIs | Grid 4 colunas: Faturamento, Custos, Lucro, Margem — cores condicionais |
| Etapas | Lista com ✅ ou ⚠️ por etapa + detalhe textual |
| Alertas | Painel expansível com todos os alertas (abre automaticamente se houver algum) |

### Lógica de cores condicionais

- Status `ok` → borda e fundo verde
- Status `aviso` → borda e fundo âmbar
- Status `erro` → borda e fundo vermelho
- Margem ≥ 10% → verde; < 10% → âmbar
- Lucro ≥ 0 → verde; < 0 → vermelho

---

## Variáveis de ambiente necessárias

| Variável | Uso |
|---|---|
| `RESEND_API_KEY` | Envio de emails (extratos + notificações de alerta) |
| `RESEND_FROM_EMAIL` | Remetente dos emails (padrão: `noreply@alugueasy.com.br`) |
| `ALUGUEASY_INTERNAL_API_KEY` | Permite chamada autenticada por cron job externo |

---

## Como adicionar uma nova etapa

1. No `route.ts`, adicionar a chave no tipo `Etapas`
2. Implementar a lógica e popular `etapas.nova_etapa`
3. Adicionar alertas em `alertas.push(...)` se necessário
4. No `RelatorioFechamento` do frontend, adicionar o campo ao tipo
5. No array de etapas do JSX, adicionar o item com `label`, `ok` e `detalhe`

# AlugEasy MCP Server

Servidor MCP que expõe os dados do sistema financeiro AlugEasy como tools para agentes de IA (Claude Desktop, Claude Code).

---

## Requisitos

- Node.js ≥ 18
- Acesso ao projeto Supabase `rlkmljeatapayiroggrp` com a **service role key**

---

## Instalação e build

```bash
# A partir da raiz do projeto AlugEasy
cd mcp-server
npm install
npm run build        # compila TypeScript → dist/
```

Para desenvolvimento com hot-reload:

```bash
npm run dev          # usa tsx watch, não precisa buildar
```

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key — **não** a anon key |
| `ALUGUEASY_BASE_URL` | opcional | URL base do Next.js (para links e webhooks) |

> **Atenção:** a service role key bypassa o RLS. Nunca exponha ela no frontend.

---

## Configurar no Claude Desktop

Edite `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) ou `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "alugueasy": {
      "command": "node",
      "args": ["/caminho/absoluto/para/Sistema-Financeiro-Alugueasy/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://rlkmljeatapayiroggrp.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "sua-service-role-key",
        "ALUGUEASY_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

Veja também `claude_desktop_config.example.json` na raiz do `mcp-server/`.

---

## Configurar no Claude Code (VS Code)

Adicione ao `.claude/settings.json` do projeto (ou `~/.claude/settings.json` para configuração global):

```json
{
  "mcpServers": {
    "alugueasy": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://rlkmljeatapayiroggrp.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "sua-service-role-key",
        "ALUGUEASY_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

O path em `args` é relativo ao diretório de trabalho onde o Claude Code é aberto (raiz do projeto).

---

## Tools disponíveis

### Módulo `financeiro`

#### `get_kpis`
KPIs financeiros agregados (faturamento, custos, lucro, margem).

| Input | Tipo | Descrição |
|---|---|---|
| `mes` | `number` 0–12 | Mês (0 = todos) |
| `ano` | `number` 2020–2030 | Ano |

```json
{
  "faturamento": 45230.00,
  "custos": 12800.00,
  "lucro": 32430.00,
  "margem_percent": 71.71,
  "periodo": "03/2026"
}
```

---

#### `get_kpis_por_empreendimento`
KPIs separados por empreendimento, ordenados por faturamento decrescente.

| Input | Tipo | Descrição |
|---|---|---|
| `mes` | `number` 0–12 | Mês (0 = todos) |
| `ano` | `number` 2020–2030 | Ano |

```json
[
  { "empreendimento": "Edifício Alpha", "faturamento": 30000, "custos": 8000, "lucro": 22000, "margem_percent": 73.33 },
  { "empreendimento": "Residencial Beta", "faturamento": 15230, "custos": 4800, "lucro": 10430, "margem_percent": 68.48 }
]
```

---

#### `get_custos_detalhados`
Detalhamento de custos por categoria com percentuais.

| Input | Tipo | Descrição |
|---|---|---|
| `mes` | `number` 0–12 | Mês (0 = todos) |
| `ano` | `number` 2020–2030 | Ano |
| `empreendimento` | `string?` | Filtro por nome (parcial, case-insensitive) |
| `tipo_gestao` | `'adm' \| 'sub' \| 'todos'` | Padrão: `'todos'` |

```json
{
  "total": 12800.00,
  "por_categoria": [
    { "categoria": "Manutenção", "valor": 5200.00, "percentual": 40.63 }
  ],
  "detalhes": [
    { "empreendimento": "Edifício Alpha", "apartamento": "101", "categoria": "Manutenção", "valor": 5200.00, "tipo_gestao": "adm" }
  ]
}
```

---

#### `get_relatorio_semestral`
Relatório dos últimos 6 meses com variação mês a mês (MoM).

Sem inputs.

```json
[
  { "mes_label": "Nov/2025", "mes": 11, "ano": 2025, "faturamento": 40000, "custos": 11000, "lucro": 29000, "margem_percent": 72.5, "variacao_lucro_percent": null },
  { "mes_label": "Dez/2025", "mes": 12, "ano": 2025, "faturamento": 38000, "custos": 10500, "lucro": 27500, "margem_percent": 72.37, "variacao_lucro_percent": -5.17 }
]
```

---

### Módulo `imoveis`

#### `list_empreendimentos`
Lista todos os empreendimentos com contagem de apartamentos.

Sem inputs.

```json
[
  { "id": "uuid", "nome": "Edifício Alpha", "total_apartamentos": 12 }
]
```

---

#### `list_apartamentos`
Lista apartamentos com configuração de repasse ao proprietário.

| Input | Tipo | Descrição |
|---|---|---|
| `empreendimento` | `string?` | Filtro por nome (parcial, case-insensitive) |

```json
[
  {
    "id": "uuid",
    "numero": "101",
    "empreendimento": "Edifício Alpha",
    "taxa_repasse": 15,
    "tipo_repasse": "lucro",
    "nome_proprietario": "João Silva",
    "modelo_contrato": "administracao",
    "tipo_gestao": "adm"
  }
]
```

---

#### `get_prestacao_contas`
Calcula a prestação de contas mensal de um apartamento (mesma lógica da página `/prestacao-contas`).

| Input | Tipo | Descrição |
|---|---|---|
| `apartamento_id` | `string` UUID | ID do apartamento |
| `mes` | `number` 1–12 | Mês de competência |
| `ano` | `number` 2020–2030 | Ano de competência |

```json
{
  "apartamento": { "numero": "101", "empreendimento": "Edifício Alpha", "taxa_repasse": 15, "tipo_repasse": "lucro" },
  "periodo": { "mes": 3, "ano": 2026, "data_inicio": "2026-03-01", "data_fim": "2026-03-31" },
  "receita": { "adm": 8000, "sub": 2000, "total": 10000 },
  "custos": { "adm": 1500, "sub": 500, "total": 2000, "detalhes": [] },
  "resultado": {
    "lucro_liquido": 8000,
    "margem_percent": 80.0,
    "base_calculo_repasse": "lucro",
    "valor_base_calculo": 8000,
    "valor_repasse": 1200,
    "valor_liquido_proprietario": 6800
  },
  "tem_dados": true
}
```

---

### Módulos pendentes

| Tool | Módulo | Status |
|---|---|---|
| `list_importacoes` | `importacao` | stub (não implementado) |
| `get_importacao` | `importacao` | stub |
| `trigger_amenitiz_sync` | `importacao` | stub |
| `health_check` | `monitoramento` | stub |
| `margin_alerts` | `monitoramento` | stub |
| `sync_status` | `monitoramento` | stub |

---

## Rodar manualmente

```bash
cd mcp-server
npm run build
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node dist/index.js
```

O servidor roda em modo **stdio** — não abre porta HTTP. Toda comunicação é via stdin/stdout seguindo o protocolo MCP.

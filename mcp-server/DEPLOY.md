# Deploy do MCP Server AlugEasy

## Opção A — Railway (recomendado, mais simples)

### Pré-requisitos
- Conta em railway.app
- Railway CLI: `npm i -g @railway/cli && railway login`

### Passos

1. Criar projeto no Railway:
```bash
cd mcp-server
railway init
railway up
```

2. Configurar variáveis de ambiente no Railway Dashboard:
```
SUPABASE_URL=https://rlkmljeatapayiroggrp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
ALUGUEASY_BASE_URL=https://<seu-dominio-vercel>.vercel.app
ALUGUEASY_INTERNAL_API_KEY=<mesma_key_do_env_local>
MCP_PORT=3001
```

3. Após deploy, anotar a URL pública (ex: `alugueasy-mcp.railway.app`)

4. Atualizar `.claude/settings.json` no projeto:
```json
{
  "mcpServers": {
    "alugueasy": {
      "type": "http",
      "url": "https://alugueasy-mcp.railway.app/mcp",
      "headers": {
        "x-alugueasy-internal-key": "<ALUGUEASY_INTERNAL_API_KEY>"
      }
    }
  }
}
```

---

## Opção B — VPS / servidor próprio

```bash
# No servidor:
git clone <repo> && cd Sistema-Financeiro-Alugueasy/mcp-server
npm ci && npm run build

# Criar .env com as variáveis acima
# Rodar com PM2:
npm i -g pm2
pm2 start dist/index-http.js --name alugueasy-mcp
pm2 save && pm2 startup
```

---

## Opção C — Render.com (free tier disponível)

1. Conectar repositório GitHub em render.com
2. Novo serviço: **Web Service**
3. Root directory: `mcp-server`
4. Build command: `npm ci && npm run build`
5. Start command: `node dist/index-http.js`
6. Configurar env vars conforme Opção A
7. Health check path: `/health`

---

## Verificar deploy

```bash
# Substituir pela URL real do deploy
curl https://alugueasy-mcp.railway.app/health
# Esperado: {"status":"ok","server":"alugueasy-mcp","version":"1.0.0"}

# Teste com autenticação
curl -X POST https://alugueasy-mcp.railway.app/mcp \
  -H "Content-Type: application/json" \
  -H "x-alugueasy-internal-key: <INTERNAL_KEY>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# Esperado: lista com 17+ tools
```

---

## Deploy do Next.js (Vercel)

```bash
# Instalar Vercel CLI
npm i -g vercel
vercel login

# Configurar variáveis (a partir da raiz do projeto)
bash mcp-server/scripts/setup-vercel-env.sh

# Deploy em produção
vercel deploy --prod
```

Ou conectar o repositório diretamente no dashboard Vercel → importar de GitHub → branch `main`.

**Variáveis obrigatórias no Vercel:**
| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (pública por design) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — **apenas server-side** |
| `AMENITIZ_ACCESS_TOKEN` | Token da API Amenitiz |
| `AMENITIZ_BASE_URL` | Base URL da API Amenitiz |
| `AMENITIZ_HOTEL_UUID` | UUID do hotel na Amenitiz |
| `ALUGUEASY_INTERNAL_API_KEY` | Chave compartilhada MCP ↔ Next.js |

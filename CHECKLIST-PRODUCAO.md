# Checklist de Produção — AlugEasy

## Deploy Next.js (Vercel)
- [ ] Merge `feature/Arthur` → `main`
- [ ] Vercel conectado ao repositório GitHub (branch `main`)
- [ ] Variáveis de ambiente configuradas no Vercel Dashboard (ver `mcp-server/DEPLOY.md`)
- [ ] Deploy automático ativo (push em `main` = deploy)
- [ ] Domínio customizado configurado (opcional)
- [ ] Testar login em produção
- [ ] Testar sync Amenitiz em produção
- [ ] Testar geração de PDF em produção

## Deploy MCP Server (Railway/Render)
- [ ] Repositório conectado ao Railway
- [ ] Variáveis de ambiente configuradas (`SUPABASE_URL`, `SERVICE_ROLE_KEY`, `INTERNAL_KEY`, `ALUGUEASY_BASE_URL`)
- [ ] `ALUGUEASY_BASE_URL` aponta para URL Vercel de produção (não `localhost`)
- [ ] Health check respondendo: `GET /health` → `{"status":"ok"}`
- [ ] `.claude/settings.json` atualizado com URL de produção do MCP

## Supabase
- [ ] Migration 009 aplicada (quando UUIDs manuais obtidos para os 7 apartamentos pendentes)
- [ ] RLS habilitado em todas as tabelas (verificar no dashboard)
- [ ] Backup automático ativo (Supabase Pro ou snapshot manual)

## Mapeamento Amenitiz (pendentes)
- [ ] BRISAS D137 → obter UUID e executar `set_amenitiz_room_id`
- [ ] BRISAS D138 → idem
- [ ] BRISAS E020 → idem
- [ ] BRISAS E016 → idem
- [ ] ATHOS 11 → idem
- [ ] ATHOS 908 → idem
- [ ] METROPOLITAN 1701 → idem

## Pós-deploy — primeiro uso
- [ ] Login com usuário analista — verificar acesso a `/importar`
- [ ] Sync Amenitiz do mês atual — verificar KPIs no dashboard
- [ ] Gerar relatório mensal via prompt MCP (`relatorio_mensal`)
- [ ] Testar tool `resumo_executivo` via Claude Code/Desktop

## Monitoramento contínuo
- [ ] Configurar cron/n8n para chamar `resumo_executivo` todo dia 1 do mês
- [ ] Configurar alerta se `health_check` falhar
- [ ] Configurar alerta se margem cair abaixo de 15%

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

---

## Portal do Proprietário

### Migrations (aplicar no Supabase produção)
- [ ] Migration 014 — `014_portal_proprietario.sql` — tabela, RLS, constraint de role
- [ ] Migration 015 — `015_fix_rls_proprietario.sql` — WITH CHECK para INSERT do analista
- [ ] Migration 016 — `016_fix_rls_select_proprietario.sql` — policy SELECT do proprietário

### Configuração inicial
- [ ] Criar primeiro proprietário real em `/usuarios` → "Novo Proprietário"
- [ ] Vincular apartamentos do proprietário via "Gerenciar Acessos"
- [ ] Verificar com `listar_proprietarios` (MCP) que vínculos estão corretos

### Testes em produção
- [ ] Login do proprietário redireciona para `/proprietario` (não para `/`)
- [ ] Analista/admin tentando acessar `/proprietario` é redirecionado para `/`
- [ ] Portal mostra KPIs corretos para o mês atual
- [ ] Filtro de mês/ano funciona nas 3 páginas
- [ ] Download de PDF no extrato abre o documento
- [ ] Proprietário NÃO consegue acessar `/custos`, `/relatorio`, `/importar`
- [ ] Histórico mostra 12 meses com status pills corretos
- [ ] Logout do portal funciona e redireciona para `/login`

---

## Pendências técnicas (ordenadas por impacto)

1. **7 room_ids Amenitiz pendentes** — impacto: dados de BRISAS/ATHOS/METROPOLITAN ausentes no sync
   - BRISAS D137, D138, E020, E016 | ATHOS 11, 908 | METROPOLITAN 1701
   - Ação: obter UUIDs no painel Amenitiz → `set_amenitiz_room_id` via MCP

2. **Pipeline de custos** — reimportar jan/2026 após correção do matching
   - Verificar com `verificar_importacao_custos { mes: 1, ano: 2026, tipo_gestao: "adm" }`
   - Esperado: R$ 205.775,01 total ADM

3. **Dados maio/2026** — ainda sem faturamento ou custos importados (mês em aberto)
   - Normal até importação das planilhas do mês

4. **Notificações por email ao proprietário** — próxima feature
   - Trigger ao fechar o mês: enviar extrato por email

5. **Layout mobile-first do portal** — cards responsivos, tabela de histórico com scroll horizontal

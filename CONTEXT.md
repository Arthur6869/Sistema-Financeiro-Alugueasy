# CONTEXT.md — Estado atual (atualizar a cada sessão)

## Última sessão: 23/04/2026

## Quebrado agora
- Brisas: 2 quartos sem amenitiz_room_id (room_id 64e4757c e f0caa1ec)

## Em andamento
- (nada)

## Próximas tarefas priorizadas
1. Identificar números dos apartamentos Brisas faltantes e executar UPDATE no banco
2. Configurar AMENITIZ_HOTEL_UUID no .env (verificar se já está — `.env.local` linha 6 tem `AMENITIZ_HOTEL_UUID=bf661ab5-37e1-4a77-b346-59c68aa14725`)
3. Verificar se relatório `/relatorio` usa `amenitiz_reservas` ou `diarias` como fonte de faturamento

## Resolvido nesta sessão
- ✅ Guard /usuarios: estava correto (`analista` entra, `admin` bloqueado) — corrigido apenas o badge "Admin only" → "Analista only"
- ✅ "Prestação de Contas" na sidebar: já estava em `navItems` (linha 43 do app-sidebar.tsx)
- ✅ Decisões de design adicionadas ao AGENTS.md para não serem questionadas novamente
- ✅ Documentações .md lidas e salvas na memória persistente do Claude

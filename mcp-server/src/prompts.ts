import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const mesSchema = z.string().describe('Month number (1-12)')
const anoSchema = z.string().describe('Year (ex: 2026)')

export function registerPrompts(server: McpServer): void {

  // ── prompt 1: relatório mensal completo ───────────────────────────────
  server.prompt(
    'relatorio_mensal',
    'Full monthly financial report and closing workflow. Now automated — runs all steps in one call via executar_fechamento_mensal.',
    { mes: mesSchema, ano: anoSchema },
    ({ mes, ano }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Execute o fechamento completo de ${mes.padStart(2, '0')}/${ano}.

PASSO 1: Chame executar_fechamento_mensal { mes: ${mes}, ano: ${ano} }

Este comando executa automaticamente:
  ✓ Sync Amenitiz para o período
  ✓ Verificação de custos ADM (≥ 5 empreendimentos)
  ✓ Verificação de custos SUB (≥ 5 empreendimentos)
  ✓ Cálculo de KPIs (faturamento, custos, lucro, margem)
  ✓ Auditoria de lançamentos manuais
  ✓ Envio de extratos por email para todos os proprietários
  ✓ Notificação ao analista se houver problemas

PASSO 2: Com base no resultado retornado:
- Se status_geral = 'ok': informe "✅ Fechamento de ${mes.padStart(2, '0')}/${ano} concluído sem alertas."
- Se há alertas ⚠️: liste cada um com ação corretiva específica e o comando MCP para resolver
- Se há erros ❌: descreva o problema e o comando exato para corrigir

PASSO 3: Mostre um resumo executivo em português:
  Período: ${mes.padStart(2, '0')}/${ano}
  Faturamento: R$ X
  Custos: R$ X
  Lucro: R$ X (X%)
  Extratos enviados: N proprietários
  Status: ✅ OK / ⚠️ Com alertas / ❌ Com erros

Se quiser o breakdown completo por empreendimento após o fechamento, chame:
  get_kpis_por_empreendimento { mes: ${mes}, ano: ${ano} }`,
          },
        },
      ],
    })
  )

  // ── prompt 2: fechamento de mês ───────────────────────────────────────
  server.prompt(
    'fechamento_mes',
    'Month-end closing checklist. Verifies all data is complete before closing the period. Use on the last day of each month.',
    { mes: mesSchema, ano: anoSchema },
    ({ mes, ano }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Execute o checklist de fechamento do mês ${mes.padStart(2, '0')}/${ano}.

Verifique cada item na ordem e marque ✅ ou ❌:

1. [ ] Sync Amenitiz — chame check_sync_pendente {mes: ${mes}, ano: ${ano}}
   → ✅ se sincronizado há menos de 3 dias | ❌ se nunca ou há mais de 3 dias

2. [ ] Planilhas importadas e validadas — execute em sequência:
   a) chame get_historico_importacoes {mes: ${mes}, ano: ${ano}}
      → ✅ se os 4 tipos foram importados (custos_adm, custos_sub, diarias_adm, diarias_sub)
      → ❌ liste quais tipos estão faltando

   b) chame verificar_importacao_custos {mes: ${mes}, ano: ${ano}, tipo_gestao: "adm"}
      → ✅ se todos os empreendimentos têm dados e nenhum está zerado
      → ❌ liste quais empreendimentos estão ausentes ou zerados e o total ADM

   c) chame verificar_importacao_custos {mes: ${mes}, ano: ${ano}, tipo_gestao: "sub"}
      → ✅ se todos os empreendimentos têm dados
      → ❌ liste os ausentes e o total SUB

   Total de custos esperado: ADM + SUB deve ser maior que R$ 100.000 para qualquer mês.
   Se total < R$ 100.000, há dados faltando — não fechar o mês.

3. [ ] KPIs positivos — chame get_kpis {mes: ${mes}, ano: ${ano}}
   → ✅ se faturamento > 0 e lucro > 0
   → ❌ se faturamento = 0 (sync não funcionou) ou lucro negativo (alerta)

4. [ ] Margem mínima — chame alert_margem_baixa {mes: ${mes}, ano: ${ano}, threshold_percent: 15}
   → ✅ se todos os empreendimentos com margem >= 15%
   → ❌ liste os empreendimentos abaixo com a margem atual

5. [ ] Saúde do sistema — chame health_check
   → ✅ se supabase e api ok | ❌ com detalhe do erro

6. [ ] Cobertura do sync — chame check_apartamentos_sem_room_id {}
   → ✅ se total_sem_room_id = 0
   → ❌ se há apartamentos sem mapeamento (liste quais e o impacto estimado)

7. [ ] Lançamentos manuais — chame listar_custos_manuais {mes: ${mes}, ano: ${ano}}
   → ✅ se total_registros = 0 (nenhum lançamento avulso)
   → ℹ️ se há lançamentos: revisar se todos são intencionais
   → Para cada lançamento: verificar categoria, valor e empreendimento
   → Confirmar com o analista se os valores estão corretos antes de fechar

Produza o checklist final com:
- Status de cada item (✅/❌)
- Para cada ❌: ação corretiva específica com o comando MCP a executar
- Status geral: APROVADO (todos ✅) ou PENDÊNCIAS (lista o que falta)
- Recomendação: pode fechar o mês? sim/não e por quê.`,
          },
        },
      ],
    })
  )

  // ── prompt 3: diagnóstico de sistema ──────────────────────────────────
  server.prompt(
    'diagnostico_sistema',
    'Full system diagnostic when something seems wrong. Checks connectivity, data freshness, and financial anomalies. Run this first when investigating any issue.',
    { mes: mesSchema, ano: anoSchema },
    ({ mes, ano }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Execute diagnóstico completo do sistema AlugEasy para ${mes.padStart(2, '0')}/${ano}.

Coleta de dados (execute em paralelo se possível):
- health_check {}
- check_sync_pendente {mes: ${mes}, ano: ${ano}}
- get_historico_importacoes {mes: ${mes}, ano: ${ano}}
- resumo_executivo {mes: ${mes}, ano: ${ano}}
- alert_margem_baixa {mes: ${mes}, ano: ${ano}, threshold_percent: 20}
- check_apartamentos_sem_room_id {} — detecta apartamentos fora do sync

Análise e diagnóstico:
1. INFRAESTRUTURA: Supabase e API respondem? Latência aceitável?
2. DADOS: Sync Amenitiz atualizado? Planilhas importadas? Dados zerados?
3. FINANCEIRO: Há anomalias? Faturamento muito diferente do mês anterior?
   Algum empreendimento com custo maior que faturamento?
4. CONFIGURAÇÃO: Todos os empreendimentos aparecem nos dados?
   Há apartamentos sem amenitiz_room_id que podem estar perdendo reservas?
5. COBERTURA AMENITIZ: Todos os apartamentos têm amenitiz_room_id?
   Se não, quais empreendimentos estão com cobertura parcial?
   Qual o impacto financeiro estimado dos apartamentos invisíveis?

Produza o diagnóstico com:
- SEMÁFORO GERAL: 🟢 Operacional / 🟡 Atenção / 🔴 Crítico
- Problemas encontrados (ordenados por severidade)
- Causa provável de cada problema
- Ação corretiva específica com o comando exato a executar
- Estimativa de impacto financeiro se algum dado estiver faltando`,
          },
        },
      ],
    })
  )
}

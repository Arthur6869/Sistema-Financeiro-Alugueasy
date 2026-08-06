// Aplica imediatamente os alvos de faturamento mensal fechados pela gestão,
// sem esperar o sync diário das 05:00. Grava direto na tabela `diarias`, que é
// o KPI "Faturamento" do portal em mês fechado (Histórico e Rentabilidade) e a
// base do repasse na prestação de contas.
//
// A regra permanente vive em FATURAMENTO_MENSAL (lib/sync-amenitiz-core.ts) —
// manter as duas listas em sincronia. Sem a regra deployada o cron regenera a
// diária do zero e reverte o que este script gravou (a janela móvel cobre o mês
// corrente + 2 anteriores). Rodar de novo é idempotente.
//
// Rodar da raiz do repo: npx tsx scripts/ajuste-faturamento-mensal.ts

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

// Espelho de FATURAMENTO_MENSAL em lib/sync-amenitiz-core.ts.
const ALVOS: Array<{ emp: string; numero: string; mes: number; ano: number; alvo: number; motivo: string }> = [
  { emp: 'EASY', numero: '117', mes: 5, ano: 2026, alvo: 6137.99,
    motivo: 'Leonardo — planilha mai/2026: 594,00 + 1.386,00 + 4.157,99' },
  { emp: 'EASY', numero: '117', mes: 6, ano: 2026, alvo: 5940.00,
    motivo: 'Leonardo — jun/2026 fechado pela gestão (KPI estava R$ 0,00)' },
]

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: apts, error: eApts } = await supabase
    .from('apartamentos')
    .select('id, numero, tipo_gestao, empreendimentos(nome)')
  if (eApts) { console.error('Erro ao carregar apartamentos:', eApts); process.exit(1) }

  let falhou = false

  for (const t of ALVOS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apt = (apts ?? []).find((x: any) =>
      String(x.numero).trim().toUpperCase() === t.numero.toUpperCase() &&
      ((x.empreendimentos as { nome?: string } | null)?.nome ?? '').toUpperCase().trim() === t.emp.toUpperCase())

    if (!apt) {
      console.error(`${t.emp} ${t.numero}: apartamento não encontrado`)
      falhou = true
      continue
    }

    const dataInicio = `${t.ano}-${String(t.mes).padStart(2, '0')}-01`
    const dataFim    = new Date(t.ano, t.mes, 0).toISOString().slice(0, 10)

    const { data: antes } = await supabase
      .from('diarias')
      .select('id, valor')
      .eq('apartamento_id', apt.id)
      .gte('data', dataInicio).lte('data', dataFim)

    const anterior = (antes ?? []).reduce((s, d) => s + Number(d.valor ?? 0), 0)

    // Uma diária por apartamento/mês: apaga as linhas do período e grava o alvo.
    // Evita somar em cima de linhas antigas quando havia mais de uma.
    if ((antes ?? []).length > 0) {
      const { error } = await supabase
        .from('diarias')
        .delete()
        .eq('apartamento_id', apt.id)
        .gte('data', dataInicio).lte('data', dataFim)
      if (error) { console.error(`Erro ao limpar diária de ${t.emp} ${t.numero}:`, error); process.exit(1) }
    }

    const { error: eIns } = await supabase.from('diarias').insert({
      apartamento_id: apt.id,
      valor:          t.alvo,
      data:           dataInicio,
      tipo_gestao:    apt.tipo_gestao ?? 'adm',
    })
    if (eIns) { console.error(`Erro ao gravar diária de ${t.emp} ${t.numero}:`, eIns); process.exit(1) }

    console.log(`${t.emp} ${t.numero} ${t.mes}/${t.ano}: ${anterior.toFixed(2)} → ${t.alvo.toFixed(2)}  (${t.motivo})`)
  }

  if (falhou) process.exit(1)
  console.log('\nFaturamento mensal aplicado. Confirme que FATURAMENTO_MENSAL (lib/sync-amenitiz-core.ts) tem os mesmos valores antes do deploy.')
}

main().catch(e => { console.error(e); process.exit(1) })

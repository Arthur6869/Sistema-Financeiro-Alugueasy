// Backfill de reservas ausentes em amenitiz_reservas (jan→jul/2026).
// Usa o próprio runAmenitizSync em modo reservasOnly (não toca diárias,
// importações nem amenitiz_syncs) + apenasNovas (INSERE só booking_ids que não
// existem — preserva qualquer edição manual de analistas em meses passados).
//
// Rodar da raiz do repo: npx tsx scripts/backfill-viradas-mes.ts

import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const { runAmenitizSync } = await import('../lib/sync-amenitiz-core')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const meses: [number, number][] = [[1, 2026], [2, 2026], [3, 2026], [4, 2026], [5, 2026], [6, 2026], [7, 2026]]

  for (const [mes, ano] of meses) {
    const { count: antes } = await supabase
      .from('amenitiz_reservas').select('*', { count: 'exact', head: true })
    console.log(`\n───── Backfill ${String(mes).padStart(2, '0')}/${ano} (linhas no banco antes: ${antes}) ─────`)

    const r = await runAmenitizSync(supabase, mes, ano, { reservasOnly: true, apenasNovas: true })

    const { count: depois } = await supabase
      .from('amenitiz_reservas').select('*', { count: 'exact', head: true })
    console.log(
      `${String(mes).padStart(2, '0')}/${ano}: success=${r.success}` +
      (r.error ? ` erro=${r.error}` : '') +
      ` | linhas inseridas: ${(depois ?? 0) - (antes ?? 0)} | total no banco: ${depois}` +
      (r.apts_nao_encontrados.length ? ` | apts não mapeados: ${r.apts_nao_encontrados.join('; ')}` : '')
    )
  }
}

main().catch(e => { console.error(e); process.exit(1) })

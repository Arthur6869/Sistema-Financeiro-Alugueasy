const postgres = require('postgres');

async function main() {
  const sql = postgres('postgresql://postgres:Arthur6768@@rlkmljeatapayiroggrp.db.supabase.co:5432/postgres');
  try {
    console.log('=== Tabelas public ===');
    const tables = await sql`select table_name from information_schema.tables where table_schema='public' order by table_name`;
    console.log(tables.map(r => r.table_name).join(', '));

    console.log('\n=== Count apartamentos ===');
    const count = await sql`select count(*) from apartamentos`;
    console.log(count[0]);

    console.log('\n=== Sample apartamentos ===');
    const sample = await sql`select id, numero, empreendimento_id from apartamentos limit 10`;
    console.log(sample);

    console.log('\n=== Empreendimentos sample ===');
    const emps = await sql`select id, nome from empreendimentos limit 10`;
    console.log(emps);

    console.log('\n=== Apartments by empreendimento count ===');
    const counts = await sql`select empreendimento_id, count(*) from apartamentos group by empreendimento_id order by empreendimento_id`;
    console.log(counts);
  } catch (error) {
    console.error('ERROR', error.message || error);
  } finally {
    await sql.end();
  }
}

main();

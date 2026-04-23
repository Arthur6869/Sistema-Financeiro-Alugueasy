import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mes = searchParams.get('mes');
  const ano = searchParams.get('ano');
  
  if (!mes || !ano) {
    return NextResponse.json({ error: 'Mês e ano são obrigatórios.' }, { status: 400 });
  }

  let query = supabase
    .from('apartamentos')
    .select('id, numero, empreendimento_id, reservas:amenitiz_reservas(booking_id, valor_liquido, valor_bruto, status, source)')
    .eq('reservas.mes_competencia', mes)
    .eq('reservas.ano_competencia', ano);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

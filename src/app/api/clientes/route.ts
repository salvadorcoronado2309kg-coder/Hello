import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { CreateClienteDTO } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body: CreateClienteDTO = await request.json();

    const { data, error } = await supabase
      .from('clientes').insert({ ...body, razon_social: body.razonSocial, rnc_cedula: body.rncCedula, regimen_itbis: body.regimenITBIS }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ exito: true, datos: data }, { status: 201 });
  } catch (error) {
    console.error('Error en POST /api/clientes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase.from('clientes').select('*').eq('activo', true).order('razon_social');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ exito: true, datos: data });
  } catch (error) {
    console.error('Error en GET /api/clientes:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

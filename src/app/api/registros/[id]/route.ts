import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: registro, error } = await supabase
      .from('registros_606').select('*, clientes(id, razon_social, rnc_cedula, regimen_itbis)').eq('id', id).single();

    if (error || !registro) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

    return NextResponse.json({ exito: true, datos: registro });
  } catch (error) {
    console.error('Error en GET /api/registros/[id]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: registroOriginal } = await supabase.from('registros_606').select('*').eq('id', id).single();
    if (!registroOriginal) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

    const updates = await request.json();
    const { data: registroActualizado, error: updateError } = await supabase
      .from('registros_606').update({ ...updates, fecha_actualizacion: new Date().toISOString() }).eq('id', id).select().single();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ exito: true, datos: registroActualizado });
  } catch (error) {
    console.error('Error en PUT /api/registros/[id]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: registroOriginal } = await supabase.from('registros_606').select('id').eq('id', id).single();
    if (!registroOriginal) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

    const { error: deleteError } = await supabase.from('registros_606').delete().eq('id', id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ exito: true, mensaje: 'Registro eliminado' });
  } catch (error) {
    console.error('Error en DELETE /api/registros/[id]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { IngestaService } from '@/services/IngestaService';
import { CreateRegistro606DTO } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const registro606DTO: CreateRegistro606DTO = body;
    const idCliente: string = body.idCliente;

    const { data: cliente, error: clienteError } = await supabase
      .from('clientes').select('*').eq('id', idCliente).single();

    if (clienteError || !cliente) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    const ingestaService = new IngestaService();
    const validacion = await ingestaService.validarRegistroFiscal(registro606DTO, { cliente });

    return NextResponse.json({ exito: true, validacion });
  } catch (error) {
    console.error('Error en POST /api/registros/validar:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

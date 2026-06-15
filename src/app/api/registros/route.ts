import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { IngestaService } from '@/services/IngestaService';
import { CreateRegistro606DTO, EstadoRegistro, TipoEventoAuditoria } from '@/types';

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

    const registroAGuardar = {
      ...registro606DTO,
      id_cliente: idCliente,
      estado: validacion.esValido ? EstadoRegistro.VALIDADO : EstadoRegistro.PENDIENTE,
      errores_validacion: validacion.errores.map(e => e.mensaje),
      fecha_validacion: validacion.esValido ? new Date().toISOString() : null
    };

    const { data: registroGuardado, error: insertError } = await supabase
      .from('registros_606').insert(registroAGuardar).select().single();

    if (insertError) {
      return NextResponse.json({ error: `Error al guardar: ${insertError.message}` }, { status: 500 });
    }

    const eventoAuditoria = ingestaService.crearEventoAuditoria(
      registroGuardado.id, idCliente,
      validacion.esValido ? TipoEventoAuditoria.VALIDACION_EXITOSA : TipoEventoAuditoria.VALIDACION_FALLIDA,
      `Registro ${validacion.esValido ? 'validado' : 'rechazado'} en ingesta`,
      validacion.reglasAplicadas, validacion.errores.map(e => e.mensaje)
    );
    await supabase.from('auditoria_registros').insert(eventoAuditoria);

    return NextResponse.json(
      { exito: true, datos: registroGuardado, validacion: { esValido: validacion.esValido, errores: validacion.errores, advertencias: validacion.advertencias } },
      { status: validacion.esValido ? 201 : 200 }
    );
  } catch (error) {
    console.error('Error en POST /api/registros:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(request.url);
    const idCliente = url.searchParams.get('idCliente');
    const periodo = url.searchParams.get('periodo');
    const estado = url.searchParams.get('estado');
    const pagina = parseInt(url.searchParams.get('pagina') || '1', 10);
    const porPagina = parseInt(url.searchParams.get('porPagina') || '50', 10);

    if (!idCliente) return NextResponse.json({ error: 'Parámetro idCliente requerido' }, { status: 400 });

    let query = supabase.from('registros_606').select('*', { count: 'exact' })
      .eq('id_cliente', idCliente).order('fecha_creacion', { ascending: false });

    if (periodo) query = query.like('fecha_comprobante', `${periodo}%`);
    if (estado) query = query.eq('estado', estado);

    const inicio = (pagina - 1) * porPagina;
    query = query.range(inicio, inicio + porPagina - 1);

    const { data: registros, count, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      exito: true, datos: registros, paginaActual: pagina, porPagina,
      totalRegistros: count || 0, totalPaginas: Math.ceil((count || 0) / porPagina)
    });
  } catch (error) {
    console.error('Error en GET /api/registros:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

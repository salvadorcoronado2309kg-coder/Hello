import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ExportadorForm606 } from '@/utils/ExportadorForm606';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { idCliente, periodo } = await request.json();
    if (!idCliente || !periodo) {
      return NextResponse.json({ error: 'Parámetros idCliente y periodo requeridos' }, { status: 400 });
    }

    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', idCliente).single();
    if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

    const { data: registros, error: registrosError } = await supabase
      .from('registros_606').select('*').eq('id_cliente', idCliente).eq('estado', 'validado').like('fecha_comprobante', `${periodo}%`);

    if (registrosError) return NextResponse.json({ error: registrosError.message }, { status: 500 });
    if (!registros || registros.length === 0) {
      return NextResponse.json({ error: 'No hay registros validados para este período' }, { status: 404 });
    }

    const exportador = new ExportadorForm606();
    const resultado = await exportador.generarArchivoTXT(registros, cliente, periodo);

    if (!resultado.exito || !resultado.contenidoTXT) {
      return NextResponse.json({ error: resultado.mensajeError }, { status: 500 });
    }

    await supabase.from('exportaciones_606').insert({
      id_cliente: idCliente, periodo,
      cantidad_registros: resultado.cantidadRegistros,
      suma_total_facturado: resultado.detallesValidacion?.totalFacturado || 0,
      suma_itbis_adelantar: resultado.detallesValidacion?.totalITBIS || 0,
      suma_isr_retenido: resultado.detallesValidacion?.totalISR || 0,
      nombre_archivo: `form606_${periodo}.txt`,
      hash_md5: resultado.hashMD5,
      usuario_id: user.id
    });

    return new NextResponse(resultado.contenidoTXT, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Content-Disposition': `attachment; filename="form606_${periodo}.txt"`
      }
    });
  } catch (error) {
    console.error('Error en POST /api/registros/exportar:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

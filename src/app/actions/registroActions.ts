'use server';

import { createClient } from '@/lib/supabase-server';
import { IngestaService } from '@/services/IngestaService';
import { CreateRegistro606DTO, EstadoRegistro } from '@/types';
import { ExportadorForm606 } from '@/utils/ExportadorForm606';

export async function crearYValidarRegistro(registro606DTO: CreateRegistro606DTO, idCliente: string) {
  try {
    const supabase = await createClient();

    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', idCliente).single();

    const ingestaService = new IngestaService();
    const validacion = await ingestaService.validarRegistroFiscal(registro606DTO, { cliente });

    const { data, error } = await supabase
      .from('registros_606').insert({
        ...registro606DTO, id_cliente: idCliente,
        estado: validacion.esValido ? EstadoRegistro.VALIDADO : EstadoRegistro.PENDIENTE,
        errores_validacion: validacion.errores.map(e => e.mensaje)
      }).select().single();

    return { exito: !error, datos: data, validacion, error: error?.message };
  } catch (error) {
    return { exito: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

export async function obtenerRegistrosPeriodo(idCliente: string, periodo: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('registros_606').select('*').eq('id_cliente', idCliente)
      .like('fecha_comprobante', `${periodo}%`).order('fecha_comprobante', { ascending: false });

    return { exito: !error, datos: data || [], error: error?.message };
  } catch (error) {
    return { exito: false, datos: [], error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

export async function exportarPeriodoTXT(idCliente: string, periodo: string) {
  try {
    const supabase = await createClient();

    const { data: cliente } = await supabase.from('clientes').select('*').eq('id', idCliente).single();
    const { data: registros } = await supabase
      .from('registros_606').select('*').eq('id_cliente', idCliente).eq('estado', 'validado').like('fecha_comprobante', `${periodo}%`);

    if (!registros || registros.length === 0) return { exito: false, error: 'No hay registros validados' };

    const exportador = new ExportadorForm606();
    const resultado = await exportador.generarArchivoTXT(registros, cliente, periodo);

    return {
      exito: resultado.exito,
      contenidoTXT: resultado.contenidoTXT,
      hashMD5: resultado.hashMD5,
      cantidadRegistros: resultado.cantidadRegistros,
      error: resultado.mensajeError
    };
  } catch (error) {
    return { exito: false, error: error instanceof Error ? error.message : 'Error desconocido' };
  }
}

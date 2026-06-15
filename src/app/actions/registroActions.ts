'use server';

import getDB from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getClienteForUser } from '@/lib/supabase-server';
import { IngestaService } from '@/services/IngestaService';
import { CreateRegistro606DTO, EstadoRegistro, Registro606 } from '@/types';
import { ExportadorForm606 } from '@/utils/ExportadorForm606';

export async function crearYValidarRegistro(dto: CreateRegistro606DTO, idCliente: string) {
  try {
    const db = getDB();
    const cliente = await getClienteForUser(idCliente);
    if (!cliente) return { exito: false, error: 'Cliente no encontrado' };

    const svc = new IngestaService();
    const validacion = await svc.validarRegistroFiscal(dto, { cliente });

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO registros_606 (
        id, id_cliente, rnc_cedula, tipo_id, tipo_bien_servicio, ncf, ncf_modificado,
        fecha_comprobante, fecha_pago, monto_servicios, monto_bienes,
        itbis_facturado, itbis_retenido, itbis_proporcional, itbis_costo, itbis_adelantar,
        tipo_retencion_isr, monto_retencion_isr, isc, otros_impuestos, propina_legal,
        forma_pago, concepto_personalizado, estado, errores_validacion,
        fecha_creacion, fecha_actualizacion, fecha_validacion, origen_ingesta, es_segundo_envio
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id, idCliente,
      dto.rncCedula, dto.tipoID, dto.tipoBienServicio, dto.ncf, dto.ncfModificado ?? null,
      dto.fechaComprobante, dto.fechaPago ?? null,
      dto.montoServicios ?? 0, dto.montoBienes ?? 0,
      dto.itbisFacturado ?? 0, dto.itbisRetenido ?? 0, dto.itbisProporcional ?? 0,
      dto.itbisCosto ?? 0, dto.itbisAdelantar ?? 0,
      dto.tipoRetencionISR ?? null, dto.montoRetencionISR ?? 0,
      dto.isc ?? 0, dto.otrosImpuestos ?? 0, dto.propinaLegal ?? 0,
      dto.formaPago, dto.conceptoPersonalizado ?? null,
      validacion.esValido ? EstadoRegistro.VALIDADO : EstadoRegistro.PENDIENTE,
      JSON.stringify(validacion.errores.map(e => e.mensaje)),
      now, now,
      validacion.esValido ? now : null,
      dto.origenIngesta ?? null, 0
    );

    const auditId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO auditoria_registros (id, id_registro_606, id_cliente, tipo_evento, descripcion, reglas_aplicadas, errores_detectados, fecha_evento)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(
      auditId, id, idCliente,
      validacion.esValido ? 'VALIDACION_EXITOSA' : 'VALIDACION_FALLIDA',
      `Registro ${validacion.esValido ? 'validado' : 'rechazado'} en ingesta`,
      JSON.stringify(validacion.reglasAplicadas),
      JSON.stringify(validacion.errores.map(e => e.mensaje)),
      now
    );

    const datos = db.prepare(
      'SELECT *, (monto_servicios + monto_bienes) as total_facturado FROM registros_606 WHERE id = ?'
    ).get(id);

    return { exito: true, datos, validacion, error: null };
  } catch (e) {
    return { exito: false, error: e instanceof Error ? e.message : 'Error desconocido', validacion: null, datos: null };
  }
}

export async function obtenerRegistrosPeriodo(idCliente: string, periodo: string) {
  try {
    const db = getDB();
    const rows = db.prepare(
      `SELECT *, (monto_servicios + monto_bienes) as total_facturado FROM registros_606
       WHERE id_cliente = ? AND fecha_comprobante LIKE ? ORDER BY fecha_comprobante DESC`
    ).all(idCliente, `${periodo}%`);
    return { exito: true, datos: rows, error: null };
  } catch (e) {
    return { exito: false, datos: [], error: e instanceof Error ? e.message : 'Error' };
  }
}

export async function exportarPeriodoTXT(idCliente: string, periodo: string) {
  try {
    const db = getDB();
    const cliente = await getClienteForUser(idCliente);
    if (!cliente) return { exito: false, error: 'Cliente no encontrado' };

    const registros = db.prepare(
      `SELECT *, (monto_servicios + monto_bienes) as total_facturado FROM registros_606
       WHERE id_cliente = ? AND estado = 'validado' AND fecha_comprobante LIKE ?`
    ).all(idCliente, `${periodo}%`);

    if (!registros.length) return { exito: false, error: 'No hay registros validados para el período' };

    const exportador = new ExportadorForm606();
    const resultado = await exportador.generarArchivoTXT(registros as unknown as Registro606[], cliente, periodo);

    if (resultado.exito) {
      const expId = crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO exportaciones_606 (id, id_cliente, periodo, cantidad_registros, suma_facturado, nombre_archivo, hash_md5, fecha_creacion)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(
        expId, idCliente, periodo,
        resultado.cantidadRegistros,
        resultado.detallesValidacion?.totalFacturado ?? 0,
        `606_${periodo}.txt`,
        resultado.hashMD5 ?? null,
        now
      );
    }

    return {
      exito: resultado.exito,
      contenidoTXT: resultado.contenidoTXT,
      hashMD5: resultado.hashMD5,
      cantidadRegistros: resultado.cantidadRegistros,
      error: resultado.mensajeError,
    };
  } catch (e) {
    return { exito: false, error: e instanceof Error ? e.message : 'Error' };
  }
}

void getSessionUser;

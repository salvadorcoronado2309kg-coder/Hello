import { createClient } from '@/lib/supabase';
import {
  Registro606, CreateRegistro606DTO, UpdateRegistro606DTO,
  EstadoRegistro, TipoID, OrigenIngesta
} from '@/types';

function mapearRegistro(row: Record<string, unknown>): Registro606 {
  return {
    id: row.id as string,
    idCliente: row.id_cliente as string,
    rncCedula: row.rnc_cedula as string,
    tipoID: row.tipo_id as TipoID,
    tipoBienServicio: row.tipo_bien_servicio as string,
    ncf: row.ncf as string,
    ncfModificado: row.ncf_modificado as string | undefined,
    fechaComprobante: row.fecha_comprobante as string,
    fechaPago: row.fecha_pago as string | undefined,
    montoServicios: Number(row.monto_servicios ?? 0),
    montoBienes: Number(row.monto_bienes ?? 0),
    totalFacturado: Number(row.total_facturado ?? 0),
    itbisFacturado: Number(row.itbis_facturado ?? 0),
    itbisRetenido: Number(row.itbis_retenido ?? 0),
    itbisProporcional: Number(row.itbis_proporcional ?? 0),
    itbisCosto: Number(row.itbis_costo ?? 0),
    itbisAdelantar: Number(row.itbis_adelantar ?? 0),
    itbisPercibido: 0,
    tipoRetencionISR: row.tipo_retencion_isr as string | undefined,
    montoRetencionISR: Number(row.monto_retencion_isr ?? 0),
    isrPercibido: 0,
    isc: Number(row.isc ?? 0),
    otrosImpuestos: Number(row.otros_impuestos ?? 0),
    propinaLegal: Number(row.propina_legal ?? 0),
    formaPago: row.forma_pago as string,
    conceptoPersonalizado: row.concepto_personalizado as string | undefined,
    estado: row.estado as EstadoRegistro,
    erroresValidacion: row.errores_validacion as string[] | undefined,
    fechaCreacion: new Date(row.fecha_creacion as string),
    fechaActualizacion: new Date(row.fecha_actualizacion as string),
    fechaValidacion: row.fecha_validacion ? new Date(row.fecha_validacion as string) : undefined,
    origenIngesta: row.origen_ingesta as OrigenIngesta | undefined,
    documentoFuenteURL: row.documento_fuente_url as string | undefined,
    esSegundoEnvio: Boolean(row.es_segundo_envio),
    idRegistroOriginal: row.id_registro_original as string | undefined,
  };
}

export interface FiltrosRegistro {
  periodo?: string;
  estado?: EstadoRegistro;
  pagina?: number;
  porPagina?: number;
}

export class Registro606Service {
  private supabase = createClient();

  async listar(idCliente: string, filtros: FiltrosRegistro = {}): Promise<{ datos: Registro606[]; total: number }> {
    const { periodo, estado, pagina = 1, porPagina = 50 } = filtros;

    let query = this.supabase
      .from('registros_606')
      .select('*', { count: 'exact' })
      .eq('id_cliente', idCliente)
      .order('fecha_creacion', { ascending: false });

    if (periodo) query = query.like('fecha_comprobante', `${periodo}%`);
    if (estado) query = query.eq('estado', estado);

    const inicio = (pagina - 1) * porPagina;
    query = query.range(inicio, inicio + porPagina - 1);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return {
      datos: (data ?? []).map(r => mapearRegistro(r as Record<string, unknown>)),
      total: count ?? 0,
    };
  }

  async obtener(id: string): Promise<Registro606 | null> {
    const { data, error } = await this.supabase
      .from('registros_606')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return mapearRegistro(data as Record<string, unknown>);
  }

  async crear(idCliente: string, dto: CreateRegistro606DTO): Promise<Registro606> {
    const { data, error } = await this.supabase
      .from('registros_606')
      .insert({
        id_cliente: idCliente,
        rnc_cedula: dto.rncCedula,
        tipo_id: dto.tipoID,
        tipo_bien_servicio: dto.tipoBienServicio,
        ncf: dto.ncf,
        ncf_modificado: dto.ncfModificado,
        fecha_comprobante: dto.fechaComprobante,
        fecha_pago: dto.fechaPago,
        monto_servicios: dto.montoServicios ?? 0,
        monto_bienes: dto.montoBienes ?? 0,
        itbis_facturado: dto.itbisFacturado ?? 0,
        itbis_retenido: dto.itbisRetenido ?? 0,
        itbis_proporcional: dto.itbisProporcional ?? 0,
        itbis_costo: dto.itbisCosto ?? 0,
        itbis_adelantar: dto.itbisAdelantar ?? 0,
        tipo_retencion_isr: dto.tipoRetencionISR,
        monto_retencion_isr: dto.montoRetencionISR ?? 0,
        isc: dto.isc ?? 0,
        otros_impuestos: dto.otrosImpuestos ?? 0,
        propina_legal: dto.propinaLegal ?? 0,
        forma_pago: dto.formaPago,
        concepto_personalizado: dto.conceptoPersonalizado,
        origen_ingesta: dto.origenIngesta,
        documento_fuente_url: dto.documentoFuenteURL,
        estado: EstadoRegistro.PENDIENTE,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapearRegistro(data as Record<string, unknown>);
  }

  async actualizar(id: string, dto: UpdateRegistro606DTO): Promise<Registro606> {
    const updates: Record<string, unknown> = {};
    if (dto.rncCedula) updates.rnc_cedula = dto.rncCedula;
    if (dto.tipoID) updates.tipo_id = dto.tipoID;
    if (dto.tipoBienServicio) updates.tipo_bien_servicio = dto.tipoBienServicio;
    if (dto.ncf) updates.ncf = dto.ncf;
    if (dto.ncfModificado !== undefined) updates.ncf_modificado = dto.ncfModificado;
    if (dto.fechaComprobante) updates.fecha_comprobante = dto.fechaComprobante;
    if (dto.fechaPago !== undefined) updates.fecha_pago = dto.fechaPago;
    if (dto.montoServicios !== undefined) updates.monto_servicios = dto.montoServicios;
    if (dto.montoBienes !== undefined) updates.monto_bienes = dto.montoBienes;
    if (dto.itbisFacturado !== undefined) updates.itbis_facturado = dto.itbisFacturado;
    if (dto.itbisRetenido !== undefined) updates.itbis_retenido = dto.itbisRetenido;
    if (dto.tipoRetencionISR !== undefined) updates.tipo_retencion_isr = dto.tipoRetencionISR;
    if (dto.montoRetencionISR !== undefined) updates.monto_retencion_isr = dto.montoRetencionISR;
    if (dto.formaPago) updates.forma_pago = dto.formaPago;
    if (dto.conceptoPersonalizado !== undefined) updates.concepto_personalizado = dto.conceptoPersonalizado;

    const { data, error } = await this.supabase
      .from('registros_606')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapearRegistro(data as Record<string, unknown>);
  }

  async eliminar(id: string): Promise<void> {
    const { error } = await this.supabase.from('registros_606').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async listarValidados(idCliente: string, periodo: string): Promise<Registro606[]> {
    const { data, error } = await this.supabase
      .from('registros_606')
      .select('*')
      .eq('id_cliente', idCliente)
      .eq('estado', EstadoRegistro.VALIDADO)
      .like('fecha_comprobante', `${periodo}%`);
    if (error) throw new Error(error.message);
    return (data ?? []).map(r => mapearRegistro(r as Record<string, unknown>));
  }
}

export const registro606Service = new Registro606Service();

// =========================================
// TIPOS Y INTERFACES: FORM 606 - DGII
// =========================================

export enum RegimenITBIS {
  EXENTO = 'EXENTO',
  GRAVADO_TOTAL = 'GRAVADO_TOTAL',
  PROPORCIONAL = 'PROPORCIONAL'
}

export enum EstadoRegistro {
  PENDIENTE = 'pendiente',
  VALIDADO = 'validado',
  RECHAZADO = 'rechazado',
  REPORTADO = 'reportado'
}

export enum TipoBienServicio {
  COMBUSTIBLES = '01',
  MATERIAS_PRIMAS = '02',
  REPUESTOS_ACCESORIOS = '03',
  EQUIPOS = '04',
  SERVICIOS = '05',
  ACTIVOS_FIJOS = '06',
  GASTOS_MENORES = '07',
  PAGOS_EXTERIOR = '08',
  TELECOMUNICACIONES = '09',
  ALQUILERES = '10',
  OTROS = '11'
}

export enum FormaPago {
  EFECTIVO = '01',
  CHEQUE_TRANSFERENCIA = '02',
  TARJETA_CREDITO = '03',
  CREDITO = '04',
  PERMUTA = '05',
  VENTA_PLAZO = '06',
  OTRO = '07'
}

export enum TipoRetencionISR {
  SERVICIOS_PROFESIONALES = '01',
  ALQUILERES = '02',
  SERVICIOS_TECNICOS = '03',
  TRANSPORTE = '04',
  OTROS_SERVICIOS = '05',
  TELECOMUNICACIONES = '06',
  CONSTRUCCION = '07',
  SERVICIOS_FINANCIEROS = '08',
  COMPRA_BIENES = '09'
}

export enum TipoID {
  RNC = 1,
  CEDULA = 2
}

export enum OrigenIngesta {
  OCR = 'OCR',
  QR_CODE = 'QR_CODE',
  MANUAL = 'MANUAL'
}

export enum TipoEventoAuditoria {
  CREACION = 'CREACION',
  VALIDACION_EXITOSA = 'VALIDACION_EXITOSA',
  VALIDACION_FALLIDA = 'VALIDACION_FALLIDA',
  MODIFICACION = 'MODIFICACION',
  EXPORTACION = 'EXPORTACION',
  SEGUNDO_ENVIO = 'SEGUNDO_ENVIO',
  RECHAZO_FISCAL = 'RECHAZO_FISCAL'
}

export interface Cliente {
  id: string;
  razonSocial: string;
  rncCedula: string;
  regimenITBIS: RegimenITBIS;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  activo: boolean;
}

export interface CreateClienteDTO {
  razonSocial: string;
  rncCedula: string;
  regimenITBIS: RegimenITBIS;
}

export interface UpdateClienteDTO {
  razonSocial?: string;
  regimenITBIS?: RegimenITBIS;
  activo?: boolean;
}

export interface ReglaCategorizacion {
  id: string;
  idCliente: string;
  rncProveedor: string;
  tipoBienServicioDefecto: string;
  formaPagoDefecto: string;
  tipoRetencionISRDefecto?: string;
  conceptoDefecto?: string;
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

export interface CreateReglaCategorizacionDTO {
  rncProveedor: string;
  tipoBienServicioDefecto: string;
  formaPagoDefecto: string;
  tipoRetencionISRDefecto?: string;
  conceptoDefecto?: string;
}

export interface Registro606 {
  id: string;
  idCliente: string;
  rncCedula: string;
  tipoID: TipoID;
  tipoBienServicio: string;
  ncf: string;
  ncfModificado?: string;
  fechaComprobante: string;
  fechaPago?: string;
  montoServicios: number;
  montoBienes: number;
  totalFacturado: number;
  itbisFacturado: number;
  itbisRetenido: number;
  itbisProporcional: number;
  itbisCosto: number;
  itbisAdelantar: number;
  itbisPercibido: number;
  tipoRetencionISR?: string;
  montoRetencionISR: number;
  isrPercibido: number;
  isc: number;
  otrosImpuestos: number;
  propinaLegal: number;
  formaPago: string;
  conceptoPersonalizado?: string;
  estado: EstadoRegistro;
  erroresValidacion?: string[];
  fechaCreacion: Date;
  fechaActualizacion: Date;
  fechaValidacion?: Date;
  origenIngesta?: OrigenIngesta;
  documentoFuenteURL?: string;
  esSegundoEnvio: boolean;
  idRegistroOriginal?: string;
}

export interface CreateRegistro606DTO {
  rncCedula: string;
  tipoID: TipoID;
  tipoBienServicio: string;
  ncf: string;
  fechaComprobante: string;
  montoServicios?: number;
  montoBienes?: number;
  itbisFacturado?: number;
  formaPago: string;
  ncfModificado?: string;
  fechaPago?: string;
  itbisRetenido?: number;
  itbisProporcional?: number;
  itbisCosto?: number;
  itbisAdelantar?: number;
  tipoRetencionISR?: string;
  montoRetencionISR?: number;
  isc?: number;
  otrosImpuestos?: number;
  propinaLegal?: number;
  conceptoPersonalizado?: string;
  origenIngesta?: OrigenIngesta;
  documentoFuenteURL?: string;
}

export interface UpdateRegistro606DTO {
  rncCedula?: string;
  tipoID?: TipoID;
  tipoBienServicio?: string;
  ncf?: string;
  fechaComprobante?: string;
  montoServicios?: number;
  montoBienes?: number;
  itbisFacturado?: number;
  formaPago?: string;
  ncfModificado?: string;
  fechaPago?: string;
  itbisRetenido?: number;
  tipoRetencionISR?: string;
  montoRetencionISR?: number;
  conceptoPersonalizado?: string;
}

export interface FacturaExtraidaDTO {
  rncProveedor: string;
  razonSocialProveedor: string;
  ncf: string;
  fecha: string;
  montoSubtotal?: number;
  montoServicios?: number;
  montoBienes?: number;
  porcentajeITBIS?: number;
  montoITBIS?: number;
  montoTotal?: number;
  confianzaOCR?: number;
  tiempoExtraccion?: number;
  origenIngesta: OrigenIngesta;
  urlDocumento?: string;
  tipoID?: TipoID;
  tipoBienServicio?: string;
  formaPago?: string;
}

export interface AuditoriaRegistro {
  id: string;
  idRegistro606: string;
  idCliente: string;
  tipoEvento: TipoEventoAuditoria;
  descripcion?: string;
  reglasAplicadas?: string[];
  erroresDetectados?: string[];
  usuarioID?: string;
  ipAddress?: string;
  userAgent?: string;
  fechaEvento: Date;
}

export interface Exportacion606 {
  id: string;
  idCliente: string;
  periodo: string;
  cantidadRegistros: number;
  sumaFacturado: number;
  sumaITBISAdelantar: number;
  sumaITBISCosto: number;
  sumaITBISRetenido: number;
  sumaISRRetenido: number;
  nombreArchivo: string;
  hashMD5?: string;
  urlDescarga?: string;
  enviadoDGII: boolean;
  fechaEnvioDGII?: Date;
  confirmacionDGII?: string;
  fechaCreacion: Date;
  usuarioID?: string;
}

export interface ResultadoValidacion {
  esValido: boolean;
  errores: ErrorValidacion[];
  advertencias: AdvertenciaValidacion[];
  reglasAplicadas: string[];
}

export interface ErrorValidacion {
  campo: string;
  codigo: string;
  mensaje: string;
  severidad: 'BLOQUEANTE' | 'CRITICO' | 'ADVERTENCIA';
}

export interface AdvertenciaValidacion {
  campo: string;
  mensaje: string;
  sugerencia?: string;
}

export interface ContextoValidacionFiscal {
  cliente: Cliente;
  registroID?: string;
  esSegundoEnvio?: boolean;
  registroOriginal?: Registro606;
}

export interface ResultadoExportacion {
  exito: boolean;
  periodo: string;
  cantidadRegistros: number;
  contenidoTXT?: string;
  hashMD5?: string;
  mensajeError?: string;
  detallesValidacion?: {
    totalFacturado: number;
    totalITBIS: number;
    totalISR: number;
  };
}

export interface APIResponse<T> {
  exito: boolean;
  datos?: T;
  error?: string;
  codigoError?: string;
  timestamp: Date;
}

export interface PaginatedResponse<T> {
  exito: boolean;
  datos: T[];
  paginaActual: number;
  totalPaginas: number;
  totalRegistros: number;
  porPagina: number;
}

export const LONGITUD_NCF = {
  FISICO: 11,
  ELECTRONICO: 13
};

export const CODIGOS_NCFBLOQUEADOS = {
  CONSUMIDOR_FINAL: ['B02', 'E32'],
  NOTAS_CREDITO: ['B04', 'E34'],
  NOTAS_DEBITO: ['B03', 'E33']
};

export const CODIGOS_NCF_ESPECIALES = {
  PROVEEDOR_INFORMAL: ['B11', 'E41'],
  GASTOS_MENORES: ['B13', 'E43'],
  PAGOS_EXTERIOR: ['B17', 'E47']
};

export const PORCENTAJES_RETENCION_ISR: Record<string, number> = {
  '01': 0.10,
  '02': 0.10,
  '03': 0.02,
  '04': 0.02,
  '05': 0.02,
  '06': 0.02,
  '07': 0.02,
  '08': 0.01,
  '09': 0.00
};

export const ETIQUETAS_FORMA_PAGO: Record<string, string> = {
  '01': 'Efectivo',
  '02': 'Cheque / Transferencia',
  '03': 'Tarjeta de Crédito',
  '04': 'Crédito',
  '05': 'Permuta',
  '06': 'Venta a Plazo',
  '07': 'Otro'
};

export const ETIQUETAS_TIPO_BIEN_SERVICIO: Record<string, string> = {
  '01': 'Combustibles y Lubricantes',
  '02': 'Materias Primas',
  '03': 'Repuestos y Accesorios',
  '04': 'Equipos',
  '05': 'Servicios',
  '06': 'Activos Fijos',
  '07': 'Gastos Menores',
  '08': 'Pagos al Exterior',
  '09': 'Telecomunicaciones',
  '10': 'Alquileres',
  '11': 'Otros'
};

export const PORCENTAJE_ITBIS_ESTANDAR = 0.18;
export const PORCENTAJE_ISC_TIPICO = 0.08;
export const RETENCION_ISR_PAGOS_EXTERIOR = 0.27;

export interface ResumenMensual {
  periodo: string;
  totalFacturado: number;
  cantidadCompras: number;
  totalITBIS: number;
  totalISR: number;
  detalleRegimenes: {
    exento: { monto: number; itbisCosto: number };
    gravado: { monto: number; itbisAdelantar: number };
    proporcional: { monto: number; itbisProporcional: number };
  };
}

export interface AnalisisProveedor {
  rncProveedor: string;
  razonSocial?: string;
  cantidadCompras: number;
  montoTotalCompras: number;
  ultimaCompra: string;
  tiposBienServicio: string[];
  formasPago: string[];
  tieneRetenciones: boolean;
}

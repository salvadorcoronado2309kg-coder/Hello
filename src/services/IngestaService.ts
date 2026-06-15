// =========================================
// SERVICIO DE INGESTA HÍBRIDA Y LÓGICA FISCAL
// =========================================

import {
  Registro606,
  CreateRegistro606DTO,
  Cliente,
  RegimenITBIS,
  TipoID,
  FacturaExtraidaDTO,
  ResultadoValidacion,
  ErrorValidacion,
  AdvertenciaValidacion,
  ContextoValidacionFiscal,
  CODIGOS_NCFBLOQUEADOS,
  CODIGOS_NCF_ESPECIALES,
  PORCENTAJES_RETENCION_ISR,
  PORCENTAJE_ITBIS_ESTANDAR,
  TipoEventoAuditoria,
  AuditoriaRegistro,
  ReglaCategorizacion
} from '@/types';

export class ErrorFiscalDGII extends Error {
  constructor(
    public codigo: string,
    public mensaje: string,
    public severidad: 'BLOQUEANTE' | 'CRITICO' | 'ADVERTENCIA' = 'BLOQUEANTE'
  ) {
    super(mensaje);
    this.name = 'ErrorFiscalDGII';
  }
}

export class IngestaService {
  async procesarFacturaExtraida(
    facturaExtraida: FacturaExtraidaDTO,
    cliente: Cliente,
    reglasCliente: ReglaCategorizacion[]
  ): Promise<CreateRegistro606DTO> {
    const rncNormalizado = this.normalizarRNC(facturaExtraida.rncProveedor);
    const ncfNormalizado = this.normalizarNCF(facturaExtraida.ncf);
    const fechaNormalizada = this.normalizarFecha(facturaExtraida.fecha);
    const tipoID = this.inferirTipoID(rncNormalizado);
    const reglaProveedor = reglasCliente.find(r => r.rncProveedor === rncNormalizado);

    const { montoServicios, montoBienes } = this.bifurcarMontos(
      facturaExtraida.montoSubtotal,
      facturaExtraida.montoServicios,
      facturaExtraida.montoBienes,
      reglaProveedor?.tipoBienServicioDefecto || '05'
    );

    const itbisFacturado = facturaExtraida.montoITBIS ||
      (montoServicios + montoBienes) * PORCENTAJE_ITBIS_ESTANDAR;

    const dto: CreateRegistro606DTO = {
      rncCedula: rncNormalizado,
      tipoID,
      tipoBienServicio: reglaProveedor?.tipoBienServicioDefecto || '05',
      ncf: ncfNormalizado,
      fechaComprobante: fechaNormalizada,
      montoServicios,
      montoBienes,
      itbisFacturado,
      formaPago: reglaProveedor?.formaPagoDefecto || '02',
      origenIngesta: facturaExtraida.origenIngesta,
      documentoFuenteURL: facturaExtraida.urlDocumento,
      conceptoPersonalizado: `${facturaExtraida.razonSocialProveedor} - Confianza OCR: ${(facturaExtraida.confianzaOCR || 1) * 100}%`
    };

    return dto;
  }

  async validarRegistroFiscal(
    registro: CreateRegistro606DTO | Registro606,
    contexto: ContextoValidacionFiscal
  ): Promise<ResultadoValidacion> {
    const errores: ErrorValidacion[] = [];
    const advertencias: AdvertenciaValidacion[] = [];
    const reglasAplicadas: string[] = [];

    const cliente = contexto.cliente;
    const ncf = registro.ncf;

    this.validarBloqueoConsumidorFinal(ncf, errores, reglasAplicadas);
    this.validarBifurcacionITBIS(registro, cliente, advertencias, reglasAplicadas);
    this.validarComprobantesEspeciales(
      registro,
      cliente,
      contexto.esSegundoEnvio || false,
      errores,
      advertencias,
      reglasAplicadas
    );
    this.validarEstructura(registro, errores, reglasAplicadas);
    this.validarAritmetica(registro, advertencias, reglasAplicadas);
    this.validarFormatos(registro, errores, reglasAplicadas);
    this.validarMontos(registro, advertencias, reglasAplicadas);

    return {
      esValido: errores.length === 0,
      errores,
      advertencias,
      reglasAplicadas
    };
  }

  private validarBloqueoConsumidorFinal(
    ncf: string,
    errores: ErrorValidacion[],
    reglasAplicadas: string[]
  ): void {
    const inicioNCF = ncf.substring(0, 3);
    if (CODIGOS_NCFBLOQUEADOS.CONSUMIDOR_FINAL.includes(inicioNCF)) {
      reglasAplicadas.push('REGLA_A_BLOQUEO_CONSUMIDOR_FINAL');
      errores.push({
        campo: 'ncf',
        codigo: 'ERR_B02_E32_BLOQUEADO',
        mensaje: 'Las facturas de consumidor final (B02/E32) no son admisibles en el Formato 606 de compras. Solicite anulación y sustitución por Crédito Fiscal (B01/E31).',
        severidad: 'BLOQUEANTE'
      });
    }
  }

  private validarBifurcacionITBIS(
    registro: CreateRegistro606DTO | Registro606,
    cliente: Cliente,
    advertencias: AdvertenciaValidacion[],
    reglasAplicadas: string[]
  ): void {
    reglasAplicadas.push('REGLA_B_BIFURCACION_ITBIS');

    switch (cliente.regimenITBIS) {
      case RegimenITBIS.EXENTO:
        if ('itbisAdelantar' in registro && (registro.itbisAdelantar ?? 0) > 0) {
          advertencias.push({
            campo: 'itbisAdelantar',
            mensaje: 'Cliente con régimen EXENTO: El campo itbisAdelantar debe ser 0.00. ITBIS será asignado a itbisCosto (Casilla 14) para deducción en ISR.',
            sugerencia: 'Migre el ITBIS a itbisCosto'
          });
        }
        break;

      case RegimenITBIS.GRAVADO_TOTAL:
        if ('itbisCosto' in registro && (registro.itbisCosto ?? 0) > 0) {
          advertencias.push({
            campo: 'itbisCosto',
            mensaje: 'Cliente con régimen GRAVADO_TOTAL: El campo itbisCosto debe ser 0.00. ITBIS será asignado a itbisAdelantar (Casilla 15) como crédito IT-1.',
            sugerencia: 'Migre el ITBIS a itbisAdelantar'
          });
        }
        break;

      case RegimenITBIS.PROPORCIONAL:
        if ('itbisCosto' in registro && (registro.itbisCosto ?? 0) > 0) {
          advertencias.push({
            campo: 'itbisCosto',
            mensaje: 'Cliente con régimen PROPORCIONAL: ITBIS asignado a itbisProporcional (Casilla 13). Coeficiente mensual se aplicará en IT-1.'
          });
        }
        break;
    }
  }

  private validarComprobantesEspeciales(
    registro: CreateRegistro606DTO | Registro606,
    cliente: Cliente,
    esSegundoEnvio: boolean,
    errores: ErrorValidacion[],
    advertencias: AdvertenciaValidacion[],
    reglasAplicadas: string[]
  ): void {
    const ncf = registro.ncf || '';
    const inicioNCF = ncf.substring(0, 3);

    if (CODIGOS_NCF_ESPECIALES.PROVEEDOR_INFORMAL.includes(inicioNCF)) {
      reglasAplicadas.push('REGLA_C1_PROVEEDOR_INFORMAL');
      const rncProveedor = registro.rncCedula || '';
      if (rncProveedor.length !== 11) {
        errores.push({
          campo: 'rncCedula',
          codigo: 'ERR_B11_E41_CEDULA_REQUERIDA',
          mensaje: 'Comprobante B11/E41 (Proveedor Informal): rncCedula DEBE tener 11 caracteres (Cédula del proveedor informal).',
          severidad: 'BLOQUEANTE'
        });
      }
      if ('tipoID' in registro && registro.tipoID !== TipoID.CEDULA) {
        errores.push({
          campo: 'tipoID',
          codigo: 'ERR_B11_E41_TIPO_ID',
          mensaje: 'Comprobante B11/E41: tipoID debe ser 2 (Cédula), no 1 (RNC).',
          severidad: 'BLOQUEANTE'
        });
      }
      const itbisFacturado = registro.itbisFacturado || 0;
      if ('itbisRetenido' in registro && itbisFacturado > 0 && registro.itbisRetenido !== itbisFacturado) {
        advertencias.push({
          campo: 'itbisRetenido',
          mensaje: 'Proveedor Informal (B11/E41): ITBIS retenido automáticamente al 100% del ITBIS facturado.',
          sugerencia: `Establezca itbisRetenido = ${itbisFacturado} (igual a ITBIS facturado)`
        });
      }
      this.validarRetencionISRProveedor(registro, reglasAplicadas);
    }

    if (CODIGOS_NCF_ESPECIALES.GASTOS_MENORES.includes(inicioNCF)) {
      reglasAplicadas.push('REGLA_C2_GASTOS_MENORES');
      const rncCedula = registro.rncCedula || '';
      if (rncCedula !== cliente.rncCedula) {
        errores.push({
          campo: 'rncCedula',
          codigo: 'ERR_B13_E43_RNC_CLIENTE',
          mensaje: `Comprobante B13/E43 (Gastos Menores): rncCedula DEBE ser el RNC del cliente remitente (${cliente.rncCedula}).`,
          severidad: 'BLOQUEANTE'
        });
      }
      if ('itbisFacturado' in registro && registro.itbisFacturado !== 0) {
        advertencias.push({ campo: 'itbisFacturado', mensaje: 'Gastos Menores (B13/E43): ITBIS facturado debe ser 0.00', sugerencia: 'Establezca itbisFacturado = 0.00' });
      }
      if ('itbisRetenido' in registro && registro.itbisRetenido !== 0) {
        advertencias.push({ campo: 'itbisRetenido', mensaje: 'Gastos Menores (B13/E43): ITBIS retenido debe ser 0.00' });
      }
      if ('montoRetencionISR' in registro && registro.montoRetencionISR !== 0) {
        advertencias.push({ campo: 'montoRetencionISR', mensaje: 'Gastos Menores (B13/E43): Retención ISR debe ser 0.00' });
      }
    }

    if (CODIGOS_NCF_ESPECIALES.PAGOS_EXTERIOR.includes(inicioNCF)) {
      reglasAplicadas.push('REGLA_C3_PAGOS_EXTERIOR');
      const rncCedula = registro.rncCedula || '';
      if (rncCedula !== cliente.rncCedula) {
        errores.push({
          campo: 'rncCedula',
          codigo: 'ERR_B17_E47_RNC_CLIENTE',
          mensaje: `Pagos al Exterior (B17/E47): rncCedula DEBE ser el RNC del cliente (${cliente.rncCedula}).`,
          severidad: 'BLOQUEANTE'
        });
      }
      const casillasVacias = [
        { campo: 'itbisRetenido', valor: ('itbisRetenido' in registro ? registro.itbisRetenido : 0) },
        { campo: 'itbisProporcional', valor: ('itbisProporcional' in registro ? registro.itbisProporcional : 0) },
        { campo: 'itbisCosto', valor: ('itbisCosto' in registro ? registro.itbisCosto : 0) },
        { campo: 'isc', valor: ('isc' in registro ? registro.isc : 0) },
        { campo: 'otrosImpuestos', valor: ('otrosImpuestos' in registro ? registro.otrosImpuestos : 0) },
        { campo: 'propinaLegal', valor: ('propinaLegal' in registro ? registro.propinaLegal : 0) }
      ];
      casillasVacias.forEach(({ campo, valor }) => {
        if ((valor ?? 0) !== 0) {
          advertencias.push({ campo, mensaje: `Pagos al Exterior (B17/E47): Campo ${campo} debe estar en 0.00`, sugerencia: `Establezca ${campo} = 0.00` });
        }
      });
      advertencias.push({ campo: 'montoRetencionISR', mensaje: 'Retención ISR 27% (Pagos al Exterior) se omite en Formato 606. Se liquida directamente en Formato 609 e IR-17.' });
    }

    if (CODIGOS_NCFBLOQUEADOS.NOTAS_CREDITO.includes(inicioNCF) || CODIGOS_NCFBLOQUEADOS.NOTAS_DEBITO.includes(inicioNCF)) {
      reglasAplicadas.push('REGLA_C4_NOTAS_CREDITO_DEBITO');
      const ncfModificado = registro.ncfModificado;
      if (!ncfModificado) {
        errores.push({
          campo: 'ncfModificado',
          codigo: 'ERR_NOTA_CREDITO_NCF_MODIFICADO',
          mensaje: `Nota de Crédito/Débito (${inicioNCF}): Campo ncfModificado (Casilla 5) es OBLIGATORIO.`,
          severidad: 'BLOQUEANTE'
        });
      } else if (![11, 13].includes(ncfModificado.length)) {
        errores.push({
          campo: 'ncfModificado',
          codigo: 'ERR_NOTA_CREDITO_NCF_FORMAT',
          mensaje: 'ncfModificado debe tener 11 (físico) o 13 (electrónico) caracteres.',
          severidad: 'CRITICO'
        });
      }
    }
  }

  private validarRetencionISRProveedor(
    registro: CreateRegistro606DTO | Registro606,
    reglasAplicadas: string[]
  ): void {
    if (!registro.tipoRetencionISR) return;
    const tipoISR = registro.tipoRetencionISR;
    const montoFacturado = (registro.montoServicios || 0) + (registro.montoBienes || 0);
    const porcentajeISR = PORCENTAJES_RETENCION_ISR[tipoISR] || 0;
    reglasAplicadas.push(`REGLA_C1_RETENCION_ISR_${tipoISR}_${(porcentajeISR * 100).toFixed(0)}PCT`);
    void montoFacturado;
  }

  private validarEstructura(
    registro: CreateRegistro606DTO | Registro606,
    errores: ErrorValidacion[],
    reglasAplicadas: string[]
  ): void {
    reglasAplicadas.push('VALIDACION_ESTRUCTURA');
    const camposObligatorios = ['rncCedula', 'tipoID', 'tipoBienServicio', 'ncf', 'fechaComprobante', 'formaPago'] as const;
    camposObligatorios.forEach(campo => {
      const valor = registro[campo as keyof typeof registro];
      if (valor === undefined || valor === null || valor === '') {
        errores.push({
          campo,
          codigo: `ERR_CAMPO_OBLIGATORIO_${campo}`,
          mensaje: `Campo obligatorio: ${campo}`,
          severidad: 'BLOQUEANTE'
        });
      }
    });
  }

  private validarFormatos(
    registro: CreateRegistro606DTO | Registro606,
    errores: ErrorValidacion[],
    reglasAplicadas: string[]
  ): void {
    reglasAplicadas.push('VALIDACION_FORMATOS');
    const ncf = registro.ncf || '';
    if (![11, 13].includes(ncf.length)) {
      errores.push({ campo: 'ncf', codigo: 'ERR_NCF_LONGITUD', mensaje: `NCF debe tener 11 o 13 caracteres. Se encontraron ${ncf.length}.`, severidad: 'BLOQUEANTE' });
    }
    const rncCedula = registro.rncCedula || '';
    if (![9, 11].includes(rncCedula.length)) {
      errores.push({ campo: 'rncCedula', codigo: 'ERR_RNC_CEDULA_LONGITUD', mensaje: `RNC/Cédula debe tener 9 o 11 caracteres. Se encontraron ${rncCedula.length}.`, severidad: 'BLOQUEANTE' });
    }
    const fechaComprobante = registro.fechaComprobante || '';
    if (!/^\d{8}$/.test(fechaComprobante)) {
      errores.push({ campo: 'fechaComprobante', codigo: 'ERR_FECHA_COMPROBANTE_FORMAT', mensaje: 'Fecha comprobante debe estar en formato AAAAMMDD.', severidad: 'BLOQUEANTE' });
    }
    if (registro.fechaPago && !/^\d{8}$/.test(registro.fechaPago)) {
      errores.push({ campo: 'fechaPago', codigo: 'ERR_FECHA_PAGO_FORMAT', mensaje: 'Fecha pago debe estar en formato AAAAMMDD o estar vacía.', severidad: 'CRITICO' });
    }
  }

  private validarAritmetica(
    registro: CreateRegistro606DTO | Registro606,
    advertencias: AdvertenciaValidacion[],
    reglasAplicadas: string[]
  ): void {
    reglasAplicadas.push('VALIDACION_ARITMETICA');
    const montoServicios = registro.montoServicios || 0;
    const montoBienes = registro.montoBienes || 0;
    const totalEsperado = montoServicios + montoBienes;
    if ('totalFacturado' in registro && (registro as Registro606).totalFacturado > 0) {
      const total = (registro as Registro606).totalFacturado;
      if (Math.abs(total - totalEsperado) > 0.01) {
        advertencias.push({ campo: 'totalFacturado', mensaje: `Total facturado (${total}) debe igualar monto servicios (${montoServicios}) + monto bienes (${montoBienes}) = ${totalEsperado}` });
      }
    }
  }

  private validarMontos(
    registro: CreateRegistro606DTO | Registro606,
    advertencias: AdvertenciaValidacion[],
    reglasAplicadas: string[]
  ): void {
    reglasAplicadas.push('VALIDACION_MONTOS_SEMAFORO');
    const totalFacturado = 'totalFacturado' in registro
      ? (registro as Registro606).totalFacturado
      : (registro.montoServicios || 0) + (registro.montoBienes || 0);
    const itbisFacturado = registro.itbisFacturado || 0;
    if (totalFacturado > 0 && itbisFacturado > 0) {
      const porcentajeITBIS = itbisFacturado / totalFacturado;
      if (porcentajeITBIS > PORCENTAJE_ITBIS_ESTANDAR) {
        advertencias.push({
          campo: 'itbisFacturado',
          mensaje: `ITBIS (${(porcentajeITBIS * 100).toFixed(2)}%) excede el 18% estándar. Revisar cálculo del proveedor.`,
          sugerencia: 'Validar el NCF con el DGII si la tasa es superior a 18%'
        });
      }
    }
  }

  private normalizarRNC(rnc: string): string {
    if (!rnc) return '';
    return rnc.trim().replace(/[^0-9]/g, '');
  }

  private normalizarNCF(ncf: string): string {
    if (!ncf) return '';
    return ncf.trim().toUpperCase();
  }

  private normalizarFecha(fecha: string): string {
    if (!fecha) return '';
    if (/^\d{8}$/.test(fecha)) return fecha;
    const date = new Date(fecha);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    }
    return fecha.replace(/[^0-9]/g, '').slice(0, 8);
  }

  private inferirTipoID(rnc: string): TipoID {
    return rnc.length === 9 ? TipoID.RNC : TipoID.CEDULA;
  }

  private bifurcarMontos(
    subtotal: number | undefined,
    montoServicios: number | undefined,
    montoBienes: number | undefined,
    tipoBienServicioDefecto: string
  ): { montoServicios: number; montoBienes: number } {
    if ((montoServicios || 0) > 0 || (montoBienes || 0) > 0) {
      return { montoServicios: montoServicios || 0, montoBienes: montoBienes || 0 };
    }
    const total = subtotal || 0;
    if (total === 0) return { montoServicios: 0, montoBienes: 0 };
    const esServicio = ['05', '09', '10'].includes(tipoBienServicioDefecto);
    return esServicio ? { montoServicios: total, montoBienes: 0 } : { montoServicios: 0, montoBienes: total };
  }

  async procesarSegundoEnvio(
    registroOriginal: Registro606,
    actualizaciones: Partial<CreateRegistro606DTO>
  ): Promise<CreateRegistro606DTO> {
    if (registroOriginal.formaPago !== '04') {
      throw new ErrorFiscalDGII('ERR_SEGUNDO_ENVIO_NO_CREDITO', 'El "Segundo Envío" solo aplica a compras con Forma de Pago "04" (Crédito).', 'BLOQUEANTE');
    }
    return {
      rncCedula: registroOriginal.rncCedula,
      tipoID: registroOriginal.tipoID,
      tipoBienServicio: registroOriginal.tipoBienServicio,
      ncf: registroOriginal.ncf,
      fechaComprobante: registroOriginal.fechaComprobante,
      montoServicios: registroOriginal.montoServicios,
      montoBienes: registroOriginal.montoBienes,
      itbisFacturado: registroOriginal.itbisFacturado,
      formaPago: actualizaciones.formaPago || '02',
      fechaPago: actualizaciones.fechaPago,
      ncfModificado: registroOriginal.ncfModificado,
      tipoRetencionISR: actualizaciones.tipoRetencionISR,
      montoRetencionISR: actualizaciones.montoRetencionISR || 0,
      itbisRetenido: actualizaciones.itbisRetenido || 0,
      conceptoPersonalizado: `[SEGUNDO ENVÍO] ${registroOriginal.conceptoPersonalizado || ''}`
    };
  }

  crearEventoAuditoria(
    idRegistro: string,
    idCliente: string,
    tipoEvento: TipoEventoAuditoria,
    descripcion: string,
    reglasAplicadas?: string[],
    erroresDetectados?: string[]
  ): AuditoriaRegistro {
    return {
      id: crypto.randomUUID(),
      idRegistro606: idRegistro,
      idCliente,
      tipoEvento,
      descripcion,
      reglasAplicadas,
      erroresDetectados,
      usuarioID: undefined,
      ipAddress: undefined,
      userAgent: undefined,
      fechaEvento: new Date()
    };
  }
}

export const ingestaService = new IngestaService();

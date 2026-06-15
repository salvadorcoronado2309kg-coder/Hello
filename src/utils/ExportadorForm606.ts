// =========================================
// MÓDULO EXPORTACIÓN COMPLIANCE DGII
// =========================================

import {
  Registro606,
  Cliente,
  EstadoRegistro,
  Exportacion606,
  ResultadoExportacion
} from '@/types';

export class ExportadorForm606 {
  private readonly DELIMITADOR = '|';
  private readonly CAMPOS_MONTOS_DECIMALES = 2;

  async generarArchivoTXT(
    registros: Registro606[],
    cliente: Cliente,
    periodo: string
  ): Promise<ResultadoExportacion> {
    try {
      if (!/^\d{6}$/.test(periodo)) {
        throw new Error('Período debe estar en formato AAAAMMM (ej: 202401)');
      }
      const registrosValidos = registros.filter(r => r.estado === EstadoRegistro.VALIDADO);
      if (registrosValidos.length === 0) {
        throw new Error('No hay registros validados para exportar');
      }
      const contenidoTXT = this.generarContenidoTXT(registrosValidos, cliente, periodo);
      const detallesValidacion = this.calcularValidaciones(registrosValidos);
      const hashMD5 = await this.generarHashMD5(contenidoTXT);

      return {
        exito: true,
        periodo,
        cantidadRegistros: registrosValidos.length,
        contenidoTXT,
        hashMD5,
        detallesValidacion
      };
    } catch (error) {
      return {
        exito: false,
        periodo,
        cantidadRegistros: 0,
        mensajeError: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  private generarContenidoTXT(registros: Registro606[], cliente: Cliente, periodo: string): string {
    const lineas: string[] = [];
    lineas.push(this.generarCabecera(cliente, periodo, registros.length));
    registros.forEach(registro => lineas.push(this.generarLineaRegistro(registro)));
    return lineas.join('\n');
  }

  private generarCabecera(cliente: Cliente, periodo: string, cantidad: number): string {
    return ['1', cliente.rncCedula, periodo, cantidad.toString()].join(this.DELIMITADOR);
  }

  private generarLineaRegistro(registro: Registro606): string {
    const campos: string[] = [];
    campos.push(this.formatearCampo(registro.rncCedula));
    campos.push(this.formatearCampo(registro.tipoID.toString()));
    campos.push(this.formatearCampo(registro.tipoBienServicio));
    campos.push(this.formatearCampo(registro.ncf));
    campos.push(this.formatearCampo(registro.ncfModificado || ''));
    campos.push(this.formatearCampo(registro.fechaComprobante));
    campos.push(this.formatearCampo(registro.fechaPago || ''));
    campos.push(this.formatearMoneda(registro.montoServicios));
    campos.push(this.formatearMoneda(registro.montoBienes));
    campos.push(this.formatearMoneda(registro.montoServicios + registro.montoBienes));
    campos.push(this.formatearMoneda(registro.itbisFacturado));
    campos.push(this.formatearMoneda(registro.itbisRetenido));
    campos.push(this.formatearMoneda(registro.itbisProporcional));
    campos.push(this.formatearMoneda(registro.itbisCosto));
    campos.push(this.formatearMoneda(registro.itbisAdelantar));
    campos.push(this.formatearMoneda(0.00));
    campos.push(this.formatearCampo(registro.tipoRetencionISR || ''));
    campos.push(this.formatearMoneda(registro.montoRetencionISR));
    campos.push(this.formatearMoneda(0.00));
    campos.push(this.formatearMoneda(registro.isc));
    campos.push(this.formatearMoneda(registro.otrosImpuestos));
    campos.push(this.formatearMoneda(registro.propinaLegal));
    campos.push(this.formatearCampo(registro.formaPago));
    return campos.join(this.DELIMITADOR);
  }

  private formatearCampo(valor: string | number | undefined): string {
    if (!valor && valor !== 0) return '';
    return valor.toString().trim().replace(/\|/g, '').replace(/\n/g, '').replace(/\r/g, '');
  }

  private formatearMoneda(valor: number | undefined): string {
    if (valor === undefined || valor === null) return '0.00';
    return (Math.round(valor * 100) / 100).toFixed(this.CAMPOS_MONTOS_DECIMALES);
  }

  private calcularValidaciones(registros: Registro606[]) {
    return {
      totalFacturado: registros.reduce((sum, r) => sum + r.montoServicios + r.montoBienes, 0),
      totalITBIS: registros.reduce((sum, r) => sum + r.itbisAdelantar + r.itbisCosto + r.itbisRetenido, 0),
      totalISR: registros.reduce((sum, r) => sum + r.montoRetencionISR, 0)
    };
  }

  private async generarHashMD5(contenido: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(contenido);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return '';
    }
  }

  private generarNombreArchivo(cliente: Cliente, periodo: string): string {
    const timestamp = new Date().toISOString().replace(/[:\-]/g, '').slice(0, 14);
    return `${cliente.rncCedula}_${periodo}_${timestamp}.TXT`;
  }

  descargarArchivo(contenido: string, nombreArchivo: string): void {
    try {
      const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', nombreArchivo);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando archivo:', error);
    }
  }

  validarContenido(contenido: string, periodo: string, cantidadEsperada: number): { esValido: boolean; errores: string[] } {
    const errores: string[] = [];
    const lineas = contenido.split('\n').filter(l => l.trim());
    if (lineas.length < 2) errores.push('Debe haber al menos una cabecera y un registro');
    const cabecera = lineas[0]?.split(this.DELIMITADOR);
    if (cabecera?.[0] !== '1') errores.push('Primera línea debe iniciar con "1" (cabecera)');
    if (cabecera?.[2] !== periodo) errores.push(`Período en cabecera (${cabecera?.[2]}) no coincide con período esperado (${periodo})`);
    const cantidadArchivo = parseInt(cabecera?.[3] || '0', 10);
    if (cantidadArchivo !== cantidadEsperada) errores.push(`Cantidad de registros en cabecera (${cantidadArchivo}) no coincide con registros validados (${cantidadEsperada})`);
    const registrosConErrores: number[] = [];
    for (let i = 1; i < lineas.length; i++) {
      if (lineas[i].split(this.DELIMITADOR).length !== 23) registrosConErrores.push(i);
    }
    if (registrosConErrores.length > 0) errores.push(`Registros con estructura incorrecta (${registrosConErrores.length}): ${registrosConErrores.slice(0, 5).join(', ')}`);
    return { esValido: errores.length === 0, errores };
  }

  generarReporteAuditoria(registros: Registro606[], cliente: Cliente, periodo: string, exportacion: Exportacion606): string {
    const lineas: string[] = [];
    lineas.push('='.repeat(80));
    lineas.push('REPORTE DE AUDITORÍA - EXPORTACIÓN FORM 606');
    lineas.push('='.repeat(80));
    lineas.push('');
    lineas.push(`Cliente: ${cliente.razonSocial}`);
    lineas.push(`RNC: ${cliente.rncCedula}`);
    lineas.push(`Período: ${periodo}`);
    lineas.push(`Régimen ITBIS: ${cliente.regimenITBIS}`);
    lineas.push(`Fecha Exportación: ${new Date().toLocaleString('es-DO')}`);
    lineas.push('');
    lineas.push('-'.repeat(80));
    lineas.push('RESUMEN DE REGISTROS');
    lineas.push('-'.repeat(80));
    lineas.push(`Total de registros exportados: ${registros.length}`);
    lineas.push('');
    const validaciones = this.calcularValidaciones(registros);
    lineas.push('-'.repeat(80));
    lineas.push('VALIDACIONES FINANCIERAS');
    lineas.push('-'.repeat(80));
    lineas.push(`Total Facturado: RD$ ${validaciones.totalFacturado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`);
    lineas.push(`Total ITBIS: RD$ ${validaciones.totalITBIS.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`);
    lineas.push(`Total Retención ISR: RD$ ${validaciones.totalISR.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`);
    lineas.push('');
    lineas.push('-'.repeat(80));
    lineas.push('INTEGRIDAD DEL ARCHIVO');
    lineas.push('-'.repeat(80));
    lineas.push(`Hash: ${exportacion.hashMD5 || 'N/A'}`);
    lineas.push(`Nombre Archivo: ${exportacion.nombreArchivo}`);
    lineas.push('');
    lineas.push('='.repeat(80));
    return lineas.join('\n');
  }
}

export async function exportarATXT(registros: Registro606[], cliente: Cliente, periodo: string): Promise<ResultadoExportacion> {
  const exportador = new ExportadorForm606();
  return exportador.generarArchivoTXT(registros, cliente, periodo);
}

export function descargarExportacion(resultado: ResultadoExportacion): void {
  if (!resultado.exito || !resultado.contenidoTXT) {
    alert('No hay contenido para descargar');
    return;
  }
  const exportador = new ExportadorForm606();
  exportador.descargarArchivo(resultado.contenidoTXT, `form606_${resultado.periodo}.txt`);
}

export default ExportadorForm606;

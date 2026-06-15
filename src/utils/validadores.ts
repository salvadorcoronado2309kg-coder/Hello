// Validadores reutilizables para campos fiscales DGII

export function validarRNC(rnc: string): { valido: boolean; mensaje?: string } {
  const limpio = rnc.replace(/[^0-9]/g, '');
  if (limpio.length === 9) return { valido: true };
  if (limpio.length === 11) return { valido: true };
  return { valido: false, mensaje: `RNC/Cédula debe tener 9 o 11 dígitos (tiene ${limpio.length})` };
}

export function validarNCF(ncf: string): { valido: boolean; mensaje?: string } {
  if (!ncf) return { valido: false, mensaje: 'NCF es requerido' };
  const limpio = ncf.trim().toUpperCase();
  if (limpio.length === 11 || limpio.length === 13) return { valido: true };
  return { valido: false, mensaje: `NCF debe tener 11 (físico) o 13 (e-CF) caracteres (tiene ${limpio.length})` };
}

export function validarFechaDGII(fecha: string): { valido: boolean; mensaje?: string } {
  if (!fecha) return { valido: false, mensaje: 'Fecha es requerida' };
  if (!/^\d{8}$/.test(fecha)) return { valido: false, mensaje: 'Formato debe ser AAAAMMDD' };
  const year = parseInt(fecha.slice(0, 4));
  const month = parseInt(fecha.slice(4, 6));
  const day = parseInt(fecha.slice(6, 8));
  if (month < 1 || month > 12) return { valido: false, mensaje: 'Mes inválido' };
  if (day < 1 || day > 31) return { valido: false, mensaje: 'Día inválido' };
  if (year < 2000 || year > 2100) return { valido: false, mensaje: 'Año fuera de rango (2000-2100)' };
  return { valido: true };
}

export function validarPeriodo(periodo: string): { valido: boolean; mensaje?: string } {
  if (!/^\d{6}$/.test(periodo)) return { valido: false, mensaje: 'Período debe ser AAAAMM (ej: 202601)' };
  const month = parseInt(periodo.slice(4, 6));
  if (month < 1 || month > 12) return { valido: false, mensaje: 'Mes inválido' };
  return { valido: true };
}

export function validarMonto(valor: number | undefined, campo = 'Monto'): { valido: boolean; mensaje?: string } {
  if (valor === undefined || valor === null) return { valido: true }; // opcional
  if (isNaN(valor)) return { valido: false, mensaje: `${campo} debe ser un número` };
  if (valor < 0) return { valido: false, mensaje: `${campo} no puede ser negativo` };
  return { valido: true };
}

export function validarITBIS(itbis: number, totalFacturado: number): { valido: boolean; advertencia?: string } {
  if (totalFacturado === 0) return { valido: true };
  const porcentaje = itbis / totalFacturado;
  if (porcentaje > 0.18) {
    return { valido: true, advertencia: `ITBIS (${(porcentaje * 100).toFixed(2)}%) excede la tasa estándar del 18%` };
  }
  return { valido: true };
}

export function esNCFConsumidorFinal(ncf: string): boolean {
  const inicio = ncf.substring(0, 3).toUpperCase();
  return ['B02', 'E32'].includes(inicio);
}

export function esNCFNotaCredito(ncf: string): boolean {
  const inicio = ncf.substring(0, 3).toUpperCase();
  return ['B04', 'E34'].includes(inicio);
}

export function esNCFNotaDebito(ncf: string): boolean {
  const inicio = ncf.substring(0, 3).toUpperCase();
  return ['B03', 'E33'].includes(inicio);
}

export function esNCFProveedorInformal(ncf: string): boolean {
  const inicio = ncf.substring(0, 3).toUpperCase();
  return ['B11', 'E41'].includes(inicio);
}

export function esNCFGastosMenores(ncf: string): boolean {
  const inicio = ncf.substring(0, 3).toUpperCase();
  return ['B13', 'E43'].includes(inicio);
}

export function esNCFPagoExterior(ncf: string): boolean {
  const inicio = ncf.substring(0, 3).toUpperCase();
  return ['B17', 'E47'].includes(inicio);
}

export function inferirTipoID(rncCedula: string): 1 | 2 {
  const limpio = rncCedula.replace(/[^0-9]/g, '');
  return limpio.length === 9 ? 1 : 2;
}

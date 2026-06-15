import { EstadoRegistro, RegimenITBIS, TipoEventoAuditoria, ETIQUETAS_FORMA_PAGO, ETIQUETAS_TIPO_BIEN_SERVICIO } from '@/types';

export function formatearMoneda(valor: number | undefined | null, moneda = 'RD$'): string {
  if (valor === undefined || valor === null) return `${moneda} 0.00`;
  return `${moneda} ${valor.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatearFechaDGII(fechaAAAAMMDD: string): string {
  if (!fechaAAAAMMDD || fechaAAAAMMDD.length !== 8) return fechaAAAAMMDD || '-';
  const year = fechaAAAAMMDD.slice(0, 4);
  const month = fechaAAAAMMDD.slice(4, 6);
  const day = fechaAAAAMMDD.slice(6, 8);
  return `${day}/${month}/${year}`;
}

export function formatearPeriodo(periodoAAAAMM: string): string {
  if (!periodoAAAAMM || periodoAAAAMM.length !== 6) return periodoAAAAMM || '-';
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const year = periodoAAAAMM.slice(0, 4);
  const monthIdx = parseInt(periodoAAAAMM.slice(4, 6), 10) - 1;
  return `${meses[monthIdx] || '?'} ${year}`;
}

export function formatearFechaISO(fecha: Date | string | undefined): string {
  if (!fecha) return '-';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return d.toLocaleString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function etiquetaEstado(estado: EstadoRegistro | string): { label: string; color: string } {
  const mapa: Record<string, { label: string; color: string }> = {
    pendiente:  { label: 'Pendiente',  color: 'bg-yellow-100 text-yellow-800' },
    validado:   { label: 'Validado',   color: 'bg-green-100 text-green-800'  },
    rechazado:  { label: 'Rechazado',  color: 'bg-red-100 text-red-800'      },
    reportado:  { label: 'Reportado',  color: 'bg-blue-100 text-blue-800'    },
  };
  return mapa[estado] ?? { label: estado, color: 'bg-gray-100 text-gray-800' };
}

export function etiquetaEvento(tipo: TipoEventoAuditoria | string): { label: string; color: string } {
  const mapa: Record<string, { label: string; color: string }> = {
    CREACION:             { label: 'Creación',        color: 'bg-blue-100 text-blue-800'    },
    VALIDACION_EXITOSA:   { label: 'Válido',          color: 'bg-green-100 text-green-800'  },
    VALIDACION_FALLIDA:   { label: 'Inválido',        color: 'bg-red-100 text-red-800'      },
    MODIFICACION:         { label: 'Modificación',    color: 'bg-yellow-100 text-yellow-800'},
    EXPORTACION:          { label: 'Exportación',     color: 'bg-purple-100 text-purple-800'},
    SEGUNDO_ENVIO:        { label: 'Segundo Envío',   color: 'bg-orange-100 text-orange-800'},
    RECHAZO_FISCAL:       { label: 'Rechazo Fiscal',  color: 'bg-red-200 text-red-900'      },
  };
  return mapa[tipo] ?? { label: tipo, color: 'bg-gray-100 text-gray-800' };
}

export function etiquetaRegimen(regimen: RegimenITBIS | string): { label: string; color: string } {
  const mapa: Record<string, { label: string; color: string }> = {
    EXENTO:        { label: 'Exento',        color: 'bg-gray-100 text-gray-700'   },
    GRAVADO_TOTAL: { label: 'Gravado Total', color: 'bg-green-100 text-green-700' },
    PROPORCIONAL:  { label: 'Proporcional',  color: 'bg-blue-100 text-blue-700'   },
  };
  return mapa[regimen] ?? { label: regimen, color: 'bg-gray-100 text-gray-700' };
}

export function etiquetaFormaPago(codigo: string): string {
  return ETIQUETAS_FORMA_PAGO[codigo] ?? codigo;
}

export function etiquetaTipoBien(codigo: string): string {
  return ETIQUETAS_TIPO_BIEN_SERVICIO[codigo] ?? codigo;
}

export function normalizarPeriodo(input: string): string {
  return input.replace(/[^0-9]/g, '').slice(0, 6);
}

export function periodoActual(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

export function truncarTexto(texto: string, max = 40): string {
  if (!texto) return '';
  return texto.length > max ? texto.slice(0, max) + '…' : texto;
}

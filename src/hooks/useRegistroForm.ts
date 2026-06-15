'use client';

import { useState, useCallback } from 'react';
import { CreateRegistro606DTO, TipoID } from '@/types';

const ESTADO_INICIAL: CreateRegistro606DTO = {
  rncCedula: '',
  tipoID: TipoID.RNC,
  tipoBienServicio: '05',
  ncf: '',
  fechaComprobante: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
  montoServicios: 0,
  montoBienes: 0,
  itbisFacturado: 0,
  formaPago: '02',
  montoRetencionISR: 0,
  isc: 0,
  otrosImpuestos: 0,
  propinaLegal: 0,
};

export function useRegistroForm(inicial?: Partial<CreateRegistro606DTO>) {
  const [registro, setRegistro] = useState<CreateRegistro606DTO>({ ...ESTADO_INICIAL, ...inicial });
  const [tocados, setTocados] = useState<Set<string>>(new Set());

  const setCampo = useCallback(<K extends keyof CreateRegistro606DTO>(campo: K, valor: CreateRegistro606DTO[K]) => {
    setRegistro(prev => ({ ...prev, [campo]: valor }));
    setTocados(prev => new Set(prev).add(campo as string));
  }, []);

  const setCampos = useCallback((cambios: Partial<CreateRegistro606DTO>) => {
    setRegistro(prev => ({ ...prev, ...cambios }));
    setTocados(prev => {
      const next = new Set(prev);
      Object.keys(cambios).forEach(k => next.add(k));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setRegistro({ ...ESTADO_INICIAL, ...inicial });
    setTocados(new Set());
  }, [inicial]);

  const totalFacturado = (registro.montoServicios ?? 0) + (registro.montoBienes ?? 0);

  const porcentajeITBIS = totalFacturado > 0
    ? ((registro.itbisFacturado ?? 0) / totalFacturado) * 100
    : 0;

  return { registro, tocados, setCampo, setCampos, reset, totalFacturado, porcentajeITBIS };
}

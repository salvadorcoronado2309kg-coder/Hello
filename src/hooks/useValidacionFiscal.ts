'use client';

import { useState, useCallback, useRef } from 'react';
import { CreateRegistro606DTO, Cliente, ResultadoValidacion } from '@/types';
import { IngestaService } from '@/services/IngestaService';

export function useValidacionFiscal(cliente: Cliente) {
  const [validacion, setValidacion] = useState<ResultadoValidacion | null>(null);
  const [validando, setValidando] = useState(false);
  const serviceRef = useRef(new IngestaService());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validar = useCallback(async (registro: CreateRegistro606DTO): Promise<ResultadoValidacion> => {
    setValidando(true);
    try {
      const resultado = await serviceRef.current.validarRegistroFiscal(registro, { cliente });
      setValidacion(resultado);
      return resultado;
    } finally {
      setValidando(false);
    }
  }, [cliente]);

  const validarDebounced = useCallback((registro: CreateRegistro606DTO, delay = 300) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => validar(registro), delay);
  }, [validar]);

  const limpiar = useCallback(() => setValidacion(null), []);

  return { validacion, validando, validar, validarDebounced, limpiar };
}

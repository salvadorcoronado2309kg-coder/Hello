'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

const supabase = createClient();

export function useSupabaseQuery<T>(
  tableName: string,
  queryFn: (client: typeof supabase) => Promise<{ data: T[] | null; error: { message: string } | null; count?: number | null }>
) {
  const [datos, setDatos] = useState<T[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const ejecutar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await queryFn(supabase);
      if (resultado.error) {
        setError(resultado.error.message);
      } else {
        setDatos(resultado.data ?? []);
        if (resultado.count !== undefined) setTotal(resultado.count ?? 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableName]);

  useEffect(() => { ejecutar(); }, [ejecutar]);

  return { datos, cargando, error, total, refetch: ejecutar };
}

export function useUsuarioActual() {
  const [usuario, setUsuario] = useState<{ id: string; email?: string } | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUsuario(user ? { id: user.id, email: user.email } : null);
      setCargando(false);
    });
  }, []);

  return { usuario, cargando };
}

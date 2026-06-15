'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Dashboard606 } from '@/components/Dashboard606';
import { crearYValidarRegistro } from '@/app/actions/registroActions';
import { Cliente, CreateRegistro606DTO, ResultadoValidacion, RegimenITBIS } from '@/types';

export default function NuevoRegistroPage() {
  const router = useRouter();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const cargarCliente = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push('/login');
          return;
        }

        const { data: clienteData, error: clienteError } = await supabase
          .from('clientes')
          .select('*')
          .eq('id', user.id)
          .single();

        if (clienteError || !clienteData) {
          setError(
            'No se encontro informacion de cliente. Por favor complete su perfil.'
          );
          return;
        }

        // Map snake_case DB columns to camelCase Cliente interface
        const clienteMapped: Cliente = {
          id: clienteData.id,
          razonSocial: clienteData.razon_social,
          rncCedula: clienteData.rnc_cedula,
          regimenITBIS: clienteData.regimen_itbis as RegimenITBIS,
          fechaCreacion: new Date(clienteData.fecha_creacion),
          fechaActualizacion: new Date(clienteData.fecha_actualizacion || clienteData.fecha_creacion),
          activo: clienteData.activo ?? true,
        };

        setCliente(clienteMapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setCargando(false);
      }
    };

    cargarCliente();
  }, [router]);

  const handleGuardar = async (
    registro: CreateRegistro606DTO,
    _validacion: ResultadoValidacion
  ) => {
    if (!cliente) return;
    setGuardando(true);
    try {
      const resultado = await crearYValidarRegistro(registro, cliente.id);
      if (resultado.exito) {
        router.push('/dashboard/registros');
        router.refresh();
      } else {
        setError(resultado.error || 'Error al guardar el registro');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al guardar');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <svg
            className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-3"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-sm text-gray-500">Cargando datos de cliente...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg
            className="w-12 h-12 text-red-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-red-700 font-medium mb-2">Error</p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!cliente) return null;

  return (
    <div className="h-full -m-6">
      {guardando && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 flex items-center gap-4 shadow-xl">
            <svg
              className="animate-spin h-6 w-6 text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-gray-700 font-medium">Guardando registro...</span>
          </div>
        </div>
      )}
      <Dashboard606 cliente={cliente} onGuardar={handleGuardar} />
    </div>
  );
}

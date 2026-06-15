'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { EstadoRegistro } from '@/types';
import TablaPaginada, { Columna } from '@/components/TablaPaginada';

interface RegistroRow {
  id: string;
  ncf: string;
  rnc_cedula: string;
  fecha_comprobante: string;
  total_facturado: number;
  itbis_facturado: number;
  estado: EstadoRegistro;
  fecha_creacion: string;
}

const ESTADO_LABELS: Record<string, { label: string; cls: string }> = {
  [EstadoRegistro.VALIDADO]: {
    label: 'Validado',
    cls: 'bg-green-100 text-green-800',
  },
  [EstadoRegistro.PENDIENTE]: {
    label: 'Pendiente',
    cls: 'bg-yellow-100 text-yellow-800',
  },
  [EstadoRegistro.RECHAZADO]: {
    label: 'Rechazado',
    cls: 'bg-red-100 text-red-800',
  },
  [EstadoRegistro.REPORTADO]: {
    label: 'Reportado',
    cls: 'bg-blue-100 text-blue-800',
  },
};

const POR_PAGINA = 20;

export default function RegistrosPage() {
  const [registros, setRegistros] = useState<RegistroRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [idCliente, setIdCliente] = useState<string | null>(null);

  // Get current user cliente id
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: cliente } = await supabase
          .from('clientes')
          .select('id')
          .eq('id', user.id)
          .single();
        if (cliente) setIdCliente(cliente.id);
      }
    };
    init();
  }, []);

  const cargarRegistros = useCallback(
    async (pagina: number) => {
      if (!idCliente) return;
      setCargando(true);
      setError(null);

      try {
        const supabase = createClient();
        let query = supabase
          .from('registros_606')
          .select('id, ncf, rnc_cedula, fecha_comprobante, total_facturado, itbis_facturado, estado, fecha_creacion', {
            count: 'exact',
          })
          .eq('id_cliente', idCliente)
          .order('fecha_creacion', { ascending: false });

        if (filtroPeriodo && filtroPeriodo.length === 6) {
          query = query.like('fecha_comprobante', `${filtroPeriodo}%`);
        }
        if (filtroEstado) {
          query = query.eq('estado', filtroEstado);
        }

        const inicio = (pagina - 1) * POR_PAGINA;
        query = query.range(inicio, inicio + POR_PAGINA - 1);

        const { data, count, error: queryError } = await query;
        if (queryError) throw new Error(queryError.message);

        setRegistros((data as RegistroRow[]) || []);
        setTotalRegistros(count || 0);
        setTotalPaginas(Math.ceil((count || 0) / POR_PAGINA));
        setPaginaActual(pagina);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar registros');
      } finally {
        setCargando(false);
      }
    },
    [idCliente, filtroPeriodo, filtroEstado]
  );

  useEffect(() => {
    if (idCliente) {
      cargarRegistros(1);
    }
  }, [idCliente, filtroPeriodo, filtroEstado, cargarRegistros]);

  const handleEliminar = async (id: string) => {
    if (!confirm('Esta accion eliminara el registro permanentemente. Continuar?')) return;
    const supabase = createClient();
    const { error: delError } = await supabase.from('registros_606').delete().eq('id', id);
    if (delError) {
      alert('Error al eliminar: ' + delError.message);
    } else {
      cargarRegistros(paginaActual);
    }
  };

  const formatFecha = (fecha: string) => {
    if (!fecha || fecha.length < 8) return fecha || '—';
    // AAAAMMDD -> DD/MM/AAAA
    const y = fecha.substring(0, 4);
    const m = fecha.substring(4, 6);
    const d = fecha.substring(6, 8);
    return `${d}/${m}/${y}`;
  };

  const formatMonto = (monto: number | null) => {
    if (monto === null || monto === undefined) return '—';
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2,
    }).format(monto);
  };

  const columnas: Columna<RegistroRow>[] = [
    {
      header: 'NCF',
      accessor: (row) => (
        <span className="font-mono text-xs text-gray-800">{row.ncf || '—'}</span>
      ),
    },
    {
      header: 'RNC Proveedor',
      accessor: (row) => (
        <span className="font-mono text-xs">{row.rnc_cedula || '—'}</span>
      ),
    },
    {
      header: 'Fecha',
      accessor: (row) => formatFecha(row.fecha_comprobante),
    },
    {
      header: 'Total Facturado',
      accessor: (row) => (
        <span className="font-medium text-gray-900">{formatMonto(row.total_facturado)}</span>
      ),
    },
    {
      header: 'ITBIS',
      accessor: (row) => formatMonto(row.itbis_facturado),
    },
    {
      header: 'Estado',
      accessor: (row) => {
        const info = ESTADO_LABELS[row.estado] || {
          label: row.estado,
          cls: 'bg-gray-100 text-gray-700',
        };
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${info.cls}`}
          >
            {info.label}
          </span>
        );
      },
    },
    {
      header: 'Acciones',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/registros/${row.id}`}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
          >
            Ver
          </Link>
          <button
            onClick={() => handleEliminar(row.id)}
            className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline"
          >
            Eliminar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registros 606</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalRegistros} registro{totalRegistros !== 1 ? 's' : ''} encontrado{totalRegistros !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/dashboard/registros/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Registro
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Periodo (AAAAMM)
            </label>
            <input
              type="text"
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value.replace(/\D/g, '').substring(0, 6))}
              placeholder="Ej: 202601"
              maxLength={6}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-36"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Estado</label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white w-40"
            >
              <option value="">Todos</option>
              <option value={EstadoRegistro.PENDIENTE}>Pendiente</option>
              <option value={EstadoRegistro.VALIDADO}>Validado</option>
              <option value={EstadoRegistro.RECHAZADO}>Rechazado</option>
              <option value={EstadoRegistro.REPORTADO}>Reportado</option>
            </select>
          </div>
          {(filtroPeriodo || filtroEstado) && (
            <button
              onClick={() => {
                setFiltroPeriodo('');
                setFiltroEstado('');
              }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Error: {error}
        </div>
      )}

      {/* Tabla */}
      <TablaPaginada
        columnas={columnas}
        datos={registros}
        paginaActual={paginaActual}
        totalPaginas={totalPaginas}
        onCambiarPagina={(p) => cargarRegistros(p)}
        cargando={cargando}
        emptyMessage="No hay registros para el periodo y filtros seleccionados."
      />
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { TipoEventoAuditoria } from '@/types';
import TablaPaginada, { Columna } from '@/components/TablaPaginada';

interface AuditoriaRow {
  id: string;
  id_registro_606: string;
  tipo_evento: TipoEventoAuditoria;
  descripcion: string | null;
  reglas_aplicadas: string[] | null;
  errores_detectados: string[] | null;
  fecha_evento: string;
}

const TIPO_EVENTO_CONFIG: Record<string, { label: string; cls: string }> = {
  [TipoEventoAuditoria.CREACION]: { label: 'Creacion', cls: 'bg-blue-100 text-blue-800' },
  [TipoEventoAuditoria.VALIDACION_EXITOSA]: { label: 'Validado', cls: 'bg-green-100 text-green-800' },
  [TipoEventoAuditoria.VALIDACION_FALLIDA]: { label: 'Fallo Validacion', cls: 'bg-red-100 text-red-800' },
  [TipoEventoAuditoria.MODIFICACION]: { label: 'Modificacion', cls: 'bg-yellow-100 text-yellow-800' },
  [TipoEventoAuditoria.EXPORTACION]: { label: 'Exportacion', cls: 'bg-purple-100 text-purple-800' },
  [TipoEventoAuditoria.SEGUNDO_ENVIO]: { label: 'Segundo Envio', cls: 'bg-orange-100 text-orange-800' },
  [TipoEventoAuditoria.RECHAZO_FISCAL]: { label: 'Rechazo Fiscal', cls: 'bg-red-200 text-red-900' },
};

const POR_PAGINA = 25;

export default function AuditoriaPage() {
  const [registros, setRegistros] = useState<AuditoriaRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [idCliente, setIdCliente] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setIdCliente(user.id);
    };
    init();
  }, []);

  const cargarAuditoria = useCallback(
    async (pagina: number) => {
      if (!idCliente) return;
      setCargando(true);
      setError(null);

      try {
        const supabase = createClient();
        let query = supabase
          .from('auditoria_registros')
          .select('*', { count: 'exact' })
          .eq('id_cliente', idCliente)
          .order('fecha_evento', { ascending: false });

        if (fechaDesde) {
          query = query.gte('fecha_evento', new Date(fechaDesde).toISOString());
        }
        if (fechaHasta) {
          const hasta = new Date(fechaHasta);
          hasta.setHours(23, 59, 59, 999);
          query = query.lte('fecha_evento', hasta.toISOString());
        }

        const inicio = (pagina - 1) * POR_PAGINA;
        query = query.range(inicio, inicio + POR_PAGINA - 1);

        const { data, count, error: queryError } = await query;
        if (queryError) throw new Error(queryError.message);

        setRegistros((data as AuditoriaRow[]) || []);
        setTotalRegistros(count || 0);
        setTotalPaginas(Math.ceil((count || 0) / POR_PAGINA));
        setPaginaActual(pagina);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar auditoria');
      } finally {
        setCargando(false);
      }
    },
    [idCliente, fechaDesde, fechaHasta]
  );

  useEffect(() => {
    if (idCliente) cargarAuditoria(1);
  }, [idCliente, fechaDesde, fechaHasta, cargarAuditoria]);

  const formatFechaEvento = (fecha: string) => {
    try {
      return new Date(fecha).toLocaleString('es-DO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return fecha;
    }
  };

  const columnas: Columna<AuditoriaRow>[] = [
    {
      header: 'Fecha y Hora',
      accessor: (row) => (
        <span className="font-mono text-xs text-gray-600">{formatFechaEvento(row.fecha_evento)}</span>
      ),
    },
    {
      header: 'Tipo Evento',
      accessor: (row) => {
        const cfg = TIPO_EVENTO_CONFIG[row.tipo_evento] || {
          label: row.tipo_evento,
          cls: 'bg-gray-100 text-gray-700',
        };
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}
          >
            {cfg.label}
          </span>
        );
      },
    },
    {
      header: 'Descripcion',
      accessor: (row) => (
        <span className="text-xs text-gray-700 max-w-xs block truncate" title={row.descripcion || ''}>
          {row.descripcion || '—'}
        </span>
      ),
      className: 'max-w-xs',
    },
    {
      header: 'Reglas Aplicadas',
      accessor: (row) => {
        const reglas = row.reglas_aplicadas;
        if (!reglas || reglas.length === 0) return <span className="text-gray-400 text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {reglas.slice(0, 3).map((r, i) => (
              <span
                key={i}
                className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                title={r}
              >
                {r.length > 15 ? r.substring(0, 15) + '...' : r}
              </span>
            ))}
            {reglas.length > 3 && (
              <span className="text-xs text-gray-400">+{reglas.length - 3}</span>
            )}
          </div>
        );
      },
    },
    {
      header: 'ID Registro',
      accessor: (row) => (
        <span className="font-mono text-xs text-gray-400" title={row.id_registro_606}>
          {row.id_registro_606 ? row.id_registro_606.substring(0, 8) + '...' : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Auditoria de Registros</h1>
        <p className="text-sm text-gray-500 mt-1">
          Historial de eventos y operaciones realizadas sobre los registros 606.{' '}
          {totalRegistros > 0 && (
            <span className="font-medium">{totalRegistros} eventos encontrados.</span>
          )}
        </p>
      </div>

      {/* Filtros de fecha */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fecha Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          {(fechaDesde || fechaHasta) && (
            <button
              onClick={() => {
                setFechaDesde('');
                setFechaHasta('');
              }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Leyenda de tipos */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TIPO_EVENTO_CONFIG).map(([, cfg]) => (
          <span
            key={cfg.label}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}
          >
            {cfg.label}
          </span>
        ))}
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
        onCambiarPagina={(p) => cargarAuditoria(p)}
        cargando={cargando}
        emptyMessage="No hay eventos de auditoria para el rango de fechas seleccionado."
      />

      <p className="text-xs text-gray-400 text-center">
        Vista de solo lectura. Los eventos son registrados automaticamente por el sistema.
      </p>
    </div>
  );
}

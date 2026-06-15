'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface ResumenPeriodo {
  total: number;
  validados: number;
  pendientes: number;
  totalFacturado: number;
  totalITBIS: number;
}

interface HistorialExportacion {
  id: string;
  periodo: string;
  cantidad_registros: number;
  suma_facturado: number;
  nombre_archivo: string;
  fecha_creacion: string;
  enviado_dgii: boolean;
}

export default function ExportarPage() {
  const [periodo, setPeriodo] = useState('');
  const [resumen, setResumen] = useState<ResumenPeriodo | null>(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialExportacion[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
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

  useEffect(() => {
    if (idCliente) cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idCliente]);

  const cargarHistorial = async () => {
    if (!idCliente) return;
    setCargandoHistorial(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('exportaciones_606')
        .select('*')
        .eq('id_cliente', idCliente)
        .order('fecha_creacion', { ascending: false })
        .limit(10);
      setHistorial((data as HistorialExportacion[]) || []);
    } catch {
      // Historial no critico si falla
    } finally {
      setCargandoHistorial(false);
    }
  };

  const consultarResumen = async () => {
    if (!periodo || periodo.length !== 6 || !idCliente) {
      setError('Ingrese un periodo valido en formato AAAAMM (ej: 202601)');
      return;
    }
    setCargandoResumen(true);
    setError(null);
    setResumen(null);

    try {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from('registros_606')
        .select('estado, total_facturado, itbis_facturado')
        .eq('id_cliente', idCliente)
        .like('fecha_comprobante', `${periodo}%`);

      if (queryError) throw new Error(queryError.message);

      const registros = data || [];
      const validados = registros.filter((r) => r.estado === 'validado');
      const pendientes = registros.filter((r) => r.estado === 'pendiente');

      setResumen({
        total: registros.length,
        validados: validados.length,
        pendientes: pendientes.length,
        totalFacturado: validados.reduce((sum, r) => sum + (r.total_facturado || 0), 0),
        totalITBIS: validados.reduce((sum, r) => sum + (r.itbis_facturado || 0), 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar resumen');
    } finally {
      setCargandoResumen(false);
    }
  };

  const handleGenerarTXT = async () => {
    if (!periodo || periodo.length !== 6 || !idCliente) {
      setError('Ingrese un periodo valido');
      return;
    }
    if (!resumen || resumen.validados === 0) {
      setError('No hay registros validados para exportar en este periodo');
      return;
    }

    setGenerando(true);
    setError(null);
    setExito(null);

    try {
      const response = await fetch(
        `/api/registros/exportar?idCliente=${idCliente}&periodo=${periodo}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al generar el archivo');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `606_${periodo}_DGII.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExito(
        `Archivo 606_${periodo}_DGII.txt generado exitosamente con ${resumen.validados} registros.`
      );
      cargarHistorial();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar TXT');
    } finally {
      setGenerando(false);
    }
  };

  const formatMonto = (monto: number) =>
    new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2,
    }).format(monto);

  const formatFechaHistorial = (fecha: string) => {
    try {
      return new Date(fecha).toLocaleDateString('es-DO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return fecha;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Exportar Form 606</h1>
        <p className="text-sm text-gray-500 mt-1">
          Genera el archivo TXT con formato DGII para envio oficial.
        </p>
      </div>

      {/* Form de exportacion */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3">
          Seleccionar Periodo
        </h2>

        <div className="flex gap-3 items-end">
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Periodo (AAAAMM)
            </label>
            <input
              type="text"
              value={periodo}
              onChange={(e) => {
                setPeriodo(e.target.value.replace(/\D/g, '').substring(0, 6));
                setResumen(null);
                setError(null);
                setExito(null);
              }}
              placeholder="Ej: 202601"
              maxLength={6}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <button
            onClick={consultarResumen}
            disabled={cargandoResumen || periodo.length !== 6}
            className="px-4 py-2.5 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition"
          >
            {cargandoResumen ? 'Consultando...' : 'Consultar'}
          </button>
        </div>

        {/* Resumen */}
        {resumen && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Resumen del periodo {periodo.substring(0, 4)}-{periodo.substring(4, 6)}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Total registros</p>
                <p className="text-xl font-bold text-gray-900">{resumen.total}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <p className="text-xs text-green-600">Validados</p>
                <p className="text-xl font-bold text-green-700">{resumen.validados}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-yellow-200">
                <p className="text-xs text-yellow-600">Pendientes</p>
                <p className="text-xl font-bold text-yellow-700">{resumen.pendientes}</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-200">
                <p className="text-xs text-blue-600">Total Facturado</p>
                <p className="text-sm font-bold text-blue-700">{formatMonto(resumen.totalFacturado)}</p>
              </div>
            </div>
            {resumen.validados === 0 && (
              <p className="text-sm text-yellow-700 bg-yellow-50 px-3 py-2 rounded-lg">
                No hay registros validados en este periodo. Valide los registros antes de exportar.
              </p>
            )}
          </div>
        )}

        {/* Mensajes de error / exito */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {exito && (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-green-700">{exito}</p>
          </div>
        )}

        {/* Boton generar */}
        <button
          onClick={handleGenerarTXT}
          disabled={generando || !resumen || resumen.validados === 0 || periodo.length !== 6}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2"
        >
          {generando ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generando archivo...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Generar TXT DGII
            </>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Solo se exportan registros con estado &quot;Validado&quot;. El archivo cumple con el formato pipe-delimitado DGII.
        </p>
      </div>

      {/* Historial de exportaciones */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-800 border-b border-gray-100 pb-3 mb-4">
          Historial de Exportaciones
        </h2>

        {cargandoHistorial ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : historial.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No hay exportaciones previas registradas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr>
                  {['Periodo', 'Registros', 'Total Facturado', 'Fecha', 'DGII'].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historial.map((exp) => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-sm font-mono text-gray-800">{exp.periodo}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-600">{exp.cantidad_registros}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-600">{formatMonto(exp.suma_facturado)}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">{formatFechaHistorial(exp.fecha_creacion)}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          exp.enviado_dgii
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {exp.enviado_dgii ? 'Enviado' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

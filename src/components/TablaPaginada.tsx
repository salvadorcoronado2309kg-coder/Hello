'use client';

import React from 'react';

export interface Columna<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface TablaPaginadaProps<T> {
  columnas: Columna<T>[];
  datos: T[];
  paginaActual: number;
  totalPaginas: number;
  onCambiarPagina: (pagina: number) => void;
  cargando?: boolean;
  emptyMessage?: string;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

export function TablaPaginada<T extends object>({
  columnas,
  datos,
  paginaActual,
  totalPaginas,
  onCambiarPagina,
  cargando = false,
  emptyMessage = 'No hay registros para mostrar.',
}: TablaPaginadaProps<T>) {
  const paginasVisibles = () => {
    const paginas: (number | '...')[] = [];
    const delta = 2;
    const left = paginaActual - delta;
    const right = paginaActual + delta;

    for (let i = 1; i <= totalPaginas; i++) {
      if (i === 1 || i === totalPaginas || (i >= left && i <= right)) {
        paginas.push(i);
      } else if (paginas[paginas.length - 1] !== '...') {
        paginas.push('...');
      }
    }
    return paginas;
  };

  const renderCelda = (row: T, columna: Columna<T>): React.ReactNode => {
    if (typeof columna.accessor === 'function') {
      return columna.accessor(row);
    }
    const val = row[columna.accessor];
    if (val === null || val === undefined) return '—';
    return String(val);
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columnas.map((col, i) => (
                <th
                  key={i}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {cargando ? (
              Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} cols={columnas.length} />
              ))
            ) : datos.length === 0 ? (
              <tr>
                <td
                  colSpan={columnas.length}
                  className="px-4 py-12 text-center text-sm text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              datos.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                  {columnas.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-4 py-3 text-sm text-gray-700 whitespace-nowrap ${col.className ?? ''}`}
                    >
                      {renderCelda(row, col)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginacion */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-gray-50">
          <p className="text-xs text-gray-500">
            Pagina <span className="font-semibold">{paginaActual}</span> de{' '}
            <span className="font-semibold">{totalPaginas}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onCambiarPagina(paginaActual - 1)}
              disabled={paginaActual <= 1}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Anterior
            </button>

            {paginasVisibles().map((p, i) =>
              p === '...' ? (
                <span key={i} className="px-2 py-1.5 text-xs text-gray-400">
                  ...
                </span>
              ) : (
                <button
                  key={i}
                  onClick={() => onCambiarPagina(p as number)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                    p === paginaActual
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => onCambiarPagina(paginaActual + 1)}
              disabled={paginaActual >= totalPaginas}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TablaPaginada;

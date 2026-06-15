'use client';

import { ResultadoValidacion } from '@/types';

interface Props {
  validacion: ResultadoValidacion | null;
  className?: string;
}

export function AlertasValidacion({ validacion, className = '' }: Props) {
  if (!validacion) return null;

  const hayErrores = validacion.errores.length > 0;
  const hayAdvertencias = validacion.advertencias.length > 0;

  if (!hayErrores && !hayAdvertencias) {
    return (
      <div className={`p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 ${className}`}>
        <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-green-700 font-medium">Registro válido — listo para guardar</span>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {hayErrores && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-red-700">
              {validacion.errores.length} error{validacion.errores.length > 1 ? 'es' : ''} de validación
            </span>
          </div>
          <ul className="space-y-1">
            {validacion.errores.map((err, i) => (
              <li key={i} className="text-xs text-red-600 flex gap-1">
                <span className="font-medium flex-shrink-0">{err.campo}:</span>
                <span>{err.mensaje}</span>
                <span className={`ml-auto flex-shrink-0 px-1 rounded text-xs font-bold ${
                  err.severidad === 'BLOQUEANTE' ? 'bg-red-200 text-red-800' :
                  err.severidad === 'CRITICO'    ? 'bg-orange-200 text-orange-800' :
                                                   'bg-yellow-200 text-yellow-800'
                }`}>{err.severidad}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hayAdvertencias && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-semibold text-yellow-700">
              {validacion.advertencias.length} advertencia{validacion.advertencias.length > 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-1">
            {validacion.advertencias.map((adv, i) => (
              <li key={i} className="text-xs text-yellow-700">
                <span className="font-medium">{adv.campo}:</span> {adv.mensaje}
                {adv.sugerencia && (
                  <span className="block text-yellow-600 pl-2">→ {adv.sugerencia}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default AlertasValidacion;

'use client';

import { useState } from 'react';
import { Dashboard606 } from '@/components/Dashboard606';
import { Cliente, RegimenITBIS, CreateRegistro606DTO, ResultadoValidacion } from '@/types';

const CLIENTES_DEMO: Cliente[] = [
  { id: '1', razonSocial: 'PAPELERÍA EL ESTUDIANTE SRL', rncCedula: '101234567', regimenITBIS: RegimenITBIS.GRAVADO_TOTAL, fechaCreacion: new Date(), fechaActualizacion: new Date(), activo: true },
  { id: '2', razonSocial: 'CLÍNICA MÉDICA SAN LUCAS SA', rncCedula: '109876543', regimenITBIS: RegimenITBIS.EXENTO, fechaCreacion: new Date(), fechaActualizacion: new Date(), activo: true },
  { id: '3', razonSocial: 'DISTRIBUIDORA MIXTA CARIBE CXA', rncCedula: '107654321', regimenITBIS: RegimenITBIS.PROPORCIONAL, fechaCreacion: new Date(), fechaActualizacion: new Date(), activo: true },
];

export default function DemoPage() {
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente>(CLIENTES_DEMO[0]);
  const [ultimoRegistro, setUltimoRegistro] = useState<{ registro: CreateRegistro606DTO; validacion: ResultadoValidacion } | null>(null);

  const handleGuardar = async (registro: CreateRegistro606DTO, validacion: ResultadoValidacion) => {
    setUltimoRegistro({ registro, validacion });
    console.log('Registro validado (DEMO):', { registro, validacion });
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Demo Banner */}
      <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded">DEMO</span>
          <span className="text-sm text-amber-800">Modo demostración — sin conexión a base de datos</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-amber-700 font-medium">Cliente:</span>
          <select
            value={clienteSeleccionado.id}
            onChange={(e) => setClienteSeleccionado(CLIENTES_DEMO.find(c => c.id === e.target.value) || CLIENTES_DEMO[0])}
            className="text-xs border border-amber-300 rounded px-2 py-1 bg-white text-amber-900"
          >
            {CLIENTES_DEMO.map(c => (
              <option key={c.id} value={c.id}>{c.razonSocial} ({c.regimenITBIS})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Dashboard */}
      <div className="flex-1 overflow-hidden">
        <Dashboard606
          cliente={clienteSeleccionado}
          onGuardar={handleGuardar}
        />
      </div>

      {/* Log de último registro guardado */}
      {ultimoRegistro && (
        <div className="bg-gray-900 text-green-400 text-xs px-4 py-2 font-mono max-h-32 overflow-auto">
          <span className="text-gray-400">Último registro validado: </span>
          {JSON.stringify(ultimoRegistro.registro, null, 0)}
        </div>
      )}
    </div>
  );
}

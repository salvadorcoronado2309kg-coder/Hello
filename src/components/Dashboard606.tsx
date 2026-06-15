'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  CreateRegistro606DTO,
  Cliente,
  TipoID,
  ETIQUETAS_TIPO_BIEN_SERVICIO,
  ETIQUETAS_FORMA_PAGO,
  CODIGOS_NCFBLOQUEADOS,
  CODIGOS_NCF_ESPECIALES,
  ResultadoValidacion
} from '@/types';
import { IngestaService } from '@/services/IngestaService';

interface Dashboard606Props {
  cliente: Cliente;
  registroInicial?: CreateRegistro606DTO;
  onGuardar?: (registro: CreateRegistro606DTO, validacion: ResultadoValidacion) => Promise<void>;
}

export const Dashboard606: React.FC<Dashboard606Props> = ({ cliente, registroInicial, onGuardar }) => {
  const [registro, setRegistro] = useState<CreateRegistro606DTO>(
    registroInicial || {
      rncCedula: '',
      tipoID: TipoID.RNC,
      tipoBienServicio: '05',
      ncf: '',
      fechaComprobante: new Date().toISOString().split('T')[0].replace(/-/g, ''),
      montoServicios: 0,
      montoBienes: 0,
      itbisFacturado: 0,
      formaPago: '02',
      montoRetencionISR: 0,
      isc: 0,
      otrosImpuestos: 0,
      propinaLegal: 0
    }
  );

  const [validacion, setValidacion] = useState<ResultadoValidacion | null>(null);
  const [zoomPDF, setZoomPDF] = useState(100);
  const [imagenCargada, setImagenCargada] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const ingestaService = useMemo(() => new IngestaService(), []);

  const ejecutarValidacion = useCallback(
    async (registroActual: CreateRegistro606DTO) => {
      const resultado = await ingestaService.validarRegistroFiscal(registroActual, { cliente });
      setValidacion(resultado);
      return resultado;
    },
    [cliente, ingestaService]
  );

  const handleCampoBasico = (campo: keyof CreateRegistro606DTO, valor: unknown) => {
    const registroActualizado = { ...registro, [campo]: valor };
    setRegistro(registroActualizado);
    ejecutarValidacion(registroActualizado);
  };

  const handleRetencionISR = (tipo: string, monto: number) => {
    const registroActualizado = { ...registro, tipoRetencionISR: tipo, montoRetencionISR: monto };
    setRegistro(registroActualizado);
    ejecutarValidacion(registroActualizado);
  };

  const totalFacturado = useMemo(() => (registro.montoServicios || 0) + (registro.montoBienes || 0), [registro.montoServicios, registro.montoBienes]);

  const porcentajeITBIS = useMemo(() => {
    if (totalFacturado === 0) return 0;
    return ((registro.itbisFacturado || 0) / totalFacturado) * 100;
  }, [registro.itbisFacturado, totalFacturado]);

  const alertaSemaforoITBIS = useMemo(() => {
    if (porcentajeITBIS > 18) return { color: 'red', mensaje: `ITBIS ${porcentajeITBIS.toFixed(2)}% (>18%)` };
    if (porcentajeITBIS > 17.5) return { color: 'yellow', mensaje: `ITBIS ${porcentajeITBIS.toFixed(2)}% (cerca de 18%)` };
    return { color: 'green', mensaje: `ITBIS ${porcentajeITBIS.toFixed(2)}%` };
  }, [porcentajeITBIS]);

  const ncfInicio = registro.ncf.substring(0, 3);
  const esConsumidorFinal = CODIGOS_NCFBLOQUEADOS.CONSUMIDOR_FINAL.includes(ncfInicio);
  const esNotaCredito = CODIGOS_NCFBLOQUEADOS.NOTAS_CREDITO.includes(ncfInicio) || CODIGOS_NCFBLOQUEADOS.NOTAS_DEBITO.includes(ncfInicio);
  const esProveedorInformal = CODIGOS_NCF_ESPECIALES.PROVEEDOR_INFORMAL.includes(ncfInicio);

  const puedoGuardar = !esConsumidorFinal && !cargando && (validacion?.esValido ?? true);

  const handleGuardar = async () => {
    setCargando(true);
    try {
      const resultado = await ejecutarValidacion(registro);
      if (!resultado.esValido) { setCargando(false); return; }
      if (onGuardar) await onGuardar(registro, resultado);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch (error) {
      console.error('Error al guardar:', error);
    } finally {
      setCargando(false);
    }
  };

  const handleCargaImagen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImagenCargada(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const resetForm = () => setRegistro({
    rncCedula: '', tipoID: TipoID.RNC, tipoBienServicio: '05', ncf: '',
    fechaComprobante: new Date().toISOString().split('T')[0].replace(/-/g, ''),
    montoServicios: 0, montoBienes: 0, itbisFacturado: 0, formaPago: '02',
    montoRetencionISR: 0, isc: 0, otrosImpuestos: 0, propinaLegal: 0
  });

  return (
    <div className="flex h-screen bg-gray-50">
      {/* PANEL IZQUIERDO: VISUALIZADOR */}
      <div className="w-1/2 border-r border-gray-300 bg-white overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 shadow">
          <h2 className="text-xl font-bold">Visualizador de Factura</h2>
          <p className="text-sm text-blue-100 mt-1">OCR | QR | PDF</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {imagenCargada ? (
            <div className="w-full h-full flex flex-col">
              <div className="flex gap-2 mb-4 bg-gray-100 p-3 rounded">
                <button onClick={() => setZoomPDF(Math.max(50, zoomPDF - 10))} className="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm font-medium">−</button>
                <span className="text-sm font-medium text-gray-700 px-3 py-1 bg-white rounded border">{zoomPDF}%</span>
                <button onClick={() => setZoomPDF(Math.min(200, zoomPDF + 10))} className="px-3 py-1 bg-gray-300 hover:bg-gray-400 rounded text-sm font-medium">+</button>
                <button onClick={() => setImagenCargada(null)} className="ml-auto px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium">Limpiar</button>
              </div>
              <div className="flex-1 overflow-auto bg-gray-200 rounded border border-gray-300 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagenCargada} alt="Factura" style={{ width: `${zoomPDF}%` }} className="object-contain" />
              </div>
            </div>
          ) : (
            <div className="text-center">
              <svg className="mx-auto h-16 w-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <label className="cursor-pointer">
                <span className="mt-2 block text-sm font-medium text-blue-600 hover:text-blue-700 underline">Cargue imagen o PDF de factura</span>
                <input type="file" accept="image/*,.pdf" onChange={handleCargaImagen} className="hidden" />
              </label>
              <p className="text-xs text-gray-400 mt-2">Soporta JPG, PNG, PDF</p>
            </div>
          )}
        </div>
      </div>

      {/* PANEL DERECHO: FORMULARIO 23 CASILLAS */}
      <div className="w-1/2 overflow-y-auto bg-white flex flex-col">
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 shadow sticky top-0 z-10">
          <h2 className="text-xl font-bold">Registro Form 606</h2>
          <p className="text-sm text-green-100 mt-1">
            Régimen: <span className="font-semibold">{cliente.regimenITBIS}</span> | RNC: {cliente.rncCedula}
          </p>
        </div>

        {/* Alertas */}
        {esConsumidorFinal && (
          <div className="mx-6 mt-4 p-4 bg-red-100 border-l-4 border-red-600 rounded">
            <p className="text-red-800 font-bold text-sm">BLOQUEO FISCAL</p>
            <p className="text-red-700 text-xs mt-1">NCF {ncfInicio}: Consumidor final (B02/E32) no admisible en Form 606.</p>
          </div>
        )}
        {validacion && !validacion.esValido && (
          <div className="mx-6 mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded">
            <p className="text-yellow-800 font-bold text-sm">Errores de Validación</p>
            <ul className="text-yellow-700 text-xs mt-2 space-y-1 list-disc list-inside">
              {validacion.errores.map((err, i) => <li key={i}><span className="font-medium">{err.campo}:</span> {err.mensaje}</li>)}
            </ul>
          </div>
        )}
        {validacion && validacion.advertencias.length > 0 && (
          <div className="mx-6 mt-2 p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
            <p className="text-blue-800 font-bold text-xs">Advertencias</p>
            <ul className="text-blue-700 text-xs mt-1 space-y-1 list-disc list-inside">
              {validacion.advertencias.map((adv, i) => <li key={i}>{adv.mensaje}</li>)}
            </ul>
          </div>
        )}
        {guardado && (
          <div className="mx-6 mt-4 p-4 bg-green-100 border-l-4 border-green-600 rounded">
            <p className="text-green-800 font-bold text-sm">Guardado exitosamente</p>
          </div>
        )}

        <form className="flex-1 px-6 py-6 space-y-6">
          {/* SECCIÓN 1: PROVEEDOR */}
          <fieldset className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <legend className="text-xs font-bold text-gray-600 px-2 bg-white uppercase tracking-wide">1. Identificación del Proveedor</legend>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 1: RNC / Cédula</label>
                <input type="text" value={registro.rncCedula} onChange={(e) => handleCampoBasico('rncCedula', e.target.value)}
                  placeholder="Ej: 123456789 o 12345678901"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" maxLength={11} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 2: Tipo ID</label>
                <select value={registro.tipoID} onChange={(e) => handleCampoBasico('tipoID', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500">
                  <option value={TipoID.RNC}>1 - RNC</option>
                  <option value={TipoID.CEDULA}>2 - Cédula</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* SECCIÓN 2: COMPROBANTE */}
          <fieldset className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <legend className="text-xs font-bold text-gray-600 px-2 bg-white uppercase tracking-wide">2. Comprobante</legend>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 3: Tipo Bien/Servicio</label>
                  <select value={registro.tipoBienServicio} onChange={(e) => handleCampoBasico('tipoBienServicio', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                    {Object.entries(ETIQUETAS_TIPO_BIEN_SERVICIO).map(([cod, label]) => (
                      <option key={cod} value={cod}>{cod} - {label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 4: NCF (11 o 13 dígitos)</label>
                  <input type="text" value={registro.ncf} onChange={(e) => handleCampoBasico('ncf', e.target.value)}
                    placeholder="Ej: B0100000000001"
                    className={`w-full px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 ${esConsumidorFinal ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                    maxLength={13} />
                  {registro.ncf && ![11, 13].includes(registro.ncf.length) && (
                    <p className="text-xs text-red-600 mt-1">NCF debe tener 11 o 13 caracteres</p>
                  )}
                </div>
              </div>

              {esNotaCredito && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 5: NCF Modificado — OBLIGATORIO para Notas Crédito/Débito</label>
                  <input type="text" value={registro.ncfModificado || ''} onChange={(e) => handleCampoBasico('ncfModificado', e.target.value)}
                    placeholder="NCF original que se modifica"
                    className="w-full px-3 py-2 border border-orange-500 rounded text-sm bg-orange-50 focus:ring-2 focus:ring-orange-500" maxLength={13} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 6: Fecha Comprobante (AAAAMMDD)</label>
                  <input type="text" value={registro.fechaComprobante} onChange={(e) => handleCampoBasico('fechaComprobante', e.target.value)}
                    placeholder="20240115" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" maxLength={8} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 7: Fecha Pago (opcional)</label>
                  <input type="text" value={registro.fechaPago || ''} onChange={(e) => handleCampoBasico('fechaPago', e.target.value)}
                    placeholder="20240120" className="w-full px-3 py-2 border border-gray-300 rounded text-sm" maxLength={8} />
                </div>
              </div>
            </div>
          </fieldset>

          {/* SECCIÓN 3: MONTOS */}
          <fieldset className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <legend className="text-xs font-bold text-gray-600 px-2 bg-white uppercase tracking-wide">3. Montos</legend>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 8: Servicios</label>
                  <input type="number" value={registro.montoServicios || 0} onChange={(e) => handleCampoBasico('montoServicios', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm" step="0.01" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 9: Bienes</label>
                  <input type="number" value={registro.montoBienes || 0} onChange={(e) => handleCampoBasico('montoBienes', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm" step="0.01" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 10: Total (Calc.)</label>
                  <input type="number" value={totalFacturado.toFixed(2)} disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-gray-100 cursor-not-allowed font-semibold" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 11: ITBIS Facturado</label>
                <div className="flex gap-2">
                  <input type="number" value={registro.itbisFacturado || 0} onChange={(e) => handleCampoBasico('itbisFacturado', parseFloat(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm" step="0.01" min="0" />
                  <div className={`px-3 py-2 rounded text-xs font-bold text-white min-w-max ${alertaSemaforoITBIS.color === 'red' ? 'bg-red-600' : alertaSemaforoITBIS.color === 'yellow' ? 'bg-yellow-500' : 'bg-green-600'}`}>
                    {alertaSemaforoITBIS.mensaje}
                  </div>
                </div>
              </div>
            </div>
          </fieldset>

          {/* SECCIÓN 4: RETENCIONES */}
          <fieldset className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <legend className="text-xs font-bold text-gray-600 px-2 bg-white uppercase tracking-wide">4. Retenciones</legend>
            <div className="space-y-4 mt-4">
              {esProveedorInformal && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 12: ITBIS Retenido (B11/E41 - 100%)</label>
                  <input type="number" value={registro.itbisRetenido || 0} onChange={(e) => handleCampoBasico('itbisRetenido', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-orange-400 rounded text-sm bg-orange-50" step="0.01" min="0" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 17: Tipo Retención ISR</label>
                  <select value={registro.tipoRetencionISR || ''} onChange={(e) => handleRetencionISR(e.target.value, registro.montoRetencionISR || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                    <option value="">-- Sin retención --</option>
                    <option value="01">01 - Servicios Profesionales (10%)</option>
                    <option value="02">02 - Alquileres (10%)</option>
                    <option value="03">03 - Servicios Técnicos (2%)</option>
                    <option value="04">04 - Transporte (2%)</option>
                    <option value="05">05 - Otros Servicios (2%)</option>
                    <option value="06">06 - Telecomunicaciones (2%)</option>
                    <option value="07">07 - Construcción (2%)</option>
                    <option value="08">08 - Servicios Financieros (1%)</option>
                    <option value="09">09 - Compra de Bienes (0%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 18: Monto Retención ISR</label>
                  <input type="number" value={registro.montoRetencionISR || 0} onChange={(e) => handleRetencionISR(registro.tipoRetencionISR || '', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm" step="0.01" min="0" />
                </div>
              </div>
            </div>
          </fieldset>

          {/* SECCIÓN 5: OTROS IMPUESTOS */}
          <fieldset className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <legend className="text-xs font-bold text-gray-600 px-2 bg-white uppercase tracking-wide">5. Otros Impuestos y Forma de Pago</legend>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 20: ISC</label>
                  <input type="number" value={registro.isc || 0} onChange={(e) => handleCampoBasico('isc', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm" step="0.01" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 21: Otros Impuestos</label>
                  <input type="number" value={registro.otrosImpuestos || 0} onChange={(e) => handleCampoBasico('otrosImpuestos', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm" step="0.01" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 22: Propina Legal</label>
                  <input type="number" value={registro.propinaLegal || 0} onChange={(e) => handleCampoBasico('propinaLegal', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm" step="0.01" min="0" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Casilla 23: Forma de Pago</label>
                <select value={registro.formaPago} onChange={(e) => handleCampoBasico('formaPago', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm">
                  {Object.entries(ETIQUETAS_FORMA_PAGO).map(([cod, label]) => (
                    <option key={cod} value={cod}>{cod} - {label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Concepto Personalizado</label>
                <input type="text" value={registro.conceptoPersonalizado || ''} onChange={(e) => handleCampoBasico('conceptoPersonalizado', e.target.value)}
                  placeholder="Ej: Factura de servicios de consultoría..."
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm" />
              </div>
            </div>
          </fieldset>

          {/* BOTONES */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-4 shadow-lg">
            <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded font-medium text-sm transition">
              Limpiar
            </button>
            <button type="button" onClick={handleGuardar} disabled={!puedoGuardar}
              className={`flex-1 px-4 py-2 rounded font-medium text-white transition ${puedoGuardar ? 'bg-green-600 hover:bg-green-700 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'}`}>
              {cargando ? 'Guardando...' : esConsumidorFinal ? 'Bloqueado (B02/E32)' : 'Guardar y Validar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Dashboard606;

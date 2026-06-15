'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { IngestaService } from '@/services/IngestaService';
import { AlertasValidacion } from '@/components/AlertasValidacion';
import {
  Registro606, Cliente, RegimenITBIS, EstadoRegistro, TipoID,
  ETIQUETAS_TIPO_BIEN_SERVICIO, ETIQUETAS_FORMA_PAGO, ResultadoValidacion,
} from '@/types';
import { formatearFechaDGII } from '@/utils/formatters';

const supabase = createClient();
const svc = new IngestaService();

interface FormState {
  rncCedula: string;
  tipoID: number;
  tipoBienServicio: string;
  ncf: string;
  ncfModificado: string;
  fechaComprobante: string;
  fechaPago: string;
  montoServicios: string;
  montoBienes: string;
  itbisFacturado: string;
  itbisRetenido: string;
  itbisProporcional: string;
  itbisCosto: string;
  itbisAdelantar: string;
  tipoRetencionISR: string;
  montoRetencionISR: string;
  isc: string;
  otrosImpuestos: string;
  propinaLegal: string;
  formaPago: string;
  conceptoPersonalizado: string;
}

function registroToForm(r: Registro606): FormState {
  return {
    rncCedula: r.rncCedula,
    tipoID: r.tipoID,
    tipoBienServicio: r.tipoBienServicio,
    ncf: r.ncf,
    ncfModificado: r.ncfModificado ?? '',
    fechaComprobante: r.fechaComprobante,
    fechaPago: r.fechaPago ?? '',
    montoServicios: r.montoServicios.toFixed(2),
    montoBienes: r.montoBienes.toFixed(2),
    itbisFacturado: r.itbisFacturado.toFixed(2),
    itbisRetenido: r.itbisRetenido.toFixed(2),
    itbisProporcional: r.itbisProporcional.toFixed(2),
    itbisCosto: r.itbisCosto.toFixed(2),
    itbisAdelantar: r.itbisAdelantar.toFixed(2),
    tipoRetencionISR: r.tipoRetencionISR ?? '',
    montoRetencionISR: r.montoRetencionISR.toFixed(2),
    isc: r.isc.toFixed(2),
    otrosImpuestos: r.otrosImpuestos.toFixed(2),
    propinaLegal: r.propinaLegal.toFixed(2),
    formaPago: r.formaPago,
    conceptoPersonalizado: r.conceptoPersonalizado ?? '',
  };
}

const TIPO_RETENCION_ISR: Record<string, string> = {
  '01': '01 — Serv. Profesionales (10%)',
  '02': '02 — Alquileres (10%)',
  '03': '03 — Serv. Técnicos (2%)',
  '04': '04 — Transporte (2%)',
  '05': '05 — Otros Servicios (2%)',
  '06': '06 — Telecomunicaciones (2%)',
  '07': '07 — Construcción (2%)',
  '08': '08 — Serv. Financieros (1%)',
  '09': '09 — Compra de Bienes (0%)',
};

function num(s: string) { return parseFloat(s) || 0; }

export default function EditarRegistroPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [registro, setRegistro] = useState<Registro606 | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState('');
  const [validacion, setValidacion] = useState<ResultadoValidacion | null>(null);

  useEffect(() => {
    async function cargar() {
      setCargando(true);
      const { data, error } = await supabase.from('registros_606').select('*').eq('id', id).single();
      if (error || !data) { setCargando(false); return; }

      const reg: Registro606 = {
        id: data.id,
        idCliente: data.id_cliente,
        rncCedula: data.rnc_cedula,
        tipoID: data.tipo_id,
        tipoBienServicio: data.tipo_bien_servicio,
        ncf: data.ncf,
        ncfModificado: data.ncf_modificado,
        fechaComprobante: data.fecha_comprobante,
        fechaPago: data.fecha_pago,
        montoServicios: Number(data.monto_servicios ?? 0),
        montoBienes: Number(data.monto_bienes ?? 0),
        totalFacturado: Number(data.total_facturado ?? 0),
        itbisFacturado: Number(data.itbis_facturado ?? 0),
        itbisRetenido: Number(data.itbis_retenido ?? 0),
        itbisProporcional: Number(data.itbis_proporcional ?? 0),
        itbisCosto: Number(data.itbis_costo ?? 0),
        itbisAdelantar: Number(data.itbis_adelantar ?? 0),
        itbisPercibido: 0,
        tipoRetencionISR: data.tipo_retencion_isr,
        montoRetencionISR: Number(data.monto_retencion_isr ?? 0),
        isrPercibido: 0,
        isc: Number(data.isc ?? 0),
        otrosImpuestos: Number(data.otros_impuestos ?? 0),
        propinaLegal: Number(data.propina_legal ?? 0),
        formaPago: data.forma_pago,
        conceptoPersonalizado: data.concepto_personalizado,
        estado: data.estado,
        erroresValidacion: data.errores_validacion,
        fechaCreacion: new Date(data.fecha_creacion),
        fechaActualizacion: new Date(data.fecha_actualizacion),
        origenIngesta: data.origen_ingesta,
        esSegundoEnvio: Boolean(data.es_segundo_envio),
        idRegistroOriginal: data.id_registro_original,
      };
      setRegistro(reg);
      setForm(registroToForm(reg));

      const { data: cd } = await supabase.from('clientes').select('*').eq('id', data.id_cliente).single();
      if (cd) {
        const cl: Cliente = {
          id: cd.id,
          razonSocial: cd.razon_social,
          rncCedula: cd.rnc_cedula,
          regimenITBIS: cd.regimen_itbis as RegimenITBIS,
          fechaCreacion: new Date(cd.fecha_creacion),
          fechaActualizacion: new Date(cd.fecha_actualizacion),
          activo: cd.activo,
        };
        setCliente(cl);
      }
      setCargando(false);
    }
    cargar();
  }, [id]);

  // Re-validate when form changes
  const revalidar = useCallback(async (f: FormState, cl: Cliente) => {
    const dto = {
      rncCedula: f.rncCedula,
      tipoID: Number(f.tipoID) as TipoID,
      tipoBienServicio: f.tipoBienServicio,
      ncf: f.ncf,
      ncfModificado: f.ncfModificado || undefined,
      fechaComprobante: f.fechaComprobante,
      fechaPago: f.fechaPago || undefined,
      montoServicios: num(f.montoServicios),
      montoBienes: num(f.montoBienes),
      itbisFacturado: num(f.itbisFacturado),
      itbisRetenido: num(f.itbisRetenido),
      itbisProporcional: num(f.itbisProporcional),
      itbisCosto: num(f.itbisCosto),
      itbisAdelantar: num(f.itbisAdelantar),
      tipoRetencionISR: f.tipoRetencionISR || undefined,
      montoRetencionISR: num(f.montoRetencionISR),
      isc: num(f.isc),
      otrosImpuestos: num(f.otrosImpuestos),
      propinaLegal: num(f.propinaLegal),
      formaPago: f.formaPago,
      conceptoPersonalizado: f.conceptoPersonalizado || undefined,
    };
    const v = await svc.validarRegistroFiscal(dto, { cliente: cl });
    setValidacion(v);
  }, []);

  const set = (key: keyof FormState, value: string) => {
    setForm(prev => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      if (cliente) revalidar(next, cliente);
      return next;
    });
  };

  const handleGuardar = async () => {
    if (!form || !registro) return;
    setGuardando(true);
    setErrorGuardar('');

    const payload = {
      rnc_cedula: form.rncCedula,
      tipo_id: Number(form.tipoID),
      tipo_bien_servicio: form.tipoBienServicio,
      ncf: form.ncf.trim().toUpperCase(),
      ncf_modificado: form.ncfModificado.trim().toUpperCase() || null,
      fecha_comprobante: form.fechaComprobante,
      fecha_pago: form.fechaPago || null,
      monto_servicios: num(form.montoServicios),
      monto_bienes: num(form.montoBienes),
      itbis_facturado: num(form.itbisFacturado),
      itbis_retenido: num(form.itbisRetenido),
      itbis_proporcional: num(form.itbisProporcional),
      itbis_costo: num(form.itbisCosto),
      itbis_adelantar: num(form.itbisAdelantar),
      tipo_retencion_isr: form.tipoRetencionISR || null,
      monto_retencion_isr: num(form.montoRetencionISR),
      isc: num(form.isc),
      otros_impuestos: num(form.otrosImpuestos),
      propina_legal: num(form.propinaLegal),
      forma_pago: form.formaPago,
      concepto_personalizado: form.conceptoPersonalizado.trim() || null,
      estado: validacion?.esValido ? EstadoRegistro.VALIDADO : EstadoRegistro.RECHAZADO,
      errores_validacion: validacion?.errores.map(e => `${e.codigo}: ${e.mensaje}`) ?? null,
      fecha_validacion: new Date().toISOString(),
      fecha_actualizacion: new Date().toISOString(),
    };

    const { error } = await supabase.from('registros_606').update(payload).eq('id', id);
    if (error) {
      setErrorGuardar(error.message);
      setGuardando(false);
      return;
    }
    router.push(`/dashboard/registro/${id}`);
  };

  if (cargando) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando registro…</p>
        </div>
      </div>
    );
  }

  if (!registro || !form) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Registro no encontrado.</p>
        <Link href="/dashboard/registros" className="text-blue-600 hover:underline text-sm">Volver al listado</Link>
      </div>
    );
  }

  if (registro.estado === EstadoRegistro.REPORTADO) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
          <p className="text-orange-700 font-semibold mb-2">Registro Reportado</p>
          <p className="text-sm text-orange-600 mb-4">
            Este registro ya fue incluido en un envío al DGII. No puede editarse una vez reportado.
          </p>
          <Link href={`/dashboard/registro/${id}`} className="text-blue-600 hover:underline text-sm">
            Ver detalle
          </Link>
        </div>
      </div>
    );
  }

  const totalFacturado = num(form.montoServicios) + num(form.montoBienes);
  const pctITBIS = totalFacturado > 0 ? (num(form.itbisFacturado) / totalFacturado * 100) : 0;
  const semaforoColor = pctITBIS > 18 ? 'text-red-600' : pctITBIS >= 17.5 ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/dashboard/registro/${id}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-2">
            ← Volver al detalle
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Editar Registro</h1>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{id}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${semaforoColor}`}>
            ITBIS: {pctITBIS.toFixed(2)}%
          </span>
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition"
          >
            {guardando ? 'Guardando…' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {/* Validación en vivo */}
      {validacion && <AlertasValidacion validacion={validacion} />}

      {errorGuardar && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errorGuardar}</div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Casillas 1–3: Proveedor */}
        <Seccion titulo="Casillas 1–3 — Proveedor">
          <Campo label="C.1 — RNC / Cédula">
            <input
              value={form.rncCedula}
              onChange={e => set('rncCedula', e.target.value.replace(/\D/g, ''))}
              maxLength={11}
              className={inputCls}
              placeholder="101234567"
            />
          </Campo>
          <Campo label="C.2 — Tipo ID">
            <select value={form.tipoID} onChange={e => set('tipoID', e.target.value)} className={inputCls}>
              <option value={TipoID.RNC}>1 — RNC</option>
              <option value={TipoID.CEDULA}>2 — Cédula</option>
            </select>
          </Campo>
          <Campo label="C.3 — Tipo Bien/Servicio">
            <select value={form.tipoBienServicio} onChange={e => set('tipoBienServicio', e.target.value)} className={inputCls}>
              {Object.entries(ETIQUETAS_TIPO_BIEN_SERVICIO).map(([k, v]) => (
                <option key={k} value={k}>{k} — {v}</option>
              ))}
            </select>
          </Campo>
        </Seccion>

        {/* Casillas 4–7: Comprobante */}
        <Seccion titulo="Casillas 4–7 — Comprobante">
          <Campo label="C.4 — NCF">
            <input
              value={form.ncf}
              onChange={e => set('ncf', e.target.value.trim().toUpperCase())}
              maxLength={13}
              className={`${inputCls} font-mono`}
              placeholder="B0100000001"
            />
          </Campo>
          <Campo label="C.5 — NCF Modificado (Nota C/D)">
            <input
              value={form.ncfModificado}
              onChange={e => set('ncfModificado', e.target.value.trim().toUpperCase())}
              maxLength={13}
              className={`${inputCls} font-mono`}
              placeholder="B0100000001 (solo notas C/D)"
            />
          </Campo>
          <Campo label="C.6 — Fecha Comprobante (AAAAMMDD)">
            <input
              value={form.fechaComprobante}
              onChange={e => set('fechaComprobante', e.target.value.replace(/\D/g, '').slice(0, 8))}
              maxLength={8}
              className={`${inputCls} font-mono`}
              placeholder="20260101"
            />
            {form.fechaComprobante.length === 8 && (
              <p className="text-xs text-gray-400 mt-0.5">{formatearFechaDGII(form.fechaComprobante)}</p>
            )}
          </Campo>
          <Campo label="C.7 — Fecha Pago (AAAAMMDD, opcional)">
            <input
              value={form.fechaPago}
              onChange={e => set('fechaPago', e.target.value.replace(/\D/g, '').slice(0, 8))}
              maxLength={8}
              className={`${inputCls} font-mono`}
              placeholder="20260201"
            />
          </Campo>
        </Seccion>

        {/* Casillas 8–10: Montos */}
        <Seccion titulo="Casillas 8–10 — Montos">
          <Campo label="C.8 — Monto Servicios">
            <input type="number" step="0.01" min="0" value={form.montoServicios} onChange={e => set('montoServicios', e.target.value)} className={inputCls} />
          </Campo>
          <Campo label="C.9 — Monto Bienes">
            <input type="number" step="0.01" min="0" value={form.montoBienes} onChange={e => set('montoBienes', e.target.value)} className={inputCls} />
          </Campo>
          <div className="flex justify-between items-center py-1 border-t border-gray-100 mt-1">
            <span className="text-xs text-gray-500">C.10 — Total Facturado (calculado)</span>
            <span className="text-sm font-bold text-gray-900">
              RD$ {totalFacturado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </Seccion>

        {/* Casillas 11–15: ITBIS */}
        <Seccion titulo="Casillas 11–15 — ITBIS">
          <Campo label="C.11 — ITBIS Facturado">
            <input type="number" step="0.01" min="0" value={form.itbisFacturado} onChange={e => set('itbisFacturado', e.target.value)} className={inputCls} />
          </Campo>
          <Campo label="C.12 — ITBIS Retenido">
            <input type="number" step="0.01" min="0" value={form.itbisRetenido} onChange={e => set('itbisRetenido', e.target.value)} className={inputCls} />
          </Campo>
          <Campo label="C.13 — ITBIS Proporcional">
            <input type="number" step="0.01" min="0" value={form.itbisProporcional} onChange={e => set('itbisProporcional', e.target.value)} className={inputCls} />
          </Campo>
          <Campo label="C.14 — ITBIS al Costo">
            <input type="number" step="0.01" min="0" value={form.itbisCosto} onChange={e => set('itbisCosto', e.target.value)} className={inputCls} />
          </Campo>
          <Campo label="C.15 — ITBIS a Adelantar">
            <input type="number" step="0.01" min="0" value={form.itbisAdelantar} onChange={e => set('itbisAdelantar', e.target.value)} className={inputCls} />
          </Campo>
          <div className="flex justify-between items-center py-1 border-t border-gray-100 mt-1">
            <span className="text-xs text-gray-400 italic">C.16 — ITBIS Percibido</span>
            <span className="text-sm text-gray-400 italic">0.00 (inhabilitado)</span>
          </div>
        </Seccion>

        {/* Casillas 17–19: ISR */}
        <Seccion titulo="Casillas 17–19 — Retención ISR">
          <Campo label="C.17 — Tipo Retención ISR">
            <select value={form.tipoRetencionISR} onChange={e => set('tipoRetencionISR', e.target.value)} className={inputCls}>
              <option value="">Sin retención</option>
              {Object.entries(TIPO_RETENCION_ISR).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Campo>
          <Campo label="C.18 — Monto Retención ISR">
            <input type="number" step="0.01" min="0" value={form.montoRetencionISR} onChange={e => set('montoRetencionISR', e.target.value)} className={inputCls} />
          </Campo>
          <div className="flex justify-between items-center py-1 border-t border-gray-100 mt-1">
            <span className="text-xs text-gray-400 italic">C.19 — ISR Percibido</span>
            <span className="text-sm text-gray-400 italic">0.00 (inhabilitado)</span>
          </div>
        </Seccion>

        {/* Casillas 20–23: Otros */}
        <Seccion titulo="Casillas 20–23 — Otros Impuestos y Pago">
          <Campo label="C.20 — ISC">
            <input type="number" step="0.01" min="0" value={form.isc} onChange={e => set('isc', e.target.value)} className={inputCls} />
          </Campo>
          <Campo label="C.21 — Otros Impuestos">
            <input type="number" step="0.01" min="0" value={form.otrosImpuestos} onChange={e => set('otrosImpuestos', e.target.value)} className={inputCls} />
          </Campo>
          <Campo label="C.22 — Propina Legal">
            <input type="number" step="0.01" min="0" value={form.propinaLegal} onChange={e => set('propinaLegal', e.target.value)} className={inputCls} />
          </Campo>
          <Campo label="C.23 — Forma de Pago">
            <select value={form.formaPago} onChange={e => set('formaPago', e.target.value)} className={inputCls}>
              {Object.entries(ETIQUETAS_FORMA_PAGO).map(([k, v]) => (
                <option key={k} value={k}>{k} — {v}</option>
              ))}
            </select>
          </Campo>
        </Seccion>
      </div>

      {/* Concepto */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Concepto Personalizado</h3>
        </div>
        <div className="px-4 py-3">
          <input
            value={form.conceptoPersonalizado}
            onChange={e => set('conceptoPersonalizado', e.target.value)}
            placeholder="Descripción libre del comprobante (opcional)"
            maxLength={200}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex justify-between items-center pt-2">
        <Link href={`/dashboard/registro/${id}`} className="text-sm text-gray-500 hover:text-gray-700">
          Cancelar y volver al detalle
        </Link>
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition"
        >
          {guardando ? 'Guardando…' : 'Guardar Cambios'}
        </button>
      </div>
    </div>
  );
}

const inputCls = 'w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">{titulo}</h3>
      </div>
      <div className="px-4 py-3 space-y-3">{children}</div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

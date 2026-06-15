'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Registro606, EstadoRegistro, RegimenITBIS, Cliente } from '@/types';
import { AlertasValidacion } from '@/components/AlertasValidacion';
import { IngestaService } from '@/services/IngestaService';
import {
  formatearMoneda, formatearFechaDGII, etiquetaEstado,
  etiquetaFormaPago, etiquetaTipoBien, formatearFechaISO
} from '@/utils/formatters';

const supabase = createClient();

export default function DetalleRegistroPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [registro, setRegistro] = useState<Registro606 | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [cargando, setCargando] = useState(true);
  const [eliminando, setEliminando] = useState(false);
  const [validacionActual, setValidacionActual] = useState<import('@/types').ResultadoValidacion | null>(null);

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
        fechaValidacion: data.fecha_validacion ? new Date(data.fecha_validacion) : undefined,
        origenIngesta: data.origen_ingesta,
        esSegundoEnvio: Boolean(data.es_segundo_envio),
        idRegistroOriginal: data.id_registro_original,
      };
      setRegistro(reg);

      // Cargar cliente
      const { data: clienteData } = await supabase.from('clientes').select('*').eq('id', data.id_cliente).single();
      if (clienteData) {
        const cl: Cliente = {
          id: clienteData.id,
          razonSocial: clienteData.razon_social,
          rncCedula: clienteData.rnc_cedula,
          regimenITBIS: clienteData.regimen_itbis as RegimenITBIS,
          fechaCreacion: new Date(clienteData.fecha_creacion),
          fechaActualizacion: new Date(clienteData.fecha_actualizacion),
          activo: clienteData.activo,
        };
        setCliente(cl);

        // Re-validar
        const svc = new IngestaService();
        const validacion = await svc.validarRegistroFiscal(reg, { cliente: cl });
        setValidacionActual(validacion);
      }
      setCargando(false);
    }
    cargar();
  }, [id]);

  const handleEliminar = async () => {
    if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
    setEliminando(true);
    const { error } = await supabase.from('registros_606').delete().eq('id', id);
    if (!error) router.push('/dashboard/registros');
    setEliminando(false);
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

  if (!registro) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Registro no encontrado.</p>
        <Link href="/dashboard/registros" className="text-blue-600 hover:underline text-sm">Volver al listado</Link>
      </div>
    );
  }

  const badge = etiquetaEstado(registro.estado);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/registros" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-2">
            ← Volver al listado
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Detalle del Registro</h1>
          <p className="text-sm text-gray-500 mt-1 font-mono">{registro.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.color}`}>{badge.label}</span>
          {registro.estado !== EstadoRegistro.REPORTADO && (
            <Link href={`/dashboard/registro/${registro.id}/editar`}
              className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium border border-gray-200 transition">
              Editar
            </Link>
          )}
          <button onClick={handleEliminar} disabled={eliminando || registro.estado === EstadoRegistro.REPORTADO}
            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium border border-red-200 disabled:opacity-40 transition">
            {eliminando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>

      {/* Validación */}
      {validacionActual && <AlertasValidacion validacion={validacionActual} />}

      {/* Errores guardados */}
      {registro.erroresValidacion && registro.erroresValidacion.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs font-semibold text-red-700 mb-1">Errores registrados en validación:</p>
          <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
            {registro.erroresValidacion.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Identificación */}
        <Seccion titulo="Identificación del Proveedor">
          <Campo label="Casilla 1 — RNC / Cédula" valor={registro.rncCedula} mono />
          <Campo label="Casilla 2 — Tipo ID" valor={registro.tipoID === 1 ? '1 - RNC' : '2 - Cédula'} />
          <Campo label="Casilla 3 — Tipo Bien/Servicio" valor={`${registro.tipoBienServicio} - ${etiquetaTipoBien(registro.tipoBienServicio)}`} />
        </Seccion>

        {/* Comprobante */}
        <Seccion titulo="Comprobante">
          <Campo label="Casilla 4 — NCF" valor={registro.ncf} mono />
          {registro.ncfModificado && <Campo label="Casilla 5 — NCF Modificado" valor={registro.ncfModificado} mono />}
          <Campo label="Casilla 6 — Fecha Comprobante" valor={formatearFechaDGII(registro.fechaComprobante)} />
          {registro.fechaPago && <Campo label="Casilla 7 — Fecha Pago" valor={formatearFechaDGII(registro.fechaPago)} />}
        </Seccion>

        {/* Montos */}
        <Seccion titulo="Montos (Casillas 8–10)">
          <Campo label="Casilla 8 — Servicios" valor={formatearMoneda(registro.montoServicios)} />
          <Campo label="Casilla 9 — Bienes" valor={formatearMoneda(registro.montoBienes)} />
          <Campo label="Casilla 10 — Total Facturado" valor={formatearMoneda(registro.totalFacturado)} destaque />
        </Seccion>

        {/* ITBIS */}
        <Seccion titulo="ITBIS (Casillas 11–16)">
          <Campo label="C.11 — ITBIS Facturado" valor={formatearMoneda(registro.itbisFacturado)} />
          <Campo label="C.12 — ITBIS Retenido" valor={formatearMoneda(registro.itbisRetenido)} />
          <Campo label="C.13 — ITBIS Proporcional" valor={formatearMoneda(registro.itbisProporcional)} />
          <Campo label="C.14 — ITBIS al Costo" valor={formatearMoneda(registro.itbisCosto)} />
          <Campo label="C.15 — ITBIS a Adelantar" valor={formatearMoneda(registro.itbisAdelantar)} />
          <Campo label="C.16 — ITBIS Percibido" valor="0.00 (inhabilitado)" gris />
        </Seccion>

        {/* Retenciones ISR */}
        <Seccion titulo="Retención ISR (Casillas 17–19)">
          <Campo label="C.17 — Tipo Retención ISR" valor={registro.tipoRetencionISR ?? 'Sin retención'} />
          <Campo label="C.18 — Monto Retención ISR" valor={formatearMoneda(registro.montoRetencionISR)} />
          <Campo label="C.19 — ISR Percibido" valor="0.00 (inhabilitado)" gris />
        </Seccion>

        {/* Otros impuestos */}
        <Seccion titulo="Otros Impuestos y Forma de Pago">
          <Campo label="C.20 — ISC" valor={formatearMoneda(registro.isc)} />
          <Campo label="C.21 — Otros Impuestos" valor={formatearMoneda(registro.otrosImpuestos)} />
          <Campo label="C.22 — Propina Legal" valor={formatearMoneda(registro.propinaLegal)} />
          <Campo label="C.23 — Forma de Pago" valor={`${registro.formaPago} - ${etiquetaFormaPago(registro.formaPago)}`} destaque />
        </Seccion>
      </div>

      {/* Metadata */}
      <Seccion titulo="Metadatos y Trazabilidad">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-2">
          <Campo label="Estado" valor={badge.label} />
          <Campo label="Origen" valor={registro.origenIngesta ?? 'MANUAL'} />
          <Campo label="Segundo Envío" valor={registro.esSegundoEnvio ? 'Sí' : 'No'} />
          <Campo label="Fecha Creación" valor={formatearFechaISO(registro.fechaCreacion)} />
          <Campo label="Fecha Actualización" valor={formatearFechaISO(registro.fechaActualizacion)} />
          {registro.fechaValidacion && <Campo label="Fecha Validación" valor={formatearFechaISO(registro.fechaValidacion)} />}
          {registro.conceptoPersonalizado && <Campo label="Concepto" valor={registro.conceptoPersonalizado} className="col-span-2" />}
          {cliente && <Campo label="Cliente" valor={`${cliente.razonSocial} (${cliente.regimenITBIS})`} className="col-span-2" />}
        </div>
      </Seccion>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">{titulo}</h3>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function Campo({ label, valor, mono, destaque, gris, className = '' }: {
  label: string; valor: string; mono?: boolean; destaque?: boolean; gris?: boolean; className?: string;
}) {
  return (
    <div className={`flex justify-between items-baseline gap-2 ${className}`}>
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className={`text-sm text-right ${mono ? 'font-mono' : ''} ${destaque ? 'font-semibold text-gray-900' : ''} ${gris ? 'text-gray-400 italic' : 'text-gray-800'}`}>
        {valor}
      </span>
    </div>
  );
}

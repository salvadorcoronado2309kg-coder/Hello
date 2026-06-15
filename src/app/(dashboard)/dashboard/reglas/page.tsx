'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { ETIQUETAS_TIPO_BIEN_SERVICIO, ETIQUETAS_FORMA_PAGO } from '@/types';

const supabase = createClient();

interface ReglaRow {
  id: string;
  id_cliente: string;
  rnc_proveedor: string;
  tipo_bien_servicio_defecto: string;
  forma_pago_defecto: string;
  tipo_retencion_isr_defecto: string | null;
  concepto_defecto: string | null;
  fecha_creacion: string;
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

const FORM_INICIAL = {
  rnc_proveedor: '',
  tipo_bien_servicio_defecto: '05',
  forma_pago_defecto: '02',
  tipo_retencion_isr_defecto: '',
  concepto_defecto: '',
};

export default function ReglasPage() {
  const [reglas, setReglas] = useState<ReglaRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [idCliente, setIdCliente] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setCargando(false); return; }
    setIdCliente(userData.user.id);
    const { data } = await supabase
      .from('reglas_categorizacion')
      .select('*')
      .eq('id_cliente', userData.user.id)
      .order('rnc_proveedor');
    setReglas((data as ReglaRow[]) ?? []);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idCliente) return;
    setGuardando(true);
    setError('');
    const payload: Record<string, string> = {
      id_cliente: idCliente,
      rnc_proveedor: form.rnc_proveedor.replace(/\D/g, ''),
      tipo_bien_servicio_defecto: form.tipo_bien_servicio_defecto,
      forma_pago_defecto: form.forma_pago_defecto,
    };
    if (form.tipo_retencion_isr_defecto) payload.tipo_retencion_isr_defecto = form.tipo_retencion_isr_defecto;
    if (form.concepto_defecto.trim()) payload.concepto_defecto = form.concepto_defecto.trim();

    const { error: err } = await supabase.from('reglas_categorizacion').insert(payload);
    if (err) {
      if (err.code === '23505') setError('Ya existe una regla para ese RNC/Cédula en este cliente.');
      else setError(err.message);
      setGuardando(false);
      return;
    }
    setForm(FORM_INICIAL);
    setMostrarForm(false);
    await cargar();
    setGuardando(false);
  };

  const handleEliminar = async (id: string) => {
    if (!confirm('¿Eliminar esta regla de categorización?')) return;
    await supabase.from('reglas_categorizacion').delete().eq('id', id);
    await cargar();
  };

  const reglasFiltradas = reglas.filter(r =>
    r.rnc_proveedor.includes(busqueda) ||
    (r.concepto_defecto ?? '').toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reglas de Categorización</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enseña al sistema a pre-clasificar comprobantes por RNC/Cédula del proveedor
          </p>
        </div>
        <button
          onClick={() => { setMostrarForm(!mostrarForm); setError(''); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
        >
          + Nueva Regla
        </button>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex gap-3">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          Cuando el sistema encuentre un comprobante del RNC registrado aquí, aplicará automáticamente
          el Tipo de Bien/Servicio, Forma de Pago e ISR indicados. Ahorra tiempo en la captura manual.
        </span>
      </div>

      {/* Formulario nueva regla */}
      {mostrarForm && (
        <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Nueva Regla de Categorización</h2>
          <form onSubmit={handleCrear} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  RNC / Cédula del Proveedor <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.rnc_proveedor}
                  onChange={e => setForm(f => ({ ...f, rnc_proveedor: e.target.value.replace(/\D/g, '') }))}
                  placeholder="Ej: 101234567"
                  maxLength={11}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">9 dígitos = RNC · 11 dígitos = Cédula</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Concepto / Nombre proveedor (opcional)
                </label>
                <input
                  value={form.concepto_defecto}
                  onChange={e => setForm(f => ({ ...f, concepto_defecto: e.target.value }))}
                  placeholder="Ej: CLARO DOMINICANA"
                  maxLength={80}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Tipo de Bien/Servicio por defecto
                </label>
                <select
                  value={form.tipo_bien_servicio_defecto}
                  onChange={e => setForm(f => ({ ...f, tipo_bien_servicio_defecto: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(ETIQUETAS_TIPO_BIEN_SERVICIO).map(([k, v]) => (
                    <option key={k} value={k}>{k} — {v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Forma de Pago por defecto
                </label>
                <select
                  value={form.forma_pago_defecto}
                  onChange={e => setForm(f => ({ ...f, forma_pago_defecto: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(ETIQUETAS_FORMA_PAGO).map(([k, v]) => (
                    <option key={k} value={k}>{k} — {v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Tipo Retención ISR (opcional)
                </label>
                <select
                  value={form.tipo_retencion_isr_defecto}
                  onChange={e => setForm(f => ({ ...f, tipo_retencion_isr_defecto: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sin retención ISR</option>
                  {Object.entries(TIPO_RETENCION_ISR).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={guardando}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition"
              >
                {guardando ? 'Guardando…' : 'Guardar Regla'}
              </button>
              <button
                type="button"
                onClick={() => { setMostrarForm(false); setError(''); }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Búsqueda */}
      {reglas.length > 0 && (
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por RNC o concepto…"
            className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['RNC / Cédula', 'Concepto / Proveedor', 'Tipo Bien/Servicio', 'Forma de Pago', 'ISR', 'Alta', ''].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : reglasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">
                  {reglas.length === 0
                    ? 'No hay reglas configuradas. Añade una para acelerar la clasificación.'
                    : 'Sin resultados para la búsqueda.'}
                </td>
              </tr>
            ) : reglasFiltradas.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-gray-700">{r.rnc_proveedor}</td>
                <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">
                  {r.concepto_defecto ?? <span className="text-gray-400 italic">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                    {r.tipo_bien_servicio_defecto} — {ETIQUETAS_TIPO_BIEN_SERVICIO[r.tipo_bien_servicio_defecto] ?? r.tipo_bien_servicio_defecto}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {r.forma_pago_defecto} — {ETIQUETAS_FORMA_PAGO[r.forma_pago_defecto] ?? r.forma_pago_defecto}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {r.tipo_retencion_isr_defecto
                    ? <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">{r.tipo_retencion_isr_defecto}</span>
                    : <span className="text-gray-400">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(r.fecha_creacion).toLocaleDateString('es-DO')}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleEliminar(r.id)}
                    className="text-xs text-red-500 hover:text-red-700 transition"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer counter */}
        {!cargando && reglas.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            {reglasFiltradas.length} de {reglas.length} regla{reglas.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

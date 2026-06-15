'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { RegimenITBIS } from '@/types';
import { etiquetaRegimen } from '@/utils/formatters';

const supabase = createClient();

interface ClienteRow {
  id: string;
  razon_social: string;
  rnc_cedula: string;
  regimen_itbis: string;
  fecha_creacion: string;
  activo: boolean;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState({ razon_social: '', rnc_cedula: '', regimen_itbis: 'GRAVADO_TOTAL' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase.from('clientes').select('*').order('razon_social');
    setClientes((data as ClienteRow[]) ?? []);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    const { error: err } = await supabase.from('clientes').insert({
      razon_social: form.razon_social,
      rnc_cedula: form.rnc_cedula,
      regimen_itbis: form.regimen_itbis,
    });
    if (err) { setError(err.message); setGuardando(false); return; }
    setForm({ razon_social: '', rnc_cedula: '', regimen_itbis: 'GRAVADO_TOTAL' });
    setMostrarForm(false);
    await cargar();
    setGuardando(false);
  };

  const handleToggleActivo = async (id: string, activo: boolean) => {
    await supabase.from('clientes').update({ activo: !activo }).eq('id', id);
    await cargar();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de clientes multi-tenant</p>
        </div>
        <button onClick={() => setMostrarForm(!mostrarForm)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition">
          + Nuevo Cliente
        </button>
      </div>

      {/* Formulario nuevo cliente */}
      {mostrarForm && (
        <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Nuevo Cliente</h2>
          <form onSubmit={handleCrear} className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Razón Social</label>
                <input required value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))}
                  placeholder="Ej: PAPELERÍA EL ESTUDIANTE SRL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">RNC / Cédula</label>
                <input required value={form.rnc_cedula} onChange={e => setForm(f => ({ ...f, rnc_cedula: e.target.value.replace(/\D/g, '') }))}
                  placeholder="101234567" maxLength={11}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Régimen ITBIS</label>
              <select value={form.regimen_itbis} onChange={e => setForm(f => ({ ...f, regimen_itbis: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="GRAVADO_TOTAL">GRAVADO_TOTAL — Comercio gravado (retail, papelería)</option>
                <option value="EXENTO">EXENTO — Sin IVA (hospitales, servicios médicos)</option>
                <option value="PROPORCIONAL">PROPORCIONAL — Insumos comunes (mixto)</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={guardando}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Crear Cliente'}
              </button>
              <button type="button" onClick={() => setMostrarForm(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Razón Social', 'RNC / Cédula', 'Régimen ITBIS', 'Fecha Alta', 'Estado', 'Acciones'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-600 px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cargando ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : clientes.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No hay clientes registrados</td></tr>
            ) : clientes.map(c => {
              const reg = etiquetaRegimen(c.regimen_itbis as RegimenITBIS);
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.razon_social}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">{c.rnc_cedula}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${reg.color}`}>{reg.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(c.fecha_creacion).toLocaleDateString('es-DO')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    <Link href={`/dashboard/registros?cliente=${c.id}`}
                      className="text-xs text-blue-600 hover:underline">Ver registros</Link>
                    <button onClick={() => handleToggleActivo(c.id, c.activo)}
                      className="text-xs text-gray-500 hover:text-gray-700">
                      {c.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

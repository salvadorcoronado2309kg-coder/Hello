'use client';

import { useState } from 'react';

// Columnas esperadas en el CSV (las genera la app de práctica contable):
// rnc,ncf,tipo_bien,fecha,concepto,monto,itbis
const COLUMNAS = ['rnc', 'ncf', 'tipo_bien', 'fecha', 'concepto', 'monto', 'itbis'];

interface Omitido { linea: number; motivo: string }

function parseCSV(texto: string): Record<string, string>[] {
  const lineas = texto.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
  if (lineas.length < 2) return [];
  const cab = lineas[0].split(',').map(c => c.trim().toLowerCase());
  return lineas.slice(1).map(l => {
    // separa por comas respetando comillas simples
    const celdas: string[] = [];
    let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { celdas.push(cur); cur = ''; continue; }
      cur += ch;
    }
    celdas.push(cur);
    const fila: Record<string, string> = {};
    cab.forEach((c, i) => { fila[c] = (celdas[i] ?? '').trim(); });
    return fila;
  });
}

export default function ImportarPage() {
  const [filas, setFilas] = useState<Record<string, string>[]>([]);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ insertados: number; omitidos: Omitido[] } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function leerArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null); setResultado(null); setFilas([]);
    const f = e.target.files?.[0];
    if (!f) return;
    setNombre(f.name);
    const texto = await f.text();
    const faltan = COLUMNAS.filter(c => !texto.split('\n')[0].toLowerCase().includes(c));
    if (faltan.length) { setError(`Faltan columnas: ${faltan.join(', ')}`); return; }
    const datos = parseCSV(texto);
    if (!datos.length) { setError('El archivo no tiene filas.'); return; }
    setFilas(datos);
  }

  async function importar() {
    setEnviando(true); setError(null);
    try {
      const res = await fetch('/api/importar/606', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ filas }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error ?? 'No se pudo importar.'); return; }
      setResultado(body);
    } catch {
      setError('Sin conexión con el servidor. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Importar compras</h1>
        <p className="text-sm text-gray-500">
          Sube el CSV que descargas desde la app de práctica contable. Las filas quedan como
          <strong> pendientes</strong> para que las revises antes de presentar el 606.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <label className="block text-sm font-medium">Archivo CSV</label>
        <input type="file" accept=".csv,text/csv" onChange={leerArchivo} className="text-sm" />
        <p className="text-xs text-gray-500">
          Columnas: {COLUMNAS.join(', ')}. La fecha va como AAAA-MM-DD y los montos sin separador de miles.
        </p>
        {nombre && !error && filas.length > 0 && (
          <p className="text-sm">{nombre}: <strong>{filas.length}</strong> filas listas para importar.</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={importar}
          disabled={!filas.length || enviando}
          className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-40"
        >
          {enviando ? 'Importando…' : 'Importar al 606'}
        </button>
      </div>

      {resultado && (
        <div className="rounded-lg border p-4 space-y-3">
          <p className="font-medium">Importadas: {resultado.insertados} · Omitidas: {resultado.omitidos.length}</p>
          {resultado.omitidos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b"><th className="py-1">Línea</th><th>Motivo</th></tr>
                </thead>
                <tbody>
                  {resultado.omitidos.map(o => (
                    <tr key={o.linea} className="border-b"><td className="py-1">{o.linea}</td><td>{o.motivo}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

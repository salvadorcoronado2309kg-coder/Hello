import { NextRequest, NextResponse } from 'next/server';
import getDB from '@/lib/db';
import { getSessionUserFromRequest } from '@/lib/auth';

// Recibe filas del "Libro de compras" de la app de práctica contable y crea registros 606 en borrador.
// Cada fila: { rnc, ncf, tipo_bien, fecha (AAAAMMDD o AAAA-MM-DD), concepto, monto, itbis }
// Las filas incompletas no se insertan: se devuelven con el motivo.

const MAX_ROWS = 2000;
const TIPOS_BIEN = new Set(['01','02','03','04','05','06','07','08','09','10','11']);
const BIENES = new Set(['04','09','10']); // bienes; el resto se registra como servicios. Revisar con contador

type Fila = Record<string, unknown>;

function validar(f: Fila, i: number): { ok: true; reg: Record<string, unknown> } | { ok: false; linea: number; motivo: string } {
  const linea = i + 1;
  const rnc = String(f.rnc ?? '').replace(/\D/g, '');
  const ncf = String(f.ncf ?? '').trim().toUpperCase();
  const tipo = String(f.tipo_bien ?? '').padStart(2, '0');
  const fechaRaw = String(f.fecha ?? '').replace(/-/g, '');
  const monto = Number(f.monto ?? 0);
  const itbis = Number(f.itbis ?? 0);

  if (rnc && rnc.length !== 9 && rnc.length !== 11) return { ok: false, linea, motivo: 'RNC/cédula inválido' };
  if (!rnc) return { ok: false, linea, motivo: 'Falta RNC o cédula del proveedor' };
  if (!/^[BE]\d{10,12}$/.test(ncf)) return { ok: false, linea, motivo: 'NCF inválido' };
  if (!TIPOS_BIEN.has(tipo)) return { ok: false, linea, motivo: 'Tipo de bien o servicio faltante o inválido' };
  if (!/^\d{8}$/.test(fechaRaw)) return { ok: false, linea, motivo: 'Fecha inválida (use AAAA-MM-DD)' };
  if (!Number.isFinite(monto) || monto < 0) return { ok: false, linea, motivo: 'Monto inválido' };
  if (!Number.isFinite(itbis) || itbis < 0) return { ok: false, linea, motivo: 'ITBIS inválido' };

  const bienes = BIENES.has(tipo);
  return {
    ok: true,
    reg: {
      rnc_cedula: rnc,
      tipo_id: rnc.length === 9 ? 1 : 2,
      tipo_bien_servicio: tipo,
      ncf,
      fecha_comprobante: fechaRaw,
      monto_servicios: bienes ? 0 : monto,
      monto_bienes: bienes ? monto : 0,
      itbis_facturado: itbis,
      concepto_personalizado: String(f.concepto ?? '').slice(0, 200),
      estado: 'pendiente',
      origen_ingesta: 'app-practica',
    },
  };
}

export async function POST(req: NextRequest) {
  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = getDB();
  const cliente = db.prepare('SELECT id FROM clientes WHERE user_id = ?').get(user.userId) as { id: string } | undefined;
  if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado para este usuario' }, { status: 400 });

  const body = await req.json().catch(() => null) as { filas?: unknown } | null;
  if (!body || !Array.isArray(body.filas)) return NextResponse.json({ error: 'Se esperaba { filas: [...] }' }, { status: 400 });
  if (body.filas.length > MAX_ROWS) return NextResponse.json({ error: `Máximo ${MAX_ROWS} filas por importación` }, { status: 400 });

  const omitidos: { linea: number; motivo: string }[] = [];
  const validas: Record<string, unknown>[] = [];
  (body.filas as Fila[]).forEach((f, i) => {
    const r = validar(f ?? {}, i);
    if (r.ok) validas.push(r.reg); else omitidos.push({ linea: r.linea, motivo: r.motivo });
  });

  const insertar = db.prepare(`INSERT INTO registros_606
    (id, id_cliente, rnc_cedula, tipo_id, tipo_bien_servicio, ncf, fecha_comprobante,
     monto_servicios, monto_bienes, itbis_facturado, concepto_personalizado, estado, origen_ingesta,
     fecha_creacion, fecha_actualizacion)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const ahora = new Date().toISOString();

  // Todo o nada: si una fila choca (por ejemplo NCF repetido), no se inserta ninguna.
  try {
    db.transaction(() => {
      for (const r of validas) {
        insertar.run(
          crypto.randomUUID(), cliente.id, r.rnc_cedula, r.tipo_id, r.tipo_bien_servicio, r.ncf,
          r.fecha_comprobante, r.monto_servicios, r.monto_bienes, r.itbis_facturado,
          r.concepto_personalizado, r.estado, r.origen_ingesta, ahora, ahora,
        );
      }
    })();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    return NextResponse.json({ error: 'No se importó nada: ' + msg }, { status: 400 });
  }

  return NextResponse.json({ insertados: validas.length, omitidos }, { status: 201 });
}

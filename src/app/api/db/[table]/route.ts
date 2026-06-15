import { NextRequest, NextResponse } from 'next/server';
import getDB, { deserializeRow, serializeValue } from '@/lib/db';
import { getSessionUserFromRequest } from '@/lib/auth';

const ALLOWED = new Set([
  'clientes', 'registros_606', 'reglas_categorizacion',
  'auditoria_registros', 'exportaciones_606',
]);

const HAS_CLIENTE_FK = new Set([
  'registros_606', 'reglas_categorizacion', 'auditoria_registros', 'exportaciones_606',
]);

type Params = Promise<{ table: string }>;

async function getClienteId(userId: string): Promise<string | null> {
  const db = getDB();
  const row = db.prepare('SELECT id FROM clientes WHERE user_id = ?').get(userId) as { id: string } | undefined;
  return row?.id ?? null;
}

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const { table } = await params;
  if (!ALLOWED.has(table)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clienteId = await getClienteId(user.userId);

  const url = new URL(req.url);
  const sp = url.searchParams;

  // Build WHERE
  const whereParts: string[] = [];
  const whereVals: unknown[] = [];

  // Security: scope by ownership
  if (table === 'clientes') {
    whereParts.push('user_id = ?');
    whereVals.push(user.userId);
  } else if (HAS_CLIENTE_FK.has(table) && clienteId) {
    whereParts.push('id_cliente = ?');
    whereVals.push(clienteId);
  }

  for (const [key, val] of sp.entries()) {
    if (key.startsWith('_')) continue;
    if (key === 'id_cliente') continue; // already injected above
    if (key.endsWith(':like')) {
      whereParts.push(`${key.slice(0, -5)} LIKE ?`);
      whereVals.push(val);
    } else if (key.endsWith(':gte')) {
      whereParts.push(`${key.slice(0, -4)} >= ?`);
      whereVals.push(val);
    } else if (key.endsWith(':lte')) {
      whereParts.push(`${key.slice(0, -4)} <= ?`);
      whereVals.push(val);
    } else {
      whereParts.push(`${key} = ?`);
      whereVals.push(val);
    }
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const order = sp.get('_order') ? `ORDER BY ${sp.get('_order')} ${sp.get('_desc') === '1' ? 'DESC' : 'ASC'}` : '';
  const isSingle = sp.get('_single') === '1';
  const needCount = sp.get('_count') === '1';

  const selectCols = table === 'registros_606'
    ? '*, (monto_servicios + monto_bienes) as total_facturado'
    : '*';

  const db = getDB();

  if (isSingle) {
    const row = db.prepare(`SELECT ${selectCols} FROM ${table} ${where} LIMIT 1`).get(...whereVals);
    if (!row) return NextResponse.json({ data: null, error: { message: 'Not found' } }, { status: 404 });
    return NextResponse.json({ data: deserializeRow(row as Record<string, unknown>, table), error: null });
  }

  const rangeStr = sp.get('_range');
  let limit = parseInt(sp.get('_limit') || '100');
  let offset = 0;
  if (rangeStr) {
    const [from, to] = rangeStr.split(',').map(Number);
    offset = from;
    limit = to - from + 1;
  }

  let count: number | undefined;
  if (needCount) {
    const cr = db.prepare(`SELECT COUNT(*) as n FROM ${table} ${where}`).get(...whereVals) as { n: number };
    count = cr.n;
  }

  const rows = db.prepare(`SELECT ${selectCols} FROM ${table} ${where} ${order} LIMIT ? OFFSET ?`)
    .all(...whereVals, limit, offset);

  return NextResponse.json({
    data: rows.map(r => deserializeRow(r as Record<string, unknown>, table)),
    error: null,
    count,
  });
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { table } = await params;
  if (!ALLOWED.has(table)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = getDB();

  // Inject ownership
  if (table === 'clientes') body.user_id = user.userId;
  if (HAS_CLIENTE_FK.has(table)) {
    const clienteId = await getClienteId(user.userId);
    if (!clienteId && table !== 'auditoria_registros') {
      return NextResponse.json({ error: 'Cliente no encontrado para este usuario' }, { status: 400 });
    }
    if (clienteId) body.id_cliente = body.id_cliente || clienteId;
  }

  const id = body.id || crypto.randomUUID();
  body.id = id;

  const cols = Object.keys(body);
  const placeholders = cols.map(() => '?').join(', ');
  const vals = cols.map(c => serializeValue(body[c]));

  try {
    db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...vals);
    const inserted = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
    return NextResponse.json({ data: deserializeRow(inserted as Record<string, unknown>, table), error: null }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    const code = msg.includes('UNIQUE') ? '23505' : undefined;
    return NextResponse.json({ error: msg, code }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const { table } = await params;
  if (!ALLOWED.has(table)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const body = await req.json();
  // Remove fields that shouldn't be updated
  delete body.id;
  delete body.id_cliente;
  delete body.user_id;

  const db = getDB();
  const setCols = Object.keys(body).map(k => `${k} = ?`).join(', ');
  const setVals = Object.values(body).map(v => serializeValue(v));

  db.prepare(`UPDATE ${table} SET ${setCols} WHERE id = ?`).run(...setVals, id);
  const updated = db.prepare(`SELECT *, (monto_servicios + monto_bienes) as total_facturado FROM ${table} WHERE id = ?`).get(id);
  return NextResponse.json({ data: updated ? deserializeRow(updated as Record<string, unknown>, table) : null, error: null });
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const { table } = await params;
  if (!ALLOWED.has(table)) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const user = await getSessionUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

  const db = getDB();
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  return NextResponse.json({ data: null, error: null });
}

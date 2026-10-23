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

const IDENT = /^[a-z_][a-z0-9_]*$/i;
const MAX_LIMIT = 1000;

type Params = Promise<{ table: string }>;
type Scope = { sql: string; vals: string[] };

// Columnas reales de la tabla (desde SQLite). Nada que no esté aquí llega al SQL.
const colCache = new Map<string, Set<string>>();
function columnas(table: string): Set<string> {
  const hit = colCache.get(table);
  if (hit) return hit;
  const rows = getDB().prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  const set = new Set(rows.map(r => r.name));
  colCache.set(table, set);
  return set;
}
function colOk(table: string, col: string): boolean {
  return IDENT.test(col) && columnas(table).has(col);
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ data: null, error: { message: msg } }, { status });
}

async function getClienteId(userId: string): Promise<string | null> {
  const row = getDB().prepare('SELECT id FROM clientes WHERE user_id = ?').get(userId) as { id: string } | undefined;
  return row?.id ?? null;
}

// Alcance fijo del usuario: nunca viene del cliente.
async function scopeFor(table: string, userId: string): Promise<Scope | null> {
  if (table === 'clientes') return { sql: 'user_id = ?', vals: [userId] };
  const cid = await getClienteId(userId);
  if (!cid) return null;
  return { sql: 'id_cliente = ?', vals: [cid] };
}

async function authorize(req: NextRequest, params: Params) {
  const { table } = await params;
  if (!ALLOWED.has(table)) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) } as const;
  const user = await getSessionUserFromRequest(req);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  const scope = await scopeFor(table, user.userId);
  if (!scope) return { error: bad('Cliente no encontrado para este usuario') } as const;
  return { table, user, scope } as const;
}

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const auth = await authorize(req, params);
  if ('error' in auth) return auth.error;
  const { table, scope } = auth;

  const sp = new URL(req.url).searchParams;
  const whereParts: string[] = [scope.sql];
  const whereVals: unknown[] = [...scope.vals];

  for (const [key, val] of sp.entries()) {
    if (key.startsWith('_')) continue;
    let col = key;
    let op = '=';
    if (key.endsWith(':like')) { col = key.slice(0, -5); op = 'LIKE'; }
    else if (key.endsWith(':gte')) { col = key.slice(0, -4); op = '>='; }
    else if (key.endsWith(':lte')) { col = key.slice(0, -4); op = '<='; }
    if (!colOk(table, col)) return bad(`Columna no válida: ${col}`);
    if (col === 'id_cliente' || col === 'user_id') continue; // el alcance lo fija la sesión
    whereParts.push(`${col} ${op} ?`);
    whereVals.push(val);
  }

  let order = '';
  const orderCol = sp.get('_order');
  if (orderCol) {
    if (!colOk(table, orderCol)) return bad(`Columna de orden no válida: ${orderCol}`);
    order = `ORDER BY ${orderCol} ${sp.get('_desc') === '1' ? 'DESC' : 'ASC'}`;
  }

  const where = `WHERE ${whereParts.join(' AND ')}`;
  const selectCols = table === 'registros_606'
    ? '*, (monto_servicios + monto_bienes) as total_facturado'
    : '*';
  const db = getDB();

  if (sp.get('_single') === '1') {
    const row = db.prepare(`SELECT ${selectCols} FROM ${table} ${where} LIMIT 1`).get(...(whereVals as never[]));
    if (!row) return NextResponse.json({ data: null, error: { message: 'Not found' } }, { status: 404 });
    return NextResponse.json({ data: deserializeRow(row as Record<string, unknown>, table), error: null });
  }

  let limit = Math.min(Math.max(parseInt(sp.get('_limit') || '100', 10) || 100, 1), MAX_LIMIT);
  let offset = 0;
  const rangeStr = sp.get('_range');
  if (rangeStr) {
    const [from, to] = rangeStr.split(',').map(Number);
    if (Number.isFinite(from) && Number.isFinite(to) && to >= from) {
      offset = Math.max(0, from);
      limit = Math.min(to - from + 1, MAX_LIMIT);
    }
  }

  let count: number | undefined;
  if (sp.get('_count') === '1') {
    const cr = db.prepare(`SELECT COUNT(*) as n FROM ${table} ${where}`).get(...(whereVals as never[])) as { n: number };
    count = cr.n;
  }

  const rows = db.prepare(`SELECT ${selectCols} FROM ${table} ${where} ${order} LIMIT ? OFFSET ?`)
    .all(...(whereVals as never[]), limit, offset);

  return NextResponse.json({
    data: rows.map(r => deserializeRow(r as Record<string, unknown>, table)),
    error: null,
    count,
  });
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const auth = await authorize(req, params);
  if ('error' in auth) return auth.error;
  const { table, user, scope } = auth;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Cuerpo inválido');

  for (const k of Object.keys(body)) {
    if (!colOk(table, k)) return bad(`Campo no válido: ${k}`);
  }

  // Dueño fijo: el cliente de la sesión, aunque el cuerpo traiga otro.
  const data: Record<string, unknown> = { ...body };
  if (table === 'clientes') data.user_id = user.userId;
  else if (HAS_CLIENTE_FK.has(table)) data.id_cliente = scope.vals[0];
  data.id = typeof body.id === 'string' && body.id ? body.id : crypto.randomUUID();

  const cols = Object.keys(data);
  const placeholders = cols.map(() => '?').join(', ');
  const vals = cols.map(c => serializeValue(data[c]));
  const db = getDB();

  try {
    db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`).run(...(vals as never[]));
    const inserted = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(data.id);
    return NextResponse.json({ data: deserializeRow(inserted as Record<string, unknown>, table), error: null }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error';
    const code = msg.includes('UNIQUE') ? '23505' : undefined;
    return NextResponse.json({ error: msg, code }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const auth = await authorize(req, params);
  if ('error' in auth) return auth.error;
  const { table, scope } = auth;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return bad('id requerido');

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Cuerpo inválido');
  delete body.id;
  delete body.id_cliente;
  delete body.user_id;

  const keys = Object.keys(body);
  if (!keys.length) return bad('Nada que actualizar');
  for (const k of keys) {
    if (!colOk(table, k)) return bad(`Campo no válido: ${k}`);
  }

  const db = getDB();
  const setCols = keys.map(k => `${k} = ?`).join(', ');
  const setVals = keys.map(k => serializeValue(body[k]));
  // Solo actualiza si el registro pertenece a la sesión.
  const info = db.prepare(`UPDATE ${table} SET ${setCols} WHERE id = ? AND ${scope.sql}`)
    .run(...(setVals as never[]), id, ...(scope.vals as never[]));
  if (info.changes === 0) return bad('Not found', 404);

  const updated = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  return NextResponse.json({ data: deserializeRow(updated as Record<string, unknown>, table), error: null });
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const auth = await authorize(req, params);
  if ('error' in auth) return auth.error;
  const { table, scope } = auth;

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return bad('id requerido');

  const info = getDB().prepare(`DELETE FROM ${table} WHERE id = ? AND ${scope.sql}`)
    .run(id, ...(scope.vals as never[]));
  if (info.changes === 0) return bad('Not found', 404);
  return NextResponse.json({ data: null, error: null });
}

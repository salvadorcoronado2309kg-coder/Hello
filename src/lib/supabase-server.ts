import getDB, { deserializeRow, serializeValue } from './db';
import { getSessionUser } from './auth';
import { RegimenITBIS } from '@/types';

type Row = Record<string, unknown>;
type QResult<T = any> = { data: T; error: { message: string } | null; count?: number };

class ServerQueryBuilder<T = any> {
  private _table: string;
  private _wheres: Array<{ field: string; op: string; value: unknown }> = [];
  private _orderField?: string;
  private _orderAsc = true;
  private _single = false;
  private _method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
  private _body: Row | undefined;
  private _rangeFrom = 0;
  private _rangeTo = 999999;
  private _needCount = false;

  constructor(table: string) { this._table = table; }

  select(_cols?: string, opts?: { count?: string }) {
    if (opts?.count === 'exact') this._needCount = true;
    return this;
  }
  eq(field: string, value: unknown) { this._wheres.push({ field, op: '=', value }); return this; }
  like(field: string, pattern: string) { this._wheres.push({ field, op: 'LIKE', value: pattern }); return this; }
  gte(field: string, value: unknown) { this._wheres.push({ field, op: '>=', value }); return this; }
  lte(field: string, value: unknown) { this._wheres.push({ field, op: '<=', value }); return this; }
  limit(n: number) { this._rangeTo = this._rangeFrom + n - 1; return this; }
  order(field: string, opts?: { ascending?: boolean }) {
    this._orderField = field; this._orderAsc = opts?.ascending !== false;
    return this;
  }
  range(from: number, to: number) { this._rangeFrom = from; this._rangeTo = to; return this; }
  single() { this._single = true; return this; }
  insert(data: Row | Row[]) { this._method = 'POST'; this._body = Array.isArray(data) ? data[0] : data; return this; }
  update(data: Row) { this._method = 'PATCH'; this._body = data; return this; }
  delete() { this._method = 'DELETE'; return this; }

  then<R1 = QResult<T>, R2 = never>(
    resolve?: ((v: QResult<T>) => R1 | PromiseLike<R1>) | null,
    reject?: ((e: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return Promise.resolve(this._run() as QResult<T>).then(resolve as never, reject as never);
  }

  private _run(): QResult<unknown> {
    try {
      const db = getDB();
      const t = this._table;
      const whereParts = this._wheres.map(w => `${w.field} ${w.op} ?`);
      const whereVals = this._wheres.map(w => serializeValue(w.value));
      const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
      const sel = t === 'registros_606' ? '*, (monto_servicios + monto_bienes) as total_facturado' : '*';

      if (this._method === 'GET') {
        if (this._single) {
          const row = db.prepare(`SELECT ${sel} FROM ${t} ${where} LIMIT 1`).get(...whereVals);
          if (!row) return { data: null, error: { message: 'Not found' } };
          return { data: deserializeRow(row as Row, t), error: null };
        }
        const order = this._orderField
          ? `ORDER BY ${this._orderField} ${this._orderAsc ? 'ASC' : 'DESC'}` : '';
        const limit = this._rangeTo - this._rangeFrom + 1;
        let count: number | undefined;
        if (this._needCount) {
          const cr = db.prepare(`SELECT COUNT(*) as n FROM ${t} ${where}`).get(...whereVals) as { n: number };
          count = cr.n;
        }
        const rows = db.prepare(`SELECT ${sel} FROM ${t} ${where} ${order} LIMIT ? OFFSET ?`)
          .all(...whereVals, limit, this._rangeFrom);
        return { data: rows.map(r => deserializeRow(r as Row, t)), error: null, count };
      }

      if (this._method === 'POST') {
        const id = (this._body?.id as string | undefined) || crypto.randomUUID();
        const body: Row = { ...this._body, id };
        const cols = Object.keys(body);
        const vals = cols.map(c => serializeValue(body[c]));
        db.prepare(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
        const inserted = db.prepare(`SELECT ${sel} FROM ${t} WHERE id = ?`).get(id);
        return { data: inserted ? deserializeRow(inserted as Row, t) : body, error: null };
      }

      if (this._method === 'PATCH') {
        const body = this._body!;
        const setCols = Object.keys(body).map(k => `${k} = ?`).join(', ');
        const setVals = Object.values(body).map(v => serializeValue(v));
        db.prepare(`UPDATE ${t} SET ${setCols} ${where}`).run(...setVals, ...whereVals);
        const updated = this._wheres.length
          ? db.prepare(`SELECT ${sel} FROM ${t} ${where} LIMIT 1`).get(...whereVals) : null;
        return { data: updated ? deserializeRow(updated as Row, t) : null, error: null };
      }

      if (this._method === 'DELETE') {
        db.prepare(`DELETE FROM ${t} ${where}`).run(...whereVals);
        return { data: null, error: null };
      }

      return { data: null, error: { message: 'Unknown method' } };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : 'DB error' } };
    }
  }
}

class ServerAuthClient {
  async getUser() {
    const user = await getSessionUser();
    if (!user) return { data: { user: null }, error: null };
    return { data: { user: { id: user.userId, email: user.email } }, error: null };
  }
}

class ServerClient {
  auth = new ServerAuthClient();
  from<T = any>(table: string) { return new ServerQueryBuilder<T>(table); }
}

export async function createClient() { return new ServerClient(); }

export async function getClienteForUser(userId: string) {
  const db = getDB();
  const row = db.prepare('SELECT * FROM clientes WHERE user_id = ?').get(userId) as Row | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    razonSocial: row.razon_social as string,
    rncCedula: row.rnc_cedula as string,
    regimenITBIS: row.regimen_itbis as RegimenITBIS,
    fechaCreacion: new Date(row.fecha_creacion as string),
    fechaActualizacion: new Date(row.fecha_actualizacion as string),
    activo: Boolean(row.activo),
  };
}

// Browser-side adapter — routes all calls to /api/db and /api/auth
// Keeps the same Supabase-like interface so existing components work unchanged.

type QResult<T = any> = { data: T; error: { message: string; code?: string } | null; count?: number };

class QueryBuilder<T = any> {
  private _table: string;
  private _params = new URLSearchParams();
  private _method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
  private _body: unknown = undefined;

  constructor(table: string) { this._table = table; }

  select(_cols?: string, opts?: { count?: string }) {
    if (opts?.count === 'exact') this._params.set('_count', '1');
    return this;
  }
  eq(field: string, value: unknown) { this._params.set(field, String(value)); return this; }
  like(field: string, pattern: string) { this._params.set(`${field}:like`, pattern); return this; }
  gte(field: string, value: unknown) { this._params.set(`${field}:gte`, String(value)); return this; }
  lte(field: string, value: unknown) { this._params.set(`${field}:lte`, String(value)); return this; }
  limit(n: number) { this._params.set('_limit', String(n)); return this; }
  order(field: string, opts?: { ascending?: boolean }) {
    this._params.set('_order', field);
    if (opts?.ascending === false) this._params.set('_desc', '1');
    return this;
  }
  range(from: number, to: number) { this._params.set('_range', `${from},${to}`); return this; }
  single() { this._params.set('_single', '1'); return this; }
  insert(data: unknown) { this._method = 'POST'; this._body = data; return this; }
  update(data: unknown) { this._method = 'PATCH'; this._body = data; return this; }
  delete() { this._method = 'DELETE'; return this; }

  then<R1 = QResult<T>, R2 = never>(
    resolve?: ((v: QResult<T>) => R1 | PromiseLike<R1>) | null,
    reject?: ((e: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return this._execute().then(resolve as never, reject as never);
  }

  private async _execute(): Promise<QResult<T>> {
    let url: string;
    if (this._method === 'PATCH' || this._method === 'DELETE') {
      const id = this._params.get('id');
      const p = id ? `?id=${id}` : '';
      url = `/api/db/${this._table}${p}`;
    } else {
      const qs = this._params.toString();
      url = `/api/db/${this._table}${qs ? '?' + qs : ''}`;
    }

    const res = await fetch(url, {
      method: this._method,
      credentials: 'same-origin',
      headers: this._body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: this._body !== undefined ? JSON.stringify(this._body) : undefined,
    });

    const json = await res.json();
    if (!res.ok) return { data: null as T, error: { message: json.error || 'Error', code: json.code } };
    return { data: json.data as T, error: null, count: json.count };
  }
}

class AuthClient {
  async getUser() {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    const json = await res.json();
    return { data: { user: json.user ?? null }, error: null };
  }
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const res = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: { message: json.error } };
    return { data: { user: json.user }, error: null };
  }
  async signUp({ email, password }: { email: string; password: string }) {
    const res = await fetch('/api/auth/register', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) return { data: null, error: { message: json.error } };
    return { data: { user: json.user }, error: null };
  }
  async signOut() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    return { error: null };
  }
}

class SupabaseAdapter {
  auth = new AuthClient();
  from<T = any>(table: string) { return new QueryBuilder<T>(table); }
}

export function createClient() { return new SupabaseAdapter(); }

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'form606.db');

let _db: Database.Database | null = null;

export default function getDB(): Database.Database {
  if (_db) return _db;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      razon_social TEXT NOT NULL,
      rnc_cedula TEXT NOT NULL,
      regimen_itbis TEXT NOT NULL CHECK (regimen_itbis IN ('EXENTO','GRAVADO_TOTAL','PROPORCIONAL')),
      activo INTEGER NOT NULL DEFAULT 1,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS registros_606 (
      id TEXT PRIMARY KEY,
      id_cliente TEXT NOT NULL REFERENCES clientes(id),
      rnc_cedula TEXT NOT NULL,
      tipo_id INTEGER NOT NULL DEFAULT 1,
      tipo_bien_servicio TEXT NOT NULL DEFAULT '05',
      ncf TEXT NOT NULL,
      ncf_modificado TEXT,
      fecha_comprobante TEXT NOT NULL,
      fecha_pago TEXT,
      monto_servicios REAL NOT NULL DEFAULT 0,
      monto_bienes REAL NOT NULL DEFAULT 0,
      itbis_facturado REAL NOT NULL DEFAULT 0,
      itbis_retenido REAL NOT NULL DEFAULT 0,
      itbis_proporcional REAL NOT NULL DEFAULT 0,
      itbis_costo REAL NOT NULL DEFAULT 0,
      itbis_adelantar REAL NOT NULL DEFAULT 0,
      tipo_retencion_isr TEXT,
      monto_retencion_isr REAL NOT NULL DEFAULT 0,
      isc REAL NOT NULL DEFAULT 0,
      otros_impuestos REAL NOT NULL DEFAULT 0,
      propina_legal REAL NOT NULL DEFAULT 0,
      forma_pago TEXT NOT NULL DEFAULT '02',
      concepto_personalizado TEXT,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      errores_validacion TEXT,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_validacion TEXT,
      origen_ingesta TEXT,
      documento_fuente_url TEXT,
      es_segundo_envio INTEGER NOT NULL DEFAULT 0,
      id_registro_original TEXT
    );

    CREATE TABLE IF NOT EXISTS reglas_categorizacion (
      id TEXT PRIMARY KEY,
      id_cliente TEXT NOT NULL REFERENCES clientes(id),
      rnc_proveedor TEXT NOT NULL,
      tipo_bien_servicio_defecto TEXT NOT NULL DEFAULT '05',
      forma_pago_defecto TEXT NOT NULL DEFAULT '02',
      tipo_retencion_isr_defecto TEXT,
      concepto_defecto TEXT,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_actualizacion TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(id_cliente, rnc_proveedor)
    );

    CREATE TABLE IF NOT EXISTS auditoria_registros (
      id TEXT PRIMARY KEY,
      id_registro_606 TEXT,
      id_cliente TEXT NOT NULL REFERENCES clientes(id),
      tipo_evento TEXT NOT NULL,
      descripcion TEXT,
      reglas_aplicadas TEXT,
      errores_detectados TEXT,
      usuario_id TEXT,
      ip_address TEXT,
      user_agent TEXT,
      fecha_evento TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exportaciones_606 (
      id TEXT PRIMARY KEY,
      id_cliente TEXT NOT NULL REFERENCES clientes(id),
      periodo TEXT NOT NULL,
      cantidad_registros INTEGER NOT NULL DEFAULT 0,
      suma_facturado REAL NOT NULL DEFAULT 0,
      suma_itbis_adelantar REAL NOT NULL DEFAULT 0,
      suma_itbis_costo REAL NOT NULL DEFAULT 0,
      suma_itbis_retenido REAL NOT NULL DEFAULT 0,
      suma_isr_retenido REAL NOT NULL DEFAULT 0,
      nombre_archivo TEXT NOT NULL,
      hash_md5 TEXT,
      url_descarga TEXT,
      enviado_dgii INTEGER NOT NULL DEFAULT 0,
      fecha_envio_dgii TEXT,
      confirmacion_dgii TEXT,
      fecha_creacion TEXT NOT NULL DEFAULT (datetime('now')),
      usuario_id TEXT
    );
  `);
}

export function deserializeRow(row: Record<string, unknown>, table = ''): Record<string, unknown> {
  const r = { ...row };
  const jsonFields = ['errores_validacion', 'reglas_aplicadas', 'errores_detectados'];
  for (const f of jsonFields) {
    if (typeof r[f] === 'string') {
      try { r[f] = JSON.parse(r[f] as string); } catch { /* leave as-is */ }
    }
  }
  if ('activo' in r) r.activo = Boolean(r.activo);
  if ('es_segundo_envio' in r) r.es_segundo_envio = Boolean(r.es_segundo_envio);
  if ('enviado_dgii' in r) r.enviado_dgii = Boolean(r.enviado_dgii);
  if (table === 'registros_606' && !('total_facturado' in r)) {
    r.total_facturado = (Number(r.monto_servicios) || 0) + (Number(r.monto_bienes) || 0);
  }
  return r;
}

export function serializeValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v ?? null;
}

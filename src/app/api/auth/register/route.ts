import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDB from '@/lib/db';
import { signToken, attachCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, razon_social, rnc_cedula, regimen_itbis } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }
    const db = getDB();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 409 });
    }
    const hash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const insert = db.transaction(() => {
      db.prepare('INSERT INTO users (id, email, password, created_at, updated_at) VALUES (?,?,?,?,?)')
        .run(userId, email.toLowerCase(), hash, now, now);
      if (razon_social && rnc_cedula) {
        db.prepare(
          'INSERT INTO clientes (id, user_id, razon_social, rnc_cedula, regimen_itbis, activo, fecha_creacion, fecha_actualizacion) VALUES (?,?,?,?,?,1,?,?)'
        ).run(userId, userId, razon_social, rnc_cedula, regimen_itbis || 'GRAVADO_TOTAL', now, now);
      }
    });
    insert();

    const token = await signToken({ userId, email: email.toLowerCase() });
    const res = NextResponse.json({ user: { id: userId, email: email.toLowerCase() } }, { status: 201 });
    return attachCookie(res, token);
  } catch (e) {
    console.error('Register error:', e);
    return NextResponse.json({ error: 'Error interno al registrar' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDB from '@/lib/db';
import { signToken, attachCookie } from '@/lib/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const razon_social = typeof body?.razon_social === 'string' ? body.razon_social.trim() : '';
    const rnc_cedula = typeof body?.rnc_cedula === 'string' ? body.rnc_cedula.trim() : '';
    const regimen_itbis = typeof body?.regimen_itbis === 'string' ? body.regimen_itbis : 'GRAVADO_TOTAL';

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'El correo no tiene un formato válido' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }
    if (rnc_cedula && !/^\d{9}$|^\d{11}$/.test(rnc_cedula)) {
      return NextResponse.json({ error: 'El RNC debe tener 9 dígitos o la cédula 11' }, { status: 400 });
    }

    const db = getDB();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return NextResponse.json({ error: 'Este correo ya está registrado' }, { status: 409 });
    }
    const hash = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const insert = db.transaction(() => {
      db.prepare('INSERT INTO users (id, email, password, created_at, updated_at) VALUES (?,?,?,?,?)')
        .run(userId, email, hash, now, now);
      if (razon_social && rnc_cedula) {
        db.prepare(
          'INSERT INTO clientes (id, user_id, razon_social, rnc_cedula, regimen_itbis, activo, fecha_creacion, fecha_actualizacion) VALUES (?,?,?,?,?,1,?,?)'
        ).run(userId, userId, razon_social, rnc_cedula, regimen_itbis, now, now);
      }
    });
    insert();

    const token = await signToken({ userId, email });
    const res = NextResponse.json({ user: { id: userId, email } }, { status: 201 });
    return attachCookie(res, token);
  } catch (e) {
    console.error('Register error:', e);
    return NextResponse.json({ error: 'Error interno al registrar' }, { status: 500 });
  }
}

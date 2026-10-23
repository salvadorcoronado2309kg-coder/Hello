import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDB from '@/lib/db';
import { signToken, attachCookie } from '@/lib/auth';
import { permitir, reiniciar } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    const ip = (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
    const clave = `${ip}|${email}`;
    if (!permitir(clave)) {
      return NextResponse.json({ error: 'Demasiados intentos. Espera 15 minutos.' }, { status: 429 });
    }

    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as {
      id: string; email: string; password: string;
    } | undefined;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    reiniciar(clave);
    const token = await signToken({ userId: user.id, email: user.email });
    const res = NextResponse.json({ user: { id: user.id, email: user.email } });
    return attachCookie(res, token);
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

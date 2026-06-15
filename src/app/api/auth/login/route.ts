import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDB from '@/lib/db';
import { signToken, attachCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }
    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as {
      id: string; email: string; password: string;
    } | undefined;

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }
    const token = await signToken({ userId: user.id, email: user.email });
    const res = NextResponse.json({ user: { id: user.id, email: user.email } });
    return attachCookie(res, token);
  } catch (e) {
    console.error('Login error:', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

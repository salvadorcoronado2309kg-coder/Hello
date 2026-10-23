import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// En producción JWT_SECRET es obligatorio. En desarrollo se genera una clave temporal
// por proceso, así nunca existe una clave pública conocida.
let devSecret: string | null = null;
function getSecret(): Uint8Array {
  const env = process.env.JWT_SECRET;
  if (env && env.length >= 32) return new TextEncoder().encode(env);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET no está definido o es muy corto (mínimo 32 caracteres).');
  }
  devSecret ??= crypto.randomUUID() + crypto.randomUUID();
  return new TextEncoder().encode(devSecret);
}

export const SESSION_COOKIE = 'f606_sess';
const MAX_AGE = 7 * 24 * 60 * 60; // 7 días

export interface SessionPayload {
  userId: string;
  email: string;
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getSessionUserFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return Promise.resolve(null);
  return verifyToken(token);
}

export function attachCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return res;
}

export function clearCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return res;
}

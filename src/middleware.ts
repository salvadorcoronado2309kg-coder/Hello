import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth';

const PUBLIC = ['/login', '/register', '/', '/api/auth/login', '/api/auth/register', '/api/health'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC.some(p => pathname === p || pathname.startsWith('/api/auth/'))) {
    return NextResponse.next();
  }
  if (!pathname.startsWith('/dashboard') && !pathname.startsWith('/api/db')) {
    return NextResponse.next();
  }
  const user = await getSessionUserFromRequest(request);
  if (!user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

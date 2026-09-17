import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { DASHBOARD_COOKIE, tokenIsValid } from '@/lib/dashboard-token';

function signedIn(request: NextRequest): boolean {
  return tokenIsValid(request.cookies.get(DASHBOARD_COOKIE)?.value);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/admin/* also checks for itself in every handler; this is the outer
  // fence so an unauthenticated request never reaches Supabase.
  if (pathname.startsWith('/api/admin')) {
    if (!signedIn(request)) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Protect /dashboard and /admin, skipping the login page itself.
  if (
    (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) &&
    !pathname.startsWith('/dashboard/login') &&
    !pathname.startsWith('/dashboard/sync')
  ) {
    if (!signedIn(request)) {
      return NextResponse.redirect(new URL('/dashboard/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/api/admin/:path*'],
};

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { DASHBOARD_COOKIE, tokenIsValid } from '@/lib/dashboard-token';

function signedIn(request: NextRequest): boolean {
  return tokenIsValid(request.cookies.get(DASHBOARD_COOKIE)?.value);
}

// Pages under /admin that must stay reachable without a session:
// - /admin/login is the sign-in page itself
// - /admin/sync is opened as a popup from purchasing.alberta.ca by the APC
//   bookmarklet; the sameSite=strict cookie is not sent on that first hop.
const OPEN_ADMIN_PATHS = ['/admin/login', '/admin/sync'];

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

  if (pathname.startsWith('/admin') && !OPEN_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    if (!signedIn(request)) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};

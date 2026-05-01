import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function makeToken(password: string): string {
  // Simple deterministic token — no Node crypto needed on Edge runtime
  return Buffer.from(`dashboard:${password}:auth`).toString('base64');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /dashboard, skip the login page itself and the auth API
  if (
    pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/dashboard/login')
  ) {
    const token = request.cookies.get('cm_dashboard_auth')?.value;
    const pass = process.env.DASHBOARD_PASSWORD || 'culturemedia2026';
    const expected = makeToken(pass);

    if (!token || token !== expected) {
      return NextResponse.redirect(new URL('/dashboard/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};

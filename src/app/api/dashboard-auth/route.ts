import { NextRequest, NextResponse } from 'next/server';

import {
  AUTH_NOT_CONFIGURED,
  DASHBOARD_COOKIE,
  dashboardCredentials,
  makeToken,
} from '@/lib/dashboard-token';

// POST /api/dashboard-auth — login
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // No credentials configured means nobody signs in. The dashboard and the
    // /admin pages expose revenue and client data, so a deploy that is missing
    // DASHBOARD_USER / DASHBOARD_PASSWORD must lock everyone out instead of
    // accepting a default password.
    const creds = dashboardCredentials();
    if (!creds) {
      console.error('[dashboard-auth] DASHBOARD_USER / DASHBOARD_PASSWORD are not set');
      return NextResponse.json({ error: AUTH_NOT_CONFIGURED }, { status: 503 });
    }

    if (username !== creds.user || password !== creds.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });

    response.cookies.set(DASHBOARD_COOKIE, makeToken(creds.password), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 14, // 14 days
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/dashboard-auth — logout
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(DASHBOARD_COOKIE);
  return response;
}

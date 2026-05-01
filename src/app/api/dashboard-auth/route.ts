import { NextRequest, NextResponse } from 'next/server';

function makeToken(password: string): string {
  return Buffer.from(`dashboard:${password}:auth`).toString('base64');
}

// POST /api/dashboard-auth — login
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const validUser = process.env.DASHBOARD_USER || 'adam';
    const validPass = process.env.DASHBOARD_PASSWORD || 'culturemedia2026';

    if (username !== validUser || password !== validPass) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = makeToken(validPass);
    const response = NextResponse.json({ ok: true });

    response.cookies.set('cm_dashboard_auth', token, {
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
  const response = NextResponse.redirect('/dashboard/login');
  response.cookies.delete('cm_dashboard_auth');
  return response;
}

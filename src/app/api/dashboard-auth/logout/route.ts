import { NextRequest, NextResponse } from 'next/server';

import { DASHBOARD_COOKIE } from '@/lib/dashboard-token';

// POST /api/dashboard-auth/logout — sign out from a plain HTML form (the admin
// hub is a server component, so it cannot send the DELETE the pipeline uses).
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/admin/login', request.url), 303);
  response.cookies.delete(DASHBOARD_COOKIE);
  return response;
}

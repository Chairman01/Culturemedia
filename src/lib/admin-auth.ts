// The one gate for every /admin page and /api/admin/* route.
//
// Pages redirect to the admin login; API routes answer 401. Both read the same
// cm_dashboard_auth cookie the login sets.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

import { DASHBOARD_COOKIE, tokenIsValid } from './dashboard-token';

export const LOGIN_PATH = '/admin/login';

export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies();
  return tokenIsValid(store.get(DASHBOARD_COOKIE)?.value);
}

/** Server components: send an unauthenticated visitor to the login page. */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdminAuthed())) redirect(LOGIN_PATH);
}

/**
 * Route handlers: returns a 401 response to return early with, or null when the
 * caller is signed in.
 */
export async function requireAdminApi(): Promise<NextResponse | null> {
  if (await isAdminAuthed()) return null;
  return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
}

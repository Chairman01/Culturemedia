// Shared dashboard credential + cookie-token logic.
//
// Kept free of next/* imports so the edge proxy, route handlers and server
// components can all use the same rules. When DASHBOARD_USER or
// DASHBOARD_PASSWORD is unset we fail closed: no token can be minted and no
// token can validate, so nobody gets in. These pages expose revenue and client
// data, so an unconfigured deploy must lock everyone out rather than fall back
// to a shared default password.

export const DASHBOARD_COOKIE = 'cm_dashboard_auth';

export interface DashboardCredentials {
  user: string;
  password: string;
}

export function dashboardCredentials(): DashboardCredentials | null {
  const user = process.env.DASHBOARD_USER;
  const password = process.env.DASHBOARD_PASSWORD;
  if (!user || !password) return null;
  return { user, password };
}

export function makeToken(password: string): string {
  // Deterministic, no Node crypto — the edge runtime runs this too.
  return Buffer.from(`dashboard:${password}:auth`).toString('base64');
}

/** The token a signed-in browser should be holding, or null when unconfigured. */
export function expectedDashboardToken(): string | null {
  const creds = dashboardCredentials();
  return creds ? makeToken(creds.password) : null;
}

export function tokenIsValid(token: string | null | undefined): boolean {
  const expected = expectedDashboardToken();
  return Boolean(expected && token && token === expected);
}

export const AUTH_NOT_CONFIGURED =
  'Dashboard sign-in is not configured. Set DASHBOARD_USER and DASHBOARD_PASSWORD.';

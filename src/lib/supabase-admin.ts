// Server-only Supabase access for the admin pages.
//
// SUPABASE_SERVICE_ROLE_KEY bypasses row-level security, so this module must
// never be imported from a client component. `import 'server-only'` makes that
// a build error rather than a leak.

import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { SalesDashboard, Scorecard } from './admin-types';

export interface AdminResult<T> {
  data: T | null;
  error: string | null;
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

const NOT_CONFIGURED =
  'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.';

/**
 * Calls one of the admin_* functions. Execute is granted to service_role only,
 * so these only work from server code.
 */
async function callRpc<T>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<AdminResult<T>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) {
      // Log the detail server-side; hand the browser the message only.
      console.error(`[admin] ${fn} failed`, error);
      return { data: null, error: error.message || `${fn} failed` };
    }
    if (data === null || data === undefined) {
      return { data: null, error: `${fn} returned nothing` };
    }
    return { data: data as T, error: null };
  } catch (err) {
    console.error(`[admin] ${fn} threw`, err);
    return { data: null, error: 'Could not reach Supabase. Try again.' };
  }
}

export function fetchScorecard(): Promise<AdminResult<Scorecard>> {
  return callRpc<Scorecard>('admin_kpi_scorecard');
}

export function fetchSales(): Promise<AdminResult<SalesDashboard>> {
  return callRpc<SalesDashboard>('admin_sales_dashboard');
}

/** Marks one ops_actions row done. Never sends anything. */
export function completeAction(
  id: number,
  note: string | null = null,
): Promise<AdminResult<unknown>> {
  return callRpc('admin_complete_action', { p_id: id, p_note: note });
}

/**
 * Adds a lead or client. admin_add_lead validates the payload, rejects
 * duplicate emails and logs a lead_events row. It never schedules or sends
 * email.
 */
export function addLead(payload: Record<string, unknown>): Promise<AdminResult<unknown>> {
  return callRpc('admin_add_lead', { p: payload });
}

/** Today in Edmonton, as YYYY-MM-DD. Computed server-side so the client markup
 *  it feeds renders the same on both sides of hydration. */
export function edmontonToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

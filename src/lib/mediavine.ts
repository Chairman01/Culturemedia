// Mediavine's Publisher API: read-only reporting, the same figures as the
// Mediavine dashboard. https://publisher-api.mediavine.com/docs
//
// The token (MEDIAVINE_API_TOKEN) is a personal access token: it can read
// revenue and traffic and nothing else. It is only ever read here, on the
// server, and never sent to the browser or logged.

import 'server-only';

const host = () => (process.env.MEDIAVINE_API_HOST || 'https://publisher-api.mediavine.com').replace(/\/+$/, '');

export const mediavineConfigured = () => Boolean(process.env.MEDIAVINE_API_TOKEN);

export class MediavineError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// What each status means for the owner, in words they can act on.
function explain(status: number, detail: string): string {
  if (status === 401) return 'Mediavine did not accept the token. Create a new one in Mediavine (Profile → Personal Access Tokens) and update MEDIAVINE_API_TOKEN in Vercel.';
  if (status === 403) return 'The Mediavine token cannot see this site. Create the token from the account that owns Culture Alberta.';
  if (status === 429) return 'Mediavine asked us to slow down. Try again in a few minutes.';
  if (status === 502) return 'Mediavine’s reporting service did not answer. Try again in a few minutes.';
  return `Mediavine answered ${status}${detail ? `: ${detail}` : ''}.`;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Params = Record<string, string | number | undefined>;

async function get<T>(path: string, params: Params = {}): Promise<T> {
  const token = process.env.MEDIAVINE_API_TOKEN;
  if (!token) throw new MediavineError('Mediavine is not connected. Add MEDIAVINE_API_TOKEN in Vercel.', 0);

  const url = new URL(host() + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));

  // 429 and 502 are worth another try; nothing else is.
  for (let attempt = 0; ; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      if (attempt < 2) {
        await wait(800 * (attempt + 1));
        continue;
      }
      throw new MediavineError('Could not reach Mediavine. Try again in a few minutes.', 0);
    }
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status === 502) && attempt < 2) {
      await wait(1200 * (attempt + 1));
      continue;
    }
    let detail = '';
    try {
      detail = String(((await res.json()) as { error?: unknown }).error ?? '').slice(0, 200);
    } catch {
      // No JSON body: the status says enough.
    }
    throw new MediavineError(explain(res.status, detail), res.status);
  }
}

type N = number | null;

export interface MvSite {
  id: number;
  domain: string | null;
}

export interface MvEarningsDay {
  date_et: string | null;
  net_revenue: N;
  adjustments: N;
  pageviews: N;
  sessions: N;
  paid_impressions: N;
  cpm: N;
  sessions_rpm: N;
  viewability: N;
}

export interface MvEarningsTotals {
  net_revenue: N;
  adjustments: N;
  pageviews: N;
  sessions: N;
  sessions_rpm: N;
}

export interface MvSourceRow {
  source: string | null;
  net_revenue: N;
  pageviews: N;
  sessions: N;
  sessions_rpm: N;
}

export interface MvPageRow {
  path: string;
  net_revenue: N;
  pageviews: N;
  pageviews_rpm: N;
  fillrate: N;
}

export interface MvAdUnitRow {
  adunit: string;
  net_revenue: N;
  sessions_rpm: N;
  fillrate: N;
}

export interface MvCountryRow {
  country: string;
  net_revenue: N;
  sessions: N;
  sessions_rpm: N;
}

export interface MvDeviceRow {
  label: string | null;
  net_revenue: N;
  pageviews: N;
  sessions: N;
  sessions_rpm: N;
}

export interface MvVideoRow {
  title: string | null;
  net_revenue: N;
  views: N;
}

interface Report<T> {
  data: T[];
}

interface Paged<T> extends Report<T> {
  pagination?: { next_cursor: string | null; has_more: boolean };
}

const range = (start: string, end: string) => ({ start_date: start, end_date: end });

/** The sites this token can read. */
export async function mvSites(): Promise<MvSite[]> {
  const me = await get<{ sites?: MvSite[] }>('/v1/me');
  return me.sites ?? [];
}

/** One row a day (US Eastern), plus totals over the whole range. Totals include adjustments; the days do not. */
export async function mvEarnings(site: number, start: string, end: string): Promise<{ days: MvEarningsDay[]; totals: MvEarningsTotals | null }> {
  const r = await get<Report<MvEarningsDay> & { totals?: MvEarningsTotals }>(`/v1/site-reports/${site}/earnings`, range(start, end));
  return { days: r.data ?? [], totals: r.totals ?? null };
}

export async function mvSources(site: number, start: string, end: string): Promise<MvSourceRow[]> {
  return (await get<Report<MvSourceRow>>(`/v1/site-reports/${site}/sources`, range(start, end))).data ?? [];
}

export async function mvAdUnits(site: number, start: string, end: string): Promise<MvAdUnitRow[]> {
  return (await get<Report<MvAdUnitRow>>(`/v1/site-reports/${site}/adunits`, range(start, end))).data ?? [];
}

export async function mvCountries(site: number, start: string, end: string): Promise<MvCountryRow[]> {
  return (await get<Report<MvCountryRow>>(`/v1/site-reports/${site}/countries`, range(start, end))).data ?? [];
}

export async function mvDevices(site: number, start: string, end: string): Promise<MvDeviceRow[]> {
  return (await get<Report<MvDeviceRow>>(`/v1/site-reports/${site}/devices`, range(start, end))).data ?? [];
}

/**
 * The top `want` rows of a paged report, best earners first. The cursor carries
 * the page size but not the ordering, so sort and direction go on every call.
 */
async function top<T>(path: string, start: string, end: string, want: number): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 10 && out.length < want; page += 1) {
    const r = await get<Paged<T>>(path, {
      ...range(start, end),
      sort: 'net_revenue',
      direction: 'desc',
      limit: cursor ? undefined : Math.min(want, 1000),
      cursor,
    });
    out.push(...(r.data ?? []));
    if (!r.pagination?.has_more || !r.pagination.next_cursor) break;
    cursor = r.pagination.next_cursor;
  }
  return out.slice(0, want);
}

export const mvPages = (site: number, start: string, end: string, want = 200) => top<MvPageRow>(`/v1/site-reports/${site}/pages`, start, end, want);

export const mvVideos = (site: number, start: string, end: string, want = 25) => top<MvVideoRow>(`/v1/site-reports/${site}/videos`, start, end, want);

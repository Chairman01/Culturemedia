// Reads the warehouse tables behind the Content page (service role only).
//
// Each source is loaded on a different day and some hold several windows, so
// every read takes the newest load and, within it, the longest window. Nothing
// here is written; a table that cannot be read is reported and the rest of the
// page still shows.

import 'server-only';

import type { ContentData, LandingPage, PageStat, Period, SearchQuery, SiteError, SourceStat, TypeStat, Vital } from './content';
import { getClient, NOT_CONFIGURED } from './supabase-admin';

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
const str = (v: unknown) => String(v ?? '');

/** Rows from the newest load only. Reads are ordered newest first. */
function latestLoad(rows: Row[]): Row[] {
  const top = rows[0]?.loaded_on;
  return top ? rows.filter((r) => r.loaded_on === top) : [];
}

/** A search row from either engine: click-through is worked out, not trusted. */
function toQuery(r: Row): SearchQuery | null {
  const impressions = num(r.impressions) ?? 0;
  const clicks = num(r.clicks) ?? 0;
  const query = str(r.query).trim();
  if (!query || !impressions) return null;
  return { query, clicks, impressions, ctr: clicks / impressions, position: num(r.position) ?? 0 };
}

export async function loadContent(): Promise<ContentData> {
  const data: ContentData = {
    period: null,
    total: null,
    pages: [],
    types: [],
    sources: [],
    google: { loaded: null, queries: [] },
    bing: { loaded: null, queries: [] },
    landing: { loaded: null, pages: [] },
    health: { period: null, vitals: [], errors: [] },
    problems: [],
  };
  const supabase = getClient();
  if (!supabase) return { ...data, problems: [NOT_CONFIGURED] };

  const [mv, gsc, bing, ga, cl] = await Promise.all([
    supabase
      .from('mediavine_snapshot')
      .select('loaded_on, period_start, period_end, dimension, label, revenue, session_rpm, pageview_rpm, sessions, pageviews')
      .in('dimension', ['page', 'content_type', 'source', 'total'])
      .order('loaded_on', { ascending: false })
      .limit(3000),
    supabase.from('gsc_striking_distance').select('loaded_on, query, clicks, impressions, position').order('loaded_on', { ascending: false }).limit(800),
    supabase.from('bing_striking_distance').select('loaded_on, query, clicks, impressions, position').order('loaded_on', { ascending: false }).limit(1200),
    supabase
      .from('ga_landing_page_snapshot')
      .select('loaded_on, landing_page, clicks, impressions, position, engagement_rate, avg_engagement_time')
      .order('loaded_on', { ascending: false })
      .limit(1000),
    supabase
      .from('clarity_snapshot')
      .select('loaded_on, period_start, period_end, dimension, label, sessions, pct, value, unit')
      .in('dimension', ['web_vitals', 'js_error'])
      .order('loaded_on', { ascending: false })
      .limit(300),
  ]);

  const failed = (what: string, error: { message?: string } | null) => {
    if (error) data.problems.push(`Could not read ${what}: ${error.message || 'unknown error'}.`);
    return Boolean(error);
  };

  // ── Mediavine: newest load, longest window ──
  if (!failed('the Mediavine figures', mv.error)) {
    const load = latestLoad((mv.data ?? []) as Row[]);
    const from = load.map((r) => str(r.period_start)).sort()[0];
    const rows = load.filter((r) => str(r.period_start) === from);
    if (rows.length) {
      data.period = { from, to: rows.map((r) => str(r.period_end)).sort().pop() as string };
      const of = (dim: string) => rows.filter((r) => r.dimension === dim);
      const total = of('total')[0];
      if (total) {
        data.total = {
          revenue: num(total.revenue) ?? 0,
          pageviews: num(total.pageviews) ?? 0,
          sessions: num(total.sessions) ?? 0,
          rpm: num(total.pageview_rpm),
        };
      }
      data.pages = of('page')
        .map<PageStat>((r) => ({ path: str(r.label), revenue: num(r.revenue) ?? 0, pageviews: num(r.pageviews) ?? 0, rpm: num(r.pageview_rpm) }))
        .filter((p) => p.path)
        .sort((a, b) => b.revenue - a.revenue);
      data.types = of('content_type')
        .map<TypeStat>((r) => ({ type: str(r.label), revenue: num(r.revenue) ?? 0, pageviews: num(r.pageviews) ?? 0, rpm: num(r.pageview_rpm) }))
        .filter((t) => t.type)
        .sort((a, b) => b.revenue - a.revenue);
      data.sources = of('source')
        .map<SourceStat>((r) => ({ source: str(r.label), revenue: num(r.revenue) ?? 0, sessions: num(r.sessions) ?? 0, rpm: num(r.session_rpm) }))
        .filter((s) => s.source && !/not available/i.test(s.source))
        .sort((a, b) => b.revenue - a.revenue);
    }
  }

  // ── Search: Google and Bing, each their newest load ──
  if (!failed('Google Search Console', gsc.error)) {
    const load = latestLoad((gsc.data ?? []) as Row[]);
    data.google = {
      loaded: load[0] ? str(load[0].loaded_on) : null,
      queries: load.map(toQuery).filter((q): q is SearchQuery => q !== null).sort((a, b) => b.impressions - a.impressions),
    };
  }
  if (!failed('Bing Webmaster Tools', bing.error)) {
    const load = latestLoad((bing.data ?? []) as Row[]);
    data.bing = {
      loaded: load[0] ? str(load[0].loaded_on) : null,
      queries: load.map(toQuery).filter((q): q is SearchQuery => q !== null).sort((a, b) => b.impressions - a.impressions),
    };
  }

  // ── GA4 landing pages ──
  if (!failed('GA4 landing pages', ga.error)) {
    const load = latestLoad((ga.data ?? []) as Row[]);
    data.landing = {
      loaded: load[0] ? str(load[0].loaded_on) : null,
      pages: load
        .map<LandingPage | null>((r) => {
          const impressions = num(r.impressions) ?? 0;
          const clicks = num(r.clicks) ?? 0;
          const path = str(r.landing_page).trim();
          if (!path || !impressions) return null;
          return {
            path,
            clicks,
            impressions,
            ctr: clicks / impressions,
            position: num(r.position) ?? 0,
            engagementRate: num(r.engagement_rate),
            engagementSeconds: num(r.avg_engagement_time),
          };
        })
        .filter((p): p is LandingPage => p !== null)
        .sort((a, b) => b.impressions - a.impressions),
    };
  }

  // ── Clarity: newest load, newest window ──
  if (!failed('Clarity', cl.error)) {
    const load = latestLoad((cl.data ?? []) as Row[]);
    const start = load.map((r) => str(r.period_start)).sort().pop();
    const rows = load.filter((r) => str(r.period_start) === start);
    if (rows.length) {
      const period: Period = { from: start as string, to: rows.map((r) => str(r.period_end)).sort().pop() as string };
      data.health = {
        period,
        vitals: rows
          .filter((r) => r.dimension === 'web_vitals' && num(r.value) !== null)
          .map<Vital>((r) => ({ name: str(r.label), value: num(r.value) as number, unit: str(r.unit) })),
        errors: rows
          .filter((r) => r.dimension === 'js_error' && num(r.sessions) !== null)
          .map<SiteError>((r) => ({ message: str(r.label), sessions: num(r.sessions) as number, pct: num(r.pct) }))
          .sort((a, b) => b.sessions - a.sessions),
      };
    }
  }

  return data;
}

/**
 * Just the traffic-source split from the newest Mediavine load, for the
 * valuation (which prices in how much rides on one social source). Sessions,
 * not revenue: it is the readers a buyer counts. Empty on any error.
 */
export async function loadSources(): Promise<{ source: string; sessions: number }[]> {
  const supabase = getClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('mediavine_snapshot')
    .select('loaded_on, period_start, dimension, label, sessions')
    .eq('dimension', 'source')
    .order('loaded_on', { ascending: false })
    .limit(400);
  if (error || !data?.length) return [];
  const load = latestLoad(data as Row[]);
  const from = load.map((r) => str(r.period_start)).sort()[0];
  return load
    .filter((r) => str(r.period_start) === from && !/not available/i.test(str(r.label)))
    .map((r) => ({ source: str(r.label), sessions: num(r.sessions) ?? 0 }))
    .filter((r) => r.source && r.sessions > 0);
}

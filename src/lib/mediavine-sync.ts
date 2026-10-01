// Keeps the warehouse's Mediavine figures current from the Publisher API, in
// the same three places the Wednesday export used to fill by hand:
//
//   seo_daily          one row per day and metric  → Scorecard weeks, "data through"
//   traffic_monthly    one row per calendar month  → Revenue, Valuation
//   mediavine_snapshot one load per week by page,  → Content, traffic sources
//                      source, country, device…
//
// Reading Mediavine is all it does there: the API is read-only. Every write is
// an upsert or a replace of today's own load, so running it twice is harmless.
// Story types (content_type) are not in the API; those rows still come from the
// Wednesday job and the Content page keeps showing the newest ones.

import 'server-only';

import {
  mediavineConfigured,
  mvAdUnits,
  mvCountries,
  mvDevices,
  mvEarnings,
  mvPages,
  mvSites,
  mvSources,
  mvVideos,
} from './mediavine';
import { edmontonToday, getClient } from './supabase-admin';

// The first day with ads on the site. Nothing is asked for before it.
const FIRST_DAY = process.env.MEDIAVINE_FIRST_DAY || '2026-05-01';
// Revenue settles for about a week, so every run re-reads at least this far back.
const WINDOW_DAYS = 35;
// The automatic check does nothing if the last one was this recent.
const FRESH_HOURS = 12;
// By-page and by-source loads are for the Content page: weekly is plenty.
const SNAPSHOT_EVERY_DAYS = 7;

export interface MediavineStatus {
  configured: boolean;
  /** When figures were last written, ISO; null if never. */
  lastSynced: string | null;
  /** The last day there is revenue for, YYYY-MM-DD. */
  through: string | null;
  stale: boolean;
}

export interface SyncReport {
  ok: boolean;
  skipped?: 'not_configured' | 'fresh';
  from?: string;
  to?: string;
  days?: number;
  months?: string[];
  snapshot?: boolean;
  error?: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (day: string, by: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return iso(d);
};
const round = (v: number, places = 2) => Math.round(v * 10 ** places) / 10 ** places;
const per1000 = (revenue: number | null, n: number | null) => (revenue !== null && n ? round((revenue / n) * 1000) : null);

/** Today in US Eastern, the clock Mediavine reports on. */
function easternToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

export async function mediavineStatus(): Promise<MediavineStatus> {
  const configured = mediavineConfigured();
  const supabase = getClient();
  if (!supabase) return { configured, lastSynced: null, through: null, stale: configured };

  const [last, through] = await Promise.all([
    supabase.from('seo_daily').select('collected_at').eq('source', 'mediavine').order('collected_at', { ascending: false }).limit(1),
    supabase.from('seo_daily').select('day').eq('source', 'mediavine').eq('metric', 'revenue').order('day', { ascending: false }).limit(1),
  ]);
  const lastSynced = last.data?.[0]?.collected_at ? String(last.data[0].collected_at) : null;
  const age = lastSynced ? Date.now() - Date.parse(lastSynced) : Infinity;
  return {
    configured,
    lastSynced,
    through: through.data?.[0]?.day ? String(through.data[0].day) : null,
    stale: configured && age > FRESH_HOURS * 3_600_000,
  };
}

// One run at a time per server instance: a second caller waits for the first.
let running: Promise<SyncReport> | null = null;

/**
 * Pull Mediavine into the warehouse. `force` runs even if the last run was
 * recent (the Update now button); `full` re-reads everything since the first
 * day instead of the last few weeks.
 */
export function syncMediavine(opts: { force?: boolean; full?: boolean } = {}): Promise<SyncReport> {
  if (running) return running;
  running = run(opts).finally(() => {
    running = null;
  });
  return running;
}

async function run({ force = false, full = false }: { force?: boolean; full?: boolean }): Promise<SyncReport> {
  if (!mediavineConfigured()) return { ok: false, skipped: 'not_configured' };
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'Supabase is not configured.' };

  try {
    const status = await mediavineStatus();
    if (!force && !status.stale) return { ok: true, skipped: 'fresh' };

    // Which site: the one named in MEDIAVINE_SITE_ID, else Culture Alberta, else the only one.
    let site = Number(process.env.MEDIAVINE_SITE_ID) || 0;
    if (!site) {
      const sites = await mvSites();
      const match = sites.find((s) => /culturealberta/i.test(s.domain ?? '')) ?? (sites.length === 1 ? sites[0] : null);
      if (!match) {
        return { ok: false, error: sites.length ? 'The Mediavine token can see more than one site. Set MEDIAVINE_SITE_ID in Vercel.' : 'The Mediavine token cannot see any site.' };
      }
      site = match.id;
    }

    // Through yesterday: today is still being counted, and a part-day would
    // make a week look complete when it is not.
    const to = shift(easternToday(), -1);
    const settled = status.through ? shift(status.through, -7) : FIRST_DAY;
    let from = full ? FIRST_DAY : [shift(to, -(WINDOW_DAYS - 1)), settled].sort()[0];
    if (from < FIRST_DAY) from = FIRST_DAY;
    if (from > to) return { ok: true, from, to, days: 0, months: [], snapshot: false };

    const collected_at = new Date().toISOString();
    const loaded_on = edmontonToday();

    // ── Daily ──
    const { days } = await mvEarnings(site, from, to);
    const daily: Record<string, unknown>[] = [];
    const put = (day: string, metric: string, value: number | null) => {
      if (value === null || !Number.isFinite(value)) return;
      daily.push({ day, source: 'mediavine', metric, segment: 'all', value, collected_at, derived: null });
    };
    for (const d of days) {
      if (!d.date_et || d.date_et > to) continue;
      put(d.date_et, 'revenue', d.net_revenue);
      put(d.date_et, 'cpm', d.cpm);
      put(d.date_et, 'viewability', d.viewability);
      // Pageviews and sessions come from Google Analytics about two days late;
      // until then Mediavine reports 0, which means "not in yet".
      if (d.pageviews) {
        put(d.date_et, 'pageviews', d.pageviews);
        if (d.paid_impressions !== null) put(d.date_et, 'impressions_per_pageview', round(d.paid_impressions / d.pageviews));
      }
      if (d.sessions) {
        put(d.date_et, 'sessions', d.sessions);
        put(d.date_et, 'session_rpm', d.sessions_rpm);
        if (d.paid_impressions !== null) put(d.date_et, 'impressions_per_session', round(d.paid_impressions / d.sessions));
      }
    }
    for (let i = 0; i < daily.length; i += 500) {
      const { error } = await supabase.from('seo_daily').upsert(daily.slice(i, i + 500), { onConflict: 'day,source,metric,segment' });
      if (error) throw new Error(`Could not save the daily figures: ${error.message}`);
    }

    // ── Monthly: every calendar month the window touches, re-read whole ──
    const months: string[] = [];
    for (let m = `${from.slice(0, 7)}-01`; m <= to; m = iso(new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 1)))) months.push(m);
    for (const month of months) {
      const next = iso(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)));
      const lastDay = shift(next, -1);
      const start = month < FIRST_DAY ? FIRST_DAY : month;
      const end = lastDay < to ? lastDay : to;
      const { totals } = await mvEarnings(site, start, end);
      if (!totals || totals.net_revenue === null) continue;
      const adjustments = totals.adjustments ?? 0;
      const { error } = await supabase.from('traffic_monthly').upsert(
        {
          month,
          source: 'mediavine',
          // Left out when Mediavine has none yet, so a good figure is never blanked.
          ...(totals.pageviews ? { pageviews: Math.round(totals.pageviews) } : {}),
          ...(totals.sessions ? { sessions: Math.round(totals.sessions) } : {}),
          revenue: round(totals.net_revenue),
          complete: lastDay <= to,
          estimated: false,
          loaded_on,
          note: `From the Mediavine API, ${start} to ${end}.${adjustments ? ` Includes adjustments of $${round(adjustments)}.` : ''}${lastDay <= to ? '' : ' Month in progress; the last two days of traffic arrive late.'}`,
        },
        { onConflict: 'month,source' },
      );
      if (error) throw new Error(`Could not save ${month.slice(0, 7)}: ${error.message}`);
    }

    // ── By page, source, country, device, ad unit and video: weekly ──
    const newest = await supabase.from('mediavine_snapshot').select('loaded_on').eq('dimension', 'total').order('loaded_on', { ascending: false }).limit(1);
    const lastLoad = newest.data?.[0]?.loaded_on ? String(newest.data[0].loaded_on) : null;
    const due = force || !lastLoad || shift(lastLoad, SNAPSHOT_EVERY_DAYS) <= loaded_on;
    if (due) {
      const first = await supabase.from('seo_daily').select('day').eq('source', 'mediavine').eq('metric', 'pageviews').order('day', { ascending: true }).limit(1);
      const longFrom = first.data?.[0]?.day ? String(first.data[0].day) : FIRST_DAY;
      await snapshot(site, longFrom, to, loaded_on, true);
      const monthFrom = shift(to, -29);
      if (monthFrom > longFrom) await snapshot(site, monthFrom, to, loaded_on, false);
    }

    return { ok: true, from, to, days: new Set(daily.map((r) => r.day)).size, months: months.map((m) => m.slice(0, 7)), snapshot: due };
  } catch (err) {
    console.error('[mediavine] sync failed', err instanceof Error ? err.message : err);
    return { ok: false, error: err instanceof Error ? err.message : 'The Mediavine update failed.' };
  }
}

/**
 * One load of the breakdowns for a window. `deep` adds pages and videos, which
 * only the long window needs. Today's rows for the same window are replaced, so
 * a second run the same day does not double anything.
 */
async function snapshot(site: number, start: string, end: string, loaded_on: string, deep: boolean): Promise<void> {
  const supabase = getClient();
  if (!supabase) return;

  const [earnings, sources, countries, devices, adunits, pages, videos] = await Promise.all([
    mvEarnings(site, start, end),
    mvSources(site, start, end),
    mvCountries(site, start, end),
    mvDevices(site, start, end),
    mvAdUnits(site, start, end),
    deep ? mvPages(site, start, end, 200) : Promise.resolve([]),
    deep ? mvVideos(site, start, end, 25) : Promise.resolve([]),
  ]);
  const totals = earnings.totals;
  const allViews = totals?.pageviews ?? null;

  const base = { loaded_on, period_start: start, period_end: end };
  const int = (v: number | null) => (v === null ? null : Math.round(v));
  const rows: Record<string, unknown>[] = [];
  const add = (dimension: string, label: string, r: { revenue: number | null; session_rpm?: number | null; pageview_rpm?: number | null; sessions?: number | null; pageviews?: number | null; fill_rate?: number | null }) => {
    if (!label || r.revenue === null) return;
    rows.push({
      ...base,
      dimension,
      label,
      revenue: round(r.revenue),
      session_rpm: r.session_rpm ?? null,
      pageview_rpm: r.pageview_rpm ?? null,
      sessions: int(r.sessions ?? null),
      pageviews: int(r.pageviews ?? null),
      fill_rate: r.fill_rate ?? null,
    });
  };

  if (totals) {
    add('total', 'total', {
      revenue: totals.net_revenue,
      session_rpm: totals.sessions_rpm,
      pageview_rpm: per1000(totals.net_revenue, totals.pageviews),
      sessions: totals.sessions,
      pageviews: totals.pageviews,
    });
  }
  for (const s of sources) {
    add('source', (s.source ?? '(data not available)').trim().toLowerCase(), {
      revenue: s.net_revenue,
      session_rpm: s.sessions_rpm,
      pageview_rpm: per1000(s.net_revenue, s.pageviews),
      sessions: s.sessions,
      pageviews: s.pageviews,
    });
  }
  for (const c of countries) add('country', c.country, { revenue: c.net_revenue, session_rpm: c.sessions_rpm, sessions: c.sessions });
  for (const d of devices) {
    add('device', (d.label ?? 'other').trim().toLowerCase(), {
      revenue: d.net_revenue,
      session_rpm: d.sessions_rpm,
      pageview_rpm: per1000(d.net_revenue, d.pageviews),
      sessions: d.sessions,
      pageviews: d.pageviews,
    });
  }
  // An ad unit has no pageviews of its own: its share of every 1,000 site pageviews.
  for (const a of adunits) add('ad_unit', a.adunit, { revenue: a.net_revenue, session_rpm: a.sessions_rpm, pageview_rpm: per1000(a.net_revenue, allViews), fill_rate: a.fillrate });
  for (const p of pages) add('page', p.path, { revenue: p.net_revenue, pageview_rpm: p.pageviews_rpm ?? per1000(p.net_revenue, p.pageviews), pageviews: p.pageviews, fill_rate: p.fillrate });
  for (const v of videos) add('video', (v.title ?? '').trim(), { revenue: v.net_revenue, pageview_rpm: per1000(v.net_revenue, v.views), pageviews: v.views });
  if (!rows.length) return;

  // Replace only what this load writes: story types loaded by hand today stay.
  const dimensions = [...new Set(rows.map((r) => String(r.dimension)))];
  const gone = await supabase.from('mediavine_snapshot').delete().eq('loaded_on', loaded_on).eq('period_start', start).eq('period_end', end).in('dimension', dimensions);
  if (gone.error) throw new Error(`Could not refresh the page and source figures: ${gone.error.message}`);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('mediavine_snapshot').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`Could not save the page and source figures: ${error.message}`);
  }
}

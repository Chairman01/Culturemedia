'use client';

// Scorecard, ported from the Claude page. Data comes from
// public.admin_kpi_scorecard() — rendered on the server for the first paint,
// re-fetched through /api/admin/scorecard on Refresh and after Mark done.

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import type { MetricRow, Scorecard, Target, WeekRow } from '@/lib/admin-types';
import type { Expense, Invoice } from '@/lib/revenue';
import { Chart, Sparkline, type ChartItem, type ChartKind } from '../_components/chart';
import { Detail, DetailTable, Explain } from '../_components/detail';
import { KpiDetail } from '../_components/kpi-detail';
import { RevenueBand } from '../_components/revenue-band';
import { useRefreshOnFocus } from '../_components/use-refresh';
import {
  convert,
  currencyNote,
  daysBetween,
  day,
  fmt,
  monthLabel,
  num,
  statusOf,
  unitFor,
  type Currency,
  type Unit,
} from '../_components/format';
import { AdminShell, PageHead } from '../_components/shell';
import {
  ActionRow,
  Banner,
  Chip,
  Seg,
  Tabs,
  Tile,
} from '../_components/ui';

const TILE_METRICS: [string, string][] = [
  ['revenue', 'Ad revenue'],
  ['pageviews', 'Pageviews'],
  ['discover_clicks', 'Discover clicks'],
  ['search_clicks', 'Google Search clicks'],
  ['net_subscribers', 'Net new subscribers'],
  ['new_members', 'New members'],
  ['articles_published', 'Articles published'],
  ['mrr', 'Retainer MRR'],
];

const WEEKLY_TABS: { k: string; label: string; unit: Unit }[] = [
  { k: 'revenue', label: 'Revenue', unit: 'dollars' },
  { k: 'session_rpm', label: 'RPM', unit: 'dollars' },
  { k: 'page_rpm', label: 'RPM per pageview', unit: 'dollars' },
  { k: 'pageviews', label: 'Pageviews', unit: 'count' },
  { k: 'discover_clicks', label: 'Discover', unit: 'count' },
  { k: 'search_clicks', label: 'Google', unit: 'count' },
  { k: 'bing_clicks', label: 'Bing', unit: 'count' },
  { k: 'net_subscribers', label: 'Subscribers', unit: 'count' },
  { k: 'new_members', label: 'Members', unit: 'count' },
  { k: 'articles_published', label: 'Articles', unit: 'count' },
];

const MONTHLY_TABS: { k: string; label: string }[] = [
  { k: 'revenue', label: 'Ad revenue' },
  { k: 'session_rpm', label: 'RPM' },
  { k: 'sessions', label: 'Sessions' },
  { k: 'pageviews', label: 'Pageviews' },
  { k: 'page_rpm', label: 'RPM per pageview' },
  { k: 'visitors', label: 'Visitors' },
  { k: 'subs', label: 'Net subscribers' },
  { k: 'members', label: 'New members' },
];

const SOURCE_OF: Record<string, string> = {
  revenue: 'Mediavine',
  session_rpm: 'Mediavine',
  page_rpm: 'Mediavine',
  pageviews: 'Mediavine',
  discover_clicks: 'Search Console',
  search_clicks: 'Search Console',
  bing_clicks: 'Bing',
};

const MEDIAVINE_MONTHS = ['revenue', 'pageviews', 'page_rpm', 'sessions', 'session_rpm'];
const CURRENCY_KEY = 'cm-admin-currency';
const KIND_KEY = 'cm-admin-chart-kind';

const TONE: Record<string, { k: 'ok' | 'warn' | 'crit'; l: string }> = {
  good: { k: 'ok', l: 'Good' },
  watch: { k: 'warn', l: 'Watch' },
  bad: { k: 'crit', l: 'Problem' },
};

export default function ScorecardView({
  initial,
  initialError,
  invoices,
  expenses,
  today,
}: {
  initial: Scorecard | null;
  initialError: string | null;
  invoices: Invoice[];
  expenses: Expense[];
  today: string;
}) {
  const [sc, setSc] = useState<Scorecard | null>(initial);
  const [banner, setBanner] = useState<{ tone: 'warn' | 'crit' | ''; text: string }>(
    initialError ? { tone: 'crit', text: initialError } : { tone: '', text: '' },
  );
  const [currency, setCurrency] = useState<Currency>('USD');
  // Which tile's detail panel is open.
  const [openKpi, setOpenKpi] = useState<string | null>(null);
  const [kind, setKind] = useState<{ wk: ChartKind; mo: ChartKind }>({ wk: 'bar', mo: 'bar' });
  const [weekTab, setWeekTab] = useState('revenue');
  const [monthTab, setMonthTab] = useState('revenue');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Per-viewer conveniences, so browser storage is the right home for them.
  // Read after mount: the server render cannot know them.
  useEffect(() => {
    try {
      if (localStorage.getItem(CURRENCY_KEY) === 'CAD') setCurrency('CAD');
      const saved = JSON.parse(localStorage.getItem(KIND_KEY) || '{}');
      setKind((k) => ({
        wk: saved.wk === 'line' || saved.wk === 'bar' ? saved.wk : k.wk,
        mo: saved.mo === 'line' || saved.mo === 'bar' ? saved.mo : k.mo,
      }));
    } catch {
      /* private window or blocked storage — defaults are fine */
    }
  }, []);

  const pickCurrency = (c: Currency) => {
    setCurrency(c);
    try {
      localStorage.setItem(CURRENCY_KEY, c);
    } catch {
      /* ignore */
    }
  };

  const pickKind = (which: 'wk' | 'mo', k: ChartKind) => {
    setKind((prev) => {
      const next = { ...prev, [which]: k };
      try {
        localStorage.setItem(KIND_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/scorecard', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({
          tone: 'crit',
          text:
            res.status === 401
              ? 'Your sign-in expired. Reload the page to sign in again.'
              : body.error || `Couldn't load the scorecard (${res.status}).`,
        });
        return;
      }
      setSc(body.data as Scorecard);
      setBanner({ tone: '', text: '' });
    } catch {
      setBanner({ tone: 'crit', text: "Couldn't reach the server. Try Refresh." });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const markDone = useCallback(
    async (id: number) => {
      if (!Number.isInteger(id) || id <= 0) return;
      setBusyId(id);
      try {
        const res = await fetch('/api/admin/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setBanner({
            tone: 'crit',
            text:
              body.error ||
              "Couldn't confirm the update. Press Refresh to see whether it saved before trying again.",
          });
          return;
        }
        await load();
      } catch {
        setBanner({
          tone: 'crit',
          text: "Couldn't confirm the update. Press Refresh to see whether it saved.",
        });
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  // Left open all day, the page still shows current numbers.
  useRefreshOnFocus(load);

  // ─── derived ──────────────────────────────────────────────────────────────

  const weeks: WeekRow[] = (sc?.weeks || []).filter((w) => !w.is_current_week);
  const last = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const targets: Target[] = sc?.targets || [];
  const targetOf = (metric: string) => targets.find((t) => t.metric === metric);
  const conv = (metric: string, value: unknown, at: 'week' | 'month' | 'window' | 'latest', key?: string) =>
    convert(sc?.fx, currency, metric, value, at, key);
  const thisMonth = today.slice(0, 7);

  // ─── tiles ────────────────────────────────────────────────────────────────

  const tiles = TILE_METRICS.map(([m, label]) => {
    const t = targetOf(m);
    const unit = t ? t.unit : 'count';

    // Retainer MRR is already CAD and is never converted.
    if (m === 'mrr') {
      const v = num(sc?.current?.mrr);
      const pipeline = sc?.current?.pipeline || {};
      const open = ['new', 'contacted', 'engaged', 'proposal'].reduce(
        (a, k) => a + (num(pipeline[k]) || 0),
        0,
      );
      return (
        <Tile
          key={m}
          label={label}
          title={t?.why}
          onOpen={() => setOpenKpi('mrr')}
          value={fmt(v, 'dollars')}
          foot={
            <>
              <span>
                {open} open leads · target {fmt(t?.target, 'dollars')}
              </span>
              <Chip s={statusOf(t, v)} />
            </>
          }
        />
      );
    }

    // The newest week that has this number. A source that loads late (Mediavine,
    // Search Console) shows its latest real week and says which, not a dash.
    let at = weeks.length - 1;
    while (at >= 0 && num(weeks[at][m]) === null) at -= 1;
    const cur = at >= 0 ? weeks[at] : undefined;
    const before = at > 0 ? weeks[at - 1] : prev && !cur ? prev : undefined;
    const stale = Boolean(cur && last && cur.week_start !== last.week_start);
    const raw = cur ? num(cur[m]) : null;
    const v = cur ? conv(m, cur[m], 'week', cur.week_start) : null;
    const p = before ? conv(m, before[m], 'week', before.week_start) : null;
    const u = unitFor(m, unit);

    let delta: ReactNode = null;
    if (v !== null && p !== null && p !== 0) {
      const d = ((v - p) / Math.abs(p)) * 100;
      const cls = Math.abs(d) < 0.5 ? 'flat' : d > 0 ? 'up' : 'down';
      delta = (
        <span className={`delta ${cls}`}>
          {d > 0 ? '▲' : d < 0 ? '▼' : '•'} {Math.abs(d).toFixed(0)}% WoW
        </span>
      );
    } else if (v === null && SOURCE_OF[m]) {
      delta = <span>Needs {SOURCE_OF[m]} data</span>;
    }

    return (
      <Tile
        key={m}
        label={label}
        title={t?.why}
        onOpen={() => setOpenKpi(m)}
        value={fmt(v, u, !isMoneyUnit(u), currency)}
        spark={<Sparkline values={weeks.slice(-8).map((w) => conv(m, w[m], 'week', w.week_start))} />}
        foot={
          <>
            {delta}
            {stale && cur && <span>week of {day(cur.week_start)}</span>}
            {t && <span>target {fmt(conv(m, t.target, 'latest'), u, true, currency)}</span>}
            <Chip s={statusOf(t, raw)} />
          </>
        }
      />
    );
  });

  // ─── weekly trend: last 12 full weeks ─────────────────────────────────────

  const weeklyUnitDef = WEEKLY_TABS.find((t) => t.k === weekTab)?.unit ?? 'count';
  const weeklyItems: ChartItem[] = weeks.slice(-12).map((w) => ({
    label: day(w.week_start),
    value: conv(weekTab, w[weekTab], 'week', w.week_start),
    est: ['pageviews', 'page_rpm'].includes(weekTab) && w.pv_estimated === true,
    title: `Week of ${day(w.week_start)}`,
  }));
  const weeklyTarget = targetOf(weekTab);
  const weeklyMissing = weeklyItems.some((i) => i.value === null);
  const weeklyNote =
    (weeklyMissing
      ? `A dotted stub means ${
          SOURCE_OF[weekTab] ? `${SOURCE_OF[weekTab]} daily data` : 'data'
        } isn't loaded for that week. It isn't a zero.`
      : 'Weeks start Monday, Edmonton time.') +
    (weeklyItems.some((i) => i.est)
      ? ' Late-July weeks include a few estimated pageview days (within about 1%).'
      : '') +
    (weekTab === 'session_rpm'
      ? " RPM is revenue per 1,000 sessions, the number Mediavine's dashboard shows."
      : '') +
    (isMoneyUnit(unitFor(weekTab, weeklyUnitDef)) ? currencyNote(currency, 'week') : '');

  // ─── monthly trend: calendar months ───────────────────────────────────────

  const monthly = monthlySeries(sc, monthTab, thisMonth, conv);

  // ─── insights, priorities, done ───────────────────────────────────────────

  const insights = sc?.insights || [];
  const allActions = sc?.actions || [];
  const open = allActions
    .filter((a) => a.status === 'todo' || a.status === 'in_progress')
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const done = allActions
    .filter((a) => a.status === 'done')
    .sort((a, b) => String(b.completed_at).localeCompare(String(a.completed_at)));
  const total = open.length + done.length;
  const rest = open.slice(6);

  return (
    <AdminShell>
      <PageHead
        title="Scorecard"
        help="How the business is tracking against its targets. Worth five minutes every Monday."
      >
        <Seg
            label="Currency for ad revenue"
            value={currency}
            onChange={pickCurrency}
            options={[
              { k: 'USD', label: 'USD', title: 'Revenue, expenses, ad revenue and RPM in USD' },
              { k: 'CAD', label: 'CAD', title: 'Revenue, expenses, ad revenue and RPM in CAD' },
            ]}
          />
        <button type="button" className="btn ghost" onClick={load} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </PageHead>

      <Freshness sc={sc} today={today} />
      <Banner tone={banner.tone}>{banner.text}</Banner>

      {/* Follows the USD / CAD switch above, like every other money figure here. */}
      <RevenueBand sc={sc} invoices={invoices} expenses={expenses} currency={currency} today={today} />

      <div className="tiles">{tiles}</div>
      {openKpi && openKpi !== 'mrr' && (
        <KpiDetail
          metric={openKpi}
          label={TILE_METRICS.find(([k]) => k === openKpi)?.[1] || openKpi}
          target={targetOf(openKpi)}
          unit={unitFor(openKpi, targetOf(openKpi)?.unit ?? 'count')}
          currency={currency}
          source={SOURCE_OF[openKpi]}
          through={
            SOURCE_OF[openKpi] === 'Mediavine'
              ? sc?.freshness?.mediavine_daily_through
              : SOURCE_OF[openKpi] === 'Search Console'
                ? sc?.freshness?.search_console_through
                : SOURCE_OF[openKpi] === 'Bing'
                  ? sc?.freshness?.bing_through
                  : null
          }
          weeks={weeks.map((w) => ({
            week_start: w.week_start,
            value: conv(openKpi, w[openKpi], 'week', w.week_start),
            raw: num(w[openKpi]),
          }))}
          onClose={() => setOpenKpi(null)}
        />
      )}
      {openKpi === 'mrr' && (
        <Detail title="Retainer MRR" value={fmt(num(sc?.current?.mrr), 'dollars')} onClose={() => setOpenKpi(null)}>
          <Explain>
            Monthly recurring revenue: what retainer clients pay you every month, in Canadian dollars. It
            is the steadiest money a media business can have — it arrives whether or not Google sends
            readers that week. The target is {fmt(targetOf('mrr')?.target, 'dollars')} a month.
          </Explain>
          <h3>Where the next retainer comes from</h3>
          <DetailTable
            head={['Stage', 'Leads']}
            right={[1]}
            rows={[
              ['New — not contacted yet', 'new'],
              ['Contacted — waiting to hear back', 'contacted'],
              ['Engaged — they replied', 'engaged'],
              ['Proposal sent', 'proposal'],
              ['Won', 'won'],
            ].map(([name, k]) => [name, String(num((sc?.current?.pipeline || {})[k]) || 0)])}
          />
          <p className="acts-row">
            <Link className="btn" href="/admin/leads">
              Open leads
            </Link>
          </p>
        </Detail>
      )}

      <div className="grid2">
        <section className="card" aria-labelledby="wk-h">
          <div className="chead">
            <h2 id="wk-h">
              Weekly trend <small>last 12 full weeks</small>
            </h2>
            <Seg
              label="Weekly chart type"
              value={kind.wk}
              onChange={(k) => pickKind('wk', k)}
              options={[
                { k: 'bar', label: 'Bars' },
                { k: 'line', label: 'Line' },
              ]}
            />
          </div>
          <Tabs
            label="Weekly metric"
            value={weekTab}
            onChange={setWeekTab}
            options={WEEKLY_TABS.map((t) => ({ k: t.k, label: t.label }))}
          />
          <div className="chart">
            <Chart
              kind={kind.wk}
              items={weeklyItems}
              unit={unitFor(weekTab, weeklyUnitDef)}
              currency={currency}
              target={weeklyTarget ? conv(weekTab, weeklyTarget.target, 'latest') : null}
            />
          </div>
          <p className="cnote">{weeklyNote}</p>
        </section>

        <section className="card" aria-labelledby="mo-h">
          <div className="chead">
            <h2 id="mo-h">
              Monthly trend <small>{monthly.note}</small>
            </h2>
            <Seg
              label="Monthly chart type"
              value={kind.mo}
              onChange={(k) => pickKind('mo', k)}
              options={[
                { k: 'bar', label: 'Bars' },
                { k: 'line', label: 'Line' },
              ]}
            />
          </div>
          <Tabs
            label="Monthly metric"
            value={monthTab}
            onChange={setMonthTab}
            options={MONTHLY_TABS}
          />
          <div className="chart">
            <Chart
              kind={kind.mo}
              items={monthly.items}
              unit={monthly.unit}
              currency={currency}
              target={null}
              empty={monthly.empty}
            />
          </div>
          <p className="cnote">
            {monthly.caption +
              (isMoneyUnit(monthly.unit) ? currencyNote(currency, 'month') : '')}
          </p>
        </section>
      </div>

      <div className="grid2">
        <section className="card" aria-labelledby="in-h">
          <h2 id="in-h">
            Insights{' '}
            <small>
              {insights.length
                ? `from the ${day(insights[0].dump_on)} data${
                    currency === 'CAD' ? ' · dollar amounts in USD' : ''
                  }`
                : ''}
            </small>
          </h2>
          <p className="cnote" style={{ margin: '0 0 10px' }}>
            Page-by-page earnings, searches within reach and titles to fix are on{' '}
            <Link href="/admin/content">Content</Link>.
          </p>
          <ul className="ins">
            {insights.length ? (
              insights.slice(0, 6).map((i, idx) => {
                const tone = TONE[i.tone] || { k: 'none' as const, l: i.tone };
                return (
                  <li key={idx}>
                    <span className={`chip ${tone.k}`}>{tone.l}</span>
                    <b>{i.headline}</b>
                    <span>
                      {i.detail} <em>{i.sources}</em>
                    </span>
                  </li>
                );
              })
            ) : (
              <li>
                <span />
                <span className="muted">
                  No insights recorded yet. Share a data dump and Claude adds them.
                </span>
              </li>
            )}
          </ul>
        </section>

        <section className="card" aria-labelledby="pr-h">
          <h2 id="pr-h">
            Priorities <small>{total ? `${done.length} of ${total} done` : ''}</small>
          </h2>
          <div className="progress" aria-hidden="true">
            <i style={{ width: total ? `${((100 * done.length) / total).toFixed(1)}%` : 0 }} />
          </div>
          <ul className="acts">
            {open.length ? (
              open
                .slice(0, 6)
                .map((a, i) => (
                  <ActionRow
                    key={a.id}
                    action={a}
                    n={i + 1}
                    today={today}
                    onDone={markDone}
                    busy={busyId === Number(a.id)}
                    disabled={busyId !== null}
                  />
                ))
            ) : (
              <li>
                <span />
                <span className="muted">Nothing open.</span>
              </li>
            )}
          </ul>
          {rest.length > 0 && (
            <details>
              <summary>{rest.length} more open</summary>
              <ul className="acts">
                {rest.map((a, i) => (
                  <ActionRow
                    key={a.id}
                    action={a}
                    n={i + 7}
                    today={today}
                    onDone={markDone}
                    busy={busyId === Number(a.id)}
                    disabled={busyId !== null}
                  />
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="dn-h">
        <h2 id="dn-h">
          Done <small>{done.length ? `${done.length} completed` : ''}</small>
        </h2>
        <ul className="done">
          {done.length ? (
            done.map((a) => (
              <li key={a.id}>
                <span className="d">{a.completed_at ? day(a.completed_at) : 'done'}</span>
                <span title={a.detail}>{a.title}</span>
              </li>
            ))
          ) : (
            <li>
              <span />
              <span className="muted">Nothing completed yet.</span>
            </li>
          )}
        </ul>
      </section>

      <details className="card" style={{ marginTop: 12 }}>
        <summary>All KPIs vs target</summary>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Latest</th>
                <th>4-wk avg</th>
                <th>Target</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <AllKpiRows sc={sc} weeks={weeks} currency={currency} conv={conv} />
            </tbody>
          </table>
        </div>
      </details>

      <p className="links">
        <a
          href="https://claude.ai/artifact/RpHRQi8oymGosgiPiTb4Ky"
          target="_blank"
          rel="noopener noreferrer"
        >
          Playbook — the full plan →
        </a>
        <a
          href="https://claude.ai/artifact/BfbMGT312xmHUctFSCd718"
          target="_blank"
          rel="noopener noreferrer"
        >
          Deep-dive report →
        </a>
        <span>
          Targets: <code>kpi_targets</code> · Actions: <code>ops_actions</code> · Insights:{' '}
          <code>ops_insights</code>
        </span>
      </p>
    </AdminShell>
  );
}

const isMoneyUnit = (u: Unit) => u === 'usd' || u === 'dollars';

// ─── monthly series ─────────────────────────────────────────────────────────

type Conv = (metric: string, value: unknown, at: 'week' | 'month' | 'window' | 'latest', key?: string) => number | null;

function monthlySeries(
  sc: Scorecard | null,
  tab: string,
  thisMonth: string,
  conv: Conv,
): { items: ChartItem[]; unit: Unit; note: string; caption: string; empty: string } {
  const mt = sc?.monthly_trend || {};
  const calendar = (source: string) =>
    (mt.calendar || [])
      .filter((r) => r.source === source)
      .sort((a, b) => (a.month < b.month ? -1 : 1));

  if (MEDIAVINE_MONTHS.includes(tab)) {
    const unit: Unit = ['revenue', 'page_rpm', 'session_rpm'].includes(tab) ? 'usd' : 'count';
    const per1000 = (a: unknown, b: unknown) => {
      const x = num(a);
      const y = num(b);
      return x !== null && y ? Math.round((x / y) * 100000) / 100 : null;
    };
    const items = calendar('mediavine').map((r) => ({
      label: monthLabel(r.month),
      value: conv(
        tab,
        tab === 'page_rpm'
          ? per1000(r.revenue, r.pageviews)
          : tab === 'session_rpm'
            ? per1000(r.revenue, r.sessions)
            : num(r[tab]),
        'month',
        r.month,
      ),
      partial: r.month === thisMonth,
      est: ['pageviews', 'page_rpm'].includes(tab) && r.estimated === true,
      title: r.month,
    }));
    const captions: Record<string, string> = {
      session_rpm:
        "RPM is revenue per 1,000 sessions, the same number Mediavine's dashboard shows as RPM. The lighter bar is this month so far.",
      sessions:
        'Sessions come from your all-time export with All Traffic selected. Its May and June totals match your dashboard exactly.',
      page_rpm:
        'Revenue per 1,000 pageviews. July uses 12 estimated pageview days (Jul 19–30), so it could be anywhere from US$9.41 to US$9.51. The lighter bar is this month so far.',
      pageviews:
        'All months add up exactly to your all-time 832,324 pageviews. July includes 12 estimated days (within about 1%). The lighter bar is this month so far.',
    };
    return {
      items,
      unit,
      note: 'Mediavine, calendar months',
      caption:
        captions[tab] ||
        'May and June come from your dashboard. July to September are summed from your daily exports, which match it to the cent. The lighter bar is this month so far.',
      empty: 'No calendar-month Mediavine numbers loaded yet',
    };
  }

  if (tab === 'visitors') {
    const items = calendar('vercel')
      .filter((r) => num(r.visitors) !== null && r.month >= '2026-05')
      .map((r) => ({
        label: monthLabel(r.month),
        value: num(r.visitors),
        partial: r.month === thisMonth,
        title: r.month,
      }));
    return {
      items,
      unit: 'count',
      note: 'Vercel, calendar months',
      caption:
        'Straight from Vercel Analytics (Production), the same monthly numbers as its chart. Vercel counts every visit; Mediavine only counts visits where ads loaded, so its numbers run lower. The lighter bar is this month so far.',
      empty: 'No calendar-month visitor numbers loaded yet',
    };
  }

  const rows =
    tab === 'subs'
      ? (mt.subscribers || []).map((r) => ({ month: r.month, value: num(r.net) }))
      : (mt.members || []).map((r) => ({ month: r.month, value: num(r.new) }));
  return {
    items: rows.map((r) => ({
      label: monthLabel(r.month),
      value: r.value,
      partial: r.month === thisMonth,
      title: r.month,
    })),
    unit: 'count',
    note: 'calendar months, live from the site',
    caption:
      'Counted straight from your database. The lighter one is this month so far. Subscriber figures are net of unsubscribes and bounced addresses.',
    empty: 'Nothing counted yet',
  };
}

// ─── all KPIs vs target ─────────────────────────────────────────────────────

function AllKpiRows({
  sc,
  weeks,
  currency,
  conv,
}: {
  sc: Scorecard | null;
  weeks: WeekRow[];
  currency: Currency;
  conv: Conv;
}) {
  const last = weeks[weeks.length - 1];
  const monthlyValues: MetricRow = sc?.monthly ?? {};
  const currentValues: MetricRow = sc?.current ?? {};
  let pillar = '';
  const rows: ReactNode[] = [];

  (sc?.targets || []).forEach((t) => {
    let v: number | null;
    if (t.cadence === 'weekly') {
      v = last ? num(last[t.metric]) : null;
      if (v === null && sc?.current) v = num(sc.current[t.metric]);
    } else if (t.cadence === 'monthly') {
      v = num(monthlyValues[t.metric]);
    } else {
      v = num(currentValues[t.metric]);
    }
    const raw = v;
    // The target is stated in USD, so status compares the unconverted value.
    const shown =
      t.cadence === 'weekly' && last
        ? conv(t.metric, v, 'week', last.week_start)
        : conv(t.metric, v, 'window');
    const recent =
      t.cadence === 'weekly'
        ? weeks
            .slice(-4)
            .map((w) => conv(t.metric, w[t.metric], 'week', w.week_start))
            .filter((x): x is number => x !== null)
        : [];
    const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
    const u = unitFor(t.metric, t.unit);

    if (t.pillar !== pillar) {
      pillar = t.pillar;
      rows.push(
        <tr key={`grp-${pillar}`}>
          <td className="grp" colSpan={5}>
            {pillar}
          </td>
        </tr>,
      );
    }
    rows.push(
      <tr key={t.metric}>
        <td title={t.why}>{t.label}</td>
        <td>{fmt(shown, u, false, currency)}</td>
        <td>{fmt(avg, u, false, currency)}</td>
        <td>{fmt(conv(t.metric, t.target, 'latest'), u, false, currency)}</td>
        <td>
          <Chip s={statusOf(t, raw)} />
        </td>
      </tr>,
    );
  });

  return <>{rows}</>;
}

// ─── data freshness ─────────────────────────────────────────────────────────

function Freshness({ sc, today }: { sc: Scorecard | null; today: string }) {
  const f = sc?.freshness;
  if (!f) return <p className="fresh" />;
  const parts: { label: string; iso?: string | null }[] = [
    { label: 'Mediavine', iso: f.mediavine_daily_through },
    { label: 'Google', iso: f.search_console_through },
    { label: 'Bing', iso: f.bing_through },
    { label: 'GA4', iso: f.ga4_through },
    { label: 'Clarity', iso: f.clarity_loaded },
  ];
  return (
    <p className="fresh">
      Data through:{' '}
      {parts.map((p, i) => {
        const age = p.iso ? daysBetween(today, p.iso) : null;
        return (
          <span key={p.label}>
            {i > 0 && ' · '}
            {p.label}{' '}
            {p.iso ? (
              <>
                {day(p.iso)}
                {age !== null && age > 9 && <span className="old"> old</span>}
              </>
            ) : (
              <span className="old">none</span>
            )}
          </span>
        );
      })}
    </p>
  );
}

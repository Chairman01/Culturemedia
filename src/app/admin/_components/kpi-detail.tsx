'use client';

// What is behind a Scorecard tile: what the number means, where it stands
// against its target, and the weeks that led here.

import type { Target } from '@/lib/admin-types';
import { Detail, DetailTable, Explain } from './detail';
import { CHIP_HELP, day, fmt, num, statusOf, trailingAvg, type Currency, type Unit } from './format';
import { Chip } from './ui';

export interface KpiWeek {
  week_start: string;
  /** In the display currency. */
  value: number | null;
  /** As stored: targets are compared against this one. */
  raw: number | null;
}

// What each number is, in the owner's words rather than the dashboard's.
const MEANING: Record<string, string> = {
  revenue:
    'What Mediavine ads earned in the week, Monday to Sunday. It follows traffic, and what the articles are about matters as much as how many people read them — the Insights list below the charts shows which topics pay best.',
  pageviews:
    'How many pages were read in the week. It is the raw fuel for ad revenue, and mostly comes from Google Discover and Search picking up new articles.',
  discover_clicks:
    'Readers Google sent from the Discover feed on phones. It arrives in bursts — one story picked up can be a whole week — so watch the trend, not a single week.',
  search_clicks:
    'Readers who found you by searching Google. Slower to grow than Discover and much steadier, because it comes from articles that keep answering a question.',
  net_subscribers:
    'New newsletter sign-ups minus people who left, in the week. Subscribers are the audience you own: they come back without Google sending them, and they are what a sponsor pays to reach.',
  new_members: 'People who made a free account in the week.',
  articles_published:
    'Articles published in the week. It is the one number here that is entirely in your hands, and the others follow it a few weeks later.',
};

export function KpiDetail({
  metric,
  label,
  target,
  weeks,
  unit,
  currency,
  source,
  through,
  onClose,
}: {
  metric: string;
  label: string;
  target: Target | undefined;
  /** Oldest first, full weeks only. */
  weeks: KpiWeek[];
  unit: Unit;
  currency: Currency;
  /** Where the number is loaded from, when it is loaded rather than counted. */
  source?: string;
  /** The last day that source has been loaded through. */
  through?: string | null;
  onClose: () => void;
}) {
  const show = (v: number | null) => fmt(v, unit, false, currency);
  const loaded = weeks.filter((w) => w.value !== null);
  const latest = loaded[loaded.length - 1];
  // Averages end at the newest loaded week, in the display currency for the
  // figures and unconverted for the chip, which compares against a USD target.
  let at = weeks.length - 1;
  while (at >= 0 && weeks[at].value === null) at -= 1;
  const values = weeks.map((w) => w.value);
  const average = trailingAvg(values, at, 4);
  const quarter = trailingAvg(values, at, 13);
  // The same 4-week average three months (12 weeks) earlier, for the trend.
  const earlier = trailingAvg(values, at - 12, 4);
  const trendPct =
    average !== null && earlier !== null && earlier !== 0 ? ((average - earlier) / Math.abs(earlier)) * 100 : null;
  const rawSeries = weeks.map((w) => w.raw);
  const avg4raw = trailingAvg(rawSeries, at, 4);
  const avg13raw = trailingAvg(rawSeries, at, 13);
  const standing = statusOf(target, avg4raw ?? latest?.raw ?? null, avg13raw);
  const best = loaded.reduce<KpiWeek | null>((b, w) => (!b || (w.value ?? 0) > (b.value ?? 0) ? w : b), null);
  const last12 = weeks.slice(-12);
  const hits = last12.filter((w) => statusOf(target, w.raw, avg13raw)?.k === 'ok').length;
  const missing = weeks.length > 0 && weeks[weeks.length - 1].value === null;

  return (
    <Detail title={label} value={latest ? show(latest.value) : '—'} onClose={onClose}>
      <Explain>
        {MEANING[metric] || target?.why || 'A weekly count.'}
        {target?.why && MEANING[metric] ? ` ${target.why}` : ''}
      </Explain>

      {standing && (
        <p className="cnote">
          <Chip s={standing} title={CHIP_HELP} /> Judged on the 4-week average against the target. Improving means better
          than your 90-day average.
        </p>
      )}

      <dl className="facts">
        <div>
          <dt>Latest week</dt>
          <dd>
            {latest ? show(latest.value) : '—'}
            <small>{latest ? `week of ${day(latest.week_start)}` : 'nothing loaded'}</small>
          </dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>
            {target ? fmt(num(target.target), unit, false, 'USD') : '—'}
            <small>{target ? `a week · ${target.direction === 'lower' ? 'lower' : 'higher'} is better` : 'none set'}</small>
          </dd>
        </div>
        <div>
          <dt>4-week average</dt>
          <dd>
            {show(average)}
            <small>what the chip is judged on</small>
          </dd>
        </div>
        <div>
          <dt>90-day average</dt>
          <dd>
            {show(quarter)}
            <small>last 13 weeks · the bar for Improving</small>
          </dd>
        </div>
        <div>
          <dt>A year at this pace</dt>
          <dd>
            {show(average !== null ? average * 52 : null)}
            <small>4-week average × 52</small>
          </dd>
        </div>
        <div>
          <dt>Best week</dt>
          <dd>
            {best ? show(best.value) : '—'}
            <small>{best ? `week of ${day(best.week_start)}` : ''}</small>
          </dd>
        </div>
      </dl>

      {target && (
        <p className="cnote">
          On target in {hits} of the last {last12.length} weeks.
          {unit === 'usd' && currency === 'CAD' ? ' The target is set in US dollars, as Mediavine reports.' : ''}
        </p>
      )}
      {missing && source && (
        <p className="banner warn" role="status">
          The newest week is not loaded from {source} yet{through ? ` — data runs through ${day(through)}` : ''}. The
          figure above is the latest week that is. It is a gap in loading, not a zero.
        </p>
      )}

      <h3>Week by week</h3>
      {trendPct !== null && (
        <p className="cnote">
          The 4-week average is {Math.abs(trendPct) < 0.5 ? 'flat' : trendPct > 0 ? 'up' : 'down'}
          {Math.abs(trendPct) < 0.5 ? '' : ` ${Math.abs(trendPct).toFixed(0)}%`} on three months ago
          {earlier !== null ? ` (${show(earlier)} then, ${show(average)} now)` : ''}.
        </p>
      )}
      <DetailTable
        head={['Week of', label, '4-wk avg', 'Change', 'Against target']}
        right={[1, 2, 3]}
        rows={[...last12].reverse().map((w) => {
          const i = weeks.indexOf(w);
          const before = i > 0 ? weeks[i - 1].value : null;
          const change =
            w.value !== null && before !== null && before !== 0
              ? `${w.value >= before ? '▲' : '▼'} ${Math.abs(((w.value - before) / Math.abs(before)) * 100).toFixed(0)}%`
              : '—';
          return [
            day(w.week_start),
            w.value === null ? 'not loaded' : show(w.value),
            show(trailingAvg(values, i, 4)),
            change,
            <Chip key="c" s={statusOf(target, w.raw, avg13raw)} />,
          ];
        })}
      />
      {source && <p className="cnote">Loaded from {source}{through ? `, through ${day(through)}` : ''}. Weeks start Monday, Edmonton time.</p>}
    </Detail>
  );
}

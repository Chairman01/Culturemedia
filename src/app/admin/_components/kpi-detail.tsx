'use client';

// What is behind a Scorecard tile: what the number means, where it stands
// against its target, and the weeks that led here.

import type { Target } from '@/lib/admin-types';
import { Detail, DetailTable, Explain } from './detail';
import { day, fmt, num, statusOf, type Currency, type Unit } from './format';
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
  const recent = loaded.slice(-4);
  const average = recent.length ? recent.reduce((a, w) => a + (w.value ?? 0), 0) / recent.length : null;
  const best = loaded.reduce<KpiWeek | null>((b, w) => (!b || (w.value ?? 0) > (b.value ?? 0) ? w : b), null);
  const last12 = weeks.slice(-12);
  const hits = last12.filter((w) => statusOf(target, w.raw)?.k === 'ok').length;
  const missing = weeks.length > 0 && weeks[weeks.length - 1].value === null;

  return (
    <Detail title={label} value={latest ? show(latest.value) : '—'} onClose={onClose}>
      <Explain>
        {MEANING[metric] || target?.why || 'A weekly count.'}
        {target?.why && MEANING[metric] ? ` ${target.why}` : ''}
      </Explain>

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
            <small>smooths out one-off weeks</small>
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
      <DetailTable
        head={['Week of', label, 'Change', 'Against target']}
        right={[1, 2]}
        rows={[...last12].reverse().map((w) => {
          const i = weeks.indexOf(w);
          const before = i > 0 ? weeks[i - 1].value : null;
          const change =
            w.value !== null && before !== null && before !== 0
              ? `${w.value >= before ? '▲' : '▼'} ${Math.abs(((w.value - before) / Math.abs(before)) * 100).toFixed(0)}%`
              : '—';
          return [day(w.week_start), w.value === null ? 'not loaded' : show(w.value), change, <Chip key="c" s={statusOf(target, w.raw)} />];
        })}
      />
      {source && <p className="cnote">Loaded from {source}{through ? `, through ${day(through)}` : ''}. Weeks start Monday, Edmonton time.</p>}
    </Detail>
  );
}

// Number, date and currency formatting for the admin pages.
//
// Every formatter here is deterministic: no Intl, no `new Date()` for "today".
// These run once on the server and again during hydration, so a locale table or
// a clock difference between the two would show up as a hydration mismatch.
// Pages get today's Edmonton date as a prop instead (see edmontonToday()).

import type { Fx, Target } from '@/lib/admin-types';

export type Currency = 'USD' | 'CAD';

export type Unit = 'dollars' | 'usd' | 'percent' | 'ms' | 'score' | 'pages' | 'count' | string;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 1234567 → "1,234,567" — same output on the server and in the browser. */
export function group(n: number): string {
  const neg = n < 0;
  const digits = Math.abs(n).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + digits;
}

export function fmt(v: unknown, unit: Unit, compact = false, currency: Currency = 'USD'): string {
  const n = num(v);
  if (n === null) return '—';

  if (unit === 'dollars' || unit === 'usd') {
    // Retainer money is already CAD ("dollars"); Mediavine money is USD unless
    // it has been converted, and then it is labelled C$.
    const sym = unit === 'usd' ? (currency === 'CAD' ? 'C$' : compact ? '$' : 'US$') : '$';
    return sym + (Math.abs(n) >= 100 ? group(Math.round(n)) : n.toFixed(2).replace(/\.00$/, ''));
  }
  if (unit === 'percent') return `${n.toFixed(1)}%`;
  if (unit === 'ms') return `${Math.round(n)} ms`;
  if (unit === 'score') return n.toFixed(3);
  if (unit === 'pages') return n.toFixed(2);
  if (compact && Math.abs(n) >= 10000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k`;
  return n % 1 && Math.abs(n) < 100 ? n.toFixed(1) : group(Math.round(n));
}

/** Plain CAD, for retainer and pipeline figures that are already in dollars. */
export function money(v: unknown): string {
  const n = num(v);
  return n === null ? '—' : `$${group(Math.round(n))}`;
}

/** A whole-dollar amount labelled with its currency: "C$9,710", "−US$1,240". */
export function cash(v: unknown, currency: Currency): string {
  const n = num(v);
  if (n === null) return '—';
  const rounded = Math.round(n);
  return `${rounded < 0 ? '−' : ''}${currency === 'CAD' ? 'C$' : 'US$'}${group(Math.abs(rounded))}`;
}

/** "2026-09-17" or a timestamp → "Sep 17". */
export function day(iso?: string | null): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}

/** "2026-09" → "Sep". */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(String(month));
  return m ? MONTHS[Number(m[2]) - 1] : String(month);
}

/** Whole days between two YYYY-MM-DD dates (a - b), ignoring time of day. */
export function daysBetween(a: string, b: string): number | null {
  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
    return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const x = parse(a);
  const y = parse(b);
  if (x === null || y === null) return null;
  return Math.round((x - y) / 86400000);
}

export function ago(iso: string | null | undefined, today: string): string {
  if (!iso) return 'never';
  const d = daysBetween(today, iso);
  if (d === null) return String(iso);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

// ─── status against target ────────────────────────────────────────────────────

export interface StatusChip {
  k: 'ok' | 'warn' | 'crit' | 'none';
  l: string;
}

export function statusOf(t: Target | undefined, v: number | null): StatusChip | null {
  if (!t) return null;
  if (v === null) return { k: 'none', l: 'No data' };
  const higher = t.direction === 'higher';
  const target = num(t.target);
  const base = num(t.baseline);
  if (target !== null && (higher ? v >= target : v <= target)) return { k: 'ok', l: 'On target' };
  if (base !== null && v === base) {
    return base === 0 ? { k: 'crit', l: 'Not started' } : { k: 'warn', l: 'At start' };
  }
  if (base !== null && (higher ? v > base : v < base)) return { k: 'warn', l: 'Improving' };
  return { k: 'crit', l: 'Behind' };
}

// ─── currency ─────────────────────────────────────────────────────────────────

/**
 * Only Mediavine money is in USD. Retainer and pipeline figures (mrr, booked,
 * in_play, deal_value) are already CAD and must never be converted.
 */
const USD_METRICS = new Set([
  'revenue',
  'session_rpm',
  'page_rpm',
  'cpm',
  'revenue_per_article',
  'monthly_ad_revenue',
]);

export const isMoney = (metric: string): boolean => USD_METRICS.has(metric);

/** Money metrics render with the currency symbol; everything else keeps its own unit. */
export const unitFor = (metric: string, unit: Unit): Unit => (isMoney(metric) ? 'usd' : unit);

export type RateKind = 'week' | 'month' | 'window' | 'latest';

/** Bank of Canada average rate for that week or month, falling back to the latest. */
export function rateFor(fx: Fx | null | undefined, kind: RateKind, key?: string): number | null {
  const f = fx || {};
  const latest = f.latest ? num(f.latest.rate) : null;
  if (kind === 'week') {
    return (
      num((f.weekly || {})[key ?? '']) ??
      num((f.monthly || {})[String(key ?? '').slice(0, 7)]) ??
      latest
    );
  }
  if (kind === 'month') return num((f.monthly || {})[key ?? '']) ?? latest;
  if (kind === 'window') return num(f.window_30d) ?? latest;
  return latest;
}

export function convert(
  fx: Fx | null | undefined,
  currency: Currency,
  metric: string,
  value: unknown,
  kind: RateKind,
  key?: string,
): number | null {
  const v = num(value);
  if (v === null || currency !== 'CAD' || !isMoney(metric)) return v;
  const rate = rateFor(fx, kind, key);
  return rate ? v * rate : v;
}

export const currencyNote = (currency: Currency, period: 'week' | 'month'): string =>
  currency === 'CAD'
    ? ` Converted from USD at the Bank of Canada average rate for each ${period}.`
    : ' In USD, as Mediavine reports it.';

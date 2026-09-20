// All the money the business takes in, from every source, in one currency.
//
// Two ledgers feed this:
//   • public.revenue_invoices — partnerships, retainers, AdSense, anything
//     invoiced by hand. Already CAD.
//   • the scorecard's Mediavine calendar months — USD, converted to CAD here at
//     that month's Bank of Canada average (the same rates the scorecard uses).
// Money counts in the month it was PAID (cash basis), so an unpaid invoice is
// "owed", not revenue. No server imports: the pages use this math directly.

import type { Scorecard } from './admin-types';

export const INVOICE_CATEGORIES = ['partnership', 'retainer', 'adsense', 'other'] as const;
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'] as const;
export const WORK_STATUSES = ['pending', 'in_progress', 'complete'] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  partnership: 'Partnership',
  retainer: 'Retainer',
  adsense: 'AdSense',
  other: 'Other',
};
export const STATUS_LABEL: Record<string, string> = { draft: 'Draft', sent: 'Sent — unpaid', paid: 'Paid', void: 'Void' };
export const WORK_LABEL: Record<string, string> = { pending: 'Work owed', in_progress: 'In progress', complete: 'Complete' };

export interface Invoice {
  id: number;
  invoice_number: string | null;
  customer: string;
  email: string | null;
  category: string;
  invoiced_on: string;
  amount: number | string;
  paid_on: string | null;
  amount_paid: number | string;
  status: string;
  work_status: string;
  currency: string;
  notes: string | null;
}

/** The two things the business sells. Colour follows these, never their rank. */
export type Source = 'ads' | 'partnerships';
export const SOURCE_LABEL: Record<Source, string> = { ads: 'Ads', partnerships: 'Partnerships & retainers' };
export const SOURCE_COLOR: Record<Source, string> = { ads: '#2563eb', partnerships: '#eb6834' };
const sourceOf = (category: string): Source => (category === 'adsense' ? 'ads' : 'partnerships');

export interface Split {
  ads: number;
  partnerships: number;
  total: number;
}

export interface RevenueSummary {
  thisYear: number;
  years: (Split & { year: number })[];
  /** Twelve months of this year, with last year's total alongside. */
  months: (Split & { month: string; lastYear: number; partial: boolean; future: boolean })[];
  /** Jan 1 → today, this year and the same stretch of last year. */
  ytd: Split;
  ytdLastYear: Split;
  /** Invoiced and not yet paid. */
  owed: number;
  owedCount: number;
  /** Paid for, work not delivered yet. */
  workOwed: Invoice[];
  /** True when a Mediavine month had no exchange rate and used the latest. */
  approxFx: boolean;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const blank = (): Split => ({ ads: 0, partnerships: 0, total: 0 });
function add(target: Split, source: Source, amount: number) {
  target[source] += amount;
  target.total += amount;
}

interface Entry {
  date: string; // YYYY-MM-DD the money landed
  source: Source;
  amount: number; // CAD
}

export function summarise(invoices: Invoice[], sc: Scorecard | null, today: string): RevenueSummary {
  const entries: Entry[] = [];
  let approxFx = false;

  for (const inv of invoices) {
    if (inv.status !== 'paid') continue;
    const amount = n(inv.amount_paid);
    if (amount <= 0) continue;
    entries.push({ date: inv.paid_on || inv.invoiced_on, source: sourceOf(inv.category), amount });
  }

  // Mediavine pays in USD; a month lands on its last day (or today, if running).
  const fx = sc?.fx;
  const latest = n(fx?.latest?.rate) || 1;
  for (const row of sc?.monthly_trend?.calendar ?? []) {
    if (row.source !== 'mediavine') continue;
    const usd = n(row.revenue);
    if (usd <= 0) continue;
    const rate = n(fx?.monthly?.[row.month]);
    if (!rate) approxFx = true;
    const [y, m] = row.month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    entries.push({
      date: lastDay > today && row.month === today.slice(0, 7) ? today : lastDay,
      source: 'ads',
      amount: usd * (rate || latest),
    });
  }

  const thisYear = Number(today.slice(0, 4));
  const lastYearCutoff = `${thisYear - 1}${today.slice(4)}`;
  const thisMonth = today.slice(0, 7);

  const byYear = new Map<number, Split>();
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = `${thisYear}-${String(i + 1).padStart(2, '0')}`;
    return { ...blank(), month, lastYear: 0, partial: month === thisMonth, future: month > thisMonth };
  });
  const ytd = blank();
  const ytdLastYear = blank();

  for (const e of entries) {
    const year = Number(e.date.slice(0, 4));
    if (!byYear.has(year)) byYear.set(year, blank());
    add(byYear.get(year)!, e.source, e.amount);

    const slot = months[Number(e.date.slice(5, 7)) - 1];
    if (year === thisYear) {
      add(slot, e.source, e.amount);
      if (e.date <= today) add(ytd, e.source, e.amount);
    } else if (year === thisYear - 1) {
      slot.lastYear += e.amount;
      if (e.date <= lastYearCutoff) add(ytdLastYear, e.source, e.amount);
    }
  }

  // Every year from the first sale to now, so a year with nothing still shows.
  const first = Math.min(thisYear, ...byYear.keys());
  const years = [];
  for (let y = first; y <= thisYear; y += 1) years.push({ year: y, ...(byYear.get(y) ?? blank()) });

  const unpaid = invoices.filter((i) => i.status === 'sent');
  return {
    thisYear,
    years,
    months,
    ytd,
    ytdLastYear,
    owed: unpaid.reduce((a, i) => a + Math.max(0, n(i.amount) - n(i.amount_paid)), 0),
    owedCount: unpaid.length,
    workOwed: invoices.filter((i) => i.status === 'paid' && i.work_status !== 'complete'),
    approxFx,
  };
}

/** "▲ 38%", "▼ 12%", or "▲ 84×" once a percentage stops meaning anything; null with nothing to compare. */
export function growth(now: number, before: number): { text: string; up: boolean } | null {
  if (before <= 0) return null;
  const pct = ((now - before) / before) * 100;
  if (pct >= 1000) return { text: `▲ ${Math.round(now / before)}×`, up: true };
  return { text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%`, up: pct >= 0 };
}

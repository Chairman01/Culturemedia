// All the money the business takes in and spends, in one currency of your choice.
//
// Three ledgers feed this:
//   • public.revenue_invoices — partnerships, retainers, AdSense, anything
//     invoiced by hand. CAD.
//   • public.revenue_expenses — running costs, one figure per category per
//     month. CAD.
//   • the scorecard's Mediavine calendar months — USD, converted to CAD here at
//     that month's Bank of Canada average (the same rates the scorecard uses).
// Money counts in the month it was PAID (cash basis), so an unpaid invoice is
// "owed", not revenue. No server imports: the pages use this math directly.

import type { Scorecard } from './admin-types';
import { monthRate } from './fx-history';

export type Currency = 'USD' | 'CAD';

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

export interface Expense {
  id: number;
  /** First of the month, YYYY-MM-01. */
  month: string;
  category: string;
  /** Negative is a credit or refund. */
  amount: number | string;
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
  /** Every figure below is in this currency. */
  currency: Currency;
  thisYear: number;
  /** `expenses` is null for a year with no expenses on file — unknown, not zero. */
  years: (Split & { year: number; expenses: number | null })[];
  /** Twelve months of this year, with last year's total alongside. */
  months: (Split & { month: string; lastYear: number; expenses: number; partial: boolean; future: boolean })[];
  /** This year's costs so far, and what is left after them. */
  ytdExpenses: number;
  ytdKept: number;
  /** This year's costs by category, largest first. */
  expenseCategories: { category: string; total: number }[];
  /** The first month with expenses on file, YYYY-MM, or null. */
  expensesSince: string | null;
  /** Jan 1 → today, this year and the same stretch of last year. */
  ytd: Split;
  ytdLastYear: Split;
  /** Invoiced and not yet paid. */
  owed: number;
  owedCount: number;
  /** Paid for, work not delivered yet. */
  workOwed: Invoice[];
  /** True when some month had no published exchange rate and used the latest. */
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
  amount: number; // in the chosen currency
}

export function summarise(
  invoices: Invoice[],
  sc: Scorecard | null,
  today: string,
  options: { currency?: Currency; expenses?: Expense[] } = {},
): RevenueSummary {
  const currency: Currency = options.currency ?? 'CAD';
  const expenses = options.expenses ?? [];
  const entries: Entry[] = [];
  let approxFx = false;
  const fx = sc?.fx;

  /** Money recorded in `from`, in the month YYYY-MM, expressed in the chosen currency. */
  const convert = (amount: number, from: string, month: string): number => {
    if (from === currency) return amount;
    const { rate, exact } = monthRate(fx, month);
    if (!exact) approxFx = true;
    return from === 'USD' ? amount * rate : amount / rate;
  };

  for (const inv of invoices) {
    if (inv.status !== 'paid') continue;
    const amount = n(inv.amount_paid);
    if (amount <= 0) continue;
    const date = inv.paid_on || inv.invoiced_on;
    entries.push({
      date,
      source: sourceOf(inv.category),
      amount: convert(amount, inv.currency || 'CAD', date.slice(0, 7)),
    });
  }

  // Mediavine pays in USD; a month lands on its last day (or today, if running).
  for (const row of sc?.monthly_trend?.calendar ?? []) {
    if (row.source !== 'mediavine') continue;
    const usd = n(row.revenue);
    if (usd <= 0) continue;
    const [y, m] = row.month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    entries.push({
      date: lastDay > today && row.month === today.slice(0, 7) ? today : lastDay,
      source: 'ads',
      amount: convert(usd, 'USD', row.month),
    });
  }

  const thisYear = Number(today.slice(0, 4));
  const lastYearCutoff = `${thisYear - 1}${today.slice(4)}`;
  const thisMonth = today.slice(0, 7);

  const byYear = new Map<number, Split>();
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = `${thisYear}-${String(i + 1).padStart(2, '0')}`;
    return { ...blank(), month, lastYear: 0, expenses: 0, partial: month === thisMonth, future: month > thisMonth };
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

  // Expenses: one figure per category per month, counted in that month.
  const spentByYear = new Map<number, number>();
  const spentByCategory = new Map<string, number>();
  let ytdExpenses = 0;
  let expensesSince: string | null = null;
  for (const e of expenses) {
    const month = e.month.slice(0, 7);
    const amount = convert(n(e.amount), e.currency || 'CAD', month);
    // A figure entered ahead of time is a plan, not money spent.
    if (month > thisMonth) continue;
    const year = Number(month.slice(0, 4));
    spentByYear.set(year, (spentByYear.get(year) ?? 0) + amount);
    if (!expensesSince || month < expensesSince) expensesSince = month;
    if (year === thisYear) {
      months[Number(month.slice(5, 7)) - 1].expenses += amount;
      ytdExpenses += amount;
      spentByCategory.set(e.category, (spentByCategory.get(e.category) ?? 0) + amount);
    }
  }

  // Every year from the first sale to now, so a year with nothing still shows.
  const first = Math.min(thisYear, ...byYear.keys());
  const years = [];
  for (let y = first; y <= thisYear; y += 1) {
    years.push({ year: y, ...(byYear.get(y) ?? blank()), expenses: spentByYear.has(y) ? spentByYear.get(y)! : null });
  }

  const unpaid = invoices.filter((i) => i.status === 'sent');
  return {
    currency,
    thisYear,
    years,
    months,
    ytd,
    ytdLastYear,
    ytdExpenses,
    ytdKept: ytd.total - ytdExpenses,
    expenseCategories: [...spentByCategory.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total),
    expensesSince,
    owed: unpaid.reduce(
      (a, i) => a + convert(Math.max(0, n(i.amount) - n(i.amount_paid)), i.currency || 'CAD', i.invoiced_on.slice(0, 7)),
      0,
    ),
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

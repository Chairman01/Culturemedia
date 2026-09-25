// Turns what the admin already loads — the scorecard, invoices, expenses and
// the Mediavine source split — into the valuation model's input, in USD.
//
// Builds its own month series rather than reusing the Revenue summary, whose
// months stop at January of this year: a trailing twelve months has to reach
// back into last year. Same exchange rates as the Revenue page (monthRate).
// Pure, so the Scorecard card and the Valuation page get identical numbers.

import type { Scorecard } from './admin-types';
import { monthRate } from './fx-history';
import type { Expense, Invoice } from './revenue';
import type { ValuationInput, ValuationMonth } from './valuation';

/** YYYY-MM, `offset` months from `month`. */
function shift(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function valuationInput(args: {
  sc: Scorecard | null;
  invoices: Invoice[];
  expenses: Expense[];
  sources: { source: string; sessions: number }[];
  today: string;
}): ValuationInput {
  const { sc, invoices, expenses, sources, today } = args;
  const thisMonth = today.slice(0, 7);
  const toUsd = (amount: number, from: string, month: string) =>
    from === 'USD' ? amount : amount / monthRate(sc?.fx, month).rate;

  // Twelve complete months back, plus the month in progress.
  const byMonth = new Map<string, ValuationMonth>();
  for (let i = 12; i >= 0; i -= 1) {
    const month = shift(thisMonth, -i);
    byMonth.set(month, { month, ads: 0, partnerships: 0, total: 0, expenses: 0, partial: month === thisMonth, future: false });
  }

  for (const inv of invoices) {
    if (inv.status !== 'paid') continue;
    const amount = Number(inv.amount_paid) || 0;
    const date = inv.paid_on || inv.invoiced_on;
    const slot = byMonth.get(date.slice(0, 7));
    if (!slot || amount <= 0) continue;
    const usd = toUsd(amount, inv.currency || 'CAD', slot.month);
    // AdSense is ad income, like Mediavine; everything else a business paid you.
    if (inv.category === 'adsense') slot.ads += usd;
    else slot.partnerships += usd;
  }
  for (const row of sc?.monthly_trend?.calendar ?? []) {
    if (row.source !== 'mediavine') continue;
    const slot = byMonth.get(row.month.slice(0, 7));
    if (slot) slot.ads += Number(row.revenue) || 0;
  }
  for (const e of expenses) {
    const slot = byMonth.get(e.month.slice(0, 7));
    if (slot) slot.expenses += toUsd(Number(e.amount) || 0, e.currency || 'CAD', slot.month);
  }
  const months = [...byMonth.values()].map((m) => ({ ...m, total: m.ads + m.partnerships }));

  // Pageviews in the last complete Mediavine month, for the per-reader comparisons.
  const mv = (sc?.monthly_trend?.calendar ?? [])
    .filter((r) => r.source === 'mediavine' && r.month.slice(0, 7) < thisMonth && Number(r.pageviews) > 0)
    .sort((a, b) => a.month.localeCompare(b.month));
  const lastMv = mv[mv.length - 1];

  const fx = Number(sc?.fx?.latest?.rate);
  const sessions = sources.reduce((a, x) => a + x.sessions, 0);
  const weeks = (sc?.weeks || []).filter((w) => !w.is_current_week).slice(-8);
  const articles = weeks.map((w) => Number(w.articles_published)).filter((n) => Number.isFinite(n) && n > 0);

  return {
    months,
    fxUsdCad: Number.isFinite(fx) && fx > 0 ? fx : 1.37,
    subscribers: Number(sc?.current?.active_subscribers) || 0,
    members: Number(sc?.current?.total_members) || 0,
    pageviews: lastMv ? Number(lastMv.pageviews) || 0 : 0,
    pageviewsMonth: lastMv ? lastMv.month.slice(0, 7) : null,
    sources: sessions ? sources.map((x) => ({ source: x.source, share: x.sessions / sessions })) : [],
    articlesPerWeek: articles.length ? articles.reduce((a, n) => a + n, 0) / articles.length : null,
    mrrCad: Number(sc?.current?.mrr) || 0,
    today,
  };
}

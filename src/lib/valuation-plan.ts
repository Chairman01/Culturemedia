// The road to a target valuation: what the business would have to earn, and a
// planner that turns levers (pageviews, partners, sponsored sends and posts,
// costs) into a monthly profit and the two prices a buyer might pay.
//
// Package prices come from packages.ts, so changing a price there changes the
// plan. Everything is USD unless a name says CAD. Pure: no server imports.

import { PACKAGES } from './packages';
import { BRAND, COMPARABLES, MULTIPLE, PER_POST, type Valuation, type ValuationInput } from './valuation';

/** CAD price of a package, read from its price label ("$1,200 / month" → 1200). */
function priceOf(key: string): number {
  const p = PACKAGES.find((x) => x.key === key)?.price ?? '';
  return Number(p.replace(/\/.*$/, '').replace(/[^0-9.]/g, '')) || 0;
}

export const PRICES_CAD = {
  alwaysOn: priceOf('always_on'),
  category: priceOf('category'),
  feature: priceOf('feature'),
};

// A sponsored send in a local consumer newsletter: general and news titles fetch
// about US$8–30 per 1,000 subscribers (beehiiv, 2026). $20 for a local list with
// good opens.
export const NEWSLETTER_CPM = 20;

// Daily Hive's price over its revenue: what a media company paid for revenue.
const DH = COMPARABLES[0];
export const REVENUE_MULTIPLE = DH.priceCad / (DH.revenueCad as number);

export interface Plan {
  /** A month. */
  pageviews: number;
  /** Ad earnings, US$ per 1,000 pageviews. */
  rpm: number;
  alwaysOn: number;
  category: number;
  /** One-off Feature Stories a month. */
  features: number;
  subscribers: number;
  /** Sponsored newsletter sends a month. */
  sends: number;
  /** Instagram followers across every account. */
  instagram: number;
  /** Sponsored Instagram posts a month. */
  posts: number;
  /** US$ a month: writers, sales help, hosting, tools. */
  costs: number;
}

export interface PlanLine {
  key: keyof Plan | 'ads';
  label: string;
  monthly: number;
}

export interface PlanResult {
  lines: PlanLine[];
  revenue: number;
  net: number;
  /** A website buyer: monthly profit × the mid multiple, plus the name. */
  marketplace: number;
  /** A media company on Daily Hive's terms: a year's revenue × its multiple. */
  strategic: number;
}

export function planResult(p: Plan, fx: number, igAccounts: number): PlanResult {
  const perPost = (p.instagram / Math.max(1, igAccounts)) * PER_POST.mid;
  const lines: PlanLine[] = [
    { key: 'ads', label: 'Ads on the site', monthly: (p.pageviews / 1000) * p.rpm },
    { key: 'alwaysOn', label: 'Always-On partners', monthly: (p.alwaysOn * PRICES_CAD.alwaysOn) / fx },
    { key: 'category', label: 'Category Sponsors', monthly: (p.category * PRICES_CAD.category) / fx },
    { key: 'features', label: 'Feature Stories', monthly: (p.features * PRICES_CAD.feature) / fx },
    { key: 'sends', label: 'Sponsored newsletters', monthly: (p.subscribers / 1000) * NEWSLETTER_CPM * p.sends },
    { key: 'posts', label: 'Sponsored Instagram posts', monthly: p.posts * perPost },
  ];
  const revenue = lines.reduce((a, l) => a + l.monthly, 0);
  const net = revenue - p.costs;
  return {
    lines,
    revenue,
    net,
    marketplace: Math.max(0, net) * MULTIPLE.mid + BRAND.mid,
    strategic: revenue * 12 * REVENUE_MULTIPLE,
  };
}

/** Today's business, in the planner's terms. */
export function todayPlan(input: ValuationInput): Plan {
  const complete = input.months.filter((m) => !m.partial && !m.future).sort((a, b) => a.month.localeCompare(b.month));
  const last3 = complete.slice(-3);
  const lastMonth = complete[complete.length - 1];
  const avg = (f: (m: (typeof complete)[number]) => number) => (last3.length ? last3.reduce((a, m) => a + f(m), 0) / last3.length : 0);
  const partnershipsCad = avg((m) => m.partnerships) * input.fxUsdCad;
  return {
    pageviews: input.pageviews,
    rpm: lastMonth && input.pageviews ? Math.round(((lastMonth.ads / input.pageviews) * 1000) * 100) / 100 : 0,
    alwaysOn: PRICES_CAD.alwaysOn ? Math.round(input.mrrCad / PRICES_CAD.alwaysOn) : 0,
    category: 0,
    // Retainers are invoiced too, so only what is left over counts as one-off features.
    features: PRICES_CAD.feature ? Math.round(Math.max(0, partnershipsCad - input.mrrCad) / PRICES_CAD.feature) : 0,
    subscribers: input.subscribers,
    sends: 0,
    instagram: input.social.filter((s) => s.platform === 'instagram').reduce((a, s) => a + s.followers, 0),
    posts: 0,
    costs: Math.round(avg((m) => m.expenses)),
  };
}

/** Checkpoints on the way, each with one mix of levers that gets there. */
export const RUNGS: { target: number; mix: string; plan: Plan }[] = [
  {
    target: 100_000,
    mix: 'About 400,000 pageviews a month, one Always-On partner and a Feature Story a month.',
    plan: { pageviews: 400_000, rpm: 7, alwaysOn: 1, category: 0, features: 1, subscribers: 3_000, sends: 0, instagram: 50_000, posts: 0, costs: 500 },
  },
  {
    target: 250_000,
    mix: 'About 800,000 pageviews, two partners, two features a month, a sponsor in every weekly newsletter and two paid Instagram posts.',
    plan: { pageviews: 800_000, rpm: 8, alwaysOn: 2, category: 0, features: 2, subscribers: 6_000, sends: 4, instagram: 70_000, posts: 2, costs: 2_000 },
  },
  {
    target: 500_000,
    mix: 'About 1.2 million pageviews, five partners and a Category Sponsor, four features a month, 12,000 subscribers and a paid post every week.',
    plan: { pageviews: 1_200_000, rpm: 9, alwaysOn: 5, category: 1, features: 4, subscribers: 12_000, sends: 4, instagram: 100_000, posts: 4, costs: 5_400 },
  },
  {
    target: 1_000_000,
    mix: 'About 2 million pageviews, ten partners and four Category Sponsors, eight features a month, 25,000 subscribers, 150,000 Instagram followers and two paid posts a week, with a small team.',
    plan: { pageviews: 2_000_000, rpm: 10, alwaysOn: 10, category: 4, features: 8, subscribers: 25_000, sends: 4, instagram: 150_000, posts: 8, costs: 14_500 },
  },
];

/** Monthly profit a website buyer would need to see to pay `targetUsd` at full price. */
export function netNeeded(targetUsd: number): number {
  return Math.max(0, targetUsd - BRAND.mid) / MULTIPLE.mid;
}

/** Revenue a year a media company would need to see to pay `targetUsd` on Daily Hive's terms. */
export function revenueNeeded(targetUsd: number): number {
  return targetUsd / REVENUE_MULTIPLE;
}

/** How fast profit must grow to go from `from` to `to` a month in `years`. */
export function growthNeeded(from: number, to: number, years: number): { yearly: number; monthly: number } | null {
  if (from <= 0 || to <= from) return null;
  const yearly = Math.pow(to / from, 1 / years);
  return { yearly, monthly: Math.pow(yearly, 1 / 12) - 1 };
}

/** Where the business stands against a target, for the progress bar. */
export function progressTo(v: Valuation, targetUsd: number): number {
  return Math.max(0, Math.min(1, v.total.mid / targetUsd));
}

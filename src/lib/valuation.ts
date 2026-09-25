// What the business would sell for today, worked out the way a buyer or a
// broker would: trailing net profit × a market multiple, adjusted for the risks
// they price in, plus the newsletter list and the brand on top.
//
// Every number here comes from the same figures the Revenue and Scorecard pages
// show, so it moves with each Wednesday drop. The multiples and per-subscriber
// values are market assumptions, named and sourced below so they can be argued
// with. Pure: no server imports.

import { PLATFORM_NAME, type SocialAccount, type SocialPlatform } from './social-accounts';

export interface ValuationMonth {
  /** YYYY-MM. */
  month: string;
  /** All in one currency (USD). */
  ads: number;
  partnerships: number;
  total: number;
  expenses: number;
  partial: boolean;
  future: boolean;
}

export interface ValuationInput {
  months: ValuationMonth[];
  /** 1 USD in CAD. */
  fxUsdCad: number;
  subscribers: number;
  members: number;
  /** Pageviews and sessions in the last complete month (Mediavine). */
  pageviews: number;
  sessions: number;
  /** The month those pageviews are from, YYYY-MM. */
  pageviewsMonth: string | null;
  /** Share of sessions by traffic source, 0–1, from Mediavine. */
  sources: { source: string; share: number }[];
  /** Recent average, or null when unknown. */
  articlesPerWeek: number | null;
  /** Retainer MRR, CAD. */
  mrrCad: number;
  /** Social accounts and their follower counts. */
  social: SocialAccount[];
  /** Published articles on the site, or null when unknown. */
  articles: number | null;
  today: string;
}

/** One thing the business owns, and how a buyer counts it. */
export interface Asset {
  name: string;
  /** What there is: "20,800 followers", "837 articles". */
  have: string;
  how: string;
  /** Its own value, USD; null when it is counted inside another line. */
  value: Range | null;
  url?: string;
}

export interface Range {
  low: number;
  mid: number;
  high: number;
}

export interface Basis {
  key: 'twelve' | 'six' | 'three';
  title: string;
  who: string;
  monthsUsed: number;
  /** Monthly net profit, USD. */
  net: number;
  /** Before adjustments. */
  raw: Range;
  /** After adjustments. */
  value: Range;
}

export interface Adjustment {
  id: string;
  /** Multiplier applied to the site value, e.g. 0.8. */
  factor: number;
  title: string;
  why: string;
}

export interface Driver {
  title: string;
  detail: string;
  /** Rough lift, USD, when it can be estimated. */
  lift?: number;
}

/** A Canadian city-media sale with published terms. CAD, as announced. */
export interface Comparable {
  name: string;
  buyer: string;
  /** YYYY-MM. */
  date: string;
  priceCad: number;
  monthlyPageviews: number | null;
  /** Social followers across platforms, as announced. */
  followers: number | null;
  revenueCad: number | null;
  profitCad: number | null;
  note: string;
  url: string;
}

export const COMPARABLES: Comparable[] = [
  {
    name: 'Daily Hive',
    buyer: 'ZoomerMedia',
    date: '2022-09',
    priceCad: 16_400_000,
    monthlyPageviews: 24_000_000,
    followers: 3_200_000,
    revenueCad: 7_500_000,
    profitCad: 625_000,
    note: 'Vancouver, Calgary, Edmonton, Toronto and Montreal; 3.2 million followers on Instagram, TikTok, Facebook and X; founded 2008. $6M cash, $5M note, $3M shares and $2.4M of debt taken on.',
    url: 'https://finance.yahoo.com/news/zoomermedia-announces-acquisition-daily-hive-013300406.html',
  },
  {
    name: 'blogTO',
    buyer: 'ZoomerMedia',
    date: '2022-01',
    priceCad: 15_072_400,
    monthlyPageviews: 29_000_000,
    followers: null,
    revenueCad: null,
    profitCad: null,
    note: 'Toronto; 350 million pageviews in 2021 and 6 million readers a month; founded 2004. Price from ZoomerMedia\'s filing; revenue not disclosed.',
    url: 'https://www.marketscreener.com/quote/stock/ZOOMERMEDIA-LIMITED-49478144/news/ZoomerMedia-Limited-acquired-Freshdaily-Inc-for-CAD-15-0724-million-37636830/',
  },
  {
    name: 'Curiocity',
    buyer: 'ZoomerMedia',
    date: '2024-02',
    priceCad: 5_000_000,
    monthlyPageviews: null,
    followers: null,
    revenueCad: null,
    profitCad: null,
    note: 'City guides in several Canadian markets; all cash. Audience and revenue not disclosed in a comparable form.',
    url: 'https://www.globenewswire.com/news-release/2024/02/20/2832385/0/en/ZoomerMedia-announces-acquisition-of-Curiocity-amplifying-its-digital-presence-in-Canada.html',
  },
];

export interface ComparableRead {
  sale: Comparable;
  /** How the deal was priced, in words: "2.2× revenue", "C$0.52 per monthly pageview". */
  measure: string;
  /** The same measure applied to this business, USD; null when the deal published too little. */
  implied: number | null;
  /** The same, adjusted for how much less this site earns per reader. */
  adjusted: number | null;
}

export interface Valuation {
  today: string;
  fxUsdCad: number;
  history: {
    firstMonth: string | null;
    completeMonths: number;
    /** Months until a buyer has the 12 they want. */
    monthsToTwelve: number;
  };
  bases: Basis[];
  /** The basis the headline uses. */
  headline: Basis['key'];
  adjustments: Adjustment[];
  /** Product of the adjustment factors. */
  factor: number;
  pieces: { key: string; title: string; detail: string; value: Range }[];
  /** Everything the business owns, and how each is counted. */
  assets: Asset[];
  total: Range;
  /** The current month, at its pace so far, for context. */
  pace: { month: string; netSoFar: number; projected: number; daysIn: number } | null;
  drivers: Driver[];
  /** The multiples and unit values used. */
  assumptions: { multiple: Range; perSubscriber: Range; brand: Range; perPost: Range; perMember: Range };
  /** Big Canadian city-media sales, read against this business. */
  comparables: ComparableRead[];
  /** What a strategic buyer might pay on the Daily Hive terms, site only, USD. */
  strategic: Range | null;
  /** Revenue earned per 1,000 pageviews, this site and Daily Hive, CAD. */
  revenuePerThousand: { ours: number | null; dailyHive: number };
  /** Revenue a year per social follower, CAD. */
  revenuePerFollower: { ours: number | null; dailyHive: number };
  /** Followers across every account. */
  followers: number;
}

// Content sites monetised by display ads sell for 25–40× monthly net profit on
// the main marketplaces (Empire Flippers averaged 33.2× in 2025; Motion Invest
// 28–32×; Flippa's baseline 30×). Sites with a falling trend or one fragile
// traffic source trade at 12–20×.
export const MULTIPLE: Range = { low: 25, mid: 30, high: 36 };
// A free consumer newsletter list, when sold with the site: $1–3 a subscriber
// (Flippa's guide gives $1–10 across niches; local news sits at the low end).
export const PER_SUBSCRIBER: Range = { low: 1, mid: 2, high: 3 };
// A member account (a reader who signed up on the site). Nearly all are on the
// list already and counted there; a logged-in, commenting reader is worth a
// little more than an address, so each adds this on top.
export const PER_MEMBER: Range = { low: 0.5, mid: 1, high: 2 };
// One sponsored post, per follower, USD. Brands pay $100–500 a post for
// 10K–100K Instagram accounts (Influencer Marketing Hub, 2026), and the Spotlight
// package sells a story inside C$350 — so about half a cent to two cents a follower.
export const PER_POST: Range = { low: 0.005, mid: 0.01, high: 0.02 };
// A buyer pays for this many months of one sponsored post a month per account,
// because it is income the accounts could carry, not income they carry yet.
const MONTHS_PAID: Range = { low: 6, mid: 9, high: 12 };
// Text-first platforms rarely sell sponsored posts: a third of the rate.
const TEXT_PLATFORMS: SocialPlatform[] = ['threads', 'bluesky', 'x', 'linkedin', 'pinterest'];
// The name and the domain: worth something to the buyer who takes the site, little on their own.
export const BRAND: Range = { low: 500, mid: 1500, high: 2500 };

export const SOURCES: { title: string; url: string; note: string }[] = [
  {
    title: 'Empire Flippers – content site multiples',
    url: 'https://exitbid.io/blog/empire-flippers-review-2026',
    note: 'Average content site sold at 33.2× monthly net profit in 2025; priced on a 12-month average.',
  },
  {
    title: 'Flippa – how much can you sell your website for',
    url: 'https://flippa.com/blog/how-much-can-you-sell-your-website-for/',
    note: 'Content sites 25–40× monthly profit; 30× baseline; longevity earns a premium.',
  },
  {
    title: 'Content site valuation, 2026',
    url: 'https://newormedia.com/blog/website-valuation-2026/',
    note: 'Buyers want 6–12 months of verified revenue; trailing 6 months for newer sites; single-channel traffic and owner dependence compress the multiple.',
  },
  {
    title: 'Flippa – newsletter multiples',
    url: 'https://flippa.com/blog/newsletter-channel-multiples-how-to-evaluate-a-newsletters-worth/',
    note: '$1–10 per subscriber depending on niche and engagement; 30–45× monthly net for a newsletter business.',
  },
  {
    title: 'Influencer Marketing Hub – Instagram rates, 2026',
    url: 'https://influencermarketinghub.com/influencer-rates/instagram-influencer-rates/',
    note: 'Brands pay $100–500 a feed post for accounts with 10K–100K followers; engagement and niche move it.',
  },
];

const SOCIAL = /reddit|facebook|instagram|threads|tiktok|twitter|x\.com|bsky|pinterest/i;

const scale = (r: Range, k: number): Range => ({ low: r.low * k, mid: r.mid * k, high: r.high * k });
const add = (a: Range, b: Range): Range => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const round = (r: Range): Range => ({ low: Math.round(r.low), mid: Math.round(r.mid), high: Math.round(r.high) });

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function buildValuation(input: ValuationInput): Valuation {
  const complete = input.months
    .filter((m) => !m.future && !m.partial)
    .sort((a, b) => a.month.localeCompare(b.month));
  const net = (m: ValuationMonth) => m.total - m.expenses;

  // History: complete months since the ads started earning.
  const firstEarning = complete.find((m) => m.ads > 0)?.month ?? null;
  const earning = firstEarning ? complete.filter((m) => m.month >= firstEarning) : [];
  const completeMonths = earning.length;
  const monthsToTwelve = Math.max(0, 12 - completeMonths);

  // Three bases. A month before the ads started counts as zero income (it was),
  // which is exactly the haircut a strict buyer applies.
  const last = (n: number) => complete.slice(-n);
  const avg = (rows: ValuationMonth[], over: number) => (over ? rows.reduce((a, m) => a + net(m), 0) / over : 0);
  const rawBases: Omit<Basis, 'value' | 'raw'>[] = [
    { key: 'twelve', title: 'Last 12 months', who: 'What a broker lists it at: the trailing twelve-month average, empty months included.', monthsUsed: Math.min(12, complete.length), net: avg(last(12), 12) },
    { key: 'six', title: 'Last 6 months', who: 'What buyers use for a newer or changing site.', monthsUsed: Math.min(6, complete.length), net: avg(last(6), 6) },
    { key: 'three', title: 'Last 3 months', who: 'What you would argue for, with the trend on your side; buyers rarely pay on it.', monthsUsed: Math.min(3, complete.length), net: avg(last(3), 3) },
  ];

  // Adjustments a buyer prices in.
  const adjustments: Adjustment[] = [];
  if (completeMonths < 6) {
    adjustments.push({
      id: 'history',
      factor: 0.75,
      title: `Only ${completeMonths} full ${completeMonths === 1 ? 'month' : 'months'} of ad revenue`,
      why: 'The main marketplaces want six to twelve months before they will list a site, and a private buyer takes a quarter off for the same reason. This is the discount that time removes on its own.',
    });
  } else if (completeMonths < 12) {
    adjustments.push({
      id: 'history',
      factor: 0.9,
      title: `${completeMonths} months of ad revenue, not yet twelve`,
      why: 'Listable, but a buyer still cannot see a full year; expect about a tenth off until they can.',
    });
  }
  const social = input.sources.filter((s) => SOCIAL.test(s.source)).reduce((a, s) => a + s.share, 0);
  const top = [...input.sources].sort((a, b) => b.share - a.share)[0];
  // Mediavine lowercases source names; show them the way people write them.
  const topName = top ? top.source.charAt(0).toUpperCase() + top.source.slice(1) : '';
  if (top && SOCIAL.test(top.source) && top.share >= 0.35) {
    const heavy = top.share >= 0.5;
    adjustments.push({
      id: 'traffic',
      factor: heavy ? 0.8 : 0.9,
      title: `${Math.round(top.share * 100)}% of sessions come from ${topName}`,
      why: `Social traffic arrives in bursts and can stop; a buyer pays for what repeats. Search and newsletter readers are the ones they value. Social sources together are ${Math.round(social * 100)}% of sessions.`,
    });
  }
  if (input.articlesPerWeek !== null && input.articlesPerWeek >= 20) {
    adjustments.push({
      id: 'owner',
      factor: 0.9,
      title: `About ${Math.round(input.articlesPerWeek)} articles a week, written by the owner`,
      why: 'News does not keep earning the way evergreen pages do, and a buyer has to replace your hours. Sites that run on ten owner-hours a week or fewer get the full multiple.',
    });
  }
  const three = rawBases.find((b) => b.key === 'three')!;
  const six = rawBases.find((b) => b.key === 'six')!;
  if (six.net > 0 && three.net >= 1.5 * six.net) {
    adjustments.push({
      id: 'growth',
      factor: 1.1,
      title: 'Revenue is rising fast',
      why: `The last three months average ${(three.net / six.net).toFixed(1)}× the last six. Buyers pay a little more for a rising line — once they believe it will hold.`,
    });
  }
  const factor = adjustments.reduce((a, x) => a * x.factor, 1);

  const bases: Basis[] = rawBases.map((b) => {
    const raw = scale(MULTIPLE, Math.max(0, b.net));
    return { ...b, raw: round(raw), value: round(scale(raw, factor)) };
  });

  // Headline on the six-month basis: strict enough to be believed, current
  // enough to be fair. Fall back to twelve if there are not six months yet.
  const headline: Basis['key'] = completeMonths >= 3 ? 'six' : 'twelve';
  const site = bases.find((b) => b.key === headline)!.value;
  const list = round(scale(PER_SUBSCRIBER, input.subscribers));
  const members = round(scale(PER_MEMBER, input.members));
  // Each account: one sponsored post a month at its rate, for the months a buyer pays for.
  const accountValue = (a: SocialAccount): Range => {
    const k = TEXT_PLATFORMS.includes(a.platform) ? 1 / 3 : 1;
    return round({
      low: a.followers * PER_POST.low * k * MONTHS_PAID.low,
      mid: a.followers * PER_POST.mid * k * MONTHS_PAID.mid,
      high: a.followers * PER_POST.high * k * MONTHS_PAID.high,
    });
  };
  const accounts = input.social.map((a) => ({ account: a, value: accountValue(a) }));
  const socialTotal = round(accounts.reduce((a, s) => add(a, s.value), { low: 0, mid: 0, high: 0 }));
  const followers = input.social.reduce((a, s) => a + s.followers, 0);
  const pieces = [
    {
      key: 'site',
      title: 'The site and its ad income',
      detail: `Monthly net on the ${bases.find((b) => b.key === headline)!.title.toLowerCase()} basis, × ${MULTIPLE.low}–${MULTIPLE.high}, after the adjustments below.`,
      value: site,
    },
    {
      key: 'list',
      title: `Newsletter list · ${input.subscribers.toLocaleString('en-CA')} subscribers`,
      detail: `$${PER_SUBSCRIBER.low}–${PER_SUBSCRIBER.high} each for a free local list sold with the site.`,
      value: list,
    },
    ...(followers
      ? [
          {
            key: 'social',
            title: `Social accounts · ${followers.toLocaleString('en-CA')} followers`,
            detail: `${input.social.length} accounts. One sponsored post a month on each at ${PER_POST.low * 100}–${PER_POST.high * 100}¢ a follower, for the ${MONTHS_PAID.low}–${MONTHS_PAID.high} months a buyer pays for.`,
            value: socialTotal,
          },
        ]
      : []),
    ...(input.members
      ? [
          {
            key: 'members',
            title: `Member accounts · ${input.members.toLocaleString('en-CA')}`,
            detail: `Readers who signed up on the site. Most are on the list already; each adds $${PER_MEMBER.low}–${PER_MEMBER.high} on top.`,
            value: members,
          },
        ]
      : []),
    {
      key: 'brand',
      title: 'Name and domain',
      detail: 'Culture Alberta and culturealberta.com: worth something to the buyer who takes the site, little on their own.',
      value: BRAND,
    },
  ];
  const total = round(pieces.reduce((a, p) => add(a, p.value), { low: 0, mid: 0, high: 0 }));

  // The month in progress, for context only.
  const partial = input.months.find((m) => m.partial && m.month === input.today.slice(0, 7));
  const pace = partial
    ? (() => {
        const daysIn = Number(input.today.slice(8, 10));
        const netSoFar = net(partial);
        return { month: partial.month, netSoFar, projected: daysIn ? (netSoFar / daysIn) * daysInMonth(partial.month) : netSoFar, daysIn };
      })()
    : null;

  // What would raise it, with the numbers.
  const drivers: Driver[] = [];
  if (monthsToTwelve > 0 && six.net > 0) {
    // The same adjustments as today, minus the short-history one that time removes.
    const history = adjustments.find((a) => a.id === 'history')?.factor ?? 1;
    const later = factor / history;
    const lowThen = six.net * MULTIPLE.mid * later;
    const highThen = Math.max(lowThen, three.net * MULTIPLE.mid * later);
    const now = site.mid;
    drivers.push({
      title: `Keep going for ${monthsToTwelve} more ${monthsToTwelve === 1 ? 'month' : 'months'}`,
      detail: `Then a buyer sees a full year. If profit holds between the last six months' pace (about $${Math.round(six.net).toLocaleString('en-CA')} a month) and the last three months' (about $${Math.round(three.net).toLocaleString('en-CA')}), the short-history discount goes away and the site alone is worth about $${Math.round(lowThen).toLocaleString('en-CA')}–${Math.round(highThen).toLocaleString('en-CA')}, against $${now.toLocaleString('en-CA')} today. Nothing else you can do is worth as much as this.`,
      lift: Math.max(0, (lowThen + highThen) / 2 - now),
    });
  }
  if (input.mrrCad <= 0) {
    const retainer = 500 / input.fxUsdCad;
    drivers.push({
      title: 'Land one monthly retainer',
      detail: `One C$500-a-month retainer adds about $${Math.round(retainer).toLocaleString('en-CA')} a month of profit — roughly $${Math.round(retainer * MULTIPLE.mid).toLocaleString('en-CA')} of value at the same ${MULTIPLE.mid}× multiple, as long as the sponsor stays with the site after a sale. It also makes the income depend less on Google and Reddit, which a buyer notices.`,
      lift: retainer * MULTIPLE.mid,
    });
  }
  if (top && SOCIAL.test(top.source) && top.share >= 0.35) {
    drivers.push({
      title: `Grow search and newsletter traffic so ${topName} is under a third`,
      detail: `That removes the ${Math.round((1 - (adjustments.find((a) => a.id === 'traffic')?.factor ?? 1)) * 100)}% traffic discount. The Content page lists the searches within reach and the titles to fix; the newsletter is the audience you own.`,
    });
  }
  const visual = accounts.filter((s) => !TEXT_PLATFORMS.includes(s.account.platform));
  if (visual.length) {
    const perPost = visual.reduce((a, s) => a + s.account.followers, 0) / visual.length * PER_POST.mid;
    const monthly = perPost * visual.length;
    const already = visual.reduce((a, s) => a + s.value.mid, 0);
    drivers.push({
      title: 'Sell one sponsored post a month on each Instagram',
      detail: `At about $${Math.round(perPost).toLocaleString('en-CA')} a post, that is $${Math.round(monthly).toLocaleString('en-CA')} a month. Kept up for a year, it stops being reach a buyer guesses at and becomes income they pay the full ${MULTIPLE.mid}× for — about $${Math.round(monthly * MULTIPLE.mid).toLocaleString('en-CA')}, against the $${Math.round(already).toLocaleString('en-CA')} the accounts are counted at today. This is how Daily Hive earned its money (below).`,
      lift: Math.max(0, monthly * MULTIPLE.mid - already),
    });
  }
  drivers.push({
    title: 'Grow the list',
    detail: `Every 1,000 subscribers adds about $${(PER_SUBSCRIBER.low * 1000).toLocaleString('en-CA')}–${(PER_SUBSCRIBER.high * 1000).toLocaleString('en-CA')} directly, and a buyer reads a growing list as a business that can live without Google.`,
  });
  if (input.articlesPerWeek !== null && input.articlesPerWeek >= 20) {
    drivers.push({
      title: 'Make it run without you',
      detail: 'Write down how a week works and hand some of it to a freelancer. A buyer who can see ten owner-hours a week pays the full multiple; one who sees forty takes a tenth off and wonders how to replace you.',
    });
  }

  // Biggest first; the ones that cannot be priced keep their order at the end.
  drivers.sort((a, b) => (b.lift ?? -1) - (a.lift ?? -1));

  // ── Canadian comparables ──
  // Revenue earned per 1,000 pageviews: Daily Hive's direct sales earned far more
  // per reader than programmatic ads do, so a per-pageview price is adjusted by it.
  const lastComplete = complete[complete.length - 1];
  const oursPerThousand =
    lastComplete && input.pageviews > 0 ? ((lastComplete.total * input.fxUsdCad) / input.pageviews) * 1000 : null;
  const dh = COMPARABLES[0];
  const dhPerThousand = ((dh.revenueCad as number) / ((dh.monthlyPageviews as number) * 12)) * 1000;
  const quality = oursPerThousand ? Math.min(1, oursPerThousand / dhPerThousand) : null;
  const runRate = (rows: ValuationMonth[]) => (rows.length ? (rows.reduce((a, m) => a + m.total, 0) / rows.length) * 12 : 0);
  const revenueMultiple = (dh.priceCad as number) / (dh.revenueCad as number);
  const ourRevenueCad = runRate(last(3)) * input.fxUsdCad;
  const dhPerFollower = (dh.revenueCad as number) / (dh.followers as number);
  const oursPerFollower = followers && ourRevenueCad ? ourRevenueCad / followers : null;
  const comparables: ComparableRead[] = COMPARABLES.flatMap((c): ComparableRead[] => {
    if (c.revenueCad) {
      const implied = runRate(last(3)) * revenueMultiple;
      const rows: ComparableRead[] = [
        { sale: c, measure: `${revenueMultiple.toFixed(1)}× a year's revenue (${Math.round(c.priceCad / (c.profitCad || 1))}× its profit)`, implied, adjusted: implied },
      ];
      if (c.followers && followers) {
        const perFollower = c.priceCad / c.followers;
        const byFollowers = (followers * perFollower) / input.fxUsdCad;
        rows.push({
          sale: c,
          measure: `C$${perFollower.toFixed(2)} per social follower`,
          implied: byFollowers,
          adjusted: oursPerFollower !== null ? byFollowers * Math.min(1, oursPerFollower / dhPerFollower) : null,
        });
      }
      return rows;
    }
    if (c.monthlyPageviews) {
      const perView = c.priceCad / c.monthlyPageviews;
      const implied = (input.pageviews * perView) / input.fxUsdCad;
      return [{
        sale: c,
        measure: `C$${perView.toFixed(2)} per monthly pageview`,
        implied: input.pageviews ? implied : null,
        adjusted: input.pageviews && quality !== null ? implied * quality : null,
      }];
    }
    return [{ sale: c, measure: 'Too little published to compare', implied: null, adjusted: null }];
  });
  const strategic =
    runRate(last(6)) > 0
      ? round({ low: runRate(last(6)) * revenueMultiple, mid: runRate(last(3)) * revenueMultiple, high: Math.max(runRate(last(3)), runRate(last(6))) * revenueMultiple * 1.15 })
      : null;

  const headlineBasis = bases.find((b) => b.key === headline)!;
  const reddit = input.sources.filter((s) => /reddit/i.test(s.source)).reduce((a, s) => a + s.share, 0);
  const assets: Asset[] = [
    {
      name: 'Readers',
      have: input.pageviews
        ? `${input.pageviews.toLocaleString('en-CA')} pageviews and ${input.sessions.toLocaleString('en-CA')} sessions a month`
        : 'Not loaded yet',
      how: 'Counted through the money they bring in (the site line) and, directly, in the Canadian sales below. A buyer pays for readers once, through what they earn.',
      value: null,
    },
    {
      name: 'The article archive',
      have: input.articles !== null ? `${input.articles.toLocaleString('en-CA')} published articles` : 'Published articles',
      how: 'The pages that earn the ad income, so they are counted in the site line.',
      value: null,
    },
    {
      name: 'The site and its ad income',
      have: `US$${Math.round(headlineBasis.net).toLocaleString('en-CA')} a month net, ${headlineBasis.title.toLowerCase()}`,
      how: `Monthly net × ${MULTIPLE.low}–${MULTIPLE.high}, less what a buyer takes off.`,
      value: site,
    },
    {
      name: 'Newsletter list',
      have: `${input.subscribers.toLocaleString('en-CA')} subscribers`,
      how: `$${PER_SUBSCRIBER.low}–${PER_SUBSCRIBER.high} a subscriber.`,
      value: list,
    },
    ...(input.members
      ? [{ name: 'Member accounts', have: `${input.members.toLocaleString('en-CA')} members`, how: `Mostly on the list already; $${PER_MEMBER.low}–${PER_MEMBER.high} each on top.`, value: members }]
      : []),
    ...accounts.map((s) => ({
      name: `${PLATFORM_NAME[s.account.platform]} ${s.account.handle}`,
      have: `${s.account.followers.toLocaleString('en-CA')} followers`,
      how: TEXT_PLATFORMS.includes(s.account.platform)
        ? 'Few brands pay for posts here yet: a third of the Instagram rate.'
        : `About $${Math.round(s.account.followers * PER_POST.low)}–${Math.round(s.account.followers * PER_POST.high)} a sponsored post.`,
      value: s.value,
      url: s.account.url,
    })),
    { name: 'Name and domain', have: 'Culture Alberta · culturealberta.com', how: 'Nominal beside the site.', value: BRAND },
    ...(reddit >= 0.1
      ? [{
          name: 'Reddit traffic',
          have: `${Math.round(reddit * 100)}% of sessions`,
          how: 'Not something you own or can hand over: it arrives when posts are shared. It earns inside the site line, and is why a buyer takes some off.',
          value: null,
        }]
      : []),
  ];

  return {
    today: input.today,
    fxUsdCad: input.fxUsdCad,
    history: { firstMonth: firstEarning, completeMonths, monthsToTwelve },
    bases,
    headline,
    adjustments,
    factor,
    pieces,
    assets,
    total,
    pace,
    drivers,
    assumptions: { multiple: MULTIPLE, perSubscriber: PER_SUBSCRIBER, brand: BRAND, perPost: PER_POST, perMember: PER_MEMBER },
    comparables,
    strategic,
    revenuePerThousand: { ours: oursPerThousand, dailyHive: dhPerThousand },
    revenuePerFollower: { ours: oursPerFollower, dailyHive: dhPerFollower },
    followers,
  };
}

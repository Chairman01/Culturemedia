// What the business would sell for today, worked out the way a buyer or a
// broker would: trailing net profit × a market multiple, adjusted for the risks
// they price in, plus the newsletter list and the brand on top.
//
// Every number here comes from the same figures the Revenue and Scorecard pages
// show, so it moves with each Wednesday drop. The multiples and per-subscriber
// values are market assumptions, named and sourced below so they can be argued
// with. Pure: no server imports.

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
  /** Pageviews in the last complete month (Mediavine). */
  pageviews: number;
  /** The month those pageviews are from, YYYY-MM. */
  pageviewsMonth: string | null;
  /** Share of sessions by traffic source, 0–1, from Mediavine. */
  sources: { source: string; share: number }[];
  /** Recent average, or null when unknown. */
  articlesPerWeek: number | null;
  /** Retainer MRR, CAD. */
  mrrCad: number;
  today: string;
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
    revenueCad: 7_500_000,
    profitCad: 625_000,
    note: 'Vancouver, Calgary, Edmonton, Toronto and Montreal; 3.2 million social followers. $6M cash, $5M note, $3M shares and $2.4M of debt taken on.',
    url: 'https://finance.yahoo.com/news/zoomermedia-announces-acquisition-daily-hive-013300406.html',
  },
  {
    name: 'blogTO',
    buyer: 'ZoomerMedia',
    date: '2022-01',
    priceCad: 15_072_400,
    monthlyPageviews: 29_000_000,
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
    revenueCad: null,
    profitCad: null,
    note: 'City guides in several Canadian markets; all cash. Audience and revenue not disclosed in a comparable form.',
    url: 'https://www.globenewswire.com/news-release/2024/02/20/2832385/0/en/ZoomerMedia-announces-acquisition-of-Curiocity-amplifying-its-digital-presence-in-Canada.html',
  },
];

export interface ComparableRead {
  name: string;
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
  total: Range;
  /** The current month, at its pace so far, for context. */
  pace: { month: string; netSoFar: number; projected: number; daysIn: number } | null;
  drivers: Driver[];
  /** The multiples and unit values used. */
  assumptions: { multiple: Range; perSubscriber: Range; brand: Range };
  /** Big Canadian city-media sales, read against this business. */
  comparables: ComparableRead[];
  /** What a strategic buyer might pay on the Daily Hive terms, site only, USD. */
  strategic: Range | null;
  /** Revenue earned per 1,000 pageviews, this site and Daily Hive, CAD. */
  revenuePerThousand: { ours: number | null; dailyHive: number };
}

// Content sites monetised by display ads sell for 25–40× monthly net profit on
// the main marketplaces (Empire Flippers averaged 33.2× in 2025; Motion Invest
// 28–32×; Flippa's baseline 30×). Sites with a falling trend or one fragile
// traffic source trade at 12–20×.
export const MULTIPLE: Range = { low: 25, mid: 30, high: 36 };
// A free consumer newsletter list, when sold with the site: $1–3 a subscriber
// (Flippa's guide gives $1–10 across niches; local news sits at the low end).
export const PER_SUBSCRIBER: Range = { low: 1, mid: 2, high: 3 };
// Domain, name and social accounts: nominal alongside the site, not a business.
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
      detail: `$${PER_SUBSCRIBER.low}–${PER_SUBSCRIBER.high} each for a free local list sold with the site.${input.members ? ` The ${input.members.toLocaleString('en-CA')} member accounts ride along; they are not a separate line.` : ''}`,
      value: list,
    },
    {
      key: 'brand',
      title: 'Name, domain and social accounts',
      detail: 'Worth something to the buyer who takes the site, and little on their own.',
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
  const comparables: ComparableRead[] = COMPARABLES.map((c) => {
    if (c.revenueCad) {
      const implied = runRate(last(3)) * revenueMultiple;
      return { name: c.name, measure: `${revenueMultiple.toFixed(1)}× a year's revenue (${Math.round(c.priceCad / (c.profitCad || 1))}× its profit)`, implied, adjusted: implied };
    }
    if (c.monthlyPageviews) {
      const perView = c.priceCad / c.monthlyPageviews;
      const implied = (input.pageviews * perView) / input.fxUsdCad;
      return {
        name: c.name,
        measure: `C$${perView.toFixed(2)} per monthly pageview`,
        implied: input.pageviews ? implied : null,
        adjusted: input.pageviews && quality !== null ? implied * quality : null,
      };
    }
    return { name: c.name, measure: 'Too little published to compare', implied: null, adjusted: null };
  });
  const strategic =
    runRate(last(6)) > 0
      ? round({ low: runRate(last(6)) * revenueMultiple, mid: runRate(last(3)) * revenueMultiple, high: Math.max(runRate(last(3)), runRate(last(6))) * revenueMultiple * 1.15 })
      : null;

  return {
    today: input.today,
    fxUsdCad: input.fxUsdCad,
    history: { firstMonth: firstEarning, completeMonths, monthsToTwelve },
    bases,
    headline,
    adjustments,
    factor,
    pieces,
    total,
    pace,
    drivers,
    assumptions: { multiple: MULTIPLE, perSubscriber: PER_SUBSCRIBER, brand: BRAND },
    comparables,
    strategic,
    revenuePerThousand: { ours: oursPerThousand, dailyHive: dhPerThousand },
  };
}

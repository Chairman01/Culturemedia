// What the articles earn and what to do about it, worked out from the weekly
// data drop: Mediavine by page, story type and traffic source; Google and Bing
// searches the site already ranks for; GA4 landing pages; Clarity's site health.
//
// Pure: no server imports. The page runs the recommendation rules in the
// browser too, so a sort or a tab change never needs another request.

export interface PageStat {
  path: string;
  revenue: number;
  pageviews: number;
  /** Dollars per 1,000 pageviews. Null when Mediavine gave no figure. */
  rpm: number | null;
}

export interface TypeStat {
  type: string;
  revenue: number;
  pageviews: number;
  rpm: number | null;
}

export interface SourceStat {
  source: string;
  revenue: number;
  sessions: number;
  /** Dollars per 1,000 sessions. */
  rpm: number | null;
}

export interface SearchQuery {
  query: string;
  clicks: number;
  impressions: number;
  /** Fraction, 0–1. */
  ctr: number;
  position: number;
}

export interface LandingPage {
  path: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  /** Fraction of sessions that engaged, 0–1. */
  engagementRate: number | null;
  engagementSeconds: number | null;
}

export interface Vital {
  name: string;
  value: number;
  unit: string;
}

export interface SiteError {
  message: string;
  sessions: number;
  pct: number | null;
}

export interface Period {
  from: string;
  to: string;
}

export interface ContentData {
  /** The Mediavine window every page, type and source figure covers. */
  period: Period | null;
  total: { revenue: number; pageviews: number; sessions: number; rpm: number | null } | null;
  pages: PageStat[];
  types: TypeStat[];
  sources: SourceStat[];
  google: { loaded: string | null; queries: SearchQuery[] };
  bing: { loaded: string | null; queries: SearchQuery[] };
  landing: { loaded: string | null; pages: LandingPage[] };
  health: { period: Period | null; vitals: Vital[]; errors: SiteError[] };
  /** Anything that could not be read, in plain words. */
  problems: string[];
}

// ─── recommendations ──────────────────────────────────────────────────────────

export interface Recommendation {
  id: string;
  tone: 'good' | 'watch' | 'bad';
  title: string;
  detail: string;
  /** Where the numbers came from. */
  source: string;
  /** A page on the live site, when one is the subject. */
  href?: string;
}

export const SITE = 'https://www.culturealberta.com';

/** "/articles/a-long-slug-here" → "a long slug here", cut to fit a row. */
export function pageName(path: string, max = 72): string {
  if (path === '/' || path === '') return 'Homepage';
  const slug = path.replace(/^\/articles\//, '').replace(/^\//, '').replace(/\/$/, '');
  const words = slug.replace(/-/g, ' ');
  if (words.length <= max) return words;
  return `${words.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

const dollars = (v: number) => `$${Math.round(v).toLocaleString('en-CA')}`;
const rpmText = (v: number | null) => (v === null ? '—' : `$${v.toFixed(2)}`);
const pct = (v: number, places = 0) => `${(v * 100).toFixed(places)}%`;
const n = (v: number) => Math.round(v).toLocaleString('en-CA');

// Story types that are not stories.
const NOT_A_STORY = /home|section|other/i;

/** Google's own "good" lines for the three Web Vitals. */
export const VITAL_GOOD: Record<string, { max: number; label: string; plain: string; unit: string }> = {
  CLS: { max: 0.1, label: 'Layout shift', plain: 'how much the page jumps around while loading', unit: '' },
  INP: { max: 200, label: 'Tap response', plain: 'how long a tap takes to do something', unit: ' ms' },
  LCP: { max: 2.5, label: 'Load time', plain: 'how long until the main content shows', unit: ' s' },
};

export function vitalKey(name: string): string | null {
  const m = /^(CLS|INP|LCP)\b/i.exec(name);
  return m ? m[1].toUpperCase() : null;
}

export function buildRecommendations(d: ContentData): Recommendation[] {
  const out: Recommendation[] = [];
  const total = d.total?.revenue || d.pages.reduce((a, p) => a + p.revenue, 0);

  // 1. Which kind of story pays. The gap is usually large, and it is the one
  //    number that should steer what gets written.
  const stories = d.types.filter((t) => !NOT_A_STORY.test(t.type) && t.rpm !== null && t.pageviews >= 5000);
  if (stories.length >= 2) {
    const best = [...stories].sort((a, b) => (b.rpm ?? 0) - (a.rpm ?? 0))[0];
    const worst = [...stories].sort((a, b) => (a.rpm ?? 0) - (b.rpm ?? 0))[0];
    const ratio = (best.rpm ?? 0) / Math.max(0.01, worst.rpm ?? 0);
    const allViews = d.total?.pageviews || d.types.reduce((a, t) => a + t.pageviews, 0);
    const worstShare = allViews ? worst.pageviews / allViews : 0;
    if (ratio >= 1.5) {
      out.push({
        id: 'types',
        tone: 'good',
        title: `Write more ${best.type}: it earns ${ratio.toFixed(1)}× what ${worst.type} does, per reader`,
        detail: `${rpmText(best.rpm)} per 1,000 views against ${rpmText(worst.rpm)}. ${
          worstShare >= 0.25
            ? `${worst.type} is still ${pct(worstShare)} of all pageviews — the biggest lever on the site is shifting that mix, not more traffic.`
            : `Every ${best.type} story is worth about ${Math.round(ratio)} ${worst.type} stories.`
        }`,
        source: 'Mediavine by story type',
      });
    }
  }

  // 2. Searches already on page 1 where a better title would win clicks.
  const reach = d.google.queries
    .filter((q) => q.impressions >= 1000 && q.position >= 3 && q.position <= 12 && q.ctr < 0.03)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 4);
  if (reach.length) {
    const top = reach[0];
    out.push({
      id: 'reach',
      tone: 'good',
      title: `${reach.length} search${reach.length === 1 ? '' : 'es'} within reach — “${top.query}” alone is ${n(top.impressions)} impressions`,
      detail: `You rank #${top.position.toFixed(0)} for it and ${pct(top.ctr, 1)} of searchers click. A title that answers the search (menu, prices, hours, dates) usually doubles that.${
        reach.length > 1 ? ` Also: ${reach.slice(1).map((q) => `“${q.query}”`).join(', ')}.` : ''
      } Full list under Search wins within reach.`,
      source: 'Google Search Console',
    });
  }

  // 3. Pages Google shows a lot that almost nobody clicks.
  const weak = d.landing.pages
    .filter((p) => p.impressions >= 5000 && p.ctr < 0.015)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 3);
  if (weak.length) {
    const top = weak[0];
    out.push({
      id: 'titles',
      tone: 'watch',
      title: `${weak.length} page${weak.length === 1 ? '' : 's'} shown ${n(weak.reduce((a, p) => a + p.impressions, 0))} times in search, clicked under 1.5%`,
      detail: `“${pageName(top.path, 60)}” was shown ${n(top.impressions)} times at #${top.position.toFixed(0)} and got ${n(top.clicks)} clicks. The title is not matching what people searched for. Rewrite it to say what the reader gets, and check the page still answers the question.`,
      source: 'GA4 landing pages',
      href: `${SITE}${top.path}`,
    });
  }

  // 4. The best-earning pages per reader: keep them current.
  const evergreen = d.pages
    .filter((p) => p.path !== '/' && (p.rpm ?? 0) >= 20 && p.pageviews >= 2000)
    .sort((a, b) => (b.rpm ?? 0) - (a.rpm ?? 0))
    .slice(0, 3);
  if (evergreen.length) {
    const top = evergreen[0];
    out.push({
      id: 'evergreen',
      tone: 'good',
      title: `“${pageName(top.path, 50)}” earns ${rpmText(top.rpm)} per 1,000 views — ${
        d.total?.rpm ? `${((top.rpm ?? 0) / d.total.rpm).toFixed(1)}× the site average` : 'your best'
      }`,
      detail: `${dollars(top.revenue)} from ${n(top.pageviews)} views. Pages like this (${evergreen.map((p) => pageName(p.path, 28)).join('; ')}) earn on every reader, so keep them current whenever the facts change and link to them from new stories.`,
      source: 'Mediavine by page',
      href: `${SITE}${top.path}`,
    });
  }

  // 5. How much rides on a few stories.
  if (d.pages.length >= 5 && total > 0) {
    const top5 = [...d.pages].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const share = top5.reduce((a, p) => a + p.revenue, 0) / total;
    if (share >= 0.3) {
      out.push({
        id: 'concentration',
        tone: 'watch',
        title: `Five pages made ${pct(share)} of all ad revenue`,
        detail: `${top5.map((p) => `${pageName(p.path, 34)} (${dollars(p.revenue)})`).join(', ')}. Viral stories fade in a week or two; the steady money is in pages people search for all year. Plan the next evergreen page before the current hit cools.`,
        source: 'Mediavine by page',
      });
    }
  }

  // 6. What a reader from each source is worth. Only sources big enough to
  //    steer by: a few thousand Yahoo sessions at a high rate is trivia.
  const allSessions = d.total?.sessions || d.sources.reduce((a, s) => a + s.sessions, 0);
  const srcs = d.sources
    .filter((s) => s.rpm !== null && s.sessions >= Math.max(5000, allSessions * 0.03))
    .sort((a, b) => (b.rpm ?? 0) - (a.rpm ?? 0));
  if (srcs.length >= 3) {
    const best = srcs[0];
    const biggest = [...srcs].sort((a, b) => b.revenue - a.revenue)[0];
    if (best.source !== biggest.source && (best.rpm ?? 0) >= 1.5 * (biggest.rpm ?? 0)) {
      out.push({
        id: 'sources',
        tone: 'watch',
        title: `A ${best.source} reader is worth ${((best.rpm ?? 0) / Math.max(0.01, biggest.rpm ?? 0)).toFixed(1)} ${biggest.source} readers`,
        detail: `${best.source} pays ${rpmText(best.rpm)} per 1,000 sessions, ${biggest.source} ${rpmText(biggest.rpm)}. ${biggest.source} is your biggest source (${dollars(biggest.revenue)}) but the cheapest reader. Search traffic compounds and pays more; social traffic spikes and pays less. Both matter — just do not measure a week by its ${biggest.source} number alone.`,
        source: 'Mediavine by source',
      });
    }
  }

  // 7. The homepage earns almost nothing per view.
  const home = d.pages.find((p) => p.path === '/');
  if (home && d.total && home.pageviews >= 10000 && d.total.pageviews > 0) {
    const viewShare = home.pageviews / d.total.pageviews;
    const revShare = total ? home.revenue / total : 0;
    if (viewShare >= 0.05 && revShare < viewShare / 3) {
      out.push({
        id: 'home',
        tone: 'watch',
        title: `The homepage is ${pct(viewShare)} of pageviews but ${pct(revShare, 1)} of revenue`,
        detail: `${n(home.pageviews)} views earned ${dollars(home.revenue)} — ${rpmText(home.rpm)} per 1,000. An article view is worth several times that. Point newsletter links, social posts and the logo tap on mobile at articles and sections, not the front page.`,
        source: 'Mediavine by page',
        href: `${SITE}/`,
      });
    }
  }

  // 8. Site health, in plain words.
  for (const v of d.health.vitals) {
    const key = vitalKey(v.name);
    const good = key ? VITAL_GOOD[key] : null;
    if (!good || v.value <= good.max) continue;
    out.push({
      id: `vital-${key}`,
      tone: v.value > good.max * 1.5 ? 'bad' : 'watch',
      title: `${good.label} is outside Google's “good” range: ${v.value}${good.unit} (good is under ${good.max}${good.unit})`,
      detail: `${good.plain[0].toUpperCase()}${good.plain.slice(1)}. Google uses this in ranking, and readers feel it. ${
        key === 'INP'
          ? 'Usually a heavy script running on tap — ad code, a map, or a menu. Worth one ticket.'
          : key === 'LCP'
            ? 'Usually a large hero image or a slow font.'
            : 'Usually images or ads without reserved space.'
      }`,
      source: 'Clarity web vitals',
    });
  }

  return out;
}

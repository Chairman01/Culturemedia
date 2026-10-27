// What the Newsletter page shows, and the plain-words reading of it.
//
// The shapes mirror public.admin_newsletter_dashboard() and
// public.admin_newsletter_issue(). No next/* or server imports: the view
// component uses these types and helpers in the browser.

/** How an email was sorted by its subject line. */
export type Kind = 'newsletter' | 'alert' | 'welcome' | 'notification' | 'other' | 'test' | string;

export const KIND_LABEL: Record<string, string> = {
  newsletter: 'Newsletter issues',
  alert: 'Alerts (one-off blasts)',
  welcome: 'Welcome emails (sent on sign-up)',
  notification: 'Comment notifications',
  other: 'Other',
  test: 'Tests',
};

export interface KindRow {
  kind: Kind;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  subjects: number;
  first_on: string | null;
  last_on: string | null;
}

export interface MonthRow {
  month: string;
  kind: Kind;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
}

export interface Issue {
  subject: string;
  kind: Kind;
  sent_on: string;
  delivered: number;
  /** Members who opened at least once. */
  opened: number;
  /** Members who clicked at least once. */
  clicked: number;
  /** Clicks in all, several per member possible. */
  clicks: number;
  bounced: number;
  complained: number;
  edition: string | null;
  city: string | null;
  label: string | null;
}

export interface WindowStats {
  issues: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
}

export interface Edition {
  edition: string;
  city: string;
  issues_8: number;
  issues_all: number;
  delivered_avg: number;
  opened: number;
  delivered: number;
  clicked: number;
  last_sent_on: string;
  active_members: number | null;
}

export interface WeekRow {
  week_start: string;
  subscribed: number;
  unsubscribed: number;
  active_end: number;
}

export interface SubEvent {
  email: string;
  event: 'subscribed' | 'unsubscribed' | string;
  city: string | null;
  source: string | null;
  /** "YYYY-MM-DD HH:MM" Edmonton time. */
  at: string;
}

export interface LinkRow {
  url: string;
  clicks: number;
  people: number;
}

export interface PersonRow {
  email: string;
  /** Raw clicks: company mail filters open every link, so this runs high. */
  clicks: number;
  /** Different issues they clicked in: the honest measure of a keen reader. */
  issues_clicked?: number;
  opens: number;
  last_click: string | null;
  city: string | null;
  status: string | null;
}

export interface DormantRow {
  email: string;
  city: string | null;
  delivered: number;
  last_engaged: string | null;
}

export interface BouncedRow {
  email: string;
  city: string | null;
  bounces: number;
  last_on: string;
}

export interface ResendDaily {
  day: string;
  sent: number | null;
  delivered: number | null;
  opened: number | null;
  unique_opened: number | null;
  clicked: number | null;
  unique_clicked: number | null;
  bounced: number | null;
  complained: number | null;
  unsubscribed: number | null;
  delivery_rate: number | string | null;
  open_rate: number | string | null;
  click_rate: number | string | null;
  bounce_rate: number | string | null;
  complaint_rate: number | string | null;
}

export interface ResendRun {
  status: string;
  error: string | null;
  requested_at: string;
  completed_at: string | null;
  rows_upserted: number | null;
  start_date: string;
  end_date: string;
}

export interface NewsletterData {
  as_of: string;
  tracking: { events_since: string | null; opens_since: string | null; events: number };
  members: {
    active: number;
    unsubscribed: number;
    total: number;
    new_7d: number;
    new_30d: number;
    new_prev_30d: number;
    unsub_30d: number;
    unsub_prev_30d: number;
    by_city: { city: string; active: number; total: number }[];
    sources_30d: { source: string; n: number }[];
    weekly: WeekRow[];
    recent: SubEvent[];
  };
  kinds: KindRow[];
  monthly: MonthRow[];
  issues: Issue[];
  window: { days: number; cur: WindowStats | null; prev: WindowStats | null };
  editions: Edition[];
  top_links_30d: LinkRow[];
  top_people_90d: PersonRow[];
  dormant: { count: number; sample: DormantRow[] };
  bounced: { count: number; sample: BouncedRow[] };
  complaints_90d: number;
  resend: { daily: ResendDaily[]; last_run: ResendRun | null };
}

export interface IssueDetail {
  subject: string;
  sent_at: string | null;
  delivered: number;
  opened: number;
  clicked: number;
  clicks: number;
  bounced: number;
  complained: number;
  links: LinkRow[];
  clickers: { email: string; clicks: number; last_at: string; urls: string[] | null; city: string | null; status: string | null }[];
  openers: { email: string; opens: number; last_at: string; city: string | null }[];
  bounces: { email: string; at: string }[];
  opens_by_hour: { hour: number; opens: number }[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** n out of d as a percentage, or null when there is nothing to divide by. */
export function rate(n: number | null | undefined, d: number | null | undefined): number | null {
  if (!d || n === null || n === undefined) return null;
  return (n / d) * 100;
}

/** "2026-10-27" shifted by n days, with no clock involved. */
export function shiftDays(iso: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n);
  return new Date(t).toISOString().slice(0, 10);
}

const CITY_SHORT: Record<string, string> = {
  Edmonton: 'Edm',
  Calgary: 'Cal',
  Lethbridge: 'Leth',
  'Medicine Hat': 'MH',
  'Grande Prairie': 'GP',
  'Red Deer': 'RD',
  'Fort McMurray': 'FtM',
  Alberta: 'AB',
};

export function cityShort(city: string | null | undefined): string | undefined {
  if (!city) return undefined;
  return CITY_SHORT[city] || city.slice(0, 3);
}

/** A readable name for a clicked link: the story's slug as words. */
export function storyTitle(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop();
    if (!seg) return u.hostname.replace(/^www\./, '');
    const words = decodeURIComponent(seg).replace(/[-_]+/g, ' ').trim();
    return words ? words[0].toUpperCase() + words.slice(1) : url;
  } catch {
    return url;
  }
}

/** The part of a link that says what kind of page it is: articles, events, jobs… */
export function linkSection(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    return parts.length > 1 ? parts[0] : 'home';
  } catch {
    return '';
  }
}

// ─── what to do next ──────────────────────────────────────────────────────────

export interface Insight {
  id: string;
  tone: 'good' | 'watch' | 'bad';
  headline: string;
  detail: string;
}

const pct = (v: number | null, places = 1) => (v === null ? '—' : `${v.toFixed(places)}%`);
/** 1577 → "1,577", the same on the server and in the browser. */
const num = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

/** The handful of things the numbers point to, worst first. */
export function buildInsights(d: NewsletterData): Insight[] {
  const out: Insight[] = [];
  const cur = d.window.cur;
  const prev = d.window.prev;

  if (cur && cur.delivered) {
    const open = rate(cur.opened, cur.delivered);
    const prevOpen = prev ? rate(prev.opened, prev.delivered) : null;
    const diff = open !== null && prevOpen !== null ? open - prevOpen : null;
    out.push({
      id: 'open',
      tone: diff === null ? 'good' : diff <= -3 ? 'bad' : diff < 0 ? 'watch' : 'good',
      headline: `${pct(open)} of members opened the newsletter over the last 30 days${
        diff === null ? '' : `, ${diff >= 0 ? 'up' : 'down'} ${Math.abs(diff).toFixed(1)} points on the 30 days before`
      }`,
      detail:
        'Opens are counted from a tracking image that some mail apps block, so this is a floor. Local-news newsletters typically open around 40%; above 50% is strong. If it slips for two weeks running, look first at the subject lines of the weakest edition below.',
    });

    const click = rate(cur.clicked, cur.delivered);
    const prevClick = prev ? rate(prev.clicked, prev.delivered) : null;
    const cdiff = click !== null && prevClick !== null ? click - prevClick : null;
    out.push({
      id: 'click',
      tone: cdiff === null ? 'good' : cdiff <= -2 ? 'bad' : cdiff < 0 ? 'watch' : 'good',
      headline: `${pct(click)} clicked a story${
        cdiff === null ? '' : `, ${cdiff >= 0 ? 'up' : 'down'} ${Math.abs(cdiff).toFixed(1)} points`
      } — ${plural(cur.clicked, 'reader')} across ${plural(cur.issues, 'issue')}`,
      detail:
        'A click is the reliable number: a real reader going to a story on the site. Each one is a page view Mediavine can sell ads against, so the newsletter pays in clicks, not opens. The most-clicked stories are listed below; lead with more like them.',
    });
  }

  const ranked = d.editions.filter((e) => e.issues_8 >= 3 && e.delivered > 0).map((e) => ({ ...e, open: rate(e.opened, e.delivered) ?? 0 }));
  if (ranked.length >= 2) {
    const best = ranked.reduce((a, b) => (b.open > a.open ? b : a));
    const worst = ranked.reduce((a, b) => (b.open < a.open ? b : a));
    if (best !== worst) {
      out.push({
        id: 'editions',
        tone: best.open - worst.open >= 12 ? 'watch' : 'good',
        headline: `${best.city} readers open most (${pct(best.open)} over the last ${best.issues_8} issues); ${worst.city} least (${pct(worst.open)})`,
        detail: `Put the two editions side by side: subject lines, how many stories, how local they are. The weakest edition is where a change shows first, and ${worst.city} has ${
          worst.active_members === null ? 'its own' : `${worst.active_members} active`
        } members waiting for one.`,
      });
    }
  }

  const m = d.members;
  const net = m.new_30d - m.unsub_30d;
  const prevNet = m.new_prev_30d - m.unsub_prev_30d;
  const topSource = m.sources_30d[0];
  out.push({
    id: 'growth',
    tone: net <= 0 ? 'bad' : net < prevNet ? 'watch' : 'good',
    headline: `${plural(m.new_30d, 'new member')} and ${num(m.unsub_30d)} left in the last 30 days: ${net >= 0 ? '+' : ''}${num(net)} net (${
      prevNet >= 0 ? '+' : ''
    }${num(prevNet)} the 30 days before)`,
    detail: `${num(m.active)} people get the newsletter today. ${
      topSource && topSource.source !== 'not recorded'
        ? `Most new sign-ups came from the ${topSource.source.replace(/-/g, ' ')} (${topSource.n} of ${m.new_30d}); that is the box to make more visible.`
        : 'Where sign-ups come from is not recorded for most of them yet.'
    } Unsubscribes under 0.5% of a send are normal; a jump after one issue points at that issue.`,
  });

  if (d.dormant.count >= 20) {
    out.push({
      id: 'dormant',
      tone: 'watch',
      headline: `${d.dormant.count} members got at least four issues in 90 days and opened none of them`,
      detail:
        'Silent addresses drag the open rate down and, in bulk, tell Gmail the list is cold. Send them one short "still want The Capital?" email and drop anyone who stays silent. The list is below under Members to look at.',
    });
  }

  if (d.bounced.count > 0) {
    out.push({
      id: 'bounced',
      tone: 'bad',
      headline: `${plural(d.bounced.count, 'active address', 'active addresses')} bounced in the last 90 days`,
      detail:
        'Mail that keeps bouncing hurts delivery for everyone else on the list. Unsubscribe these addresses (the list is below); a member who wants back in will sign up again.',
    });
  }

  if (d.complaints_90d > 0) {
    out.push({
      id: 'complaints',
      tone: d.complaints_90d >= 5 ? 'bad' : 'watch',
      headline: `${plural(d.complaints_90d, 'spam complaint')} in the last 90 days`,
      detail:
        'Each one is someone who pressed "report spam" instead of unsubscribe. Under 0.1% of sends is fine; keep the unsubscribe link obvious near the top so people use it instead.',
    });
  }

  const top = [...d.top_links_30d].sort((a, b) => b.people - a.people || b.clicks - a.clicks)[0];
  if (top) {
    out.push({
      id: 'top-story',
      tone: 'good',
      headline: `Most clicked in 30 days: ${storyTitle(top.url)} (${plural(top.clicks, 'click')} from ${plural(top.people, 'reader')})`,
      detail: 'What members click is the clearest signal of what to lead with. Compare the top five below for a pattern — a city, a topic, a kind of headline — and give the next issues more of it.',
    });
  }

  if (!d.resend.daily.length) {
    const run = d.resend.last_run;
    out.push({
      id: 'resend-sync',
      tone: 'watch',
      headline: 'Resend’s own daily totals are not flowing in yet',
      detail:
        run?.status === 'awaiting_api_key'
          ? 'The nightly sync in Supabase is waiting for a Resend API key, stored in Supabase Vault under the name resend_api_key. Until then this page works from the per-email events, which cover every email since the webhook was switched on. Steps are at the bottom of the page.'
          : `The last attempt ${run ? `on ${run.requested_at.slice(0, 10)} ended "${run.status}"${run.error ? `: ${run.error}` : ''}` : 'has not happened yet'}. This page works from the per-email events meanwhile.`,
    });
  }

  const order = { bad: 0, watch: 1, good: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}

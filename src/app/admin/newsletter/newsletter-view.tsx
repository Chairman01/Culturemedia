'use client';

// Newsletter & members: who gets the newsletter, how the list is growing, and
// what readers do with each issue. Built from the per-email events Resend
// posts back (one row per delivery, open, click, bounce and complaint) and the
// members list the site keeps. Newsletter issues are kept apart from the
// welcome email people get when they sign up, from one-off alerts and from
// comment notifications, so the rates here are the newsletter's own.

import { useEffect, useMemo, useState } from 'react';

import {
  KIND_LABEL,
  buildInsights,
  cityShort,
  rate,
  shiftDays,
  storyTitle,
  type Issue,
  type IssueDetail,
  type NewsletterData,
} from '@/lib/newsletter';
import { Chart, type ChartItem } from '../_components/chart';
import { Detail, DetailTable, Explain } from '../_components/detail';
import { day, group, monthLabel } from '../_components/format';
import { AdminShell, PageHead } from '../_components/shell';
import { Banner, Tabs, Tile, type Option } from '../_components/ui';

type MemberTab = 'total' | 'new' | 'unsub';
type IssueTab = 'open' | 'click' | 'delivered';

const MEMBER_TABS: Option<MemberTab>[] = [
  { k: 'total', label: 'Members total' },
  { k: 'new', label: 'New sign-ups' },
  { k: 'unsub', label: 'Unsubscribes' },
];
const ISSUE_TABS: Option<IssueTab>[] = [
  { k: 'open', label: 'Open rate' },
  { k: 'click', label: 'Click rate' },
  { k: 'delivered', label: 'Delivered' },
];

const TONE = {
  good: { k: 'ok', l: 'Good' },
  watch: { k: 'warn', l: 'Watch' },
  bad: { k: 'crit', l: 'Fix' },
} as const;

const pct = (n: number | null | undefined, d: number | null | undefined, places = 1): string => {
  const r = rate(n, d);
  return r === null ? '—' : `${r.toFixed(places)}%`;
};
/** "2026-10-27 06:48" → "Oct 27 06:48". */
const when = (s: string | null | undefined): string => (s ? `${day(s)} ${s.slice(11, 16)}`.trim() : '—');
const signed = (v: number): string => (v > 0 ? `+${group(v)}` : v < 0 ? `−${group(Math.abs(v))}` : '0');
const cityName = (slug: string | null | undefined): string =>
  (slug || 'unknown')
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace('Mcmurray', 'McMurray');

function Delta({
  cur,
  prev,
  pts = false,
  goodWhen = 'up',
}: {
  cur: number | null;
  prev: number | null;
  /** The values are percentages: show the change in points. */
  pts?: boolean;
  goodWhen?: 'up' | 'down';
}) {
  if (cur === null || prev === null) return <span className="muted">No earlier period to compare</span>;
  const d = cur - prev;
  const cls = Math.abs(d) < (pts ? 0.05 : 0.5) ? 'flat' : (d > 0) === (goodWhen === 'up') ? 'up' : 'down';
  const sign = d > 0 ? '+' : d < 0 ? '−' : '';
  const text = pts ? `${sign}${Math.abs(d).toFixed(1)} pts` : `${sign}${group(Math.abs(Math.round(d)))}`;
  return (
    <span className={`delta ${cls}`} title="Compared with the 30 days before">
      {text} vs the 30 days before
    </span>
  );
}

type Panel = 'active' | 'new' | 'unsub' | 'net' | 'issues' | 'open' | 'click' | 'delivery' | null;

function Head() {
  return (
    <PageHead
      label="Audience"
      title="Newsletter & members"
      help="Who gets the newsletter, how the list is growing, and what readers open and click — issue by issue. Sign-up emails, alerts and notifications are counted separately so the newsletter's own rates stay honest."
    />
  );
}

export default function NewsletterView({
  data,
  error,
  today,
}: {
  data: NewsletterData | null;
  error: string | null;
  today: string;
}) {
  if (!data) {
    return (
      <AdminShell>
        <Head />
        <Banner tone="crit">{error || 'The newsletter figures could not be loaded.'}</Banner>
      </AdminShell>
    );
  }
  return <Loaded data={data} today={today} />;
}

function Loaded({ data, today }: { data: NewsletterData; today: string }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [memberTab, setMemberTab] = useState<MemberTab>('total');
  const [issueTab, setIssueTab] = useState<IssueTab>('open');
  const [edition, setEdition] = useState('all');
  const [kindTab, setKindTab] = useState('all');
  const [allIssues, setAllIssues] = useState(false);
  const [showDormant, setShowDormant] = useState(false);
  const [showBounced, setShowBounced] = useState(false);

  const m = data.members;
  const cur = data.window.cur;
  const prev = data.window.prev;
  const net = m.new_30d - m.unsub_30d;
  const insights = useMemo(() => buildInsights(data), [data]);

  const editionOptions = useMemo(
    () => [
      { k: 'all', label: 'All editions' },
      ...data.editions.map((e) => ({ k: `${e.edition}|${e.city}`, label: e.city, title: e.edition })),
    ],
    [data.editions],
  );
  const editionLabel = editionOptions.find((o) => o.k === edition)?.label || '';

  // Newest first, as the function returns them; alerts ride along in the table.
  const issues = useMemo(
    () => data.issues.filter((i) => edition === 'all' || `${i.edition}|${i.city}` === edition),
    [data.issues, edition],
  );
  const shownIssues = allIssues ? issues : issues.slice(0, 15);

  const issueItems: ChartItem[] = useMemo(() => {
    const recent = issues.filter((i) => i.kind === 'newsletter').slice(0, 24).reverse();
    return recent.map((i) => ({
      label: day(i.sent_on),
      sub: edition === 'all' ? cityShort(i.city) : undefined,
      value: issueTab === 'delivered' ? i.delivered : rate(issueTab === 'open' ? i.opened : i.clicked, i.delivered),
      title: `${i.edition || ''} · ${i.city || ''} · ${i.label || ''}`,
    }));
  }, [issues, issueTab, edition]);

  const memberItems: ChartItem[] = useMemo(
    () =>
      m.weekly.map((w, idx) => ({
        label: day(w.week_start),
        value: memberTab === 'total' ? w.active_end : memberTab === 'new' ? w.subscribed : w.unsubscribed,
        partial: idx === m.weekly.length - 1,
        title: `Week of ${day(w.week_start)}`,
      })),
    [m.weekly, memberTab],
  );

  const kinds = useMemo(() => data.kinds.filter((k) => k.kind !== 'test'), [data.kinds]);
  const kindOptions = useMemo(
    () => [{ k: 'all', label: 'All emails' }, ...kinds.map((k) => ({ k: k.kind, label: KIND_LABEL[k.kind] || k.kind }))],
    [kinds],
  );
  const monthItems: ChartItem[] = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const r of data.monthly) {
      if (r.kind === 'test') continue;
      if (kindTab !== 'all' && r.kind !== kindTab) continue;
      byMonth.set(r.month, (byMonth.get(r.month) || 0) + r.delivered);
    }
    return [...byMonth.keys()].sort().map((mo) => ({
      label: monthLabel(mo),
      sub: mo.slice(0, 4),
      value: byMonth.get(mo) ?? 0,
      partial: mo === data.as_of.slice(0, 7),
      title: `${monthLabel(mo)} ${mo.slice(0, 4)}`,
    }));
  }, [data.monthly, kindTab, data.as_of]);

  const since30 = shiftDays(data.as_of, -29);
  const curIssues = data.issues.filter((i) => i.kind === 'newsletter' && i.sent_on >= since30);
  const totalDelivered = kinds.reduce((a, k) => a + k.delivered, 0);

  return (
    <AdminShell>
      <Head />
      <p className="through">
        Per-email events since {day(data.tracking.events_since)} (opens and clicks tracked since {day(data.tracking.opens_since)}) ·{' '}
        {group(data.tracking.events)} events · members list is live · today {day(today)}
      </p>

      <section className="card" aria-labelledby="w-h" style={{ marginBottom: 12 }}>
        <h2 id="w-h">
          What to do next <small>{insights.length ? `${insights.length} worked out from the numbers below` : ''}</small>
        </h2>
        {insights.length ? (
          <ul className="ins">
            {insights.map((r) => {
              const t = TONE[r.tone];
              return (
                <li key={r.id}>
                  <span className={`chip ${t.k}`}>{t.l}</span>
                  <b>{r.headline}</b>
                  <span>{r.detail}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-note">Nothing stands out right now.</p>
        )}
      </section>

      {/* ── members ─────────────────────────────────────────────────────── */}
      <h2 className="sub-h">Members</h2>
      <div className="tiles">
        <Tile
          label="Active members"
          value={group(m.active)}
          foot={
            <>
              {group(m.total)} ever signed up · {group(m.unsubscribed)} left
            </>
          }
          onOpen={() => setPanel('active')}
        />
        <Tile
          label="Joined, last 30 days"
          value={group(m.new_30d)}
          foot={<Delta cur={m.new_30d} prev={m.new_prev_30d} />}
          onOpen={() => setPanel('new')}
        />
        <Tile
          label="Left, last 30 days"
          value={group(m.unsub_30d)}
          foot={<Delta cur={m.unsub_30d} prev={m.unsub_prev_30d} goodWhen="down" />}
          onOpen={() => setPanel('unsub')}
        />
        <Tile
          label="Net growth, last 30 days"
          value={signed(net)}
          foot={<>{group(m.new_7d)} joined in the last 7 days</>}
          onOpen={() => setPanel('net')}
        />
      </div>

      <section className="card" aria-labelledby="m-h" style={{ marginBottom: 12 }}>
        <h2 id="m-h">
          Members, week by week <small>last {m.weekly.length} weeks · the current week is still filling in</small>
        </h2>
        <Tabs options={MEMBER_TABS} value={memberTab} onChange={setMemberTab} label="Members metric" />
        <div className="chart">
          <Chart kind={memberTab === 'total' ? 'line' : 'bar'} items={memberItems} unit="count" empty="No sign-ups recorded yet" />
        </div>
      </section>

      {/* ── the newsletter itself ───────────────────────────────────────── */}
      <h2 className="sub-h">The newsletter, last 30 days</h2>
      <div className="tiles">
        <Tile
          label="Issues sent"
          value={cur ? group(cur.issues) : '0'}
          foot={cur ? `${group(cur.delivered)} emails delivered` : 'No issue went out in the last 30 days'}
          onOpen={() => setPanel('issues')}
        />
        <Tile
          label="Open rate"
          value={cur ? pct(cur.opened, cur.delivered) : '—'}
          foot={<Delta cur={cur ? rate(cur.opened, cur.delivered) : null} prev={prev ? rate(prev.opened, prev.delivered) : null} pts />}
          onOpen={() => setPanel('open')}
        />
        <Tile
          label="Click rate"
          value={cur ? pct(cur.clicked, cur.delivered) : '—'}
          foot={<Delta cur={cur ? rate(cur.clicked, cur.delivered) : null} prev={prev ? rate(prev.clicked, prev.delivered) : null} pts />}
          onOpen={() => setPanel('click')}
        />
        <Tile
          label="Bounced · complaints"
          value={cur ? `${group(cur.bounced)} · ${group(cur.complained)}` : '—'}
          foot={cur ? `${pct(cur.bounced, cur.delivered + cur.bounced, 2)} of sends bounced` : ''}
          onOpen={() => setPanel('delivery')}
        />
      </div>

      <section className="card" aria-labelledby="i-h" style={{ marginBottom: 12 }}>
        <h2 id="i-h">
          Issue by issue{' '}
          <small>
            last {issueItems.length} issues{edition !== 'all' ? ` · ${editionLabel}` : ''}
          </small>
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Tabs options={ISSUE_TABS} value={issueTab} onChange={setIssueTab} label="Issue metric" />
          <Tabs options={editionOptions} value={edition} onChange={setEdition} label="Edition" />
        </div>
        <div className="chart">
          <Chart
            kind="line"
            items={issueItems}
            unit={issueTab === 'delivered' ? 'count' : 'percent'}
            empty="No newsletter issue recorded for this edition yet"
          />
        </div>
      </section>

      <section className="card" aria-labelledby="e-h" style={{ marginBottom: 12 }}>
        <h2 id="e-h">
          Editions <small>rates over each edition’s last 8 issues · click a row to filter the chart and the list</small>
        </h2>
        <div className="scroll-x">
          <table className="clickrows">
            <thead>
              <tr>
                <th>Edition</th>
                <th>City</th>
                <th>Active members</th>
                <th>Issues sent</th>
                <th>Avg delivered</th>
                <th>Open rate</th>
                <th>Click rate</th>
                <th>Last sent</th>
              </tr>
            </thead>
            <tbody>
              {data.editions.map((e) => {
                const k = `${e.edition}|${e.city}`;
                return (
                  <tr key={k} aria-selected={edition === k} onClick={() => setEdition(edition === k ? 'all' : k)}>
                    <td>{e.edition}</td>
                    <td className="txt">{e.city}</td>
                    <td>{e.active_members === null ? '—' : group(e.active_members)}</td>
                    <td>{group(e.issues_all)}</td>
                    <td>{group(e.delivered_avg)}</td>
                    <td>{pct(e.opened, e.delivered)}</td>
                    <td>{pct(e.clicked, e.delivered)}</td>
                    <td>{day(e.last_sent_on)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="l-h" style={{ marginBottom: 12 }}>
        <h2 id="l-h">
          Every issue sent{' '}
          <small>
            {group(issues.length)} {edition !== 'all' ? `for ${editionLabel}` : 'in all'} · click one to see who clicked what
          </small>
        </h2>
        <div className="scroll-x">
          <table className="clickrows">
            <thead>
              <tr>
                <th>Sent</th>
                <th className="txt">Issue</th>
                <th>Delivered</th>
                <th>Opened</th>
                <th>Clicked</th>
                <th>Clicks</th>
                <th>Bounced</th>
              </tr>
            </thead>
            <tbody>
              {shownIssues.map((i) => (
                <tr key={i.subject} onClick={() => setIssue(i)} title="See what was clicked and by whom">
                  <td>{day(i.sent_on)}</td>
                  <td className="txt">
                    <b>{i.kind === 'alert' ? 'Alert' : `${i.edition || ''} · ${i.city || ''}`}</b>
                    <span className="muted"> {i.label || i.subject}</span>
                  </td>
                  <td>{group(i.delivered)}</td>
                  <td>
                    {group(i.opened)} <span className="muted">({pct(i.opened, i.delivered, 0)})</span>
                  </td>
                  <td>
                    {group(i.clicked)} <span className="muted">({pct(i.clicked, i.delivered, 0)})</span>
                  </td>
                  <td>{group(i.clicks)}</td>
                  <td>{i.bounced ? group(i.bounced) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {issues.length > 15 && (
          <p className="how">
            <button type="button" className="linkbtn" onClick={() => setAllIssues((v) => !v)}>
              {allIssues ? 'Show the latest 15' : `Show all ${issues.length} issues`}
            </button>
          </p>
        )}
      </section>

      <div className="grid2">
        <section className="card" aria-labelledby="t-h">
          <h2 id="t-h">
            Most clicked stories <small>last 30 days</small>
          </h2>
          {data.top_links_30d.length ? (
            <div className="scroll-x">
              <table className="compact">
                <thead>
                  <tr>
                    <th className="txt">Story</th>
                    <th>Readers</th>
                    <th>Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.top_links_30d].sort((a, b) => b.people - a.people || b.clicks - a.clicks).map((l) => (
                    <tr key={l.url}>
                      <td className="txt">
                        <a href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}>
                          {storyTitle(l.url)}
                        </a>
                      </td>
                      <td>{group(l.people)}</td>
                      <td>{group(l.clicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-note">No clicks recorded in the last 30 days.</p>
          )}
        </section>

        <section className="card" aria-labelledby="p-h">
          <h2 id="p-h">
            Most engaged members <small>clicks in the last 90 days</small>
          </h2>
          {data.top_people_90d.length ? (
            <div className="scroll-x">
              <table className="compact">
                <thead>
                  <tr>
                    <th className="txt">Member</th>
                    <th>City</th>
                    <th>Issues clicked</th>
                    <th>Clicks</th>
                    <th>Opens</th>
                    <th>Last click</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_people_90d.map((p) => (
                    <tr key={p.email}>
                      <td className="txt">
                        {p.email}
                        {p.status && p.status !== 'active' ? <span className="chip none"> {p.status}</span> : null}
                      </td>
                      <td>{cityName(p.city)}</td>
                      <td>{p.issues_clicked === undefined ? '—' : group(p.issues_clicked)}</td>
                      <td>{group(p.clicks)}</td>
                      <td>{group(p.opens)}</td>
                      <td>{when(p.last_click)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-note">No clicks recorded in the last 90 days.</p>
          )}
          <p className="how">Company mail systems often open every link to check it for viruses, which inflates raw clicks. Compare members by issues clicked.</p>
        </section>
      </div>

      {/* ── every email, by kind ────────────────────────────────────────── */}
      <h2 className="sub-h">Every email sent, by kind</h2>
      <section className="card" aria-labelledby="k-h" style={{ marginBottom: 12 }}>
        <h2 id="k-h">
          What Resend has sent for you{' '}
          <small>
            {group(totalDelivered)} delivered since {day(data.tracking.events_since)} · newsletters and sign-up emails counted apart
          </small>
        </h2>
        <div className="scroll-x">
          <table className="compact">
            <thead>
              <tr>
                <th className="txt">Kind</th>
                <th>Different emails</th>
                <th>Delivered</th>
                <th>Opened</th>
                <th>Clicked</th>
                <th>Bounced</th>
                <th>Complaints</th>
                <th>First</th>
                <th>Last</th>
              </tr>
            </thead>
            <tbody>
              {kinds.map((k) => (
                <tr key={k.kind}>
                  <td className="txt">{KIND_LABEL[k.kind] || k.kind}</td>
                  <td>{group(k.subjects)}</td>
                  <td>{group(k.delivered)}</td>
                  <td>
                    {group(k.opened)} <span className="muted">({pct(k.opened, k.delivered, 0)})</span>
                  </td>
                  <td>
                    {group(k.clicked)} <span className="muted">({pct(k.clicked, k.delivered, 0)})</span>
                  </td>
                  <td>{group(k.bounced)}</td>
                  <td>{group(k.complained)}</td>
                  <td>{day(k.first_on)}</td>
                  <td>{day(k.last_on)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 14 }}>
          <Tabs options={kindOptions} value={kindTab} onChange={setKindTab} label="Kind of email" />
          <div className="chart">
            <Chart kind="bar" items={monthItems} unit="count" empty="No emails recorded" />
          </div>
        </div>
        <p className="how">
          Delivered per month. “Opened” is counted from a tiny tracking image that some mail apps block or load on their own, so treat it as a
          rough floor; a click is a real reader going to the site. Both have been recorded since {day(data.tracking.opens_since)}, deliveries
          since {day(data.tracking.events_since)}. Anything sent before that is only in Resend’s own dashboard.
        </p>
      </section>

      {/* ── list hygiene ─────────────────────────────────────────────────── */}
      <div className="grid2">
        <section className="card" aria-labelledby="d-h">
          <h2 id="d-h">
            Not opening anything <small>{group(data.dormant.count)} members</small>
          </h2>
          <p className="how">
            Still subscribed, received at least four issues in the last 90 days, opened none. Send them one short “still want this?” email and
            drop those who stay silent: a cleaner list opens better and keeps Gmail trusting the sender.
          </p>
          {data.dormant.count > 0 && (
            <p className="how">
              <button type="button" className="linkbtn" onClick={() => setShowDormant((v) => !v)}>
                {showDormant ? 'Hide the list' : `Show ${Math.min(60, data.dormant.count)} of them`}
              </button>
            </p>
          )}
          {showDormant && (
            <div className="scroll-x">
              <table className="compact">
                <thead>
                  <tr>
                    <th className="txt">Member</th>
                    <th>City</th>
                    <th>Issues in 90 days</th>
                    <th>Last opened</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dormant.sample.map((r) => (
                    <tr key={r.email}>
                      <td className="txt">{r.email}</td>
                      <td>{cityName(r.city)}</td>
                      <td>{group(r.delivered)}</td>
                      <td>{r.last_engaged ? day(r.last_engaged) : 'never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="b-h">
          <h2 id="b-h">
            Bouncing addresses <small>{group(data.bounced.count)} still active</small>
          </h2>
          <p className="how">
            Active members whose address bounced in the last 90 days. Unsubscribe them on the Culture Alberta members page; repeated bounces
            hurt delivery for everyone else.
          </p>
          {data.bounced.count > 0 && (
            <p className="how">
              <button type="button" className="linkbtn" onClick={() => setShowBounced((v) => !v)}>
                {showBounced ? 'Hide the list' : `Show ${Math.min(60, data.bounced.count)} of them`}
              </button>
            </p>
          )}
          {showBounced && (
            <div className="scroll-x">
              <table className="compact">
                <thead>
                  <tr>
                    <th className="txt">Member</th>
                    <th>City</th>
                    <th>Bounces</th>
                    <th>Last</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bounced.sample.map((r) => (
                    <tr key={r.email}>
                      <td className="txt">{r.email}</td>
                      <td>{cityName(r.city)}</td>
                      <td>{group(r.bounces)}</td>
                      <td>{day(r.last_on)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ── Resend's own totals ─────────────────────────────────────────── */}
      <section className="card" aria-labelledby="r-h" style={{ marginBottom: 12 }}>
        <h2 id="r-h">
          Resend’s own daily totals <small>every email the account sends, as Resend counts it</small>
        </h2>
        {data.resend.daily.length ? (
          <div className="scroll-x">
            <table className="compact">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Sent</th>
                  <th>Delivered</th>
                  <th>Opened</th>
                  <th>Clicked</th>
                  <th>Bounced</th>
                  <th>Complaints</th>
                  <th>Unsubscribed</th>
                </tr>
              </thead>
              <tbody>
                {data.resend.daily.map((r) => (
                  <tr key={r.day}>
                    <td>{day(r.day)}</td>
                    <td>{group(r.sent ?? 0)}</td>
                    <td>{group(r.delivered ?? 0)}</td>
                    <td>{group(r.unique_opened ?? r.opened ?? 0)}</td>
                    <td>{group(r.unique_clicked ?? r.clicked ?? 0)}</td>
                    <td>{group(r.bounced ?? 0)}</td>
                    <td>{group(r.complained ?? 0)}</td>
                    <td>{group(r.unsubscribed ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="how">
            <p style={{ margin: 0 }}>
              Not flowing yet. A nightly job in Supabase is ready to copy Resend’s metrics here, but it needs a Resend API key
              {data.resend.last_run
                ? ` — the last attempt on ${day(data.resend.last_run.requested_at)} said: “${data.resend.last_run.error || data.resend.last_run.status}”.`
                : '.'}{' '}
              Everything above works without it, from the per-email events.
            </p>
            <ol>
              <li>In Resend, open API keys → Create API key. Name it “Supabase metrics”, permission “Sending access” is not needed — pick read-only if offered.</li>
              <li>Copy the key once; Resend will not show it again.</li>
              <li>In Supabase (project Culturealberta), open Project Settings → Vault → New secret. Name: resend_api_key. Paste the key. Save.</li>
              <li>The job runs at 2:15 a.m. Edmonton time; this table fills in the next morning.</li>
            </ol>
          </div>
        )}
      </section>

      {panel && <Panels panel={panel} data={data} curIssues={curIssues} onClose={() => setPanel(null)} />}
      {issue && <IssuePanel key={issue.subject} issue={issue} onClose={() => setIssue(null)} />}
    </AdminShell>
  );
}

// ─── the panels behind the tiles ───────────────────────────────────────────

function Panels({
  panel,
  data,
  curIssues,
  onClose,
}: {
  panel: Exclude<Panel, null>;
  data: NewsletterData;
  curIssues: Issue[];
  onClose: () => void;
}) {
  const m = data.members;
  const cur = data.window.cur;
  const prev = data.window.prev;

  if (panel === 'active') {
    return (
      <Detail title="Active members" value={group(m.active)} onClose={onClose}>
        <Explain>
          People on the list right now, by the city they chose when they signed up. “Kept” is the share of everyone who ever signed up from
          that city who is still subscribed.
        </Explain>
        <DetailTable
          head={['City', 'Active', 'Ever signed up', 'Kept']}
          right={[1, 2, 3]}
          rows={m.by_city.map((c) => [cityName(c.city), group(c.active), group(c.total), pct(c.active, c.total, 0)])}
          foot={['All cities', group(m.active), group(m.total), pct(m.active, m.total, 0)]}
        />
      </Detail>
    );
  }

  if (panel === 'new' || panel === 'net') {
    const joined = m.recent.filter((r) => r.event === 'subscribed');
    return (
      <Detail
        title={panel === 'net' ? 'Net growth, last 30 days' : 'Joined, last 30 days'}
        value={panel === 'net' ? signed(m.new_30d - m.unsub_30d) : group(m.new_30d)}
        onClose={onClose}
      >
        <Explain>
          {group(m.new_30d)} people signed up and {group(m.unsub_30d)} unsubscribed in the last 30 days; the 30 days before that brought{' '}
          {group(m.new_prev_30d)} and lost {group(m.unsub_prev_30d)}.{' '}
          {m.sources_30d.length
            ? `Where the sign-ups came from: ${m.sources_30d.map((s) => `${s.source.replace(/-/g, ' ')} ${s.n}`).join(', ')}.`
            : ''}
        </Explain>
        <DetailTable
          head={['When', 'Member', 'City', 'Came from']}
          rows={joined.map((r) => [when(r.at), r.email, cityName(r.city), (r.source || 'not recorded').replace(/-/g, ' ')])}
          empty="No sign-ups recorded yet."
        />
      </Detail>
    );
  }

  if (panel === 'unsub') {
    const left = m.recent.filter((r) => r.event === 'unsubscribed');
    return (
      <Detail title="Left, last 30 days" value={group(m.unsub_30d)} onClose={onClose}>
        <Explain>
          Members who unsubscribed. A few after every issue is normal; a cluster on one day points at that day’s issue. The newest are listed
          here.
        </Explain>
        <DetailTable head={['When', 'Member', 'City']} rows={left.map((r) => [when(r.at), r.email, cityName(r.city)])} empty="Nobody has left recently." />
      </Detail>
    );
  }

  if (panel === 'delivery') {
    return (
      <Detail
        title="Bounces and complaints, last 30 days"
        value={cur ? `${group(cur.bounced)} bounced · ${group(cur.complained)} complaints` : '—'}
        onClose={onClose}
      >
        <Explain>
          A bounce is an address that could not take the email (full inbox, closed account, a typo at sign-up). A complaint is someone pressing
          “report spam”. Under 2% bounces and under 0.1% complaints keeps Gmail and Outlook happy. {group(data.complaints_90d)} complaints in
          the last 90 days. Active addresses that bounced are listed on the page under Bouncing addresses.
        </Explain>
        <DetailTable
          head={['Sent', 'Issue', 'Delivered', 'Bounced', 'Complaints']}
          right={[2, 3, 4]}
          rows={curIssues.map((i) => [day(i.sent_on), `${i.edition} · ${i.city}`, group(i.delivered), group(i.bounced), group(i.complained)])}
          empty="No issue went out in the last 30 days."
        />
      </Detail>
    );
  }

  // issues / open / click: the 30-day window, issue by issue
  const title = panel === 'open' ? 'Open rate, last 30 days' : panel === 'click' ? 'Click rate, last 30 days' : 'Issues sent, last 30 days';
  const value =
    panel === 'open' ? (cur ? pct(cur.opened, cur.delivered) : '—') : panel === 'click' ? (cur ? pct(cur.clicked, cur.delivered) : '—') : cur ? group(cur.issues) : '0';
  return (
    <Detail title={title} value={value} onClose={onClose}>
      <Explain>
        {panel === 'open'
          ? 'Members who opened at least once, out of everyone the issue reached, across every newsletter issue sent in the last 30 days. Opens come from a tracking image some mail apps block, so this is a floor, not a count of readers.'
          : panel === 'click'
            ? 'Members who clicked at least one story, out of everyone the issue reached, across every newsletter issue sent in the last 30 days. This is the number to trust: each click is a reader on the site.'
            : 'Every newsletter issue that went out in the last 30 days. Welcome emails, alerts and notifications are not counted here.'}
        {prev && cur
          ? ` The 30 days before: ${group(prev.issues)} issues, ${pct(prev.opened, prev.delivered)} opened, ${pct(prev.clicked, prev.delivered)} clicked.`
          : ''}
      </Explain>
      <DetailTable
        head={['Sent', 'Issue', 'Delivered', 'Opened', 'Clicked']}
        right={[2, 3, 4]}
        rows={curIssues.map((i) => [
          day(i.sent_on),
          `${i.edition} · ${i.city}`,
          group(i.delivered),
          `${group(i.opened)} (${pct(i.opened, i.delivered, 0)})`,
          `${group(i.clicked)} (${pct(i.clicked, i.delivered, 0)})`,
        ])}
        foot={cur ? ['All', `${group(cur.issues)} issues`, group(cur.delivered), pct(cur.opened, cur.delivered), pct(cur.clicked, cur.delivered)] : undefined}
        empty="No issue went out in the last 30 days."
      />
    </Detail>
  );
}

// ─── one issue in full ─────────────────────────────────────────────────────

function IssuePanel({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const [d, setD] = useState<IssueDetail | null>(null);
  const [err, setErr] = useState('');
  const [showOpeners, setShowOpeners] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/newsletter/issue?subject=${encodeURIComponent(issue.subject)}`, { cache: 'no-store' })
      .then(async (r) => {
        const j = (await r.json()) as { data?: IssueDetail; error?: string };
        if (!r.ok || !j.data) throw new Error(j.error || 'Could not load this issue.');
        return j.data;
      })
      .then((x) => {
        if (alive) setD(x);
      })
      .catch((e: Error) => {
        if (alive) setErr(e.message);
      });
    return () => {
      alive = false;
    };
  }, [issue.subject]);

  const totalOpens = d ? d.opens_by_hour.reduce((a, h) => a + h.opens, 0) : 0;
  const firstHour = d ? d.opens_by_hour.filter((h) => h.hour < 1).reduce((a, h) => a + h.opens, 0) : 0;
  const firstDay = d ? d.opens_by_hour.filter((h) => h.hour < 24).reduce((a, h) => a + h.opens, 0) : 0;

  return (
    <Detail
      title={issue.subject}
      value={`${pct(issue.opened, issue.delivered)} opened · ${pct(issue.clicked, issue.delivered)} clicked`}
      onClose={onClose}
    >
      <Explain>
        Sent {d?.sent_at ? when(d.sent_at) : day(issue.sent_on)} to {group(issue.delivered)} members. {group(issue.opened)} opened it (a floor:
        some mail apps hide opens), {group(issue.clicked)} clicked at least one story, {group(issue.clicks)} clicks in all
        {issue.bounced ? `, ${group(issue.bounced)} bounced` : ''}
        {issue.complained ? `, ${group(issue.complained)} marked it spam` : ''}.
        {d && totalOpens
          ? ` ${pct(firstHour, totalOpens, 0)} of the opens came in the first hour and ${pct(firstDay, totalOpens, 0)} within a day — after that an issue is as good as finished.`
          : ''}
      </Explain>

      {err && <Banner tone="crit">{err}</Banner>}
      {!d && !err && <p className="empty-note">Loading who clicked…</p>}

      {d && (
        <>
          <h3 className="sub-h">What they clicked</h3>
          <DetailTable
            head={['Story', 'Clicks', 'Readers']}
            right={[1, 2]}
            rows={d.links.map((l) => [
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" title={l.url}>
                {storyTitle(l.url)}
              </a>,
              group(l.clicks),
              group(l.people),
            ])}
            empty="Nobody clicked a link in this issue."
          />

          <h3 className="sub-h">Who clicked</h3>
          <DetailTable
            head={['Member', 'City', 'Clicks', 'Last click', 'What']}
            right={[2]}
            rows={d.clickers.map((c) => [
              <span key={c.email}>
                {c.email}
                {c.status && c.status !== 'active' ? <span className="chip none"> {c.status}</span> : null}
              </span>,
              cityName(c.city),
              group(c.clicks),
              when(c.last_at),
              (c.urls || []).map(storyTitle).join(' · '),
            ])}
            empty="Nobody clicked a link in this issue."
          />

          {d.openers.length > 0 && (
            <>
              <h3 className="sub-h">
                <button type="button" className="linkbtn" onClick={() => setShowOpeners((v) => !v)}>
                  {showOpeners ? 'Hide' : 'Show'} the {group(d.openers.length)} who opened but did not click
                </button>
              </h3>
              {showOpeners && (
                <DetailTable
                  head={['Member', 'City', 'Opens', 'Last open']}
                  right={[2]}
                  rows={d.openers.map((o) => [o.email, cityName(o.city), group(o.opens), when(o.last_at)])}
                />
              )}
            </>
          )}

          {d.bounces.length > 0 && (
            <>
              <h3 className="sub-h">Bounced</h3>
              <DetailTable head={['Address', 'When']} rows={d.bounces.map((b) => [b.email, when(b.at)])} />
            </>
          )}
        </>
      )}
    </Detail>
  );
}

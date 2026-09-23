'use client';

// Content: the articles as a business. Which pages and kinds of story earn,
// which searches are within reach, which titles waste impressions, where
// readers come from, and how the site is holding up — each with the action it
// points to. All money here is USD, as Mediavine reports it.

import { useMemo, useState } from 'react';

import { SITE, VITAL_GOOD, buildRecommendations, pageName, vitalKey, type ContentData, type SearchQuery } from '@/lib/content';
import { day, group } from '../_components/format';
import { AdminShell, PageHead } from '../_components/shell';
import { Banner, Tile } from '../_components/ui';

const TONE: Record<string, { k: 'ok' | 'warn' | 'crit'; l: string }> = {
  good: { k: 'ok', l: 'Do this' },
  watch: { k: 'warn', l: 'Watch' },
  bad: { k: 'crit', l: 'Fix' },
};

const usd = (v: number) => `$${group(Math.round(v))}`;
const rpm = (v: number | null) => (v === null ? '—' : `$${v.toFixed(2)}`);
const pct = (v: number | null, places = 1) => (v === null ? '—' : `${(v * 100).toFixed(places)}%`);
const range = (p: { from: string; to: string } | null) => (p ? `${day(p.from)} – ${day(p.to)}` : '');

type PageSort = 'revenue' | 'rpm' | 'pageviews';

export default function ContentView({ data }: { data: ContentData }) {
  const [sort, setSort] = useState<PageSort>('revenue');
  const [showAll, setShowAll] = useState(false);
  const [engine, setEngine] = useState<'google' | 'bing'>('google');

  const recs = useMemo(() => buildRecommendations(data), [data]);
  const pages = useMemo(
    () => [...data.pages].sort((a, b) => (sort === 'rpm' ? (b.rpm ?? -1) - (a.rpm ?? -1) : b[sort] - a[sort])),
    [data.pages, sort],
  );
  const shown = showAll ? pages : pages.slice(0, 15);
  const totalRevenue = data.total?.revenue || data.pages.reduce((a, p) => a + p.revenue, 0);
  const totalViews = data.total?.pageviews || data.types.reduce((a, t) => a + t.pageviews, 0);

  const stories = data.types.filter((t) => t.rpm !== null && !/home|section/i.test(t.type));
  const bestType = [...stories].sort((a, b) => (b.rpm ?? 0) - (a.rpm ?? 0))[0];
  // Same bar as the recommendation: a source has to carry real traffic to count.
  const allSessions = data.total?.sessions || data.sources.reduce((a, s) => a + s.sessions, 0);
  const bestSource = [...data.sources]
    .filter((s) => s.rpm !== null && s.sessions >= Math.max(5000, allSessions * 0.03))
    .sort((a, b) => (b.rpm ?? 0) - (a.rpm ?? 0))[0];
  const topPage = data.pages[0];
  const maxTypeRpm = Math.max(1, ...data.types.map((t) => t.rpm ?? 0));
  const score = data.health.vitals.find((v) => /^score$/i.test(v.name));

  // "Within reach": on page 1 or just off it, with room to gain clicks.
  const queries: SearchQuery[] = (engine === 'google' ? data.google : data.bing).queries.slice(0, 25);
  const weakTitles = data.landing.pages.filter((p) => p.impressions >= 2000 && p.ctr < 0.02).slice(0, 12);

  const through = [
    data.period ? `Mediavine ${range(data.period)}` : null,
    data.google.loaded ? `Google Search ${day(data.google.loaded)}` : null,
    data.bing.loaded ? `Bing ${day(data.bing.loaded)}` : null,
    data.landing.loaded ? `GA4 ${day(data.landing.loaded)}` : null,
    data.health.period ? `Clarity ${range(data.health.period)}` : null,
  ].filter(Boolean);

  return (
    <AdminShell>
      <PageHead
        label="Site"
        title="Content"
        help="What the articles earn, what to write next and what to fix — worked out from the latest data drop. Money is in US dollars, as Mediavine pays it."
      />
      {through.length > 0 && <p className="through">Data through: {through.join(' · ')}</p>}
      {data.problems.map((p) => (
        <Banner key={p} tone="warn">
          {p}
        </Banner>
      ))}

      <section className="card" aria-labelledby="w-h" style={{ marginBottom: 12 }}>
        <h2 id="w-h">
          What to do next <small>{recs.length ? `${recs.length} worked out from the numbers below` : ''}</small>
        </h2>
        {recs.length ? (
          <ul className="ins">
            {recs.map((r) => {
              const tone = TONE[r.tone];
              return (
                <li key={r.id}>
                  <span className={`chip ${tone.k}`}>{tone.l}</span>
                  <b>{r.title}</b>
                  <span>
                    {r.detail} <em>{r.source}</em>
                    {r.href && (
                      <>
                        {' '}
                        <a href={r.href} target="_blank" rel="noopener noreferrer">
                          Open the page
                        </a>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="empty-note">Nothing stands out yet. Send a data drop and this fills in by itself.</p>
        )}
      </section>

      <div className="tiles">
        <Tile
          label="Best-paying kind of story"
          value={bestType ? rpm(bestType.rpm) : '—'}
          foot={<span>{bestType ? `per 1,000 views · ${bestType.type}` : 'no story types loaded'}</span>}
        />
        <Tile
          label="Best-paying source"
          value={bestSource ? rpm(bestSource.rpm) : '—'}
          foot={<span>{bestSource ? `per 1,000 sessions · ${bestSource.source}` : 'no sources loaded'}</span>}
        />
        <Tile
          label="Top page"
          value={topPage ? usd(topPage.revenue) : '—'}
          foot={<span>{topPage ? `${pageName(topPage.path, 40)} · ${group(topPage.pageviews)} views` : 'no pages loaded'}</span>}
        />
        <Tile
          label="Site score"
          value={score ? score.value.toFixed(0) : '—'}
          foot={<span>{score ? `Clarity, ${range(data.health.period)} · out of 100` : 'Clarity not loaded'}</span>}
        />
      </div>

      <section className="card" aria-labelledby="p-h" style={{ marginBottom: 12 }}>
        <div className="row-head">
          <h2 id="p-h">
            Top pages <small>{data.period ? `${range(data.period)} · ${data.pages.length} pages` : ''}</small>
          </h2>
          <div className="seg" role="group" aria-label="Sort pages by">
            {(
              [
                ['revenue', 'Revenue'],
                ['rpm', 'Per 1,000 views'],
                ['pageviews', 'Pageviews'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="cnote">
          “Per 1,000 views” is what a page earns for every thousand readers. A high number on a low-traffic page is a
          page worth promoting; a low number on a high-traffic page is readers who skim.
        </p>
        <div className="tw" style={{ marginTop: 6 }}>
          <table>
            <thead>
              <tr>
                <th>Page</th>
                <th>Revenue</th>
                <th>Share</th>
                <th>Pageviews</th>
                <th>Per 1,000</th>
              </tr>
            </thead>
            <tbody>
              {shown.length ? (
                shown.map((p) => (
                  <tr key={p.path}>
                    <td className="co">
                      <a href={`${SITE}${p.path}`} target="_blank" rel="noopener noreferrer" title={p.path}>
                        <b>{pageName(p.path)}</b>
                        <span>{p.path === '/' ? '/' : p.path.replace(/^\/articles\//, '').slice(0, 60)}</span>
                      </a>
                    </td>
                    <td>{usd(p.revenue)}</td>
                    <td>{totalRevenue ? pct(p.revenue / totalRevenue) : '—'}</td>
                    <td>{group(p.pageviews)}</td>
                    <td className={(p.rpm ?? 0) >= 20 ? 'ok' : (p.rpm ?? 0) < 6 && p.pageviews >= 5000 ? 'crit' : undefined}>
                      {rpm(p.rpm)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="l muted">
                    No page figures loaded. The Mediavine pages export fills this in.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages.length > 15 && (
          <p className="acts-row" style={{ marginTop: 10 }}>
            <button type="button" onClick={() => setShowAll((s) => !s)}>
              {showAll ? 'Show the top 15' : `Show all ${pages.length}`}
            </button>
          </p>
        )}
      </section>

      <div className="two-col">
        <section className="card" aria-labelledby="t-h">
          <h2 id="t-h">
            What each kind of story earns <small>per 1,000 views</small>
          </h2>
          {data.types.length ? (
            <ul className="tbars">
              {[...data.types]
                .sort((a, b) => (b.rpm ?? 0) - (a.rpm ?? 0))
                .map((t) => (
                  <li key={t.type}>
                    <span className="lbl">{t.type}</span>
                    <span className="bar">
                      <i style={{ width: `${Math.max(2, ((t.rpm ?? 0) / maxTypeRpm) * 100)}%` }} />
                    </span>
                    <b>{rpm(t.rpm)}</b>
                    <span className="sub">
                      {usd(t.revenue)} · {group(t.pageviews)} views{totalViews ? ` · ${pct(t.pageviews / totalViews, 0)} of traffic` : ''}
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="empty-note">No story types loaded.</p>
          )}
          <p className="cnote">
            Story types are Mediavine&apos;s grouping of your URLs. The bar is earnings per reader; the small line is
            the total and how much of your traffic it is.
          </p>
        </section>

        <section className="card" aria-labelledby="s-h">
          <h2 id="s-h">
            Where readers come from <small>{data.period ? range(data.period) : ''}</small>
          </h2>
          <div className="tw" style={{ marginTop: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Revenue</th>
                  <th>Sessions</th>
                  <th>Per 1,000</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.slice(0, 10).map((s) => (
                  <tr key={s.source}>
                    <td>{s.source}</td>
                    <td>{usd(s.revenue)}</td>
                    <td>{group(s.sessions)}</td>
                    <td className={(s.rpm ?? 0) >= 15 ? 'ok' : undefined}>{rpm(s.rpm)}</td>
                  </tr>
                ))}
                {!data.sources.length && (
                  <tr>
                    <td colSpan={4} className="l muted">
                      No sources loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="cnote">Per 1,000 sessions. Search readers pay most and keep coming; social readers arrive in bursts and skim.</p>
        </section>
      </div>

      <section className="card" aria-labelledby="q-h" style={{ marginBottom: 12 }}>
        <div className="row-head">
          <h2 id="q-h">
            Search wins within reach{' '}
            <small>
              {engine === 'google' ? (data.google.loaded ? `Google, loaded ${day(data.google.loaded)}` : '') : data.bing.loaded ? `Bing, loaded ${day(data.bing.loaded)}` : ''}
            </small>
          </h2>
          <div className="seg" role="group" aria-label="Search engine">
            <button type="button" aria-pressed={engine === 'google'} onClick={() => setEngine('google')}>
              Google {data.google.queries.length}
            </button>
            <button type="button" aria-pressed={engine === 'bing'} onClick={() => setEngine('bing')}>
              Bing {data.bing.queries.length}
            </button>
          </div>
        </div>
        <p className="cnote">
          Searches you already rank on page 1 or just off it for. You do not need new content to win these — a title that
          matches the search, a fresher page, or a clearer first paragraph moves you up. Impressions are how often the
          search was shown; the click rate is how often yours was chosen.
        </p>
        <div className="tw" style={{ marginTop: 6 }}>
          <table>
            <thead>
              <tr>
                <th>Search</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>Click rate</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              {queries.length ? (
                queries.map((q) => (
                  <tr key={q.query}>
                    <td>{q.query}</td>
                    <td>{group(q.impressions)}</td>
                    <td>{group(q.clicks)}</td>
                    <td className={q.impressions >= 1000 && q.ctr < 0.01 ? 'crit' : q.ctr >= 0.05 ? 'ok' : undefined}>{pct(q.ctr)}</td>
                    <td>#{q.position.toFixed(1)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="l muted">
                    Nothing loaded from {engine === 'google' ? 'Google Search Console' : 'Bing'} yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="l-h" style={{ marginBottom: 12 }}>
        <h2 id="l-h">
          Titles to fix <small>{data.landing.loaded ? `GA4 landing pages, loaded ${day(data.landing.loaded)}` : ''}</small>
        </h2>
        <p className="cnote">
          Pages Google shows often that few people click. Each one is a title that does not match what the reader
          searched for. Engagement is the share of visits that stayed and how long, once they did click.
        </p>
        <div className="tw" style={{ marginTop: 6 }}>
          <table>
            <thead>
              <tr>
                <th>Page</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>Click rate</th>
                <th>Position</th>
                <th>Engagement</th>
              </tr>
            </thead>
            <tbody>
              {weakTitles.length ? (
                weakTitles.map((p) => (
                  <tr key={p.path}>
                    <td className="co">
                      <a href={`${SITE}${p.path}`} target="_blank" rel="noopener noreferrer" title={p.path}>
                        <b>{pageName(p.path, 64)}</b>
                      </a>
                    </td>
                    <td>{group(p.impressions)}</td>
                    <td>{group(p.clicks)}</td>
                    <td className="crit">{pct(p.ctr)}</td>
                    <td>#{p.position.toFixed(1)}</td>
                    <td className="l">
                      {p.engagementRate !== null ? pct(p.engagementRate, 0) : '—'}
                      {p.engagementSeconds !== null ? ` · ${p.engagementSeconds.toFixed(0)}s` : ''}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="l muted">
                    {data.landing.pages.length ? 'No page is wasting impressions right now.' : 'No GA4 landing pages loaded.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="h-h">
        <h2 id="h-h">
          Site health <small>{data.health.period ? `Clarity, ${range(data.health.period)}` : ''}</small>
        </h2>
        <div className="two-col" style={{ marginBottom: 0 }}>
          <div>
            <h3 className="sub-h">Speed, as Google measures it</h3>
            <ul className="srows">
              {data.health.vitals
                .filter((v) => vitalKey(v.name))
                .map((v) => {
                  const key = vitalKey(v.name) as string;
                  const good = VITAL_GOOD[key];
                  const ok = v.value <= good.max;
                  return (
                    <li key={v.name}>
                      <span>
                        {good.label}
                        <span className="sub-line">
                          {good.plain} · good is under {good.max}
                          {good.unit}
                        </span>
                      </span>
                      <b className={ok ? 'ok' : 'crit'}>
                        {v.value}
                        {good.unit}
                        <span className={`chip ${ok ? 'ok' : 'crit'}`} style={{ marginLeft: 8 }}>
                          {ok ? 'Good' : 'Needs work'}
                        </span>
                      </b>
                    </li>
                  );
                })}
              {!data.health.vitals.length && <li className="empty-note">No Clarity figures loaded.</li>}
            </ul>
          </div>
          <div>
            <h3 className="sub-h">Errors readers hit</h3>
            <ul className="srows">
              {data.health.errors.slice(0, 5).map((e) => (
                <li key={e.message}>
                  <span className="err">{e.message}</span>
                  <b>
                    {group(e.sessions)}
                    {e.pct !== null ? <span className="soft"> · {e.pct.toFixed(1)}%</span> : null}
                  </b>
                </li>
              ))}
              {!data.health.errors.length && <li className="empty-note">No errors recorded in this window.</li>}
            </ul>
            <p className="cnote">
              Sessions that hit each error. “Script error.” is the browser hiding the detail of an error in third-party
              code (usually ads); the named ones are yours to fix.
            </p>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}

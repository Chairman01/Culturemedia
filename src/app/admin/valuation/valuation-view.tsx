'use client';

// Valuation: the number a buyer would pay today, and every step between the
// figures on the other pages and that number. Nothing here is typed in by hand:
// it moves with the weekly data drop.

import Link from 'next/link';

import type { Freshness } from '@/lib/admin-types';
import { SOURCES, type Range, type Valuation, type ValuationInput } from '@/lib/valuation';
import { day, group, monthLabel } from '../_components/format';
import { AdminShell, PageHead } from '../_components/shell';
import { netNeeded } from '@/lib/valuation-plan';
import { RoadToMillion } from './road-to-million';
import { Banner, Tile } from '../_components/ui';

const usd = (v: number) => `${v < -0.5 ? '−' : ''}US$${group(Math.abs(Math.round(v)))}`;
const cad = (v: number, fx: number) => `C$${group(Math.round(v * fx))}`;
const span = (r: Range) => `${usd(r.low)} – ${usd(r.high)}`;
const pct = (f: number) => `${f >= 1 ? '+' : '−'}${Math.round(Math.abs(1 - f) * 100)}%`;

export default function ValuationView({
  valuation: v,
  input,
  error,
  freshness,
}: {
  valuation: Valuation;
  input: ValuationInput;
  error: string | null;
  freshness: Freshness | null;
}) {
  const fx = v.fxUsdCad;
  const headline = v.bases.find((b) => b.key === v.headline)!;
  const months = [...input.months].filter((m) => !m.future).reverse();
  // How many times bigger the big brands' audiences were, rounded so it reads as an order of size.
  const times = input.pageviews ? Math.max(1, Math.round(24_000_000 / input.pageviews / 10) * 10) : null;
  const through = [
    freshness?.mediavine_daily_through ? `Mediavine ${day(freshness.mediavine_daily_through)}` : null,
    `expenses ${v.history.firstMonth ? 'on file' : 'none'}`,
    `${input.subscribers.toLocaleString('en-CA')} subscribers today`,
  ].filter(Boolean);

  return (
    <AdminShell>
      <PageHead
        label="If you sold today"
        title="Valuation"
        help="What a buyer would realistically pay for Culture Alberta right now, worked out the way brokers do — from your own numbers, updated with every data drop. In US dollars, the currency these sites trade in, with Canadian alongside."
      />
      <p className="through">As of {day(v.today)} · {through.join(' · ')} · 1 USD = {fx.toFixed(2)} CAD</p>
      <Banner tone="crit">{error}</Banner>

      <section className="card band" aria-labelledby="v-h" style={{ marginBottom: 12 }}>
        <div className="band-figure">
          <h2 id="v-h">
            Realistic sale price today <small>most likely</small>
          </h2>
          <p className="hero">{usd(v.total.mid)}</p>
          <p className="foot">
            {cad(v.total.mid, fx)} · a buyer would land somewhere between <b>{usd(v.total.low)}</b> and <b>{usd(v.total.high)}</b>
          </p>
          {v.strategic && (
            <p className="foot">
              A strategic buyer — the kind that bought Daily Hive — might stretch further: up to about{' '}
              <b>
                {usd(v.strategic.low)} – {usd(v.strategic.high)}
              </b>{' '}
              on Daily Hive&apos;s revenue terms. See the Canadian sales below.
            </p>
          )}
          <ul className="srows" style={{ marginTop: 12 }}>
            {v.pieces.map((p) => (
              <li key={p.key}>
                <span>
                  {p.title}
                  <span className="sub-line">{p.detail}</span>
                </span>
                <b>{usd(p.value.mid)}</b>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="sub-h">How it is worked out</h3>
          <p className="explain-plain">
            Websites like this sell for a multiple of monthly profit. Take the net profit on the{' '}
            <b>{headline.title.toLowerCase()}</b> — about <b>{usd(headline.net)} a month</b> after costs —
            and multiply by {v.assumptions.multiple.low}–{v.assumptions.multiple.high}, the range content sites
            fetch on the main marketplaces. That gives {span(headline.raw)}. Then take off what a buyer would
            take off ({pct(v.factor)} in total, itemised below), and add what else a buyer gets: the newsletter
            list, the social accounts, the member accounts and the name. Every asset is listed below.
          </p>
          {v.pace && (
            <p className="cnote">
              {monthLabel(v.pace.month)} so far: {usd(v.pace.netSoFar)} net in {v.pace.daysIn} days, on pace for about{' '}
              {usd(v.pace.projected)}. A month in progress is not counted until it is complete.
            </p>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="k-h" style={{ marginBottom: 12 }}>
        <h2 id="k-h">
          In short <small>the whole page in five lines</small>
        </h2>
        <ul className="short">
          <li>
            <b>Worth about {usd(v.total.mid)} ({cad(v.total.mid, fx)}) today.</b> A buyer would land between{' '}
            {usd(v.total.low)} and {usd(v.total.high)}. That is what a website buyer pays for what the business earns
            now, after what they take off for risk.
          </li>
          <li>
            <b>Every asset is counted, none twice.</b> Readers
            {input.articles ? ` and the ${input.articles.toLocaleString('en-CA')} articles` : ' and the archive'} count through the money
            they make. The list, {v.followers.toLocaleString('en-CA')} social followers
            {input.members ? `, ${input.members.toLocaleString('en-CA')} members` : ''} and the name are added on top.
          </li>
          {v.strategic && (
            <li>
              <b>A media company could pay more.</b> ZoomerMedia bought Daily Hive, blogTO and Curiocity; on Daily
              Hive&apos;s terms Culture Alberta could reach about {usd(v.strategic.low)}–{usd(v.strategic.high)}.
            </li>
          )}
          {v.drivers.filter((d) => d.lift).length > 0 && (
            <li>
              <b>Fastest ways up:</b>{' '}
              {v.drivers
                .filter((d) => d.lift)
                .slice(0, 3)
                .map((d) => `${d.title.charAt(0).toLowerCase()}${d.title.slice(1)} (+${usd(d.lift as number)})`)
                .join('; ')}
              .
            </li>
          )}
          <li>
            <b>US$1 million</b> needs about {usd(netNeeded(1_000_000))} a month in profit
            {headline.net > 0 ? `, roughly ${Math.round(netNeeded(1_000_000) / (v.bases.find((b) => b.key === 'three')?.net || headline.net))}× the last three months` : ''}.
            The road is below.
          </li>
        </ul>
      </section>

      <div className="tiles">
        <Tile label="Monthly net, headline basis" value={usd(headline.net)} foot={<span>{headline.title.toLowerCase()} · after expenses</span>} />
        <Tile
          label="Months of ad revenue"
          value={String(v.history.completeMonths)}
          foot={<span>{v.history.monthsToTwelve ? `${v.history.monthsToTwelve} more to the 12 buyers want` : 'a full year — the discount is gone'}</span>}
        />
        <Tile label="Multiple used" value={`${v.assumptions.multiple.low}–${v.assumptions.multiple.high}×`} foot={<span>monthly net · content sites, 2025–26</span>} />
        <Tile
          label="Taken off for risk"
          value={pct(v.factor)}
          foot={<span>{v.adjustments.length ? `${v.adjustments.length} ${v.adjustments.length === 1 ? 'adjustment' : 'adjustments'}, below` : 'nothing to take off'}</span>}
        />
      </div>

      <section className="card" aria-labelledby="e-h" style={{ marginBottom: 12 }}>
        <h2 id="e-h">
          Everything you own, and how a buyer counts it <small>nothing left out, nothing counted twice</small>
        </h2>
        <div className="tw" style={{ marginTop: 6 }}>
          <table>
            <thead>
              <tr>
                <th>Asset</th>
                <th className="cell-l">What you have</th>
                <th className="cell-l">How it is counted</th>
                <th>Worth</th>
              </tr>
            </thead>
            <tbody>
              {v.assets.map((a) => (
                <tr key={a.name} className={a.value ? undefined : 'dim'}>
                  <td className="co">
                    <b>
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noopener noreferrer">
                          {a.name}
                        </a>
                      ) : (
                        a.name
                      )}
                    </b>
                  </td>
                  <td className="l cell-wrap">{a.have}</td>
                  <td className="l cell-wrap how">{a.how}</td>
                  <td>
                    {a.value ? (
                      <>
                        <b>{usd(a.value.mid)}</b>
                        <span className="range">{span(a.value)}</span>
                      </>
                    ) : (
                      <span className="muted">in the site line</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="hl">
                <td className="co">
                  <b>Total</b>
                </td>
                <td className="l" colSpan={2}>
                  What a buyer would realistically pay today
                </td>
                <td>
                  <b>{usd(v.total.mid)}</b>
                  <span className="range">{span(v.total)}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="cnote">
          Social accounts are priced on the sponsored posts they could carry: brands pay $100–500 a post for accounts
          with 10,000–100,000 followers, and the Spotlight package includes a story for C$350, so about{' '}
          {Math.round(v.assumptions.perPost.low * 100 * 10) / 10}–{v.assumptions.perPost.high * 100}¢ a follower. A buyer pays for
          6–12 months of one a month while you are not selling them yet. Follower counts were read from each public
          profile on {day(input.social[0]?.countedOn ?? v.today)} and are refreshed with the Wednesday data drop. Readers and the archive have no line of their own because a buyer
          pays for them through the money they make; adding them again would count them twice.
        </p>
      </section>

      <RoadToMillion v={v} input={input} />

      <section className="card" aria-labelledby="b-h" style={{ marginBottom: 12 }}>
        <h2 id="b-h">
          Three ways a buyer counts it <small>site only, before the list and the name</small>
        </h2>
        <div className="tw" style={{ marginTop: 6 }}>
          <table>
            <thead>
              <tr>
                <th>Basis</th>
                <th>Monthly net</th>
                <th>× {v.assumptions.multiple.low}–{v.assumptions.multiple.high}</th>
                <th>After adjustments</th>
              </tr>
            </thead>
            <tbody>
              {v.bases.map((b) => (
                <tr key={b.key} className={b.key === v.headline ? 'hl' : undefined}>
                  <td className="co">
                    <b>
                      {b.title}
                      {b.key === v.headline ? ' · used above' : ''}
                    </b>
                    <span>{b.who}</span>
                  </td>
                  <td>{usd(b.net)}</td>
                  <td>{span(b.raw)}</td>
                  <td>
                    <b>{span(b.value)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="cnote">
          The twelve-month line counts months before the ads started as zero, because a buyer does. The three-month
          line is the one you would argue for; expect to be paid nearer the six.
        </p>
      </section>

      <div className="two-col">
        <section className="card" aria-labelledby="a-h">
          <h2 id="a-h">
            What a buyer takes off, and why <small>{pct(v.factor)} in total</small>
          </h2>
          {v.adjustments.length ? (
            <ul className="ins">
              {v.adjustments.map((a) => (
                <li key={a.id}>
                  <span className={`chip ${a.factor >= 1 ? 'ok' : a.factor <= 0.8 ? 'crit' : 'warn'}`}>{pct(a.factor)}</span>
                  <b>{a.title}</b>
                  <span>{a.why}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">Nothing a buyer would discount right now.</p>
          )}
        </section>

        <section className="card" aria-labelledby="d-h">
          <h2 id="d-h">
            What would raise it <small>in order of size</small>
          </h2>
          <ul className="ins">
            {v.drivers.map((d) => (
              <li key={d.title}>
                <span className="chip ok">{d.lift ? `+${usd(d.lift)}` : 'Do this'}</span>
                <b>{d.title}</b>
                <span>{d.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card" aria-labelledby="m-h" style={{ marginBottom: 12 }}>
        <h2 id="m-h">
          The months behind it <small>USD · complete months count; the current one is shown for context</small>
        </h2>
        <div className="tw" style={{ marginTop: 6 }}>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Ads</th>
                <th>Partnerships</th>
                <th>Expenses</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className={m.partial ? 'dim' : undefined}>
                  <td className="co">
                    <b>
                      {monthLabel(m.month)} {m.month.slice(0, 4)}
                      {m.partial ? ' (so far)' : ''}
                    </b>
                  </td>
                  <td>{usd(m.ads)}</td>
                  <td>{usd(m.partnerships)}</td>
                  <td>{usd(-m.expenses)}</td>
                  <td className={m.total - m.expenses >= 0 ? 'ok' : 'crit'}>{usd(m.total - m.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="c-h" style={{ marginBottom: 12 }}>
        <h2 id="c-h">
          Canadian sales to compare <small>what the big city-media brands sold for</small>
        </h2>
        <div className="tw" style={{ marginTop: 6 }}>
          <table>
            <thead>
              <tr>
                <th>Sale</th>
                <th>Price</th>
                <th>Priced at</th>
                <th>Same measure, Culture Alberta</th>
                <th>Adjusted for earnings per reader</th>
              </tr>
            </thead>
            <tbody>
              {v.comparables.map((r) => {
                const c = r.sale;
                return (
                  <tr key={`${c.name}-${r.measure}`}>
                    <td className="co">
                      <a href={c.url} target="_blank" rel="noopener noreferrer">
                        <b>
                          {c.name} → {c.buyer}
                        </b>
                      </a>
                      <span>
                        {monthLabel(c.date)} {c.date.slice(0, 4)}
                        {c.monthlyPageviews ? ` · ${group(c.monthlyPageviews / 1_000_000)}M pageviews a month` : ''}
                        {c.revenueCad ? ` · C$${(c.revenueCad / 1_000_000).toFixed(1)}M revenue` : ''}
                        {c.followers ? ` · ${(c.followers / 1_000_000).toFixed(1)}M followers` : ''}
                      </span>
                    </td>
                    <td>C${(c.priceCad / 1_000_000).toFixed(1)}M</td>
                    <td className="l">{r.measure}</td>
                    <td>{r.implied !== null ? usd(r.implied) : '—'}</td>
                    <td>
                      <b>{r.adjusted !== null ? usd(r.adjusted) : '—'}</b>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="prose spaced" style={{ marginTop: 10 }}>
          <p>
            ZoomerMedia bought all three, and it already owns Daily Hive in Calgary and Edmonton — so the buyer
            for an Alberta city brand exists. But these were companies with {times ? `about ${times} times` : 'many times'} your audience, sales teams
            and years of history, and two of the three sold in 2022, before Meta pulled news off Facebook and
            Instagram in Canada (August 2023) and before digital-media prices fell. Their price per reader is
            also inflated by how they earned: Daily Hive took in about{' '}
            <b>C${v.revenuePerThousand.dailyHive.toFixed(0)} per 1,000 pageviews</b>, mostly from branded content
            it sold itself; Culture Alberta takes in about{' '}
            <b>{v.revenuePerThousand.ours !== null ? `C$${v.revenuePerThousand.ours.toFixed(0)}` : '—'}</b> through
            Mediavine. Per follower it is the same story: Daily Hive earned about{' '}
            <b>C${v.revenuePerFollower.dailyHive.toFixed(2)} a year per follower</b>, Culture Alberta about{' '}
            <b>{v.revenuePerFollower.ours !== null ? `C$${v.revenuePerFollower.ours.toFixed(2)}` : '—'}</b> across its{' '}
            {v.followers.toLocaleString('en-CA')}. The last column scales for that.
          </p>
          <p>
            Read them as the ceiling a strategic buyer might reach, not the price a website marketplace would
            get you today. The gap between the two is mostly direct sales: every sponsorship and retainer you sell
            moves Culture Alberta&apos;s earnings per reader toward Daily Hive&apos;s, and its price with it.
          </p>
          <p className="cnote">
            Culture Alberta figures used: {input.pageviews.toLocaleString('en-CA')} pageviews in{' '}
            {input.pageviewsMonth ? monthLabel(input.pageviewsMonth) : 'the last full month'}; revenue run-rate from
            the last three full months. Daily Hive&apos;s multiple is on its revenue, so it is applied to yours.
          </p>
        </div>
      </section>

      <section className="card" aria-labelledby="dh-h" style={{ marginBottom: 12 }}>
        <h2 id="dh-h">
          How Daily Hive made C$7.5 million a year <small>and what it means for Culture Alberta</small>
        </h2>
        <ul className="ins">
          <li>
            <span className="chip ok">1</span>
            <b>It sold branded content itself</b>
            <span>
              Hive Labs, its in-house studio, had writers and creators separate from the newsroom. They made sponsored
              articles, videos and social posts for brands, and its own sales team sold them. ZoomerMedia&apos;s
              announcement singled out the studio and its established sales team.
            </span>
          </li>
          <li>
            <span className="chip ok">2</span>
            <b>Every campaign came with social reach</b>
            <span>
              3.2 million followers on Instagram, TikTok, Facebook and X, so a brand bought the article and
              the posts together. Its revenue works out to about C${v.revenuePerFollower.dailyHive.toFixed(2)} a year per follower.
              Culture Alberta&apos;s works out to about{' '}
              {v.revenuePerFollower.ours !== null ? `C$${v.revenuePerFollower.ours.toFixed(2)}` : '—'} across its{' '}
              {v.followers.toLocaleString('en-CA')} followers, and nearly all of it is ads on the site, not paid posts.
            </span>
          </li>
          <li>
            <span className="chip ok">3</span>
            <b>Scale that national advertisers buy</b>
            <span>
              24 million pageviews a month across Vancouver, Calgary, Edmonton, Toronto and Montreal, built over 14
              years, is big enough for agencies and national brands. Display ads ran on top. All in, it earned about
              C${v.revenuePerThousand.dailyHive.toFixed(0)} per 1,000 pageviews; Culture Alberta earns about{' '}
              {v.revenuePerThousand.ours !== null ? `C$${v.revenuePerThousand.ours.toFixed(0)}` : '—'}.
            </span>
          </li>
          <li>
            <span className="chip warn">!</span>
            <b>But it barely made a profit</b>
            <span>
              About C$7.5M came in and C$7.3M went out on a newsroom, a studio and a sales team. ZoomerMedia paid for
              the revenue, the audience and the team, not the profit. That is why a strategic buyer can pay so far
              above a marketplace price, and why the marketplace price is the realistic one for a site run by one
              person.
            </span>
          </li>
        </ul>
        <p className="explain-plain" style={{ marginTop: 10 }}>
          Your packages (Spotlight, Feature Story, Always-On, Category Sponsor) are the Hive Labs model at Alberta
          scale. Each sponsored feature or post you sell moves your earnings per reader and per follower toward Daily
          Hive&apos;s, and the price moves with them. Narcity, the other big Canadian city brand, works the same way:
          most of its referral traffic comes from its social channels, and its in-house studio makes the branded
          content.
        </p>
        <p className="cnote">
          Sources:{' '}
          <a href="https://www.newsfilecorp.com/release/136910/ZoomerMedia-Announces-Acquisition-of-Daily-Hive" target="_blank" rel="noopener noreferrer">
            ZoomerMedia&apos;s release
          </a>{' '}
          (revenue, costs, pageviews, followers, Hive Labs),{' '}
          <a href="https://dailyhive.com/vancouver/daily-hive-acquisition-zoomer" target="_blank" rel="noopener noreferrer">
            Daily Hive on the sale
          </a>{' '}
          (founded 2008),{' '}
          <a href="https://dailyhive.com/page/content-funding" target="_blank" rel="noopener noreferrer">
            Daily Hive on branded content
          </a>
          ,{' '}
          <a href="https://en.wikipedia.org/wiki/Narcity_Media" target="_blank" rel="noopener noreferrer">
            Narcity Media
          </a>
          .
        </p>
      </section>

      <section className="card" aria-labelledby="s-h">
        <h2 id="s-h">How sure is this</h2>
        <div className="prose spaced">
          <p>
            This is a market estimate, not an appraisal or an offer. The multiples come from what content sites
            actually sold for on the main marketplaces in 2025–26; the per-subscriber figure is the low end of
            what newsletter lists fetch, because this is a free local list; the social accounts are priced on the
            sponsored posts they could carry, which a buyer pays for only in part until you are selling them. Bare
            Instagram pages sell for far less on their own, and the platforms do not allow selling accounts apart from
            a business, so that value holds only when they go with the site. A real buyer will also look at
            things no spreadsheet holds: how the site ranks after Google&apos;s next update, whether the Reddit
            traffic repeats, and how much of the work is you.
          </p>
          <p>
            The strongest lever is time. Most of what is being taken off today is the short history, and it
            disappears on its own if the numbers hold. If you were serious about selling, the moment to ask a
            broker for a formal valuation is when you have twelve full months.
          </p>
          <ul>
            {SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>{' '}
                — {s.note}
              </li>
            ))}
          </ul>
          <p className="cnote">
            The numbers feeding this: <Link href="/admin/revenue">Revenue</Link> (ads, partnerships, expenses),{' '}
            <Link href="/admin/scorecard">Scorecard</Link> (subscribers, members, articles a week) and{' '}
            <Link href="/admin/content">Content</Link> (where readers come from).
          </p>
        </div>
      </section>
    </AdminShell>
  );
}

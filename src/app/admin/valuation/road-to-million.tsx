'use client';

// Road to a million: how far the business is from a US$1M (or C$1M) sale, what
// a buyer would need to see, checkpoints on the way, and a planner that turns
// levers into a monthly profit and a price. Nothing here is saved: it is a
// calculator over the same figures as the rest of the page.

import { useMemo, useState } from 'react';

import { MULTIPLE, PER_POST, type Valuation, type ValuationInput } from '@/lib/valuation';
import {
  growthNeeded,
  NEWSLETTER_CPM,
  netNeeded,
  planResult,
  PRICES_CAD,
  revenueNeeded,
  REVENUE_MULTIPLE,
  RUNGS,
  todayPlan,
  type Plan,
  type PlanLine,
} from '@/lib/valuation-plan';
import { group } from '../_components/format';

const usd = (v: number) => `${v < -0.5 ? '−' : ''}US$${group(Math.abs(Math.round(v)))}`;
// "US$1M", "US$1.27M", "US$457k".
const short = (v: number) =>
  v >= 1_000_000 ? `US$${Number((v / 1_000_000).toFixed(2))}M` : v >= 1000 ? `US$${Math.round(v / 1000)}k` : usd(v);
const pctOf = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0);

interface Lever {
  key: keyof Plan;
  label: string;
  hint?: string;
  step: number;
  line?: PlanLine['key'];
}

export function RoadToMillion({ v, input }: { v: Valuation; input: ValuationInput }) {
  const fx = v.fxUsdCad;
  const [currency, setCurrency] = useState<'USD' | 'CAD'>('USD');
  const today = useMemo(() => todayPlan(input), [input]);
  const [plan, setPlan] = useState<Plan>(RUNGS[RUNGS.length - 1].plan);

  const igAccounts = Math.max(1, input.social.filter((s) => s.platform === 'instagram').length);
  const targetUsd = currency === 'USD' ? 1_000_000 : 1_000_000 / fx;
  const targetLabel = currency === 'USD' ? 'US$1 million' : 'C$1 million';
  const needNet = netNeeded(targetUsd);
  const needRevenue = revenueNeeded(targetUsd);
  const three = v.bases.find((b) => b.key === 'three');
  const nowNet = three?.net ?? 0;
  // Revenue run-rate from the last three complete months, the same basis as the strategic range.
  const recent = input.months.filter((m) => !m.partial && !m.future).sort((a, b) => a.month.localeCompare(b.month)).slice(-3);
  const nowRevenue = recent.length ? (recent.reduce((a, m) => a + m.total, 0) / recent.length) * 12 : 0;
  const result = planResult(plan, fx, igAccounts);
  const timelines = [3, 5, 7].map((years) => ({ years, g: growthNeeded(nowNet, needNet, years) }));

  const google = input.sources.find((s) => /google/i.test(s.source))?.rpm;
  const reddit = input.sources.find((s) => /reddit/i.test(s.source))?.rpm;
  const perPost = (plan.instagram / igAccounts) * PER_POST.mid;
  const levers: Lever[] = [
    { key: 'pageviews', label: 'Pageviews a month', step: 10_000, line: 'ads', hint: 'The Content page lists the searches within reach and the titles to fix.' },
    {
      key: 'rpm',
      label: 'Ad earnings per 1,000 pageviews (US$)',
      step: 0.5,
      hint:
        google && reddit
          ? `Google readers earn about US$${google.toFixed(2)}, Reddit readers US$${reddit.toFixed(2)} (Mediavine). More search traffic raises this.`
          : 'Search readers earn more per pageview than social ones.',
    },
    { key: 'alwaysOn', label: `Always-On partners (C$${group(PRICES_CAD.alwaysOn)} a month)`, step: 1, line: 'alwaysOn' },
    { key: 'category', label: `Category Sponsors (C$${group(PRICES_CAD.category)} a month)`, step: 1, line: 'category' },
    { key: 'features', label: `Feature Stories a month (C$${group(PRICES_CAD.feature)} each)`, step: 1, line: 'features' },
    { key: 'subscribers', label: 'Newsletter subscribers', step: 500 },
    { key: 'sends', label: `Sponsored newsletter sends a month`, step: 1, line: 'sends', hint: `US$${NEWSLETTER_CPM} per 1,000 subscribers a send.` },
    { key: 'instagram', label: 'Instagram followers, all accounts', step: 1_000 },
    { key: 'posts', label: 'Sponsored Instagram posts a month', step: 1, line: 'posts', hint: `About ${usd(perPost)} a post at ${PER_POST.mid * 100}¢ a follower.` },
    { key: 'costs', label: 'Costs a month (US$: writers, sales help, tools)', step: 100 },
  ];
  const lineOf = (k: PlanLine['key']) => result.lines.find((l) => l.key === k)?.monthly ?? 0;
  const set = (key: keyof Plan, raw: string) => {
    const n = Number(raw);
    setPlan((p) => ({ ...p, [key]: Number.isFinite(n) && n >= 0 ? n : 0 }));
  };
  const reached = result.marketplace >= targetUsd;

  return (
    <section className="card road" aria-labelledby="r-h" style={{ marginBottom: 12 }}>
      <div className="road-head">
        <h2 id="r-h">
          Road to {targetLabel} <small>what a buyer would need to see, and how to get there</small>
        </h2>
        <div className="seg" role="group" aria-label="Target">
          <button type="button" aria-pressed={currency === 'USD'} onClick={() => setCurrency('USD')}>
            US$1M
          </button>
          <button type="button" aria-pressed={currency === 'CAD'} onClick={() => setCurrency('CAD')}>
            C$1M
          </button>
        </div>
      </div>

      <div className="road-progress" role="img" aria-label={`${Math.round(pctOf(v.total.mid, targetUsd) * 10) / 10}% of ${targetLabel}`}>
        <span style={{ width: `${Math.max(0.8, pctOf(v.total.mid, targetUsd))}%` }} />
      </div>
      <p className="road-now">
        <b>{usd(v.total.mid)}</b> today is {pctOf(v.total.mid, targetUsd).toFixed(1)}% of the way to {targetLabel}
        {currency === 'CAD' ? ` (${usd(targetUsd)})` : ` (C$${group(Math.round(targetUsd * fx))})`}.
      </p>

      <div className="road-routes">
        <div>
          <span className="l">Selling to a website buyer</span>
          <b>{usd(needNet)} a month profit</b>
          <span>
            At the full {MULTIPLE.mid}× a buyer pays once the discounts are gone. The last three months averaged {usd(nowNet)}
            {nowNet > 0 ? ` — about ${Math.round(needNet / nowNet)}× that` : ''}.
          </span>
        </div>
        <div>
          <span className="l">Selling to a media company</span>
          <b>{short(needRevenue)} a year in revenue</b>
          <span>
            On Daily Hive&apos;s terms ({usd(needRevenue / 12)} a month). Today&apos;s run-rate is about {short(nowRevenue)}
            {nowRevenue > 0 ? ` — about ${Math.round(needRevenue / nowRevenue)}× that` : ''}. A buyer like ZoomerMedia would
            want most of it from direct sales.
          </span>
        </div>
      </div>

      <p className="explain-plain">
        {timelines.map((t, i) =>
          t.g ? (
            <span key={t.years}>
              {i === 0 ? 'To get there in ' : ' In '}
              <b>{t.years} years</b>
              {i === 0 ? ', profit has to grow about ' : ', '}
              <b>{t.g.yearly.toFixed(1)}× a year</b> ({(t.g.monthly * 100).toFixed(1)}% a month).
            </span>
          ) : null,
        )}{' '}
        Joining Mediavine in May was a one-time jump, so the growth from here has to come from more readers and from
        selling directly. That is Daily Hive&apos;s model: its studio and sales team, not its ads, are what made it
        worth C$16.4M.
      </p>

      <h3 className="sub-h">Checkpoints on the way</h3>
      <ol className="rungs">
        {RUNGS.map((r) => (
          <li key={r.target} className={v.total.mid >= r.target ? 'got' : undefined}>
            <div className="rung-price">
              <b>{short(r.target)}</b>
              <span>C${group(Math.round(r.target * fx))}</span>
            </div>
            <div className="rung-need">
              <b>{usd(netNeeded(r.target))}</b>
              <span>profit a month</span>
            </div>
            <p>{r.mix}</p>
            <button type="button" className="btn ghost" onClick={() => setPlan(r.plan)}>
              Try it ›
            </button>
          </li>
        ))}
      </ol>

      <h3 className="sub-h" style={{ marginTop: 14 }}>
        Plan it
      </h3>
      <p className="cnote" style={{ marginTop: 0 }}>
        Change any number to see the price move. Today&apos;s figures are shown beside each one. This assumes the
        discounts are gone (a full year of history, Reddit under a third of traffic, and a team doing the work) and
        values the list and the followers through what they earn, so they have no separate line.
      </p>
      <div className="planner">
        <div className="prow phead" aria-hidden="true">
          <span>Lever</span>
          <span>Today</span>
          <span>Your plan</span>
          <span>A month</span>
        </div>
        {levers.map((l) => (
          <div className="prow" key={l.key}>
            <label htmlFor={`plan-${l.key}`}>
              {l.label}
              {l.hint && <span className="sub-line">{l.hint}</span>}
            </label>
            <span className="today">{l.key === 'rpm' ? (today.rpm ? today.rpm.toFixed(2) : '—') : group(today[l.key])}</span>
            <input
              id={`plan-${l.key}`}
              type="number"
              inputMode="decimal"
              min={0}
              step={l.step}
              value={plan[l.key]}
              onChange={(e) => set(l.key, e.target.value)}
            />
            <span className="amt">{l.line ? usd(lineOf(l.line)) : l.key === 'costs' ? usd(-plan.costs) : ''}</span>
          </div>
        ))}
        <div className="prow ptotal">
          <span>Revenue a month</span>
          <span />
          <span />
          <span className="amt">{usd(result.revenue)}</span>
        </div>
        <div className="prow ptotal">
          <span>Profit a month</span>
          <span />
          <span />
          <span className={`amt ${result.net >= 0 ? 'ok' : 'crit'}`}>{usd(result.net)}</span>
        </div>
      </div>

      <div className="road-result">
        <div>
          <span className="l">A website buyer would pay</span>
          <b>{usd(result.marketplace)}</b>
          <span>profit × {MULTIPLE.mid}, plus the name</span>
        </div>
        <div>
          <span className="l">A media company might pay</span>
          <b>{usd(result.strategic)}</b>
          <span>a year&apos;s revenue × {REVENUE_MULTIPLE.toFixed(1)}, Daily Hive&apos;s terms</span>
        </div>
        <div className={reached ? 'hit' : undefined}>
          <span className="l">Against {targetLabel}</span>
          <b>{reached ? 'Reached' : `${usd(targetUsd - result.marketplace)} short`}</b>
          <span>
            {reached ? 'on the website-buyer price' : `${pctOf(result.marketplace, targetUsd).toFixed(0)}% of the way, at the website-buyer price`}
          </span>
        </div>
      </div>
      <div className="road-buttons">
        <button type="button" className="btn ghost" onClick={() => setPlan(today)}>
          Start from today
        </button>
        <button type="button" className="btn" onClick={() => setPlan(RUNGS[RUNGS.length - 1].plan)}>
          The {short(RUNGS[RUNGS.length - 1].target)} plan
        </button>
      </div>
    </section>
  );
}

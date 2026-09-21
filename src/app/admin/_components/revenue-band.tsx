'use client';

// Ads are only part of the money. This band puts every source together — and
// what it cost to earn — in USD or CAD, this year against the same stretch of
// last year. It follows the page's currency switch.

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { Scorecard } from '@/lib/admin-types';
import { SOURCE_COLOR, growth, summarise, type Currency, type Expense, type Invoice } from '@/lib/revenue';
import { cash } from './format';
import { RevenueColumns } from './revenue-chart';
import { RevenueDetail, type RevenueTopic } from './revenue-detail';

export function RevenueBand({
  sc,
  invoices,
  expenses,
  currency,
  today,
  linkToRevenue = true,
}: {
  sc: Scorecard | null;
  invoices: Invoice[];
  expenses: Expense[];
  currency: Currency;
  today: string;
  /** Off on the Revenue page itself. */
  linkToRevenue?: boolean;
}) {
  const s = useMemo(
    () => summarise(invoices, sc, today, { currency, expenses }),
    [invoices, sc, today, currency, expenses],
  );
  const [topic, setTopic] = useState<RevenueTopic | null>(null);
  const margin = s.ytd.total > 0 ? Math.round((s.ytdKept / s.ytd.total) * 100) : null;
  const g = growth(s.ytd.total, s.ytdLastYear.total);
  const adsShare = s.ytd.total > 0 ? (s.ytd.ads / s.ytd.total) * 100 : 0;
  const lastYear = s.thisYear - 1;

  return (
    <section className="card band" aria-labelledby="rev-h">
      <div className="band-figure">
        <h2 id="rev-h">
          All revenue · {s.thisYear} so far <small>in {currency}</small>
        </h2>
        <p className="hero">{cash(s.ytd.total, currency)}</p>
        <p className="foot">
          {g ? (
            <>
              <span className={`delta ${g.up ? 'up' : 'down'}`}>{g.text}</span> vs{' '}
              {cash(s.ytdLastYear.total, currency)} by this date in {lastYear}
            </>
          ) : (
            `nothing by this date in ${lastYear}`
          )}
        </p>
        <div
          className="split"
          role="img"
          aria-label={`Partnerships ${Math.round(100 - adsShare)} percent, ads ${Math.round(adsShare)} percent`}
        >
          <i style={{ width: `${100 - adsShare}%`, background: SOURCE_COLOR.partnerships }} />
          <i style={{ width: `${adsShare}%`, background: SOURCE_COLOR.ads }} />
        </div>
        <ul className="srows">
          <li>
            <button type="button" className="rowbtn" onClick={() => setTopic('partnerships')}>
              Partnerships &amp; retainers
            </button>
            <b>{cash(s.ytd.partnerships, currency)}</b>
          </li>
          <li>
            <button type="button" className="rowbtn" onClick={() => setTopic('ads')}>
              Ads (Mediavine + AdSense)
            </button>
            <b>{cash(s.ytd.ads, currency)}</b>
          </li>
          {s.expensesSince && (
            <>
              <li>
                <button type="button" className="rowbtn" onClick={() => setTopic('expenses')}>
                  Expenses
                </button>
                <b className="soft">{cash(-s.ytdExpenses, currency)}</b>
              </li>
              <li>
                <span>
                  <button type="button" className="rowbtn strong" onClick={() => setTopic('kept')}>
                    Kept after expenses
                  </button>
                  {margin !== null && <span className="sub-line">{margin}% of what came in</span>}
                </span>
                <b className={s.ytdKept >= 0 ? 'ok' : 'crit'}>{cash(s.ytdKept, currency)}</b>
              </li>
            </>
          )}
        </ul>
        <p className="cnote" style={{ margin: '8px 0 0' }}>Click any line to see what is behind it.</p>
        {topic && (
          <RevenueDetail topic={topic} s={s} invoices={invoices} currency={currency} onClose={() => setTopic(null)} />
        )}
        {linkToRevenue && (
          <Link className="btn ghost" href="/admin/revenue">
            Open revenue
          </Link>
        )}
      </div>
      <div>
        <RevenueColumns
          ariaLabel="Revenue by year, split into partnerships and ads, with expenses marked"
          currency={currency}
          columns={s.years.map((y) => ({
            label: String(y.year),
            ads: y.ads,
            partnerships: y.partnerships,
            expenses: y.expenses,
            partial: y.year === s.thisYear,
          }))}
        />
      </div>
    </section>
  );
}

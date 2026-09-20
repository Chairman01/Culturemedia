'use client';

// Ads are only part of the money. This band opens the Scorecard with every
// source together, in CAD, this year against the same stretch of last year.

import Link from 'next/link';
import { useMemo } from 'react';

import type { Scorecard } from '@/lib/admin-types';
import { SOURCE_COLOR, growth, summarise, type Invoice } from '@/lib/revenue';
import { money } from './format';
import { RevenueColumns } from './revenue-chart';

export function RevenueBand({
  sc,
  invoices,
  today,
}: {
  sc: Scorecard | null;
  invoices: Invoice[];
  today: string;
}) {
  const s = useMemo(() => summarise(invoices, sc, today), [invoices, sc, today]);
  const g = growth(s.ytd.total, s.ytdLastYear.total);
  const adsShare = s.ytd.total > 0 ? (s.ytd.ads / s.ytd.total) * 100 : 0;
  const lastYear = s.thisYear - 1;

  return (
    <section className="card band" aria-labelledby="rev-h">
      <div className="band-figure">
        <h2 id="rev-h">All revenue · {s.thisYear} so far</h2>
        <p className="hero">{money(s.ytd.total)}</p>
        <p className="foot">
          {g ? (
            <>
              <span className={`delta ${g.up ? 'up' : 'down'}`}>{g.text}</span> vs{' '}
              {money(s.ytdLastYear.total)} by this date in {lastYear}
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
            <span>Partnerships &amp; retainers</span>
            <b>{money(s.ytd.partnerships)}</b>
          </li>
          <li>
            <span>Ads in CAD (Mediavine + AdSense)</span>
            <b>{money(s.ytd.ads)}</b>
          </li>
        </ul>
        <Link className="btn ghost" href="/admin/revenue">
          Open revenue
        </Link>
      </div>
      <div>
        <RevenueColumns
          ariaLabel="Revenue by year, split into partnerships and ads"
          columns={s.years.map((y) => ({
            label: String(y.year),
            ads: y.ads,
            partnerships: y.partnerships,
            partial: y.year === s.thisYear,
          }))}
        />
      </div>
    </section>
  );
}

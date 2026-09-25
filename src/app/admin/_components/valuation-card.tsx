'use client';

// One line on the Scorecard: what the business would sell for today, with the
// Valuation page a click away for the working.

import Link from 'next/link';

import type { Valuation } from '@/lib/valuation';
import { group } from './format';

const usd = (v: number) => `US$${group(Math.round(v))}`;

export function ValuationCard({ v }: { v: Valuation }) {
  const pieces = v.pieces.map((p) => `${p.title.split(' · ')[0].toLowerCase()} ${usd(p.value.mid)}`).join(' · ');
  return (
    <Link className="card vcard" href="/admin/valuation" title="How this is worked out">
      <span className="l">If you sold today</span>
      <b>{usd(v.total.mid)}</b>
      <span className="sub">
        {usd(v.total.low)} – {usd(v.total.high)} · C${group(Math.round(v.total.mid * v.fxUsdCad))} · {pieces}
      </span>
      <span className="go">How it&apos;s worked out ›</span>
    </Link>
  );
}

'use client';

// Revenue by source, as stacked columns — by year, or month by month with last
// year's total as a grey companion bar.
//
// Two series only, and colour follows the source everywhere: blue is ads,
// orange is partnerships (validated as a colour-blind-safe pair). Partnerships
// sit on the baseline because that is the line the business is trying to grow,
// so its year-over-year change reads from a common zero. Identity never rests
// on colour alone: there is a legend, a hover read-out and a table view.

import { useState } from 'react';

import { SOURCE_COLOR, SOURCE_LABEL } from '@/lib/revenue';
import { money } from './format';

export interface RevenueColumn {
  label: string;
  ads: number;
  partnerships: number;
  /** Last year's total for the same slot. */
  ghost?: number;
  /** Still in progress: drawn lighter. */
  partial?: boolean;
  /** Has not happened yet: left empty. */
  future?: boolean;
}

const MONO = 'var(--font-admin-mono), ui-monospace, monospace';
const GHOST = '#c4c4cc';

function niceMax(v: number): number {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const short = (v: number) =>
  v >= 10000 ? `$${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : money(v);

/** A column whose top corners are rounded and whose bottom sits square on whatever is below. */
function topRounded(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

export function RevenueColumns({
  columns,
  ghostName,
  ariaLabel,
}: {
  columns: RevenueColumn[];
  /** Set to show last year's companion bars, e.g. "2025". */
  ghostName?: string;
  ariaLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  // Same 520-wide canvas as the scorecard charts, so type lands at the same size.
  const W = 520;
  const H = 250;
  const L = 48;
  const R = 12;
  const T = 28;
  const B = 30;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const showGhost = Boolean(ghostName);

  const peak = Math.max(1, ...columns.map((c) => Math.max(c.ads + c.partnerships, c.ghost ?? 0)));
  const max = niceMax(peak * 1.12);
  const y = (v: number) => T + plotH * (1 - v / max);
  const band = plotW / Math.max(1, columns.length);
  const barW = showGhost ? Math.min(22, band * 0.4) : Math.min(56, band * 0.56);
  const ghostW = showGhost ? Math.min(12, band * 0.22) : 0;
  const GAP = 2;

  const active = hover !== null ? columns[hover] : null;

  return (
    <div className="rev-chart">
      <ul className="legend" aria-hidden="true">
        <li>
          <i style={{ background: SOURCE_COLOR.partnerships }} />
          {SOURCE_LABEL.partnerships}
        </li>
        <li>
          <i style={{ background: SOURCE_COLOR.ads }} />
          {SOURCE_LABEL.ads}
        </li>
        {showGhost && (
          <li>
            <i style={{ background: GHOST }} />
            {ghostName} total
          </li>
        )}
      </ul>

      <div className="plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
          {[0, 1, 2, 3, 4].map((k) => {
            const v = (max * k) / 4;
            return (
              <g key={k}>
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth={1} />
                <text x={L - 8} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--muted)" fontFamily={MONO}>
                  {short(v)}
                </text>
              </g>
            );
          })}

          {columns.map((c, i) => {
            const cx = L + band * i + band / 2;
            const total = c.ads + c.partnerships;
            const x0 = showGhost ? cx - (barW + ghostW + GAP) / 2 + ghostW + GAP : cx - barW / 2;
            const opacity = c.partial ? 0.55 : 1;
            const base = y(0);
            const pH = (c.partnerships / max) * plotH;
            const aH = (c.ads / max) * plotH;
            // A 2px surface gap separates the two fills; it only exists when both do.
            const gap = pH > 0 && aH > 0 ? GAP : 0;
            const topY = base - pH - gap - aH;

            return (
              <g key={c.label}>
                {showGhost && (c.ghost ?? 0) > 0 && (
                  <path
                    d={topRounded(x0 - GAP - ghostW, y(c.ghost!), ghostW, base - y(c.ghost!), 3)}
                    fill={GHOST}
                  />
                )}
                {pH > 0 && (
                  <path
                    d={aH > 0 ? `M${x0},${base - pH} h${barW} v${pH} h${-barW} Z` : topRounded(x0, base - pH, barW, pH, 4)}
                    fill={SOURCE_COLOR.partnerships}
                    fillOpacity={opacity}
                  />
                )}
                {aH > 0 && (
                  <path d={topRounded(x0, topY, barW, aH, 4)} fill={SOURCE_COLOR.ads} fillOpacity={opacity} />
                )}
                {total > 0 && (
                  <text
                    x={x0 + barW / 2}
                    y={topY - 6}
                    textAnchor="middle"
                    fontSize={columns.length > 8 ? 8.5 : 11}
                    fontWeight={700}
                    fill={c.partial ? 'var(--muted)' : 'var(--ink)'}
                    fontFamily={MONO}
                  >
                    {short(total)}
                  </text>
                )}
                <text x={cx} y={H - 9} textAnchor="middle" fontSize={10.5} fill="var(--muted)" fontFamily={MONO}>
                  {c.label}
                </text>
                {/* Hit target: the whole band, far bigger than the marks. */}
                <rect
                  x={L + band * i}
                  y={T}
                  width={band}
                  height={plotH + B}
                  fill={hover === i ? 'rgb(0 0 0 / 0.035)' : 'transparent'}
                  tabIndex={c.future ? -1 : 0}
                  aria-label={`${c.label}: ${money(total)}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>

        {active && hover !== null && !active.future && (
          <div
            className="tip"
            style={{
              left: `${((L + band * hover + band / 2) / W) * 100}%`,
              transform: `translateX(${hover > columns.length / 2 ? '-100%' : '0'}) translateX(${hover > columns.length / 2 ? '-10px' : '10px'})`,
            }}
            role="status"
          >
            <b>
              {active.label}
              {active.partial ? ' · so far' : ''}
            </b>
            <span>
              <i style={{ background: SOURCE_COLOR.partnerships }} /> Partnerships
              <em>{money(active.partnerships)}</em>
            </span>
            <span>
              <i style={{ background: SOURCE_COLOR.ads }} /> Ads
              <em>{money(active.ads)}</em>
            </span>
            <span className="sum">
              Total<em>{money(active.ads + active.partnerships)}</em>
            </span>
            {showGhost && (
              <span>
                <i style={{ background: GHOST }} /> {ghostName}
                <em>{money(active.ghost ?? 0)}</em>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

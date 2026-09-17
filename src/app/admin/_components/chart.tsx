// Bar and line charts, ported from the Claude scorecard page.
//
// Deliberately hand-drawn SVG rather than a chart library: every bar and point
// carries its own value label, the target is a dashed rule with its own legend,
// and each mark has a <title> tooltip. Only a period still in progress is drawn
// lighter — an estimated value is a normal bar and says so in its tooltip.

import type { Currency, Unit } from './format';
import { fmt } from './format';

export interface ChartItem {
  label: string;
  /** Second line under the tick, e.g. a year. */
  sub?: string;
  value: number | null;
  /** The week or month still in progress — drawn lighter. */
  partial?: boolean;
  /** Includes estimated days — normal weight, caveat in the tooltip. */
  est?: boolean;
  title?: string;
}

export type ChartKind = 'bar' | 'line';

interface ChartProps {
  kind: ChartKind;
  items: ChartItem[];
  unit: Unit;
  target?: number | null;
  currency?: Currency;
  empty?: string;
}

const MONO = 'var(--font-admin-mono), ui-monospace, monospace';

function axisMax(v: number): number {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function tooltip(it: ChartItem, unit: Unit, currency: Currency): string {
  const head = `${it.title || it.label}: `;
  if (it.value === null) return `${it.title || it.label}: no data`;
  const caveat = it.partial
    ? ' (still coming in)'
    : it.est
      ? ' (includes estimated days, within about 1%)'
      : '';
  return head + fmt(it.value, unit, false, currency) + caveat;
}

function ValueLabel({
  x,
  y,
  text,
  muted,
  size,
}: {
  x: number;
  y: number;
  text: string;
  muted?: boolean;
  size: number;
}) {
  return (
    <text
      x={x.toFixed(1)}
      y={y.toFixed(1)}
      textAnchor="middle"
      fontSize={size}
      fontWeight={700}
      fill={muted ? 'var(--muted)' : 'var(--ink)'}
      stroke="var(--surface)"
      strokeWidth={3}
      paintOrder="stroke"
      fontFamily={MONO}
    >
      {text}
    </text>
  );
}

function XLabel({ cx, H, it }: { cx: number; H: number; it: ChartItem }) {
  const common = {
    textAnchor: 'middle' as const,
    fontSize: 10,
    fill: 'var(--muted)',
    fontFamily: MONO,
  };
  if (!it.sub) {
    return (
      <text x={cx.toFixed(1)} y={H - 8} {...common}>
        {it.label}
      </text>
    );
  }
  return (
    <>
      <text x={cx.toFixed(1)} y={H - 20} {...common}>
        {it.label}
      </text>
      <text x={cx.toFixed(1)} y={H - 7} {...common}>
        {it.sub}
      </text>
    </>
  );
}

function Gridlines({
  max,
  y,
  W,
  L,
  R,
  unit,
  currency,
}: {
  max: number;
  y: (v: number) => number;
  W: number;
  L: number;
  R: number;
  unit: Unit;
  currency: Currency;
}) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((k) => {
        const v = (max * k) / 4;
        const yy = y(v);
        return (
          <g key={k}>
            <line x1={L} x2={W - R} y1={yy.toFixed(1)} y2={yy.toFixed(1)} stroke="var(--rule)" strokeWidth={1} />
            <text
              x={L - 6}
              y={(yy + 3.5).toFixed(1)}
              textAnchor="end"
              fontSize={10}
              fill="var(--muted)"
              fontFamily={MONO}
            >
              {fmt(v, unit, true, currency)}
            </text>
          </g>
        );
      })}
    </>
  );
}

function TargetLine({
  ty,
  W,
  L,
  R,
  T,
  target,
  unit,
  currency,
}: {
  ty: number;
  W: number;
  L: number;
  R: number;
  T: number;
  target: number;
  unit: Unit;
  currency: Currency;
}) {
  return (
    <>
      <line
        x1={L}
        x2={W - R}
        y1={ty.toFixed(1)}
        y2={ty.toFixed(1)}
        stroke="var(--ink-2)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <line
        x1={L + 4}
        x2={L + 20}
        y1={(T - 11).toFixed(1)}
        y2={(T - 11).toFixed(1)}
        stroke="var(--ink-2)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <text
        x={L + 25}
        y={(T - 8).toFixed(1)}
        textAnchor="start"
        fontSize={10}
        fill="var(--ink-2)"
        fontFamily="inherit"
      >
        target {fmt(target, unit, true, currency)}
      </text>
    </>
  );
}

export function Chart({
  kind,
  items,
  unit,
  target = null,
  currency = 'USD',
  empty = 'No data loaded for this metric yet',
}: ChartProps) {
  const values = items.map((i) => i.value).filter((v): v is number => v !== null);
  if (!values.length) return <div className="empty">{empty}</div>;
  return kind === 'line' ? (
    <LineChart items={items} unit={unit} target={target} currency={currency} values={values} />
  ) : (
    <BarChart items={items} unit={unit} target={target} currency={currency} values={values} />
  );
}

interface InnerProps {
  items: ChartItem[];
  unit: Unit;
  target: number | null;
  currency: Currency;
  values: number[];
}

function BarChart({ items, unit, target, currency, values }: InnerProps) {
  const W = 520;
  const L = 44;
  const R = 10;
  const T = 22;
  const B = items.some((i) => i.sub) ? 36 : 24;
  const H = 186 + B;

  const max = axisMax(Math.max(...values, target || 0) * 1.12);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const band = (W - L - R) / items.length;
  const bw = Math.max(6, band * 0.62);
  const every = band >= 40 ? 1 : Math.ceil(items.length / 6);
  const labelSize = band < 44 ? 9 : 10.5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img">
      <Gridlines max={max} y={y} W={W} L={L} R={R} unit={unit} currency={currency} />

      {items.map((it, i) => {
        const cx = L + band * i + band / 2;
        if (it.value === null) {
          // A dotted stub, not a zero: that period has no data loaded.
          return (
            <g key={i}>
              <title>{tooltip(it, unit, currency)}</title>
              <line
                x1={(cx - bw / 2).toFixed(1)}
                x2={(cx + bw / 2).toFixed(1)}
                y1={(H - B - 1).toFixed(1)}
                y2={(H - B - 1).toFixed(1)}
                stroke="var(--rule-hard)"
                strokeWidth={2}
                strokeDasharray="2 2"
              />
            </g>
          );
        }
        const h = Math.max(1.5, H - B - y(Math.max(0, it.value)));
        return (
          <g key={i}>
            <title>{tooltip(it, unit, currency)}</title>
            <rect
              x={(cx - bw / 2).toFixed(1)}
              y={(H - B - h).toFixed(1)}
              width={bw.toFixed(1)}
              height={h.toFixed(1)}
              rx={3}
              fill="var(--s2)"
              fillOpacity={it.partial ? 0.45 : 1}
            />
          </g>
        );
      })}

      {target !== null && target !== undefined && target <= max && (
        <TargetLine ty={y(target)} W={W} L={L} R={R} T={T} target={target} unit={unit} currency={currency} />
      )}

      {items.map((it, i) => {
        if (it.value === null) return null;
        const cx = L + band * i + band / 2;
        const h = Math.max(1.5, H - B - y(Math.max(0, it.value)));
        return (
          <ValueLabel
            key={i}
            x={cx}
            y={H - B - h - 5}
            text={fmt(it.value, unit, true, currency)}
            muted={it.partial}
            size={labelSize}
          />
        );
      })}

      {items.map((it, i) =>
        i % every === 0 || i === items.length - 1 ? (
          <XLabel key={i} cx={L + band * i + band / 2} H={H} it={it} />
        ) : null,
      )}
    </svg>
  );
}

function LineChart({ items, unit, target, currency, values }: InnerProps) {
  const W = 520;
  const L = 44;
  const R = 14;
  const T = 24;
  const B = items.some((i) => i.sub) ? 36 : 24;
  const H = 186 + B;
  const PAD = 26; // keeps the first and last value labels inside the plot

  const max = axisMax(Math.max(...values, target || 0) * 1.12);
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const x = (i: number) =>
    L +
    PAD +
    (items.length === 1
      ? (W - L - R - 2 * PAD) / 2
      : ((W - L - R - 2 * PAD) * i) / (items.length - 1));

  const points = items.map((it, i) => (it.value === null ? null : ([x(i), y(it.value)] as const)));
  const line = points
    .filter((p): p is readonly [number, number] => p !== null)
    .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(' ');
  const every = (W - L - R) / Math.max(1, items.length) >= 40 ? 1 : Math.ceil(items.length / 6);
  const labelSize = items.length > 8 ? 9 : 10.5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img">
      <Gridlines max={max} y={y} W={W} L={L} R={R} unit={unit} currency={currency} />

      {target !== null && target !== undefined && target <= max && (
        <TargetLine ty={y(target)} W={W} L={L} R={R} T={T} target={target} unit={unit} currency={currency} />
      )}

      <polyline
        fill="none"
        stroke="var(--s2)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={line}
      />

      {items.map((it, i) => {
        const p = points[i];
        if (!p) return null;
        return (
          <g key={i}>
            <title>{tooltip(it, unit, currency)}</title>
            <circle
              cx={p[0].toFixed(1)}
              cy={p[1].toFixed(1)}
              r={4}
              fill="var(--s2)"
              fillOpacity={it.partial ? 0.4 : 1}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </g>
        );
      })}

      {items.map((it, i) => {
        const p = points[i];
        if (!p) return null;
        return (
          <ValueLabel
            key={i}
            x={p[0]}
            y={p[1] - 10}
            text={fmt(it.value, unit, true, currency)}
            muted={it.partial}
            size={labelSize}
          />
        );
      })}

      {items.map((it, i) =>
        i % every === 0 || i === items.length - 1 ? (
          <XLabel key={i} cx={x(i)} H={H} it={it} />
        ) : null,
      )}
    </svg>
  );
}

/** The 8-week trace on a KPI tile. */
export function Sparkline({ values, w = 70, h = 26 }: { values: (number | null)[]; w?: number; h?: number }) {
  const pts = values
    .map((v, i) => [i, v] as const)
    .filter((p): p is readonly [number, number] => p[1] !== null);
  if (pts.length < 2) return null;

  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || 1;
  const n = values.length - 1 || 1;
  const xy = pts.map(([i, v]) => [2 + (i / n) * (w - 4), h - 3 - ((v - lo) / span) * (h - 6)] as const);
  const last = xy[xy.length - 1];

  return (
    <svg className="sp" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke="var(--s2)"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={xy.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
      />
      <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r={2.4} fill="var(--s2)" />
    </svg>
  );
}

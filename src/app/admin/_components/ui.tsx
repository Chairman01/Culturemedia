// Small presentational pieces shared by the admin pages.

import type { ReactNode } from 'react';

import type { OpsAction } from '@/lib/admin-types';
import { repeatLabel } from '@/lib/alerts';
import { day } from './format';
import type { StatusChip } from './format';

export function Chip({ s }: { s: StatusChip | null | undefined }) {
  if (!s) return null;
  return <span className={`chip ${s.k}`}>{s.l}</span>;
}

export function Tile({
  label,
  value,
  foot,
  spark,
  title,
  onOpen,
}: {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  spark?: ReactNode;
  title?: string;
  /** Makes the whole tile a button that opens what is behind the number. */
  onOpen?: () => void;
}) {
  const body = (
    <>
      <span className="l" title={onOpen ? undefined : title}>
        {label}
      </span>
      <span className="v">{value}</span>
      {spark ?? <span />}
      <span className="foot">{foot}</span>
    </>
  );
  if (!onOpen) return <div className="tile">{body}</div>;
  return (
    <button type="button" className="tile open" onClick={onOpen} title="See what is behind this number">
      {body}
    </button>
  );
}

export interface Option<T extends string> {
  k: T;
  label: string;
  title?: string;
}

/** Joined pair of buttons, e.g. USD/CAD or Bars/Line. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Option<T>[];
  value: T;
  onChange: (k: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.k}
          type="button"
          aria-pressed={value === o.k}
          title={o.title}
          onClick={() => onChange(o.k)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pill row for picking which metric a chart shows. */
export function Tabs<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Option<T>[];
  value: T;
  onChange: (k: T) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.k} type="button" aria-pressed={value === o.k} onClick={() => onChange(o.k)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Banner({ tone, children }: { tone?: 'warn' | 'crit' | ''; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="banner" data-tone={tone || ''} role="status" aria-live="polite">
      {children}
    </p>
  );
}

/** One priority or setup step, with its Mark done button. */
export function ActionRow({
  action,
  n,
  today,
  onDone,
  busy,
  disabled,
}: {
  action: OpsAction;
  n: number;
  today: string;
  onDone: (id: number) => void;
  /** This row's request is in flight. */
  busy?: boolean;
  /** Another row's request is in flight. */
  disabled?: boolean;
}) {
  const overdue = Boolean(action.due_on && action.due_on < today && action.status !== 'done');
  return (
    <li>
      <span className="n">{n}</span>
      <span className="t" title={action.detail}>
        {action.title}
      </span>
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => onDone(Number(action.id))}
        title={action.repeat_days ? 'Records it and brings the job back for its next round' : undefined}
      >
        {busy ? 'Saving…' : action.repeat_days === 7 ? 'Done for this week' : action.repeat_days ? 'Done for this round' : 'Mark done'}
      </button>
      <span className="m">
        <span className={`owner${action.owner === 'you' ? ' you' : ''}`}>{action.owner}</span>
        {action.due_on && (
          <span className={`due ${overdue ? 'over' : ''}`}>
            {overdue ? 'Overdue · ' : 'Due '}
            {day(action.due_on)}
          </span>
        )}
        {action.status === 'in_progress' && <span className="chip warn">In progress</span>}
        {repeatLabel(action) && <span className="chip none">{repeatLabel(action)}</span>}
        {action.repeat_days && action.last_done_on ? <span>last done {day(action.last_done_on)}</span> : null}
      </span>
    </li>
  );
}


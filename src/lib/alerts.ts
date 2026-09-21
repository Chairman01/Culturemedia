// Things that need the owner now, worked out from the data every time Today
// loads — nobody has to remember to write them down.
//
// The priorities list (ops_actions) is what someone decided matters. These are
// the things the books and the CRM prove are slipping: work that was paid for
// and never delivered, money nobody has chased, people nobody has called back.
// Pure functions, no server imports.

import type { OpsAction } from './admin-types';
import { goingCold, isFollowable, type LeadRow } from './crm';
import type { Invoice } from './revenue';

export interface Alert {
  id: string;
  /** crit = costing money or trust today; warn = slipping. */
  tone: 'crit' | 'warn';
  title: string;
  detail: string;
  href: string;
  cta: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const nice = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;
const dollars = (v: unknown) => `$${Math.round(Number(v) || 0).toLocaleString('en-CA')}`;

function daysSince(date: string, today: string): number {
  const at = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.round((at(today) - at(date)) / 86400000);
}
const ago = (days: number) =>
  days >= 60 ? `over ${Math.floor(days / 30)} months ago` : days >= 14 ? `${Math.floor(days / 7)} weeks ago` : `${days} days ago`;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Every Wednesday", "Every 14 days" — or '' for a one-off. */
export function repeatLabel(action: Pick<OpsAction, 'repeat_days' | 'due_on'>): string {
  const every = Number(action.repeat_days) || 0;
  if (!every) return '';
  if (every % 7 === 0 && action.due_on) {
    const d = action.due_on;
    const weekday = WEEKDAYS[new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))).getUTCDay()];
    return every === 7 ? `Every ${weekday}` : `Every ${every / 7} weeks, ${weekday}`;
  }
  return every === 1 ? 'Every day' : `Every ${every} days`;
}

/** How long before its day a repeating job appears on Today. */
const SHOW_AHEAD_DAYS = 1;

/**
 * Priorities the owner has to do (not Claude's), most important first. With
 * `today`, a repeating job done for this round stays off the list until the day
 * before it is due again — otherwise next Wednesday's job would sit at the top
 * of Today all week, already done.
 */
export function ownPriorities(actions: OpsAction[], today?: string): OpsAction[] {
  return actions
    .filter((a) => (a.status === 'todo' || a.status === 'in_progress') && /you/i.test(a.owner))
    .filter((a) => !today || !a.repeat_days || !a.due_on || daysSince(a.due_on, today) >= -SHOW_AHEAD_DAYS)
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
}

export function buildAlerts(input: {
  invoices: Invoice[];
  leads: LeadRow[];
  actions: OpsAction[];
  today: string;
}): Alert[] {
  const { invoices, leads, actions, today } = input;
  const alerts: Alert[] = [];
  const leadFor = (inv: Invoice) =>
    leads.find((l) => inv.email && l.email && l.email.toLowerCase() === inv.email.toLowerCase()) ||
    leads.find((l) => l.company.toLowerCase() === inv.customer.toLowerCase());

  // 1. Paid for, not delivered. The most expensive thing to leave: it is a
  //    customer who already said yes, waiting.
  for (const inv of invoices) {
    if (inv.status !== 'paid' || inv.work_status === 'complete') continue;
    const paidOn = inv.paid_on || inv.invoiced_on;
    const days = daysSince(paidOn, today);
    const lead = leadFor(inv);
    alerts.push({
      id: `work-${inv.id}`,
      tone: days > 30 ? 'crit' : 'warn',
      title: `${inv.customer} paid ${dollars(inv.amount_paid)} and is still waiting for the work`,
      detail: `Paid ${nice(paidOn)} — ${ago(days)}. Deliver it before selling anything new, then mark the work done on the Revenue page.`,
      href: lead ? `/admin/leads/${lead.id}` : '/admin/revenue',
      cta: lead ? 'Open customer' : 'Open revenue',
    });
  }

  // 2. Invoiced and never paid.
  for (const inv of invoices) {
    if (inv.status !== 'sent') continue;
    const days = daysSince(inv.invoiced_on, today);
    if (days < 14) continue;
    const owed = Math.max(0, (Number(inv.amount) || 0) - (Number(inv.amount_paid) || 0));
    if (owed <= 0) continue;
    alerts.push({
      id: `unpaid-${inv.id}`,
      tone: days > 45 ? 'crit' : 'warn',
      title: `${inv.customer} owes you ${dollars(owed)}`,
      detail: `Invoiced ${nice(inv.invoiced_on)} — ${ago(days)} — and not paid. Send a reminder.`,
      href: '/admin/revenue',
      cta: 'Open revenue',
    });
  }

  // 3. Follow-ups that have sat past their date for days.
  const late = leads.filter(
    (l) => isFollowable(l) && l.next_action_on && daysSince(l.next_action_on, today) >= 3,
  );
  if (late.length) {
    const names = late.slice(0, 3).map((l) => l.company).join(', ');
    alerts.push({
      id: 'late-followups',
      tone: late.some((l) => daysSince(String(l.next_action_on), today) >= 10) ? 'crit' : 'warn',
      title: `${late.length} follow-up${late.length === 1 ? ' is' : 's are'} more than a few days late`,
      detail: `${names}${late.length > 3 ? ` and ${late.length - 3} more` : ''}. Do them, or move the date so the list stays honest.`,
      href: '/admin/leads',
      cta: 'Open leads',
    });
  }

  // 4. Customers nobody is going to talk to again.
  const cold = leads.filter((l) => goingCold(l, today));
  if (cold.length) {
    alerts.push({
      id: 'cold',
      tone: 'warn',
      title: `${cold.length} past customer${cold.length === 1 ? ' has' : 's have'} no check-in booked`,
      detail: 'Someone who already bought is the easiest next sale. Give each a date.',
      href: '/admin/leads?show=cold',
      cta: 'Book check-ins',
    });
  }

  // 5. Your own priorities past their date.
  const overdue = ownPriorities(actions).filter((a) => a.due_on && a.due_on < today);
  if (overdue.length) {
    alerts.push({
      id: 'overdue-priorities',
      tone: 'warn',
      title: `${overdue.length} of your priorities ${overdue.length === 1 ? 'is' : 'are'} past ${overdue.length === 1 ? 'its' : 'their'} date`,
      detail: `Oldest: “${overdue.sort((a, b) => String(a.due_on).localeCompare(String(b.due_on)))[0].title}”. Do it, or mark it done if it already is.`,
      href: '#priorities',
      cta: 'See them',
    });
  }

  return alerts.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'crit' ? -1 : 1));
}

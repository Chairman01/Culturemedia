// Where things stand with a lead, in one sentence: who wrote last, how long ago,
// and whose move it is. Worked out from the two timestamps the mail check keeps
// current — last_contacted_at (you wrote, from your Sent folders) and
// last_reply_at (they wrote) — plus the next-step date.
//
// Pure, so the Leads list and anything else can share one reading of a lead.

import { isCustomer, isFollowable, isOpen, type LeadRow } from './crm';

export type StandingGroup = 'move' | 'waiting' | 'fresh' | 'customer' | 'closed';

export interface Standing {
  group: StandingGroup;
  /** Short label for the chip. */
  label: string;
  tone: 'warn' | 'ok' | 'none' | 'crit';
  /** The sentence. */
  text: string;
  /** Lower sorts first within the list. */
  rank: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function nice(iso: string, today: string): string {
  const d = `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
  return iso.slice(0, 4) === today.slice(0, 4) ? d : `${d}, ${iso.slice(0, 4)}`;
}

function daysAgo(iso: string, today: string): number {
  const at = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  return Math.max(0, Math.round((at(today) - at(iso.slice(0, 10))) / 86400000));
}

const span = (days: number) =>
  days === 0 ? 'today' : days === 1 ? 'yesterday' : days < 14 ? `${days} days ago` : days < 60 ? `${Math.round(days / 7)} weeks ago` : `${Math.round(days / 30)} months ago`;

export function standingOf(lead: LeadRow, today: string): Standing {
  const theirs = lead.last_reply_at ? String(lead.last_reply_at) : '';
  const yours = lead.last_contacted_at ? String(lead.last_contacted_at) : '';
  const theyWroteLast = Boolean(theirs) && (!yours || theirs > yours);
  const due = lead.next_action_on && lead.next_action_on <= today ? lead.next_action_on : null;

  if (!isFollowable(lead) && !isCustomer(lead)) {
    return {
      group: 'closed',
      label: lead.unsubscribed_at ? 'Unsubscribed' : 'Closed',
      tone: 'none',
      text: lead.unsubscribed_at ? 'Asked not to be emailed. Nothing more to do.' : 'Closed. Nothing more to do.',
      rank: 9,
    };
  }

  // Someone wrote and has not been answered: the same whether they are a lead or a client.
  if (theyWroteLast && (isOpen(lead) || isCustomer(lead))) {
    const days = daysAgo(theirs, today);
    return {
      group: 'move',
      label: 'Your move',
      tone: days >= 3 ? 'crit' : 'warn',
      text: `They wrote last, ${span(days)} (${nice(theirs, today)}) — you have not answered yet.`,
      rank: 0,
    };
  }

  if (isCustomer(lead)) {
    return {
      group: 'customer',
      label: due ? 'Check in now' : 'Client',
      tone: due ? 'warn' : 'ok',
      text: due
        ? `Check-in was due ${nice(due, today)}.${yours ? ` You last wrote ${span(daysAgo(yours, today))}.` : ''}`
        : lead.next_action_on
          ? `Next check-in ${nice(lead.next_action_on, today)}.${yours ? ` Last contact ${nice(yours, today)}.` : ''}`
          : `No check-in booked.${yours ? ` Last contact ${nice(yours, today)}.` : ''}`,
      rank: due ? 1 : 5,
    };
  }

  if (due) {
    return {
      group: 'move',
      label: 'Your move',
      tone: 'warn',
      text: `Your next step was due ${nice(due, today)}.${yours ? ` You wrote last, ${span(daysAgo(yours, today))}.` : ' No emails yet.'}`,
      rank: 1,
    };
  }

  if (yours) {
    const days = daysAgo(yours, today);
    return {
      group: 'waiting',
      label: 'Waiting on them',
      tone: 'none',
      text: `You wrote last, ${span(days)} (${nice(yours, today)}) — ${theirs ? 'no answer since.' : 'no answer yet.'}${
        lead.next_action_on ? ` Next step ${nice(lead.next_action_on, today)}.` : ''
      }`,
      rank: 3,
    };
  }

  return {
    group: 'fresh',
    label: 'Not started',
    tone: 'none',
    text: `No emails either way yet.${lead.created_at ? ` Added ${nice(String(lead.created_at), today)}.` : ''}`,
    rank: 2,
  };
}

export const GROUP_TITLE: Record<StandingGroup, { title: string; help: string }> = {
  move: { title: 'Your move', help: 'They are waiting on you, or a step you set is due. Do these first.' },
  fresh: { title: 'Not started', help: 'In your list, but no email has gone either way.' },
  waiting: { title: 'Waiting on them', help: 'You wrote last. Nothing to do until they answer or the next step comes due.' },
  customer: { title: 'Clients', help: 'They have bought. Keep a check-in date on each so nobody goes cold.' },
  closed: { title: 'Closed', help: 'Lost, declined or unsubscribed.' },
};

export const GROUP_ORDER: StandingGroup[] = ['move', 'fresh', 'waiting', 'customer', 'closed'];

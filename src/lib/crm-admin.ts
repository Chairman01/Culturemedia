// Server-side reads and small updates on the CRM tables.
//
// The admin_* functions cover the dashboards and adding a lead. Everything else
// the Leads and Inbox pages need is a plain read or a small update on leads /
// lead_events / lead_drafts, done here with the service role. The rules in
// updateLead() mirror Culture Alberta's PATCH /api/admin/leads, so a lead
// behaves the same whichever admin touched it. Nothing in this file sends
// email: drafting, sending and reply-spotting stay with the Culture Alberta
// engine.

import 'server-only';

import {
  CONSENT_BASES,
  DEAL_TYPES,
  SEQUENCE_KEYS,
  STAGES,
  type LeadDraftRow,
  type LeadEventRow,
  type LeadRow,
} from './crm';
import { getClient, NOT_CONFIGURED, type AdminResult } from './supabase-admin';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isLeadId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id);

const LEAD_COLUMNS =
  'id, company, contact_name, email, phone, website, city, category, tier, source, stage, deal_type, deal_value, term_months, sequence_key, sequence_step, next_action_on, last_contacted_at, last_reply_at, won_at, renewal_on, consent_basis, consent_note, unsubscribed_at, notes, created_at, updated_at';

const DRAFT_COLUMNS =
  'id, lead_id, sequence_key, step, subject, body, status, sent_at, send_error, created_at';

function fail<T>(where: string, error: unknown): AdminResult<T> {
  console.error(`[admin] ${where} failed`, error);
  const message = (error as { message?: string } | null)?.message;
  return { data: null, error: message || `${where} failed` };
}

export async function listLeads(): Promise<AdminResult<LeadRow[]>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase
    .from('leads')
    .select(LEAD_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(1000);
  if (error) return fail('listLeads', error);
  return { data: (data ?? []) as LeadRow[], error: null };
}

export interface LeadDetail {
  lead: LeadRow;
  events: LeadEventRow[];
  drafts: LeadDraftRow[];
}

export async function getLeadDetail(id: string): Promise<AdminResult<LeadDetail>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  if (!isLeadId(id)) return { data: null, error: 'Not a lead id.' };

  const [lead, events, drafts] = await Promise.all([
    supabase.from('leads').select(LEAD_COLUMNS).eq('id', id).maybeSingle(),
    supabase
      .from('lead_events')
      .select('id, lead_id, type, body, created_at')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('lead_drafts')
      .select(DRAFT_COLUMNS)
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  if (lead.error) return fail('getLeadDetail', lead.error);
  if (!lead.data) return { data: null, error: 'That lead no longer exists.' };
  return {
    data: {
      lead: lead.data as LeadRow,
      events: (events.data ?? []) as LeadEventRow[],
      drafts: (drafts.data ?? []) as LeadDraftRow[],
    },
    error: null,
  };
}

/** Emails the engine has drafted that are waiting for a human to approve. */
export async function listPendingDrafts(): Promise<AdminResult<LeadDraftRow[]>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase
    .from('lead_drafts')
    .select(`${DRAFT_COLUMNS}, leads(company, email)`)
    .in('status', ['pending', 'failed'])
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return fail('listPendingDrafts', error);

  type Joined = { company?: string | null; email?: string | null };
  const rows = ((data ?? []) as unknown as Array<LeadDraftRow & { leads: Joined | Joined[] | null }>).map(
    ({ leads, ...draft }) => {
      const lead = Array.isArray(leads) ? leads[0] : leads;
      return { ...draft, company: lead?.company ?? null, email: lead?.email ?? null };
    },
  );
  return { data: rows, error: null };
}

const EDITABLE = [
  'company',
  'contact_name',
  'email',
  'phone',
  'website',
  'city',
  'category',
  'stage',
  'deal_type',
  'sequence_key',
  'next_action_on',
  'deal_value',
  'term_months',
  'consent_basis',
  'consent_note',
  'notes',
] as const;

// The engine compares next_action_on with its own UTC date; match it.
const utcToday = () => new Date().toISOString().slice(0, 10);

function checkLeadChanges(changes: Record<string, unknown>): string | null {
  const has = (k: string) => k in changes && changes[k] !== '' && changes[k] !== null;
  if ('company' in changes && !String(changes.company ?? '').trim()) return 'Company is required.';
  if (has('stage') && !(STAGES as readonly string[]).includes(String(changes.stage))) return 'Pick a stage.';
  if (has('deal_type') && !(DEAL_TYPES as readonly string[]).includes(String(changes.deal_type))) {
    return 'Pick a deal type.';
  }
  if (has('consent_basis') && !(CONSENT_BASES as readonly string[]).includes(String(changes.consent_basis))) {
    return 'Pick an email permission option.';
  }
  if (has('sequence_key') && !SEQUENCE_KEYS.includes(String(changes.sequence_key))) {
    return 'Pick an email sequence.';
  }
  if (has('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(changes.email))) {
    return "That email address doesn't look right.";
  }
  if (has('deal_value') && !(Number(changes.deal_value) >= 0)) return 'Check the deal value.';
  if (has('term_months')) {
    const months = Number(changes.term_months);
    if (!Number.isInteger(months) || months < 1 || months > 60) return 'Months must be 1 to 60.';
  }
  if (has('next_action_on') && !/^\d{4}-\d{2}-\d{2}$/.test(String(changes.next_action_on))) {
    return 'Next step needs a date.';
  }
  return null;
}

export async function updateLead(
  id: string,
  changes: Record<string, unknown>,
  by: string,
): Promise<AdminResult<LeadRow>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  if (!isLeadId(id)) return { data: null, error: 'Not a lead id.' };
  const problem = checkLeadChanges(changes);
  if (problem) return { data: null, error: problem };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of EDITABLE) {
    if (!(field in changes)) continue;
    const value = changes[field];
    patch[field] =
      value === '' || value === undefined ? null : typeof value === 'string' ? value.trim() : value;
  }

  if (patch.sequence_key) {
    // A sequence only makes sense for someone we may lawfully email.
    const { data: current } = await supabase
      .from('leads')
      .select('email, consent_basis, unsubscribed_at')
      .eq('id', id)
      .maybeSingle();
    const email = 'email' in patch ? patch.email : current?.email;
    const consent = 'consent_basis' in patch ? patch.consent_basis : current?.consent_basis;
    if (current?.unsubscribed_at) {
      return { data: null, error: 'They unsubscribed, so they cannot be put on a sequence.' };
    }
    if (!email) return { data: null, error: 'Add their email address before choosing a sequence.' };
    if (!consent) return { data: null, error: 'Record the email permission before choosing a sequence.' };

    // Changing the sequence restarts it. Leaving the step where it was would
    // drop the lead into the middle of a cadence it never began.
    patch.sequence_step = 0;
    patch.next_action_on = utcToday();
  }

  // Winning a deal schedules its own renewal 45 days before the term ends,
  // which is the step that turns one-off buyers into retainers.
  if (patch.stage === 'won') {
    const { data: existing } = await supabase.from('leads').select('term_months').eq('id', id).maybeSingle();
    const months = Number(patch.term_months ?? existing?.term_months ?? 0);
    patch.won_at = new Date().toISOString();
    if (months > 0) {
      const renewal = new Date();
      renewal.setMonth(renewal.getMonth() + months);
      renewal.setDate(renewal.getDate() - 45);
      patch.renewal_on = renewal.toISOString().slice(0, 10);
      patch.sequence_key = 'renewal';
      patch.sequence_step = 0;
      patch.next_action_on = patch.renewal_on;
    } else {
      patch.next_action_on = null;
    }
  }

  if (patch.stage === 'lost' || patch.stage === 'declined') {
    patch.next_action_on = null;
    await supabase
      .from('lead_drafts')
      .update({ status: 'skipped', send_error: `Lead marked ${patch.stage}` })
      .eq('lead_id', id)
      .eq('status', 'pending');
  }

  const { data, error } = await supabase
    .from('leads')
    .update(patch)
    .eq('id', id)
    .select(LEAD_COLUMNS)
    .maybeSingle();
  if (error) return fail('updateLead', error);
  if (!data) return { data: null, error: 'That lead no longer exists.' };

  if ('stage' in changes) {
    await supabase.from('lead_events').insert({
      lead_id: id,
      type: 'stage_change',
      body: `Moved to ${changes.stage} by ${by}`,
      meta: { deal_value: patch.deal_value ?? null, via: 'culturemedia.ca' },
    });
  }
  return { data: data as LeadRow, error: null };
}

export const LOGGABLE = ['note', 'call', 'meeting', 'email'] as const;

/**
 * Writes a line on the lead's timeline. `touched` also stamps
 * last_contacted_at — a call, a meeting, an email sent by hand — which is what
 * clears a lead from "replies to answer".
 */
export async function logLeadEvent(
  id: string,
  kind: string,
  body: string,
  touched: boolean,
): Promise<AdminResult<true>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  if (!isLeadId(id)) return { data: null, error: 'Not a lead id.' };
  if (!(LOGGABLE as readonly string[]).includes(kind)) return { data: null, error: 'Unknown kind of note.' };
  const text = body.trim().slice(0, 4000);
  if (!text) return { data: null, error: 'Write something first.' };

  // The engine's timeline knows the type 'note'; keep to it and say what kind
  // of contact it was in words.
  const label = kind === 'note' ? '' : `${kind[0].toUpperCase()}${kind.slice(1)}: `;
  const { error } = await supabase.from('lead_events').insert({
    lead_id: id,
    type: 'note',
    body: `${label}${text}`,
    meta: { kind, via: 'culturemedia.ca' },
  });
  if (error) return fail('logLeadEvent', error);

  if (touched) {
    const now = new Date().toISOString();
    await supabase.from('leads').update({ last_contacted_at: now, updated_at: now }).eq('id', id);
  }
  return { data: true, error: null };
}

export interface OutreachDay {
  date: string;
  /** First-touch emails that went out that day. */
  firstTouches: number;
  /** Every email that went out that day, follow-ups included. */
  sent: number;
  /** Leads added that day. */
  added: number;
}

/** Monday-to-Friday activity for the week containing `today` (YYYY-MM-DD, Edmonton). */
export async function outreachWeek(today: string): Promise<AdminResult<OutreachDay[]>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const [y, m, d] = today.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
  const days = [0, 1, 2, 3, 4].map((i) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
  // A day of slack: timestamps are UTC, the week is Edmonton's.
  const from = new Date(monday.getTime() - 86400000).toISOString();

  const [sent, added] = await Promise.all([
    supabase.from('lead_drafts').select('step, sent_at').gte('sent_at', from).limit(2000),
    supabase.from('leads').select('created_at').gte('created_at', from).limit(2000),
  ]);
  if (sent.error) return fail('outreachWeek', sent.error);

  const edmonton = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Edmonton',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const localDay = (iso: string) => edmonton.format(new Date(iso));

  const out: OutreachDay[] = days.map((date) => ({ date, firstTouches: 0, sent: 0, added: 0 }));
  const byDate = new Map(out.map((o) => [o.date, o]));
  for (const row of sent.data ?? []) {
    if (!row.sent_at) continue;
    const slot = byDate.get(localDay(String(row.sent_at)));
    if (!slot) continue;
    slot.sent += 1;
    if (Number(row.step) === 0) slot.firstTouches += 1;
  }
  for (const row of added.data ?? []) {
    const slot = byDate.get(localDay(String(row.created_at)));
    if (slot) slot.added += 1;
  }
  return { data: out, error: null };
}

/**
 * They asked to stop. Mirrors Culture Alberta's /api/leads/opt-out: stamped as
 * unsubscribed, moved to Declined, schedule cleared, anything waiting to send
 * cancelled. Only ever called from a button a person pressed.
 */
export async function unsubscribeLead(id: string, by: string): Promise<AdminResult<true>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  if (!isLeadId(id)) return { data: null, error: 'Not a lead id.' };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('leads')
    .update({ unsubscribed_at: now, next_action_on: null, stage: 'declined', updated_at: now })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) return fail('unsubscribeLead', error);
  if (!data) return { data: null, error: 'That lead no longer exists.' };

  await supabase
    .from('lead_drafts')
    .update({ status: 'skipped', send_error: 'Lead unsubscribed' })
    .eq('lead_id', id)
    .eq('status', 'pending');
  await supabase.from('lead_events').insert({
    lead_id: id,
    type: 'note',
    body: `Marked as unsubscribed by ${by} — asked by email not to be contacted.`,
    meta: { via: 'culturemedia.ca' },
  });
  return { data: true, error: null };
}

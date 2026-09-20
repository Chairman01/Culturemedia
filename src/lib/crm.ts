// CRM vocabulary shared by the admin pages and their API routes.
//
// The tables (leads, lead_events, lead_drafts) and the email engine that drafts
// follow-ups, sends them through Zoho and spots replies all live with Culture
// Alberta (lib/crm/* in that repo; cron at 7:15 a.m. Edmonton). This file only
// mirrors the names that engine uses, so both admins agree on what a stage or a
// sequence is. No next/* or server imports: client components use it too.

export const STAGES = ['new', 'contacted', 'engaged', 'proposal', 'won', 'lost', 'declined'] as const;
export type Stage = (typeof STAGES)[number];

export const OPEN_STAGES: Stage[] = ['new', 'contacted', 'engaged', 'proposal'];
export const CLOSED_STAGES: Stage[] = ['won', 'lost', 'declined'];

export const STAGE_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  engaged: 'Talking',
  proposal: 'Proposal sent',
  won: 'Client',
  lost: 'Lost',
  declined: 'Declined',
};

export const DEAL_TYPES = ['retainer', 'one_time', 'sponsorship', 'partnership', 'other'] as const;

export const DEAL_LABEL: Record<string, string> = {
  retainer: 'Retainer',
  one_time: 'One-time',
  sponsorship: 'Sponsorship',
  partnership: 'Partnership',
  other: 'Other',
};

export const CONSENT_BASES = ['implied_inquiry', 'implied_published', 'implied_existing', 'express'] as const;

/** CASL: why we are allowed to email this person. No basis recorded, no email. */
export const CONSENT_LABEL: Record<string, string> = {
  implied_inquiry: 'They contacted us first',
  implied_published: 'Their business email is published on their website',
  // CASL's existing business relationship: good for two years after a purchase.
  implied_existing: 'They bought from us in the last two years',
  express: 'They agreed to get emails from us',
};

/**
 * The follow-up sequences the Culture Alberta engine knows. Keys must match
 * lib/crm/sequences.ts over there; the wording of each email lives there too.
 */
export const SEQUENCES = [
  {
    key: 'smb_intro',
    label: 'Local business intro',
    when: 'Cold outreach to a business that could buy a feature or a bundle.',
    cadence: '4 emails over 16 days',
  },
  {
    key: 'institution_intro',
    label: 'Institution / retainer intro',
    when: 'An organisation that could sponsor a whole section on a term.',
    cadence: '4 emails over 4 weeks',
  },
  {
    key: 'inbound_rates',
    label: 'They asked for rates',
    when: 'Someone wrote in asking what you charge. Answer fast, follow up twice.',
    cadence: '3 emails over 11 days',
  },
  {
    key: 'renewal',
    label: 'Renewal',
    when: 'Starts by itself 45 days before a signed term ends.',
    cadence: '2 emails',
  },
] as const;

export const SEQUENCE_KEYS: string[] = SEQUENCES.map((s) => s.key);
export const SEQUENCE_LABEL: Record<string, string> = Object.fromEntries(
  SEQUENCES.map((s) => [s.key, s.label]),
);

/** Where drafted emails are approved and sent today. */
export const PARTNERSHIPS_URL = 'https://www.culturealberta.com/admin/leads';

export interface LeadRow {
  id: string;
  company: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  category: string | null;
  tier: string;
  source: string;
  stage: string;
  deal_type: string | null;
  deal_value: number | string | null;
  term_months: number | null;
  sequence_key: string | null;
  sequence_step: number;
  next_action_on: string | null;
  last_contacted_at: string | null;
  last_reply_at: string | null;
  won_at: string | null;
  renewal_on: string | null;
  consent_basis: string | null;
  consent_note: string | null;
  unsubscribed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadEventRow {
  id: number;
  lead_id: string;
  type: string;
  body: string | null;
  created_at: string;
}

export interface LeadDraftRow {
  id: string;
  lead_id: string;
  sequence_key: string;
  step: number;
  subject: string;
  body: string;
  status: string;
  sent_at: string | null;
  send_error: string | null;
  created_at: string;
  company?: string | null;
  email?: string | null;
}

export const isOpen = (lead: Pick<LeadRow, 'stage'>): boolean =>
  !CLOSED_STAGES.includes(lead.stage as Stage);

/** They wrote back and we have not answered since. */
export const awaitingReply = (lead: Pick<LeadRow, 'last_reply_at' | 'last_contacted_at' | 'stage'>): boolean =>
  Boolean(lead.last_reply_at) &&
  isOpen(lead) &&
  (!lead.last_contacted_at || String(lead.last_reply_at) > String(lead.last_contacted_at));

/** Someone who has paid us — imported from the invoice ledger, or marked Client. */
export const isCustomer = (lead: Pick<LeadRow, 'stage' | 'source'>): boolean =>
  lead.stage === 'won' || lead.source === 'past_customer';

/** Still worth a follow-up date: anyone not lost, declined or unsubscribed. */
export const isFollowable = (lead: Pick<LeadRow, 'stage' | 'unsubscribed_at'>): boolean =>
  !lead.unsubscribed_at && lead.stage !== 'lost' && lead.stage !== 'declined';

const SIX_MONTHS_MS = 183 * 86400000;

/**
 * A customer who would otherwise be forgotten: no check-in booked, and nobody
 * has spoken to them in six months (or ever). `today` is YYYY-MM-DD.
 */
export function goingCold(lead: LeadRow, today: string): boolean {
  if (!isCustomer(lead) || !isFollowable(lead) || lead.next_action_on) return false;
  // A renewal sequence is its own follow-up.
  if (lead.sequence_key) return false;
  if (!lead.last_contacted_at) return true;
  return Date.parse(`${today}T12:00:00Z`) - Date.parse(lead.last_contacted_at) > SIX_MONTHS_MS;
}

/** What stops this lead from getting follow-up emails, in plain words. */
export function needsOf(lead: LeadRow): string[] {
  if (lead.unsubscribed_at) return ['unsubscribed'];
  if (!isOpen(lead)) return [];
  const needs: string[] = [];
  if (!lead.email) needs.push('email address');
  else if (!lead.consent_basis) needs.push('email permission');
  if (!lead.sequence_key) needs.push('email sequence');
  return needs;
}

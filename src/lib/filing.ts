// What each email is to the business, so the whole inbox can be worked by pile:
// partnership leads, retainer leads, stories for Culture Alberta, clients,
// platforms — and what is automated or not business at all.
//
// The owner files a SENDER once (stored in mail_senders.category) and every
// email from them follows. Before that, a lead in the CRM files itself from its
// deal type, and anything else gets a suggestion worked out from the email.
// Pure, no server imports: the Inbox page runs this in the browser.

import { isCustomer, type LeadRow } from './crm';
import type { Classified } from './mail';

export type FileAs = 'partnership' | 'retainer' | 'story' | 'client' | 'platform';

export const FILE_AS: { k: FileAs; label: string; plural: string; help: string }[] = [
  { k: 'partnership', label: 'Partnership lead', plural: 'Partnership leads', help: 'Could pay for a feature, a campaign or a sponsorship.' },
  { k: 'retainer', label: 'Retainer lead', plural: 'Retainer leads', help: 'Could pay every month.' },
  { k: 'story', label: 'Story for Culture Alberta', plural: 'Stories', help: 'A press release, a tip or news worth writing up.' },
  { k: 'client', label: 'Client', plural: 'Clients', help: 'Has paid you.' },
  { k: 'platform', label: 'Platform & admin', plural: 'Platforms & admin', help: 'Mediavine, Zoho, Google, government portals and the like.' },
];

export const FILE_LABEL: Record<FileAs, string> = Object.fromEntries(FILE_AS.map((f) => [f.k, f.label])) as Record<FileAs, string>;

/** Every email lands in exactly one pile. */
export type Pile = FileAs | 'unfiled' | 'automated' | 'notbusiness';

// A sales conversation: money, placement, promotion.
const ADS = /advertis|sponsor|media kit|rate card|\brates?\b|pricing|paid (article|post|placement)|sponsored|budget|promot(e|ion)|partnership|collab|package/i;
// Money that recurs.
const MONTHLY = /monthly|per month|every month|ongoing|retainer|long[- ]term|annual (partnership|contract)/i;
// Something to write about.
const STORY =
  /press release|media release|news release|for immediate release|media advisory|story (idea|tip|pitch)|follow[- ]up story|press preview|media pass|embargo|announce|is pleased to|launch(es|ing)?\b|forthcoming|showcase|award|nominees?|grand opening|opening (day|soon)|festival|you previously covered|would love (for you )?to (cover|feature|share)/i;
// Accounts the business runs on.
const PLATFORM =
  /(^|\.)(mediavine|raptive|comscore|zoho|zohomail|zohoaccounts|zohostore|google|bidsandtenders|resend|vercel|supabase|godaddy|stripe|paypal|interac|payments\.interac)\.(com|ca|net|io)$|(^|\.)gov\.ab\.ca$|(^|\.)canada\.ca$/i;

const domainOf = (address: string) => (address.split('@')[1] || '').toLowerCase();

/** What an unfiled email looks like, or null when there is nothing to go on. */
export function suggestFiling(m: Classified): FileAs | null {
  if (m.kind === 'noise' || m.kind === 'bounce') return null;
  const text = `${m.subject}\n${m.summary}`;
  if (m.kind === 'money') return 'client';
  if (PLATFORM.test(domainOf(m.fromAddress))) return 'platform';
  if (ADS.test(text)) return MONTHLY.test(text) ? 'retainer' : 'partnership';
  if (STORY.test(text)) return 'story';
  if (m.kind === 'inquiry') return 'partnership';
  return null;
}

/** A lead in the CRM files itself: bought → client, monthly → retainer, otherwise a partnership prospect. */
export function fileOfLead(lead: LeadRow): FileAs {
  if (isCustomer(lead)) return 'client';
  if (lead.deal_type === 'retainer') return 'retainer';
  return 'partnership';
}

export interface Filing {
  pile: Pile;
  /** What the sender is filed as: by hand, or by being a lead. */
  filed: FileAs | null;
  /** True when `filed` comes from the lead record rather than a hand filing. */
  fromLead: boolean;
  suggested: FileAs | null;
}

export function fileOf(
  m: Classified,
  ctx: { categories: Record<string, FileAs>; muted: Set<string>; leads: Map<string, LeadRow> },
): Filing {
  const key = m.fromAddress.toLowerCase();
  const byHand = ctx.categories[key] || null;
  const lead = m.leadId ? ctx.leads.get(m.leadId) || null : null;

  // Filing by hand beats everything, including Not business: filing a muted
  // sender brings them back (the server clears the flag as it saves).
  if (byHand) return { pile: byHand, filed: byHand, fromLead: false, suggested: null };
  if (ctx.muted.has(key) && !lead) return { pile: 'notbusiness', filed: null, fromLead: false, suggested: null };
  if (lead) {
    const f = fileOfLead(lead);
    return { pile: f, filed: f, fromLead: true, suggested: null };
  }
  if (m.kind === 'noise') return { pile: 'automated', filed: null, fromLead: false, suggested: null };
  return { pile: 'unfiled', filed: null, fromLead: false, suggested: suggestFiling(m) };
}

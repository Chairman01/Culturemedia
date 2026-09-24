// What each email is to the business, so the whole inbox can be worked by pile:
// partnership leads, retainer leads, stories for Culture Alberta, clients,
// platforms — and what is automated or not business at all.
//
// The owner files a SENDER once (stored in mail_senders.category) and every
// email from them follows. Before that, a lead in the CRM files itself from its
// deal type, and anything else gets a suggestion worked out from the email.
// Pure, no server imports: the Inbox page runs this in the browser.

import { isCustomer, type LeadRow } from './crm';
import { PERSONAL_DOMAINS, type Classified } from './mail';

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

// Second-level labels that are not a company: gov.ab.ca, co.uk, com.au.
const SHARED_SUFFIX = /^(ab|bc|mb|nb|nl|ns|nt|nu|on|pe|qc|sk|yt|gc|co|com|org|net|gov|edu|ac)\.[a-z]{2}$/;

/**
 * The company behind an address, for "everything from pinterest.com":
 * recommendations@discover.pinterest.com → pinterest.com. Null for free mail
 * (gmail.com and the like), where a domain is strangers, not one company.
 */
export function companyDomainOf(address: string): string | null {
  const domain = domainOf(address);
  const parts = domain.split('.').filter(Boolean);
  if (parts.length < 2) return null;
  let base = parts.slice(-2).join('.');
  if (SHARED_SUFFIX.test(base) && parts.length >= 3) base = parts.slice(-3).join('.');
  if (PERSONAL_DOMAINS.has(domain) || PERSONAL_DOMAINS.has(base)) return null;
  return base;
}

/**
 * The Not business entry that hides an address, or null. Entries are an
 * address, or "@company.com" for everything a company sends from any address
 * or subdomain.
 */
export function muteEntryFor(address: string, muted: readonly string[]): string | null {
  const a = address.toLowerCase();
  const d = domainOf(a);
  for (const entry of muted) {
    const e = entry.toLowerCase();
    if (e === a) return e;
    if (e.startsWith('@')) {
      const company = e.slice(1);
      if (d === company || d.endsWith(`.${company}`)) return e;
    }
  }
  return null;
}

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
  /** The Not business entry hiding this sender: their address, or "@company.com". */
  mutedBy: string | null;
}

export function fileOf(
  m: Classified,
  ctx: { categories: Record<string, FileAs>; muted: readonly string[]; leads: Map<string, LeadRow> },
): Filing {
  const key = m.fromAddress.toLowerCase();
  const byHand = ctx.categories[key] || null;
  const lead = m.leadId ? ctx.leads.get(m.leadId) || null : null;

  // Filing by hand beats everything, including Not business: filing a muted
  // sender brings them back (the server clears the flag as it saves).
  const none = { filed: null, fromLead: false, suggested: null, mutedBy: null };
  if (byHand) return { ...none, pile: byHand, filed: byHand };
  const mutedBy = muteEntryFor(key, ctx.muted);
  if (mutedBy && !lead) return { ...none, pile: 'notbusiness', mutedBy };
  if (lead) {
    const f = fileOfLead(lead);
    return { ...none, pile: f, filed: f, fromLead: true };
  }
  if (m.kind === 'noise') return { ...none, pile: 'automated' };
  return { ...none, pile: 'unfiled', suggested: suggestFiling(m) };
}

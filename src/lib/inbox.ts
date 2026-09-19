// Everything the Inbox page shows, gathered in one place: leads who wrote back,
// emails the engine drafted that are waiting for approval, and the recent Zoho
// inbox with each sender matched against the CRM.

import 'server-only';

import { awaitingReply, type LeadDraftRow, type LeadRow } from './crm';
import { listLeads, listPendingDrafts } from './crm-admin';
import { PERSONAL_DOMAINS, recentInbox, type InboxMessage } from './zoho-mail';

export interface InboxMail extends InboxMessage {
  /** Set when the sender is already in the CRM. */
  leadId: string | null;
  leadCompany: string | null;
  /** A guess at the company from the address, for "Add as lead". */
  companyGuess: string;
}

export interface InboxData {
  replies: LeadRow[];
  drafts: LeadDraftRow[];
  mail: InboxMail[];
  zohoConnected: boolean;
  zohoReason: string | null;
  error: string | null;
}

function companyFromAddress(address: string): string {
  const domain = address.split('@')[1] || '';
  if (!domain || PERSONAL_DOMAINS.has(domain)) return '';
  const name = domain.split('.')[0] || '';
  return name ? name[0].toUpperCase() + name.slice(1) : '';
}

export async function loadInbox(): Promise<InboxData> {
  const [leads, drafts, zoho] = await Promise.all([listLeads(), listPendingDrafts(), recentInbox(40)]);

  const all = leads.data ?? [];
  const byEmail = new Map(all.filter((l) => l.email).map((l) => [String(l.email).toLowerCase(), l]));

  const mail: InboxMail[] = zoho.connected
    ? zoho.messages.map((m) => {
        const lead = byEmail.get(m.fromAddress);
        return {
          ...m,
          leadId: lead?.id ?? null,
          leadCompany: lead?.company ?? null,
          companyGuess: companyFromAddress(m.fromAddress),
        };
      })
    : [];

  return {
    replies: all.filter(awaitingReply),
    drafts: drafts.data ?? [],
    mail,
    zohoConnected: zoho.connected,
    zohoReason: zoho.connected ? null : zoho.reason,
    error: leads.error || drafts.error,
  };
}

// Everything the Inbox page shows, gathered in one place: leads who wrote back,
// emails the engine drafted that are waiting for approval, and the mail from
// both mailboxes sorted into what it means.

import 'server-only';

import { awaitingReply, type LeadDraftRow, type LeadRow } from './crm';
import { listLeads, listPendingDrafts } from './crm-admin';
import type { Classified } from './mail';
import { readMail, syncMail, type MailSnapshot, type SyncReport } from './mail-sync';

export interface InboxData {
  replies: LeadRow[];
  drafts: LeadDraftRow[];
  /** Incoming mail from both mailboxes (inbox + spam), newest first. */
  mail: Classified[];
  mailboxes: MailSnapshot['mailboxes'];
  /** Leads already marked unsubscribed, so the page does not offer to do it twice. */
  stopped: string[];
  /** What the last sync changed; null when the page was only read. */
  report: SyncReport | null;
  error: string | null;
}

function shape(snapshot: MailSnapshot, drafts: LeadDraftRow[], report: SyncReport | null, error: string | null): InboxData {
  return {
    replies: snapshot.leads.filter(awaitingReply),
    drafts,
    mail: snapshot.incoming,
    mailboxes: snapshot.mailboxes,
    stopped: snapshot.leads.filter((l) => l.unsubscribed_at).map((l) => l.id),
    report,
    error,
  };
}

/** Read-only: what is there, without touching the CRM. */
export async function loadInbox(): Promise<InboxData> {
  const [snapshot, drafts] = await Promise.all([readMail(), listPendingDrafts()]);
  return shape(snapshot, drafts.data ?? [], null, snapshot.leadsError || drafts.error);
}

/** Read, then record what the mailboxes prove (replies, mail you sent). */
export async function syncInbox(): Promise<InboxData> {
  const { snapshot, report } = await syncMail();
  // After the sync: a reply cancels that lead's pending drafts.
  const drafts = await listPendingDrafts();
  return shape(snapshot, drafts.data ?? [], report, snapshot.leadsError || drafts.error);
}

/** First paint: the CRM side only, so the page appears before the mailboxes answer. */
export async function loadInboxQuick(): Promise<InboxData> {
  const [leads, drafts] = await Promise.all([listLeads(), listPendingDrafts()]);
  return {
    replies: (leads.data ?? []).filter(awaitingReply),
    drafts: drafts.data ?? [],
    mail: [],
    mailboxes: [],
    stopped: [],
    report: null,
    error: leads.error || drafts.error,
  };
}

// Reads both mailboxes and brings the CRM up to date with what they show.
//
// Two facts are safe to record without asking, because the mailbox proves them:
//   • a lead wrote to you      → the same thing Culture Alberta's recordReply()
//     does: pending drafts are cancelled, the schedule is cleared, the lead
//     moves to Talking (never backwards), and last_reply_at is stamped.
//   • you wrote to a lead      → last_contacted_at is stamped, and New → Contacted.
// Both use the MESSAGE's own time, not "now", so answering a reply from your
// mail client clears it from "replies to answer" without you logging anything,
// and running the sync twice changes nothing.
//
// Everything else — a stranger asking about rates, a payment notice, a bounce,
// someone asking to be removed — is only ever a suggestion on the Inbox page.
// Nothing in this file sends, deletes, moves or marks mail.

import 'server-only';

import { classify, indexLeads, type Classified, type MailMessage } from './mail';
import type { LeadRow } from './crm';
import { listLeads } from './crm-admin';
import { readGmail } from './gmail-imap';
import { getClient } from './supabase-admin';
import { readZoho, type MailboxResult } from './zoho-mail';

export interface SyncReport {
  /** Leads newly marked as having replied. */
  replies: { leadId: string; company: string; subject: string; folder: string }[];
  /** Leads newly marked as contacted, from mail you sent. */
  contacted: { leadId: string; company: string; subject: string }[];
  errors: string[];
}

export interface MailSnapshot {
  mailboxes: Omit<MailboxResult, 'messages'>[];
  /** Incoming mail (inbox + spam), newest first, classified. */
  incoming: Classified[];
  /** When you last emailed each address, from the Sent folders: address → ISO time. */
  repliedTo: Record<string, string>;
  leads: LeadRow[];
  leadsError: string | null;
}

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);

// An email the engine sent shows up in Sent a moment after the engine stamped
// last_contacted_at. Without slack, that same email would be logged twice.
const SEND_SLACK_MS = 2 * 60 * 1000;

/** Read both mailboxes and classify. Read-only: safe to call from a GET. */
export async function readMail(): Promise<MailSnapshot & { sent: MailMessage[] }> {
  const [zoho, gmail, leads] = await Promise.all([readZoho(40), readGmail(30), listLeads()]);
  const all = [...zoho.messages, ...gmail.messages].filter((m) => m.at);

  // Our own addresses: mail "from" these in the inbox is a copy of something we sent.
  const own = new Set(
    [zoho.label, gmail.label, process.env.CRM_SENDER_EMAIL, process.env.GMAIL_USER]
      .map((a) => String(a || '').toLowerCase())
      .filter((a) => a.includes('@')),
  );

  const index = indexLeads(leads.data ?? []);
  const incoming = all
    .filter((m) => m.folder !== 'sent' && !own.has(m.fromAddress))
    .map((m) => classify(m, index))
    .sort((a, b) => b.at.localeCompare(a.at));

  const sent = all.filter((m) => m.folder === 'sent' || own.has(m.fromAddress));
  const repliedTo: Record<string, string> = {};
  for (const m of sent) {
    for (const to of m.to) {
      const address = to.toLowerCase();
      if (ms(m.at) > ms(repliedTo[address])) repliedTo[address] = m.at;
    }
  }

  return {
    mailboxes: [zoho, gmail].map((box) => ({
      mailbox: box.mailbox,
      label: box.label,
      connected: box.connected,
      note: box.note,
      folders: box.folders,
    })),
    incoming,
    repliedTo,
    sent,
    leads: leads.data ?? [],
    leadsError: leads.error,
  };
}

/** Apply what the mailboxes prove to the CRM. Idempotent. */
export async function syncMail(): Promise<{ snapshot: MailSnapshot; report: SyncReport }> {
  const { sent, ...snapshot } = await readMail();
  const report: SyncReport = { replies: [], contacted: [], errors: [] };
  const supabase = getClient();
  if (!supabase || snapshot.leadsError) {
    if (snapshot.leadsError) report.errors.push(snapshot.leadsError);
    return { snapshot, report };
  }

  for (const lead of snapshot.leads) {
    const email = (lead.email || '').toLowerCase().trim();
    if (!email) continue;

    // Exact address only: a colleague on the same domain is shown as "probably
    // them" on the page, never written to the record.
    const inbound = snapshot.incoming.find((m) => m.fromAddress === email && m.kind !== 'bounce');
    const outbound = sent
      .filter((m) => m.to.includes(email))
      .sort((a, b) => b.at.localeCompare(a.at))[0];

    const lastContact = ms(lead.last_contacted_at);
    const lastReply = ms(lead.last_reply_at);
    const patch: Record<string, unknown> = {};
    let stage = lead.stage;

    try {
      if (outbound && ms(outbound.at) > lastContact + SEND_SLACK_MS) {
        patch.last_contacted_at = outbound.at;
        if (stage === 'new') patch.stage = stage = 'contacted';
        await supabase.from('lead_events').insert({
          lead_id: lead.id,
          type: 'note',
          body: `Email you sent from ${outbound.mailbox === 'gmail' ? 'Gmail' : 'Zoho'}: “${outbound.subject}”`,
          meta: { kind: 'email', via: 'mail sync', messageId: outbound.id, at: outbound.at },
        });
        report.contacted.push({ leadId: lead.id, company: lead.company, subject: outbound.subject });
      }

      // Same test as the morning run: newer than our last send and the last
      // reply already on file.
      if (inbound && ms(inbound.at) > Math.max(lastContact, lastReply)) {
        await supabase
          .from('lead_drafts')
          .update({ status: 'skipped', send_error: 'Cancelled — lead replied' })
          .eq('lead_id', lead.id)
          .eq('status', 'pending');

        // Never drag a lead backwards: someone at proposal or won stays there.
        // And "please remove me" is not a conversation: it pauses everything
        // but leaves the stage for you to settle with the Stop button.
        if (inbound.kind !== 'stop' && !['proposal', 'won', 'lost', 'declined'].includes(stage)) {
          patch.stage = stage = 'engaged';
        }
        patch.last_reply_at = inbound.at;
        patch.next_action_on = null;

        await supabase.from('lead_events').insert({
          lead_id: lead.id,
          type: 'reply_received',
          body: inbound.subject || 'Replied',
          meta: {
            via: 'mail sync',
            mailbox: inbound.mailbox,
            folder: inbound.folder,
            messageId: inbound.id,
            from: inbound.fromAddress,
          },
        });
        report.replies.push({
          leadId: lead.id,
          company: lead.company,
          subject: inbound.subject,
          folder: inbound.folder,
        });
      }

      if (Object.keys(patch).length) {
        patch.updated_at = new Date().toISOString();
        const { error } = await supabase.from('leads').update(patch).eq('id', lead.id);
        if (error) report.errors.push(`${lead.company}: ${error.message}`);
        else Object.assign(lead, patch);
      }
    } catch (err) {
      console.error('[admin] mail sync failed for a lead', err);
      report.errors.push(`${lead.company}: could not be updated`);
    }
  }

  return { snapshot, report };
}

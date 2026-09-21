// "Did that email get missed?" — search the whole of both mailboxes.
//
// The Inbox page holds the newest mail from each folder. An email older than
// that window, archived, or filed somewhere odd is still in the mailbox, and
// this finds it: Zoho's search across every folder, Gmail's own search across
// All Mail and Spam. Read-only, and nothing found here is written to the CRM.

import 'server-only';

import { listLeads } from './crm-admin';
import { searchGmail } from './gmail-imap';
import { classify, indexLeads, type Classified } from './mail';
import { searchZoho } from './zoho-mail';

export interface MailSearch {
  results: Classified[];
  /** Anything that stopped one mailbox from being searched, in plain words. */
  notes: string[];
}

export async function searchMail(rawQuery: unknown): Promise<MailSearch | { error: string }> {
  // Quotes and search operators are dropped: this box takes plain words.
  const query = String(rawQuery ?? '').replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (query.length < 2) return { error: 'Type at least two letters to search.' };

  const [zoho, gmail, leads] = await Promise.all([searchZoho(query), searchGmail(query), listLeads()]);
  const index = indexLeads(leads.data ?? []);
  const own = new Set(
    [process.env.CRM_SENDER_EMAIL, process.env.GMAIL_USER].map((a) => String(a || '').toLowerCase()).filter((a) => a.includes('@')),
  );

  const results = [...zoho.messages, ...gmail.messages]
    .filter((m) => m.at)
    // Mail you wrote shows up in a whole-mailbox search too: label it as sent.
    .map((m) => classify(own.has(m.fromAddress) ? { ...m, folder: 'sent' as const } : m, index))
    .sort((a, b) => b.at.localeCompare(a.at));

  return { results, notes: [zoho.note, gmail.note].filter((n): n is string => Boolean(n)) };
}

// Senders the owner has judged by hand from the Inbox page: whether their mail
// is spam, and where the conversation with them stands.
//
// Both mail grants are read-only, so none of this touches the mailbox itself.
// "Not spam" remembers the address, so that message and everything the sender
// writes later stops being flagged here. A conversation status is stored with
// the time it was set, so a message that arrives after "done" reopens it.

import 'server-only';

import type { ConvoStatus, SenderMark } from './conversations';
import { getClient, NOT_CONFIGURED, type AdminResult } from './supabase-admin';

// Deliberately loose: this only decides what we are willing to store.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const STATUSES: ConvoStatus[] = ['todo', 'working', 'done'];

function fail<T>(where: string, error: unknown): AdminResult<T> {
  console.error(`[admin] ${where} failed`, error);
  return { data: null, error: (error as { message?: string } | null)?.message || `${where} failed` };
}

const clean = (raw: unknown) => String(raw ?? '').trim().toLowerCase().slice(0, 320);

export interface SenderCalls {
  /** Lower-cased addresses marked "not spam". */
  trusted: string[];
  /** Conversation status by lower-cased address. */
  marks: Record<string, SenderMark>;
}

export async function listSenders(): Promise<AdminResult<SenderCalls>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from('mail_senders')
    .select('email, trusted, status, status_at')
    .limit(5000);
  if (error) return fail('listSenders', error);

  const calls: SenderCalls = { trusted: [], marks: {} };
  for (const row of data ?? []) {
    const email = String(row.email).toLowerCase();
    if (row.trusted) calls.trusted.push(email);
    if (row.status && row.status_at && STATUSES.includes(row.status as ConvoStatus)) {
      calls.marks[email] = { status: row.status as ConvoStatus, at: String(row.status_at) };
    }
  }
  return { data: calls, error: null };
}

/** Mark a sender safe, or put them back. Setting it twice is harmless. */
export async function setSenderTrust(
  rawEmail: unknown,
  trusted: boolean,
  note?: unknown,
): Promise<AdminResult<'saved'>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const email = clean(rawEmail);
  if (!EMAIL.test(email)) return { data: null, error: "That doesn't look like an email address." };

  // Only the columns named here are written, so a status on the row survives.
  const { error } = await supabase.from('mail_senders').upsert(
    {
      email,
      trusted,
      note: note ? String(note).slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email' },
  );
  if (error) return fail('setSenderTrust', error);
  return { data: 'saved', error: null };
}

/** Where the conversation stands. Returns the mark so the page and the row agree on the time. */
export async function setSenderStatus(rawEmail: unknown, rawStatus: unknown): Promise<AdminResult<SenderMark>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const email = clean(rawEmail);
  if (!EMAIL.test(email)) return { data: null, error: "That doesn't look like an email address." };
  const status = String(rawStatus ?? '') as ConvoStatus;
  if (!STATUSES.includes(status)) return { data: null, error: 'Pick To do, In progress or Done.' };

  const at = new Date().toISOString();
  // `trusted` is left out on purpose: closing a conversation must not vouch
  // for the sender, and must not undo a "not spam" either.
  const { error } = await supabase
    .from('mail_senders')
    .upsert({ email, status, status_at: at, updated_at: at }, { onConflict: 'email' });
  if (error) return fail('setSenderStatus', error);
  return { data: { status, at }, error: null };
}

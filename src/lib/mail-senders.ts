// Senders the owner has judged by hand from the Inbox page: whether their mail
// is spam, and where the conversation with them stands.
//
// Both mail grants are read-only, so none of this touches the mailbox itself.
// "Not spam" remembers the address, so that message and everything the sender
// writes later stops being flagged here. A conversation status is stored with
// the time it was set, so a message that arrives after "done" reopens it.

import 'server-only';

import type { ConvoStatus, SenderMark } from './conversations';
import type { FileAs } from './filing';
import { getClient, NOT_CONFIGURED, type AdminResult } from './supabase-admin';

// Deliberately loose: this only decides what we are willing to store.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const STATUSES: ConvoStatus[] = ['todo', 'working', 'done'];
const CATEGORIES: FileAs[] = ['partnership', 'retainer', 'story', 'client', 'platform'];

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
  /** Lower-cased addresses the owner hid: never something to act on. */
  muted: string[];
  /** What each sender is filed as, by lower-cased address. */
  categories: Record<string, FileAs>;
}

export async function listSenders(): Promise<AdminResult<SenderCalls>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from('mail_senders')
    .select('email, trusted, muted, status, status_at, category')
    .limit(5000);
  if (error) return fail('listSenders', error);

  const calls: SenderCalls = { trusted: [], marks: {}, muted: [], categories: {} };
  for (const row of data ?? []) {
    const email = String(row.email).toLowerCase();
    if (row.trusted) calls.trusted.push(email);
    if (row.muted) calls.muted.push(email);
    if (row.category && CATEGORIES.includes(row.category as FileAs)) calls.categories[email] = row.category as FileAs;
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

/**
 * File a sender as a partnership lead, retainer lead, story, client or platform,
 * or clear the filing with null. Filing someone also brings them back from Not
 * business: choosing what they are is a decision that they matter.
 */
export async function setSenderCategory(rawEmail: unknown, rawCategory: unknown): Promise<AdminResult<FileAs | null>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const email = clean(rawEmail);
  if (!EMAIL.test(email)) return { data: null, error: "That doesn't look like an email address." };
  const category = rawCategory === null || rawCategory === '' ? null : (String(rawCategory) as FileAs);
  if (category !== null && !CATEGORIES.includes(category)) return { data: null, error: 'Pick one of the listed kinds.' };

  const at = new Date().toISOString();
  const row: Record<string, unknown> = { email, category, category_at: category ? at : null, updated_at: at };
  if (category) row.muted = false;
  const { error } = await supabase.from('mail_senders').upsert(row, { onConflict: 'email' });
  if (error) return fail('setSenderCategory', error);
  return { data: category, error: null };
}

/** Hide a sender from the Inbox for good (a newsletter, a product update), or bring them back. */
export async function setSenderMuted(rawEmail: unknown, muted: boolean): Promise<AdminResult<'saved'>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const email = clean(rawEmail);
  if (!EMAIL.test(email)) return { data: null, error: "That doesn't look like an email address." };

  const { error } = await supabase
    .from('mail_senders')
    .upsert({ email, muted, updated_at: new Date().toISOString() }, { onConflict: 'email' });
  if (error) return fail('setSenderMuted', error);
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

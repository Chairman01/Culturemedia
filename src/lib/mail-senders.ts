// Senders the owner has judged by hand from the Inbox page.
//
// Both mail grants are read-only, so "Not spam" cannot move anything in the
// mailbox itself. What it does is remember the address: that message, and
// everything the same sender writes later, stops being flagged here. Undoing it
// ("Back to spam") keeps the row but puts the warning back.

import 'server-only';

import { getClient, NOT_CONFIGURED, type AdminResult } from './supabase-admin';

// Deliberately loose: this only decides what we are willing to store.
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function fail<T>(where: string, error: unknown): AdminResult<T> {
  console.error(`[admin] ${where} failed`, error);
  return { data: null, error: (error as { message?: string } | null)?.message || `${where} failed` };
}

/** Lower-cased addresses the owner has marked "not spam". */
export async function listTrustedSenders(): Promise<AdminResult<string[]>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from('mail_senders')
    .select('email')
    .eq('trusted', true)
    .limit(5000);
  if (error) return fail('listTrustedSenders', error);
  return { data: (data ?? []).map((row) => String(row.email).toLowerCase()), error: null };
}

/** Mark a sender safe, or put them back. Setting it twice is harmless. */
export async function setSenderTrust(
  rawEmail: unknown,
  trusted: boolean,
  note?: unknown,
): Promise<AdminResult<'saved'>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const email = String(rawEmail ?? '').trim().toLowerCase().slice(0, 320);
  if (!EMAIL.test(email)) return { data: null, error: "That doesn't look like an email address." };

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

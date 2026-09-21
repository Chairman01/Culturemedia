// The whole of one email, fetched when the owner asks to read it.
//
// The Inbox only ever holds the first few hundred characters of each message.
// This goes back to the mailbox for the rest of a single message — read-only,
// like everything else — and hands it over as plain text (see mail-text.ts for
// why it is never HTML).

import 'server-only';

import { readGmailBody } from './gmail-imap';
import { htmlToText, tidy } from './mail-text';
import { zohoSession } from './zoho-mail';

export interface MailBody {
  text: string;
  /** The message was longer than is comfortable to show; the rest is in the mailbox. */
  cut: boolean;
}

const ZOHO_ID = /^zoho:(?:search:)?(\d{5,40})$/;
const GMAIL_ID = /^gmail:(?:search:)?(inbox|spam|sent):(\d{1,12})$/;

async function readZohoBody(id: string, folderId: string | null): Promise<MailBody | { error: string }> {
  const match = ZOHO_ID.exec(id);
  if (!match) return { error: 'That is not a Zoho email.' };
  const session = await zohoSession();
  if (!session) return { error: 'Zoho Mail is not connected.' };

  // An older saved check may not carry the folder; the Inbox folder is the fallback.
  let folder = folderId;
  if (!folder) {
    const res = await fetch(`${session.api}/folders`, { headers: session.headers, cache: 'no-store' });
    const list = res.ok ? (((await res.json()).data || []) as Array<{ folderId?: string; folderType?: string }>) : [];
    folder = String(list.find((f) => String(f.folderType).toLowerCase() === 'inbox')?.folderId || '');
    if (!folder) return { error: 'Could not tell which Zoho folder that email is in. Press Check mail now, then try again.' };
  }

  const res = await fetch(`${session.api}/folders/${folder}/messages/${match[1]}/content`, {
    headers: session.headers,
    cache: 'no-store',
  });
  if (!res.ok) return { error: `Zoho would not hand over that email (it answered ${res.status}). It may have been moved or deleted.` };
  const content = String(((await res.json()).data || {}).content || '');
  return tidy(htmlToText(content));
}

export async function readBody(input: Record<string, unknown>): Promise<MailBody | { error: string }> {
  const id = String(input.id ?? '');
  const folderId = /^\d{1,40}$/.test(String(input.folderId ?? '')) ? String(input.folderId) : null;
  try {
    if (ZOHO_ID.test(id)) return await readZohoBody(id, folderId);
    const gmail = GMAIL_ID.exec(id);
    if (gmail) return await readGmailBody(gmail[1] as 'inbox' | 'spam' | 'sent', Number(gmail[2]), id.startsWith('gmail:search:'));
    return { error: 'That email cannot be opened here.' };
  } catch (err) {
    console.error('[admin] readBody failed', err);
    return { error: 'Could not reach the mailbox. Try again in a minute.' };
  }
}

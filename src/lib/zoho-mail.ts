// Read-only view of the Zoho mailbox: Inbox, Spam, Sent, and every other folder
// mail can land in. Zoho files a lot by itself ("Newsletter", "Notification")
// and owners make their own folders; mail there never reaches the Inbox, so
// reading the Inbox alone quietly misses it.
//
// The site's Zoho grant is read-only, so this can list what arrived and nothing
// more: it cannot send, reply, delete or mark as read. Sending stays with the
// Culture Alberta engine's Approve & send.
//
// Zoho wants numeric folder ids, which come from the folders endpoint and need
// the ZohoMail.folders.READ scope. A connection made before that scope was
// requested still works — it just reads the Inbox only and says so.

import 'server-only';

import { loadTokens, saveTokens } from '@/app/api/zoho/callback/route';

import type { Folder, MailMessage } from './mail';

export interface FolderCheck {
  /** The folder's name as the mailbox shows it. */
  name: string;
  count: number;
  /** ISO time of the oldest message read: mail older than this is not on the page. */
  since: string | null;
}

/** Oldest `at` among messages, for a FolderCheck. */
export function oldestOf(messages: MailMessage[]): string | null {
  let oldest: string | null = null;
  for (const m of messages) if (m.at && (!oldest || m.at < oldest)) oldest = m.at;
  return oldest;
}

export interface MailboxResult {
  mailbox: 'zoho' | 'gmail';
  /** The address, for display. */
  label: string;
  connected: boolean;
  /** Why it is not connected, or what is missing, in plain words. */
  note: string | null;
  /** Folders that were actually read. */
  folders: Folder[];
  /** What was read, folder by folder, so the owner can see the coverage. */
  checked: FolderCheck[];
  messages: MailMessage[];
}

// Overridable so the sync can be exercised against a local stand-in; unset in
// production, where they are Zoho's real hosts.
const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || 'https://accounts.zoho.com';
const MAIL_HOST = process.env.ZOHO_MAIL_HOST || 'https://mail.zoho.com';

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch(`${ACCOUNTS_HOST}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
      cache: 'no-store',
    });
    const data = await res.json();
    return res.ok && data.access_token ? (data.access_token as string) : null;
  } catch {
    return null;
  }
}

// Same two modes as /api/zoho/mail: the env refresh token on Vercel, the
// .zoho-tokens.json file in local development.
async function accessToken(): Promise<string | null> {
  const envRefresh = process.env.ZOHO_REFRESH_TOKEN;
  if (envRefresh) return refreshAccessToken(envRefresh);

  const tokens = loadTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expires_at - 5 * 60 * 1000) return tokens.access_token;
  if (!tokens.refresh_token) return null;
  const fresh = await refreshAccessToken(tokens.refresh_token);
  if (!fresh) return null;
  saveTokens({ ...tokens, access_token: fresh, expires_at: Date.now() + 55 * 60 * 1000 });
  return fresh;
}

const unescape = (raw: unknown) =>
  String(raw ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

/** "Dana Reid <dana@x.ca>" → name + lower-cased address. */
export function parseAddress(raw: unknown): { name: string; address: string } {
  const text = unescape(raw).trim();
  const match = /^(.*)<([^>]+)>\s*$/.exec(text);
  if (match) return { name: match[1].replace(/"/g, '').trim(), address: match[2].toLowerCase().trim() };
  return { name: '', address: text.toLowerCase() };
}

function parseAddressList(raw: unknown): string[] {
  return unescape(raw)
    .split(/[,;]/)
    .map((part) => parseAddress(part).address)
    .filter((a) => a.includes('@'));
}

/** Zoho sends epoch milliseconds as a string; tolerate an ISO date too. */
function toIso(value: unknown): string {
  const text = String(value ?? '');
  const date = /^\d+$/.test(text) ? new Date(Number(text)) : new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

type RawMessage = {
  messageId?: string;
  fromAddress?: string;
  sender?: string;
  toAddress?: string;
  subject?: string;
  summary?: string;
  receivedTime?: string;
  sentDateInGMT?: string;
  status?: string;
};

const FOLDER_TYPES: Record<string, Folder> = { inbox: 'inbox', spam: 'spam', sent: 'sent' };
// Never incoming mail worth reading.
const SKIP_FOLDERS = /^(drafts?|trash|templates?|outbox|snoozed|scheduled|archive)$/i;
// Enough extra folders for any real mailbox, few enough to stay quick.
const MAX_OTHER_FOLDERS = 10;

export async function readZoho(limit = 100): Promise<MailboxResult> {
  const base: MailboxResult = {
    mailbox: 'zoho',
    label: 'Zoho Mail',
    connected: false,
    note: null,
    folders: [],
    checked: [],
    messages: [],
  };

  const token = await accessToken();
  if (!token) return { ...base, note: 'Zoho Mail is not connected.' };
  const headers = { Authorization: `Zoho-oauthtoken ${token}` };

  try {
    const accountsRes = await fetch(`${MAIL_HOST}/api/accounts`, { headers, cache: 'no-store' });
    if (!accountsRes.ok) return { ...base, note: 'Zoho refused the connection. Reconnect it.' };
    const accounts: Array<{ accountId: string; primaryEmailAddress?: string; mailboxAddress?: string }> =
      (await accountsRes.json()).data || [];
    if (!accounts.length) return { ...base, connected: true, note: 'Zoho has no mail account on this login.' };
    const account = accounts[0];
    const label = account.primaryEmailAddress || account.mailboxAddress || 'Zoho Mail';
    const api = `${MAIL_HOST}/api/accounts/${account.accountId}`;

    // Folder ids. Without the folders scope this call is refused and we fall
    // back to the default view, which is the Inbox.
    const wanted = new Map<Folder, string | null>();
    // Everything else mail can land in: read as incoming, labelled with its name.
    const others: { id: string; name: string }[] = [];
    const foldersRes = await fetch(`${api}/folders`, { headers, cache: 'no-store' });
    if (foldersRes.ok) {
      const folders: Array<{ folderId?: string; folderType?: string; folderName?: string }> =
        (await foldersRes.json()).data || [];
      for (const f of folders) {
        const kind = FOLDER_TYPES[String(f.folderType || f.folderName || '').toLowerCase()];
        if (kind && f.folderId && !wanted.has(kind)) wanted.set(kind, String(f.folderId));
        else if (!kind && f.folderId && f.folderName && !SKIP_FOLDERS.test(f.folderName) && !SKIP_FOLDERS.test(String(f.folderType || ''))) {
          if (others.length < MAX_OTHER_FOLDERS) others.push({ id: String(f.folderId), name: f.folderName });
        }
      }
    }
    const limitedToInbox = !wanted.has('inbox');
    if (limitedToInbox) wanted.set('inbox', null);

    const messages: MailMessage[] = [];
    const read: Folder[] = [];
    const checked: FolderCheck[] = [];
    let firstError: string | null = null;

    const jobs: { folder: Folder; folderId: string | null; name: string; take: number }[] = [
      ...[...wanted.entries()].map(([folder, folderId]) => ({
        folder,
        folderId,
        name: folder[0].toUpperCase() + folder.slice(1),
        take: limit,
      })),
      ...others.map((o) => ({ folder: 'inbox' as Folder, folderId: o.id, name: o.name, take: Math.min(limit, 50) })),
    ];

    await Promise.all(
      jobs.map(async ({ folder, folderId, name, take }) => {
        const params = new URLSearchParams({
          limit: String(take),
          sortBy: 'date',
          sortorder: 'false',
          includeto: 'true',
        });
        if (folderId) params.set('folderId', folderId);
        const res = await fetch(`${api}/messages/view?${params}`, { headers, cache: 'no-store' });
        if (!res.ok) {
          firstError ??= `Zoho answered ${res.status} for the ${name} folder.`;
          return;
        }
        if (!read.includes(folder)) read.push(folder);
        const mine: MailMessage[] = [];
        const custom = !wanted.has(folder) || wanted.get(folder) !== folderId;
        for (const m of ((await res.json()).data || []) as RawMessage[]) {
          const from = parseAddress(m.fromAddress);
          mine.push({
            id: `zoho:${m.messageId ?? ''}`,
            mailbox: 'zoho',
            folder,
            fromName: from.name || unescape(m.sender),
            fromAddress: from.address,
            to: parseAddressList(m.toAddress),
            subject: unescape(m.subject) || '(no subject)',
            summary: unescape(m.summary),
            at: toIso(m.receivedTime ?? m.sentDateInGMT),
            unread: String(m.status) === '0',
            ...(custom ? { folderName: name } : {}),
          });
        }
        messages.push(...mine);
        checked.push({ name, count: mine.length, since: oldestOf(mine) });
      }),
    );
    // Inbox, Spam, Sent first, then the rest by name.
    const rank = (n: string) => ['Inbox', 'Spam', 'Sent'].indexOf(n);
    checked.sort((a, b) => (rank(a.name) < 0 ? 9 : rank(a.name)) - (rank(b.name) < 0 ? 9 : rank(b.name)) || a.name.localeCompare(b.name));

    if (!read.length) return { ...base, label, note: firstError || 'Zoho returned nothing.' };
    return {
      ...base,
      label,
      connected: true,
      folders: read,
      checked,
      messages,
      note: limitedToInbox
        ? 'Reading the Inbox only. Reconnect Zoho once to also check Spam and Sent.'
        : firstError,
    };
  } catch (err) {
    console.error('[admin] Zoho read failed', err);
    return { ...base, note: 'Could not reach Zoho Mail.' };
  }
}

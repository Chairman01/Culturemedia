// Read-only view of the Zoho inbox, for the admin Inbox page.
//
// The site's Zoho grant is ZohoMail.messages.READ + accounts.READ, so this can
// list what arrived and nothing more: it cannot send, reply, delete or mark as
// read. Sending stays with the Culture Alberta engine's Approve & send.

import 'server-only';

import { loadTokens, saveTokens } from '@/app/api/zoho/callback/route';

export interface InboxMessage {
  id: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  summary: string;
  /** ISO timestamp. */
  receivedAt: string;
  unread: boolean;
}

export type InboxResult =
  | { connected: true; messages: InboxMessage[] }
  | { connected: false; reason: string };

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
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

/** "Dana Reid <dana@x.ca>" → name + lower-cased address. */
function parseAddress(raw: string): { name: string; address: string } {
  const text = String(raw || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
  const match = /^(.*)<([^>]+)>\s*$/.exec(text);
  if (match) {
    return { name: match[1].replace(/"/g, '').trim(), address: match[2].toLowerCase().trim() };
  }
  return { name: '', address: text.toLowerCase().trim() };
}

/** Zoho sends epoch milliseconds as a string; tolerate an ISO date too. */
function toIso(value: unknown): string {
  const text = String(value ?? '');
  const date = /^\d+$/.test(text) ? new Date(Number(text)) : new Date(text);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export async function recentInbox(limit = 40): Promise<InboxResult> {
  const token = await accessToken();
  if (!token) return { connected: false, reason: 'Zoho Mail is not connected.' };

  try {
    const headers = { Authorization: `Zoho-oauthtoken ${token}` };
    const accountsRes = await fetch('https://mail.zoho.com/api/accounts', { headers, cache: 'no-store' });
    if (!accountsRes.ok) return { connected: false, reason: 'Zoho refused the connection. Reconnect it.' };
    const accounts: Array<{ accountId: string }> = (await accountsRes.json()).data || [];
    if (!accounts.length) return { connected: true, messages: [] };

    const res = await fetch(
      `https://mail.zoho.com/api/accounts/${accounts[0].accountId}/messages/view?folderId=inbox&limit=${limit}&sortBy=date&sortorder=false`,
      { headers, cache: 'no-store' },
    );
    if (!res.ok) return { connected: false, reason: `Zoho answered ${res.status} for the inbox.` };

    type Raw = {
      messageId?: string;
      fromAddress?: string;
      sender?: string;
      subject?: string;
      summary?: string;
      receivedTime?: string;
      sentDateInGMT?: string;
      status?: string;
    };
    const rows: Raw[] = (await res.json()).data || [];
    const messages = rows.map((m) => {
      const from = parseAddress(m.fromAddress || '');
      return {
        id: String(m.messageId ?? ''),
        fromName: from.name || String(m.sender ?? ''),
        fromAddress: from.address,
        subject: String(m.subject ?? '(no subject)'),
        summary: String(m.summary ?? ''),
        receivedAt: toIso(m.receivedTime ?? m.sentDateInGMT),
        unread: String(m.status) === '0',
      };
    });
    return { connected: true, messages };
  } catch (err) {
    console.error('[admin] Zoho inbox read failed', err);
    return { connected: false, reason: 'Could not reach Zoho Mail.' };
  }
}

/** Free-mail domains: a sender here is a person, not a company we can name. */
export const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.ca', 'hotmail.com', 'outlook.com', 'live.com',
  'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'aol.com', 'msn.com', 'shaw.ca', 'telus.net',
  'rogers.com', 'bell.net', 'videotron.ca',
]);

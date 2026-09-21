// Read-only view of the Gmail mailbox: Inbox, Spam and Sent.
//
// Gmail is read over IMAP with an app password (GMAIL_USER + GMAIL_APP_PASSWORD
// in Vercel). Every folder is opened read-only — IMAP EXAMINE, not SELECT — so
// nothing here can mark a message read, move it, delete it or send anything.
// Folders are found by their special-use flag (\Junk, \Sent), because Gmail
// names them differently in every language.

import 'server-only';

import { ImapFlow, type FetchMessageObject, type MessageStructureObject } from 'imapflow';

import type { Folder, MailMessage } from './mail';
import { decodeBody, htmlToText, tidy } from './mail-text';
import { oldestOf, type FolderCheck, type MailboxResult } from './zoho-mail';

const PREVIEW_BYTES = 1800;

/** The first text/plain part (or, failing that, text/html) and how it is encoded. */
function findTextPart(node: MessageStructureObject | undefined): { part: string; encoding: string; html: boolean } | null {
  if (!node) return null;
  const queue: MessageStructureObject[] = [node];
  let html: { part: string; encoding: string; html: boolean } | null = null;
  while (queue.length) {
    const n = queue.shift()!;
    if (n.childNodes?.length) queue.push(...n.childNodes);
    const type = (n.type || '').toLowerCase();
    if (n.disposition && n.disposition.toLowerCase() === 'attachment') continue;
    // A single-part message has no part number; IMAP calls its body "1".
    const part = n.part || '1';
    if (type === 'text/plain') return { part, encoding: (n.encoding || '').toLowerCase(), html: false };
    if (type === 'text/html' && !html) html = { part, encoding: (n.encoding || '').toLowerCase(), html: true };
  }
  return html;
}

/** Best-effort readable preview from the first bytes of a body part. */
export function previewOf(buffer: Buffer | undefined, encoding: string, html: boolean): string {
  if (!buffer?.length) return '';
  let text: string;
  if (encoding === 'base64') {
    // A truncated base64 run decodes cleanly only on a 4-character boundary.
    const clean = buffer.toString('ascii').replace(/[^A-Za-z0-9+/]/g, '');
    text = Buffer.from(clean.slice(0, clean.length - (clean.length % 4)), 'base64').toString('utf8');
  } else {
    text = buffer.toString('utf8');
    if (encoding === 'quoted-printable') {
      text = text
        .replace(/=\r?\n/g, '')
        .replace(/((?:=[0-9A-Fa-f]{2})+)/g, (run) => {
          const bytes = run.split('=').filter(Boolean).map((h) => parseInt(h, 16));
          return Buffer.from(bytes).toString('utf8');
        });
    }
  }
  if (html) {
    text = text
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/<[^>]*$/, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
      .replace(/&quot;|&ldquo;|&rdquo;/g, '"');
  }
  return text
    .replace(/�/g, '')
    .replace(/^>.*$/gm, ' ') // quoted earlier messages
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
}

/**
 * Gmail opens a conversation from its thread id in hex. `authuser` picks the
 * right account when several are signed in to the browser. Without a thread id,
 * a search for the message's own id finds exactly that email.
 */
function gmailLink(msg: FetchMessageObject): string | undefined {
  const account = encodeURIComponent(process.env.GMAIL_USER || '');
  const base = `https://mail.google.com/mail/?authuser=${account}`;
  try {
    if (msg.threadId) return `${base}#all/${BigInt(msg.threadId).toString(16)}`;
  } catch {
    /* not a number: fall through to the message-id search */
  }
  const id = (msg.envelope?.messageId || '').replace(/^<|>$/g, '');
  return id ? `${base}#search/${encodeURIComponent(`rfc822msgid:${id}`)}` : undefined;
}

function toMessage(msg: FetchMessageObject, folder: Folder, preview: string): MailMessage {
  const env = msg.envelope;
  const from = env?.from?.[0];
  const when = env?.date || msg.internalDate;
  const date = when ? new Date(when) : null;
  return {
    id: `gmail:${folder}:${msg.uid}`,
    link: gmailLink(msg),
    mailbox: 'gmail',
    folder,
    fromName: from?.name || '',
    fromAddress: (from?.address || '').toLowerCase(),
    to: [...(env?.to || []), ...(env?.cc || [])].map((a) => (a.address || '').toLowerCase()).filter(Boolean),
    subject: env?.subject || '(no subject)',
    summary: preview,
    at: date && !Number.isNaN(date.getTime()) ? date.toISOString() : '',
    unread: !msg.flags?.has('\\Seen'),
    // Gmail requires List-Unsubscribe of anyone sending in bulk, so its presence
    // is the most reliable sign that nobody typed this message to you.
    bulk: /^(list-unsubscribe|list-id):|^precedence:\s*(bulk|list|junk)/im.test(msg.headers ? msg.headers.toString('utf8') : ''),
  };
}

// Plenty for any email a person wrote; a cap so a huge newsletter cannot stall the page.
const FULL_BYTES = 400_000;

/**
 * The whole text of one Gmail message. `fromSearch` ids were numbered inside
 * All Mail, the others inside the folder they were read from. Opened read-only,
 * so reading it here does not mark it read in Gmail.
 */
export async function readGmailBody(
  folder: Folder,
  uid: number,
  fromSearch: boolean,
): Promise<{ text: string; cut: boolean } | { error: string }> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return { error: 'Gmail is not connected.' };

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, '') },
    logger: false,
    socketTimeout: 20000,
  });
  client.on('error', (err: unknown) => console.error('[admin] Gmail IMAP error', err));

  try {
    await client.connect();
    let path = 'INBOX';
    const wanted = folder === 'spam' ? '\\Junk' : folder === 'sent' ? '\\Sent' : fromSearch ? '\\All' : null;
    if (wanted) {
      const box = (await client.list()).find((b) => b.specialUse === wanted);
      if (!box) return { error: 'Could not find that folder in Gmail.' };
      path = box.path;
    }

    const lock = await client.getMailboxLock(path, { readOnly: true });
    try {
      const shape = await client.fetchOne(String(uid), { bodyStructure: true }, { uid: true });
      const part = shape ? findTextPart(shape.bodyStructure) : null;
      if (!part) return { error: 'That email has no text to show (it may be only an attachment or an image).' };
      const one = await client.fetchOne(String(uid), { bodyParts: [{ key: part.part, maxLength: FULL_BYTES }] }, { uid: true });
      const raw = decodeBody(one ? one.bodyParts?.get(part.part) : undefined, part.encoding);
      if (!raw) return { error: 'Gmail did not hand over that email. It may have been moved or deleted.' };
      return tidy(part.html ? htmlToText(raw) : raw);
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error('[admin] Gmail body read failed', err);
    return { error: 'Could not reach Gmail.' };
  } finally {
    try {
      await client.logout();
    } catch {
      /* already closed */
    }
  }
}

/**
 * Search the whole Gmail account — All Mail (which includes archived mail and
 * everything that skipped the inbox), then Spam — with Gmail's own search, so
 * "costco" or a person's name finds mail of any age. Read-only.
 */
export async function searchGmail(query: string, limit = 25): Promise<{ messages: MailMessage[]; note: string | null }> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return { messages: [], note: null };

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, '') },
    logger: false,
    socketTimeout: 20000,
  });
  client.on('error', (err: unknown) => console.error('[admin] Gmail IMAP error', err));

  try {
    await client.connect();
    let all = 'INBOX';
    let junk: string | null = null;
    for (const box of await client.list()) {
      if (box.specialUse === '\\All') all = box.path;
      if (box.specialUse === '\\Junk') junk = box.path;
    }
    const places: { path: string; folder: Folder; take: number }[] = [{ path: all, folder: 'inbox', take: limit }];
    if (junk) places.push({ path: junk, folder: 'spam', take: 10 });

    const messages: MailMessage[] = [];
    for (const place of places) {
      const lock = await client.getMailboxLock(place.path, { readOnly: true });
      try {
        const hits = (await client.search({ gmraw: query }, { uid: true })) || [];
        const newest = hits.slice(-place.take);
        if (!newest.length) continue;
        const found: FetchMessageObject[] = [];
        for await (const msg of client.fetch(
          newest.join(','),
          { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true, threadId: true, headers: ['list-unsubscribe', 'list-id', 'precedence'] },
          { uid: true },
        )) {
          found.push(msg);
        }
        for (const msg of found.reverse()) {
          // A preview costs a round trip each: the first fifteen are plenty to recognise a result.
          const part = messages.length < 15 ? findTextPart(msg.bodyStructure) : null;
          let preview = '';
          if (part) {
            const one = await client.fetchOne(String(msg.uid), { bodyParts: [{ key: part.part, maxLength: PREVIEW_BYTES }] }, { uid: true });
            const buffer = one ? one.bodyParts?.get(part.part) : undefined;
            preview = previewOf(buffer, part.encoding, part.html);
          }
          messages.push({ ...toMessage(msg, place.folder, preview), id: `gmail:search:${place.folder}:${msg.uid}` });
        }
      } finally {
        lock.release();
      }
    }
    return { messages, note: null };
  } catch (err) {
    console.error('[admin] Gmail search failed', err);
    return { messages: [], note: 'Could not search Gmail.' };
  } finally {
    try {
      await client.logout();
    } catch {
      /* already closed */
    }
  }
}

export async function readGmail(limit = 40): Promise<MailboxResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  const base: MailboxResult = {
    mailbox: 'gmail',
    label: user || 'Gmail',
    connected: false,
    note: null,
    folders: [],
    checked: [],
    messages: [],
  };
  if (!user || !pass) {
    return { ...base, note: 'Gmail is not connected yet. It needs GMAIL_USER and GMAIL_APP_PASSWORD in Vercel.' };
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    // Google shows app passwords in groups of four; the spaces are not part of it.
    auth: { user, pass: pass.replace(/\s+/g, '') },
    logger: false,
    socketTimeout: 20000,
  });
  // imapflow emits 'error' for socket trouble; without a listener Node would
  // treat it as fatal.
  client.on('error', (err: unknown) => console.error('[admin] Gmail IMAP error', err));

  try {
    await client.connect();

    const paths = new Map<Folder, string>([['inbox', 'INBOX']]);
    for (const box of await client.list()) {
      if (box.specialUse === '\\Junk') paths.set('spam', box.path);
      if (box.specialUse === '\\Sent') paths.set('sent', box.path);
    }

    const messages: MailMessage[] = [];
    const read: Folder[] = [];
    const checked: FolderCheck[] = [];

    for (const [folder, path] of paths) {
      const lock = await client.getMailboxLock(path, { readOnly: true });
      try {
        const total = typeof client.mailbox === 'object' && client.mailbox ? client.mailbox.exists : 0;
        read.push(folder);
        const name = folder[0].toUpperCase() + folder.slice(1);
        if (!total) {
          checked.push({ name, count: 0, since: null });
          continue;
        }
        // Each inbox message costs a second trip for its preview, so spam — rarely
        // more than a handful worth seeing — gets a shorter window.
        const take = folder === 'spam' ? Math.min(limit, 30) : limit;
        const range = `${Math.max(1, total - take + 1)}:*`;
        const before = messages.length;

        // Pass 1: headers and structure. Pass 2: the first bytes of each text part.
        const found: FetchMessageObject[] = [];
        for await (const msg of client.fetch(range, {
          uid: true,
          envelope: true,
          flags: true,
          internalDate: true,
          bodyStructure: true,
          threadId: true,
          headers: ['list-unsubscribe', 'list-id', 'precedence'],
        })) {
          found.push(msg);
        }
        for (const msg of found) {
          // Sent mail only needs its recipients and date; skip the extra trip.
          const part = folder === 'sent' ? null : findTextPart(msg.bodyStructure);
          let preview = '';
          if (part) {
            const one = await client.fetchOne(
              String(msg.uid),
              { bodyParts: [{ key: part.part, maxLength: PREVIEW_BYTES }] },
              { uid: true },
            );
            const buffer = one ? one.bodyParts?.get(part.part) : undefined;
            preview = previewOf(buffer, part.encoding, part.html);
          }
          messages.push(toMessage(msg, folder, preview));
        }
        const mine = messages.slice(before);
        checked.push({ name, count: mine.length, since: oldestOf(mine) });
      } finally {
        lock.release();
      }
    }

    const missing = (['spam', 'sent'] as Folder[]).filter((f) => !paths.has(f));
    return {
      ...base,
      connected: true,
      folders: read,
      checked,
      messages,
      note: missing.length ? `Gmail did not report a ${missing.join(' or ')} folder.` : null,
    };
  } catch (err) {
    console.error('[admin] Gmail read failed', err);
    const text = String((err as { responseText?: string; message?: string })?.responseText || (err as Error)?.message || '');
    const auth = /auth|credential|password|login/i.test(text);
    return {
      ...base,
      note: auth
        ? 'Gmail refused the sign-in. Check GMAIL_USER and make a fresh app password.'
        : 'Could not reach Gmail.',
    };
  } finally {
    try {
      await client.logout();
    } catch {
      /* already closed */
    }
  }
}

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
import type { MailboxResult } from './zoho-mail';

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

function toMessage(msg: FetchMessageObject, folder: Folder, preview: string): MailMessage {
  const env = msg.envelope;
  const from = env?.from?.[0];
  const when = env?.date || msg.internalDate;
  const date = when ? new Date(when) : null;
  return {
    id: `gmail:${folder}:${msg.uid}`,
    mailbox: 'gmail',
    folder,
    fromName: from?.name || '',
    fromAddress: (from?.address || '').toLowerCase(),
    to: [...(env?.to || []), ...(env?.cc || [])].map((a) => (a.address || '').toLowerCase()).filter(Boolean),
    subject: env?.subject || '(no subject)',
    summary: preview,
    at: date && !Number.isNaN(date.getTime()) ? date.toISOString() : '',
    unread: !msg.flags?.has('\\Seen'),
  };
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

    for (const [folder, path] of paths) {
      const lock = await client.getMailboxLock(path, { readOnly: true });
      try {
        const total = typeof client.mailbox === 'object' && client.mailbox ? client.mailbox.exists : 0;
        read.push(folder);
        if (!total) continue;
        const range = `${Math.max(1, total - limit + 1)}:*`;

        // Pass 1: headers and structure. Pass 2: the first bytes of each text part.
        const found: FetchMessageObject[] = [];
        for await (const msg of client.fetch(range, { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true })) {
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
      } finally {
        lock.release();
      }
    }

    const missing = (['spam', 'sent'] as Folder[]).filter((f) => !paths.has(f));
    return {
      ...base,
      connected: true,
      folders: read,
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

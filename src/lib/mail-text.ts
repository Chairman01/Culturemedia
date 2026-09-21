// Turning a raw email body into text that is safe to show.
//
// Email is untrusted input. It is never rendered as HTML in the admin: a message
// can carry scripts, and the invisible images in marketing mail report back the
// moment they load. Everything here ends as plain text, which React escapes.
// No imports, so both mailbox readers can use it.

/** Undo the transfer encoding of one MIME part. */
export function decodeBody(buffer: Buffer | undefined, encoding: string): string {
  if (!buffer?.length) return '';
  if (encoding === 'base64') {
    const clean = buffer.toString('ascii').replace(/[^A-Za-z0-9+/]/g, '');
    return Buffer.from(clean.slice(0, clean.length - (clean.length % 4)), 'base64').toString('utf8');
  }
  const text = buffer.toString('utf8');
  if (encoding !== 'quoted-printable') return text;
  return text.replace(/=\r?\n/g, '').replace(/((?:=[0-9A-Fa-f]{2})+)/g, (run) => {
    const bytes = run
      .split('=')
      .filter(Boolean)
      .map((h) => parseInt(h, 16));
    return Buffer.from(bytes).toString('utf8');
  });
}

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®', trade: '™',
};

// A number outside Unicode would throw; an email can contain anything.
const point = (n: number) => (Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');

/** HTML to readable text: paragraphs and line breaks kept, everything else dropped. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head|title|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|blockquote|table|section|article)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    // A link keeps its address when the text does not already show it.
    .replace(/<a\b[^>]*href=["']?(https?:[^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const text = label.replace(/<[^>]*>/g, '').trim();
      return !text || text.includes(href.slice(0, 24)) ? text || href : `${text} (${href})`;
    })
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, code: string) => point(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => point(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole);
}

const MAX_CHARS = 30_000;

/** Tidy whitespace without flattening the message, and keep it to a readable length. */
export function tidy(text: string): { text: string; cut: boolean } {
  const clean = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ​‌‍﻿]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return clean.length > MAX_CHARS ? { text: clean.slice(0, MAX_CHARS), cut: true } : { text: clean, cut: false };
}

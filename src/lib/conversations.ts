// Mail from one person, treated as one conversation with a state.
//
// Two things decide the state. The owner's own call (To do / In progress /
// Done), stored with the time it was made — and the Sent folder, which proves
// when the owner last wrote to that address. Between them the page can answer
// the only question that matters with many threads open: whose move is it?
//
//   - You replied after their last message      → in progress, waiting on them
//   - They wrote after your reply               → your turn
//   - They wrote after you marked it done       → it reopens by itself
//
// Pure functions, no server imports: the Inbox page runs this in the browser.

import { companyDomainOf } from './filing';
import type { Classified } from './mail';

export type ConvoStatus = 'todo' | 'working' | 'done';

export interface SenderMark {
  status: ConvoStatus;
  /** ISO time the owner made the call. */
  at: string;
}

export interface Conversation {
  /** The sender's address, lower-case. */
  key: string;
  latest: Classified;
  /** Older messages from the same sender in the current window. */
  earlier: number;
  /** Any of their messages asked about advertising — not only the newest. */
  asked: boolean;
  /** Any of their messages reads like a complaint, a legal notice or a demand. */
  urgent: boolean;
  state: ConvoStatus;
  /** Whose move it is, when the Sent folder can tell. */
  turn: 'yours' | 'theirs' | null;
  /** When you last emailed this address, if the Sent folder shows it. */
  repliedAt: string | null;
  /** They wrote again after you marked the conversation done. */
  reopened: boolean;
}

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);

/** `mail` is newest first, as the inbox delivers it. */
export function buildConversations(
  mail: Classified[],
  marks: Record<string, SenderMark>,
  repliedTo: Record<string, string>,
): Conversation[] {
  const bySender = new Map<string, Classified[]>();
  for (const m of mail) {
    const key = m.fromAddress.toLowerCase();
    const list = bySender.get(key);
    if (list) list.push(m);
    else bySender.set(key, [m]);
  }

  const out: Conversation[] = [];
  for (const [key, list] of bySender) {
    const latest = list[0];
    const mark = marks[key] || null;
    const repliedAt = repliedTo[key] || null;
    const theirs = ms(latest.at);
    const yours = ms(repliedAt);
    const marked = ms(mark?.at);

    const turn: Conversation['turn'] = !yours ? null : yours > theirs ? 'theirs' : 'yours';

    let state: ConvoStatus = 'todo';
    let reopened = false;
    if (mark?.status === 'done') {
      if (theirs > marked) reopened = true;
      else state = 'done';
    } else if (mark?.status === 'working') {
      state = 'working';
    } else if (yours && !(mark?.status === 'todo' && marked > yours)) {
      // No call from you, or a "to do" you made before replying: a reply on
      // file means the conversation is under way.
      state = 'working';
    }

    out.push({
      key,
      latest,
      earlier: list.length - 1,
      asked: list.some((m) => m.kind === 'inquiry'),
      urgent: list.some((m) => m.urgent),
      state,
      turn,
      repliedAt,
      reopened,
    });
  }
  return out;
}

// ─── threads ──────────────────────────────────────────────────────────────────

/**
 * "Re: [Spam] Fwd: For Immediate Release: X" → "for immediate release: x". Tags a
 * mail server adds in square brackets ([Spam], [External]) come off with the
 * reply and forward prefixes, or a chain splits the moment one reply is tagged.
 */
export function threadSubject(subject: string): string {
  return subject
    .replace(/^(\s*((re|fw|fwd|aw|sv|tr|rv|wg)(\s*\[\d+\])?\s*:|\[[^\]]{1,24}\]))+\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export interface Thread {
  key: string;
  /** Newest first. */
  messages: Classified[];
}

/**
 * One email chain, one row: the same subject once "Re:" and "Fwd:" are taken
 * off, with the same person — or anyone at the same company, so a colleague
 * joining the chain does not split it. An email without a real subject stands
 * alone rather than gathering every "(no subject)" together. `mail` is newest
 * first, and each thread keeps that order.
 */
export function groupThreads(mail: Classified[]): Thread[] {
  const byKey = new Map<string, Thread>();
  const out: Thread[] = [];
  for (const m of mail) {
    const subject = threadSubject(m.subject);
    const party = companyDomainOf(m.fromAddress) ?? m.fromAddress.toLowerCase();
    const key = !subject || subject === '(no subject)' ? `id:${m.id}` : `${party}|${subject}`;
    const thread = byKey.get(key);
    if (thread) thread.messages.push(m);
    else {
      const next = { key, messages: [m] };
      byKey.set(key, next);
      out.push(next);
    }
  }
  return out;
}

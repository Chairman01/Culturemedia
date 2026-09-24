'use client';

// All mail: every email the check found, newest first, nothing tucked away.
// Each sender can be filed — partnership lead, retainer lead, story for Culture
// Alberta, client, platform, or not business — and the piles along the top
// count and filter them. A lead in the CRM files itself; anything else shows
// what it looks like until the owner decides.

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { buildConversations, type Conversation, type ConvoStatus, type SenderMark } from '@/lib/conversations';
import type { LeadRow } from '@/lib/crm';
import { FILE_AS, FILE_LABEL, fileOf, type FileAs, type Filing, type Pile } from '@/lib/filing';
import type { Classified } from '@/lib/mail';
import { day } from '../_components/format';

export type FileChoice = FileAs | 'notbusiness' | '';

const PAGE = 50;

const PILES: { k: Pile | 'all'; label: string; help: string }[] = [
  { k: 'all', label: 'All', help: 'Every email except senders marked not business.' },
  { k: 'unfiled', label: 'Not filed yet', help: 'From people, not filed yet. Work through these once and the piles take care of themselves.' },
  ...FILE_AS.map((f) => ({ k: f.k as Pile, label: f.plural, help: f.help })),
  { k: 'automated', label: 'Automated', help: 'Notifications, receipts and newsletters nobody typed to you.' },
  { k: 'notbusiness', label: 'Not business', help: 'Senders you marked not business.' },
];

const STATE_LABEL: Record<ConvoStatus, string> = { todo: 'To do', working: 'In progress', done: 'Done' };

// Filing a lead as one of these opens the add-a-lead form with the deal type set.
const DEAL_FOR: Partial<Record<FileAs, string>> = { partnership: 'one_time', retainer: 'retainer' };

export function AllMail({
  mail,
  leads,
  categories,
  muted,
  marks,
  repliedTo,
  needle,
  busy,
  boxName,
  webmail,
  onRead,
  onFile,
  onStatus,
  onAdd,
}: {
  /** Received mail, already narrowed to the chosen mailbox, newest first. */
  mail: Classified[];
  leads: LeadRow[];
  categories: Record<string, FileAs>;
  muted: string[];
  marks: Record<string, SenderMark>;
  repliedTo: Record<string, string>;
  /** The find box, lower-cased; empty when under two letters. */
  needle: string;
  /** Address with a save in flight. */
  busy: string | null;
  boxName: Record<string, string>;
  webmail: Record<string, string>;
  onRead: (m: Classified) => void;
  onFile: (m: Classified, choice: FileChoice) => void;
  onStatus: (c: Conversation, status: ConvoStatus) => void;
  onAdd: (m: Classified, dealType?: string) => void;
}) {
  const [pile, setPile] = useState<Pile | 'all'>('all');
  const [limit, setLimit] = useState(PAGE);

  const filed = useMemo(() => {
    const ctx = { categories, muted: new Set(muted), leads: new Map(leads.map((l) => [l.id, l])) };
    return new Map<string, Filing>(mail.map((m) => [m.id, fileOf(m, ctx)]));
  }, [mail, categories, muted, leads]);

  // Where each conversation stands, for anyone who is a person.
  const convoOf = useMemo(() => {
    const convos = buildConversations(
      mail.filter((m) => m.kind !== 'noise' && m.kind !== 'bounce'),
      marks,
      repliedTo,
    );
    return new Map(convos.map((c) => [c.key, c]));
  }, [mail, marks, repliedTo]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const f of filed.values()) {
      c[f.pile] = (c[f.pile] || 0) + 1;
      if (f.pile !== 'notbusiness') c.all += 1;
    }
    return c;
  }, [filed]);

  const matches = (m: Classified) =>
    !needle || `${m.fromName} ${m.fromAddress} ${m.subject} ${m.summary}`.toLowerCase().includes(needle);
  const list = mail.filter((m) => {
    const f = filed.get(m.id);
    if (!f) return false;
    if (pile === 'all' ? f.pile === 'notbusiness' : f.pile !== pile) return false;
    return matches(m);
  });
  const shown = list.slice(0, limit);
  const current = PILES.find((p) => p.k === pile);

  return (
    <section className="card" aria-labelledby="all-h" style={{ marginBottom: 12 }}>
      <h2 id="all-h">
        All mail <small>{mail.length} received · newest first</small>
      </h2>
      <p className="cnote" style={{ margin: '0 0 10px' }}>
        Every email the last check found, from both mailboxes, spam included — nothing is hidden here. File a
        sender once and all their mail follows: that is how the piles fill. Click any email to read it.
      </p>

      <div className="ctabs piles" role="group" aria-label="Which pile to show">
        {PILES.filter((p) => p.k === 'all' || counts[p.k]).map((p) => (
          <button
            key={p.k}
            type="button"
            aria-pressed={pile === p.k}
            title={p.help}
            onClick={() => {
              setPile(p.k);
              setLimit(PAGE);
            }}
          >
            {p.label} <b>{counts[p.k] || 0}</b>
          </button>
        ))}
      </div>
      {current && pile !== 'all' && <p className="cnote" style={{ margin: '0 0 4px' }}>{current.help}</p>}

      {shown.length ? (
        <div className="alist">
          {shown.map((m) => {
            const f = filed.get(m.id) as Filing;
            const key = m.fromAddress.toLowerCase();
            const c = convoOf.get(key);
            const saving = busy === key;
            const value: FileChoice = f.filed ?? (f.pile === 'notbusiness' ? 'notbusiness' : '');
            const deal = DEAL_FOR[(f.filed ?? f.suggested) as FileAs];
            return (
              <article key={m.id} className={`arow${m.unread ? ' unread' : ''}${f.pile === 'notbusiness' ? ' dim' : ''}`}>
                <div className="a-top">
                  <span className="a-who">{m.fromName || m.fromAddress}</span>
                  <span className={`src ${m.mailbox}`}>{boxName[m.mailbox]}</span>
                  {f.filed && (
                    <span className={`chip file ${f.filed}`}>
                      {FILE_LABEL[f.filed]}
                      {f.fromLead ? ' · in Leads' : ''}
                    </span>
                  )}
                  {!f.filed && f.suggested && <span className="chip hint">Looks like: {FILE_LABEL[f.suggested]}</span>}
                  {m.urgent && <span className="chip crit">Complaint or legal · answer it</span>}
                  {m.kind === 'money' && <span className="chip ok">Payment</span>}
                  {m.kind === 'bounce' && <span className="chip crit">Bounced</span>}
                  {f.pile === 'automated' && <span className="chip none">Automated</span>}
                  {m.folder === 'spam' && <span className="chip warn">Found in spam</span>}
                  {m.folderName && <span className="chip none">In “{m.folderName}”</span>}
                  <span className="a-when">{day(m.at)}</span>
                </div>
                {m.fromName && m.fromName.toLowerCase() !== key && <span className="a-addr">{m.fromAddress}</span>}
                <button type="button" className="a-body" onClick={() => onRead(m)} title="Read the whole email">
                  <b>{m.subject || '(no subject)'}</b>
                  {m.summary && <span>{m.summary}</span>}
                </button>
                <div className="a-acts">
                  <select
                    className="fileas"
                    aria-label={`File ${m.fromName || m.fromAddress} as`}
                    value={value}
                    disabled={saving}
                    onChange={(e) => onFile(m, e.target.value as FileChoice)}
                  >
                    <option value="">{saving ? 'Saving…' : 'File as…'}</option>
                    {FILE_AS.map((o) => (
                      <option key={o.k} value={o.k}>
                        {o.label}
                        {!f.filed && f.suggested === o.k ? ' (suggested)' : ''}
                      </option>
                    ))}
                    <option value="notbusiness">Not business</option>
                  </select>
                  {c && (
                    <span className="seg state" role="group" aria-label="Where this conversation stands">
                      {(['todo', 'working', 'done'] as const).map((s) => (
                        <button key={s} type="button" aria-pressed={c.state === s} disabled={saving} onClick={() => onStatus(c, s)}>
                          {STATE_LABEL[s]}
                        </button>
                      ))}
                    </span>
                  )}
                  {m.leadId ? (
                    <Link className="btn ghost" href={`/admin/leads/${m.leadId}`}>
                      Open lead
                    </Link>
                  ) : deal ? (
                    <button type="button" className="btn" onClick={() => onAdd(m, deal)}>
                      Add as lead
                    </button>
                  ) : null}
                  <a className="btn ghost" href={m.link || webmail[m.mailbox]} target="_blank" rel="noopener noreferrer">
                    Open in {boxName[m.mailbox]}
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-note">
          {needle ? 'Nothing in this pile matches your search.' : 'Nothing in this pile.'}
        </p>
      )}

      {list.length > shown.length && (
        <p className="acts-row" style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, list.length - shown.length)} more · {list.length - shown.length} left
          </button>
          <button type="button" onClick={() => setLimit(list.length)}>
            Show all {list.length}
          </button>
        </p>
      )}
    </section>
  );
}

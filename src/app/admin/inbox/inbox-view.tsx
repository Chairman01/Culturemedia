'use client';

// The Inbox: everyone waiting on you, in the order to deal with them.
//   1. Leads who wrote back            — answer these first
//   2. Emails drafted for approval     — then send today's outreach
//   3. Conversations                   — one row per person who wrote, sales or not:
//                                         to do, in progress, done
//   4. Worth a look                    — payments, bounces, "please remove me"
//   5. Everything else                 — collapsed; spam is included so nothing hides
// The page keeps its last check for the browser session: coming back to it
// shows that check at once, and the mailboxes are only read again when you
// press Check mail now (or the check is over an hour old).
// Opening the page checks both mailboxes (Zoho and Gmail: inbox, spam, sent)
// and records what they prove. It never sends, deletes, moves or marks mail —
// including "Not spam", which is remembered here rather than in the mailbox.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { buildConversations, type Conversation, type ConvoStatus } from '@/lib/conversations';
import type { FileAs } from '@/lib/filing';
import { PARTNERSHIPS_URL, SEQUENCE_LABEL, STAGE_LABEL, awaitingReply } from '@/lib/crm';
import type { InboxData } from '@/lib/inbox';
import { INBOX_FRESH_MS, readSavedCheck, saveCheck } from '@/lib/inbox-cache';
import type { Classified } from '@/lib/mail';
import { PREFILL_KEY, type LeadPrefill } from '../_components/add-lead';
import { Detail } from '../_components/detail';
import { AllMail, type FileChoice } from './all-mail';
import { day } from '../_components/format';
import { AdminShell, PageHead } from '../_components/shell';
import { Banner } from '../_components/ui';

const WEBMAIL: Record<string, string> = {
  zoho: 'https://mail.zoho.com/',
  gmail: 'https://mail.google.com/',
};
const BOX_NAME: Record<string, string> = { zoho: 'Zoho', gmail: 'Gmail' };
const VIEW_KEY = 'cm-admin-inbox-view';

// Every row can open its email, wherever on the page the row is drawn.
const ReadContext = createContext<((m: Classified) => void) | null>(null);

const clock = (at: number) =>
  new Date(at).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Edmonton' });

export default function InboxView({ initial }: { initial: InboxData }) {
  const [data, setData] = useState<InboxData>(initial);
  const [syncing, setSyncing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [problem, setProblem] = useState('');
  const [stopping, setStopping] = useState<string | null>(null);
  const [trusting, setTrusting] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [muting, setMuting] = useState<string | null>(null);
  const [box, setBox] = useState<'all' | 'zoho' | 'gmail'>('all');
  const [find, setFind] = useState('');
  // All mail is where the page opens: nothing is hidden there. The choice is
  // remembered per browser; a link to #approve always lands on Needs you.
  const [view, setViewState] = useState<'needs' | 'all' | 'board'>('all');
  const setView = (v: 'needs' | 'all' | 'board') => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* not remembered: fine */
    }
  };
  const [filing, setFiling] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState('');
  const lastCheck = useRef(0);
  // A search of the whole mailbox, not just what this page holds.
  const [deep, setDeep] = useState<{ q: string; results: Classified[]; notes: string[] } | null>(null);
  const [searching, setSearching] = useState(false);
  // The email being read in full: its text arrives a moment after the panel opens.
  const [reading, setReading] = useState<{ m: Classified; text: string | null; cut: boolean; error: string } | null>(null);

  const readEmail = useCallback(async (m: Classified) => {
    setReading({ m, text: null, cut: false, error: '' });
    try {
      const res = await fetch('/api/admin/inbox/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, folderId: m.folderId }),
      });
      const body = await res.json().catch(() => ({}));
      // Only fill the panel that is still open on this email.
      setReading((now) =>
        now && now.m.id === m.id
          ? res.ok && body.data
            ? { m, text: String(body.data.text || ''), cut: Boolean(body.data.cut), error: '' }
            : { m, text: null, cut: false, error: body.error || "Couldn't fetch that email." }
          : now,
      );
    } catch {
      setReading((now) => (now && now.m.id === m.id ? { m, text: null, cut: false, error: "Couldn't reach the server." } : now));
    }
  }, []);
  const [tab, setTab] = useState<ConvoStatus>('todo');
  const started = useRef(false);
  const router = useRouter();

  const sync = useCallback(async () => {
    setSyncing(true);
    setProblem('');
    try {
      const res = await fetch('/api/admin/inbox/sync', { method: 'POST', cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.data) {
        setProblem(
          res.status === 401
            ? 'Your sign-in expired. Reload the page to sign in again.'
            : "Couldn't check your mailboxes. Try again in a minute.",
        );
        return;
      }
      setData(body.data as InboxData);
      setChecked(true);
      lastCheck.current = Date.now();
      setCheckedAt(clock(lastCheck.current));
    } catch {
      setProblem("Couldn't reach the server.");
    } finally {
      setSyncing(false);
    }
  }, []);

  // Opening the page shows the last check. The mailboxes are read again only
  // when there is no check yet, or it is over an hour old — or you ask.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // A check saved by an earlier release is ignored (see inbox-cache.ts), so an
    // update to the admin never leaves old rows on screen.
    const saved = readSavedCheck<InboxData>();
    if (saved?.data.mailboxes?.length && Array.isArray(saved.data.leads)) {
      lastCheck.current = saved.at;
      setData(saved.data);
      setChecked(true);
      setCheckedAt(clock(saved.at));
      if (Date.now() - saved.at < INBOX_FRESH_MS) return;
    }
    void sync();
  }, [sync]);

  useEffect(() => {
    let next: 'needs' | 'all' | 'board' | null = null;
    if (window.location.hash === '#approve') next = 'needs';
    else {
      try {
        const saved = localStorage.getItem(VIEW_KEY);
        if (saved === 'needs' || saved === 'all' || saved === 'board') next = saved;
      } catch {
        /* default view */
      }
    }
    // Deferred so the first render matches the server's, then switches.
    if (next) {
      const v = next;
      queueMicrotask(() => setViewState(v));
    }
  }, []);

  // Keep the saved check in step with what you do here (Done, Not spam, Not business).
  useEffect(() => {
    if (!checked || !lastCheck.current) return;
    saveCheck({ ...data, report: null }, lastCheck.current);
  }, [data, checked]);

  const searchEverywhere = async () => {
    const q = find.trim();
    if (q.length < 2 || searching) return;
    setSearching(true);
    setProblem('');
    try {
      const res = await fetch('/api/admin/inbox/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.data) {
        setProblem(body.error || "Couldn't search the mailboxes. Try again in a minute.");
        return;
      }
      setDeep({ q, results: body.data.results as Classified[], notes: body.data.notes as string[] });
    } catch {
      setProblem("Couldn't reach the server.");
    } finally {
      setSearching(false);
    }
  };

  // Hand the sender to the add-a-lead form without putting them in a URL.
  const addAsLead = (m: Classified, dealType?: string) => {
    const prefill: LeadPrefill = {
      ...(dealType ? { deal_type: dealType } : {}),
      company: m.companyGuess,
      contact_name: m.fromName,
      email: m.fromAddress,
      consent_basis: 'implied_inquiry',
      sequence_key: '',
      notes: `Wrote in on ${day(m.at)} (${BOX_NAME[m.mailbox]}${m.folder === 'spam' ? ', found in spam' : ''}): “${m.subject}”`,
    };
    try {
      sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
    } catch {
      /* the form just opens empty */
    }
    router.push('/admin/leads?add=1');
  };

  const stopEmailing = async (m: Classified) => {
    if (!m.leadId || stopping) return;
    setStopping(m.leadId);
    try {
      const res = await fetch(`/api/admin/leads/${m.leadId}/unsubscribe`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setProblem(body.error || "Couldn't update that lead.");
        return;
      }
      await sync();
    } finally {
      setStopping(null);
    }
  };

  // Vouching for a sender only changes what this page shows: the mail grants are
  // read-only, so the message stays exactly where it is in Zoho or Gmail.
  const isTrusted = (m: Classified) => data.trusted.includes(m.fromAddress.toLowerCase());

  const trustSender = async (m: Classified, trust: boolean) => {
    if (trusting) return;
    setTrusting(m.id);
    setProblem('');
    try {
      const res = await fetch('/api/admin/inbox/trust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: m.fromAddress, trusted: trust }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setProblem(body.error || "Couldn't save that.");
        return;
      }
      const address = m.fromAddress.toLowerCase();
      setData((d) => ({
        ...d,
        trusted: trust ? [...d.trusted, address] : d.trusted.filter((e) => e !== address),
      }));
    } catch {
      setProblem("Couldn't reach the server.");
    } finally {
      setTrusting(null);
    }
  };

  // A hidden sender is never something to do: a newsletter, a product update.
  // Unlike Done, it stays quiet when they write again. Never applied to a lead.
  const isMuted = (m: Classified) => data.muted.includes(m.fromAddress.toLowerCase());
  const hidden = (m: Classified) => isMuted(m) && !m.leadId;

  // File a sender (partnership lead, story…), mark them not business, or clear it.
  const fileSender = async (m: Classified, choice: FileChoice) => {
    const address = m.fromAddress.toLowerCase();
    if (choice === 'notbusiness') return muteAddress(address, true, m.id);
    if (filing) return;
    const wasMuted = data.muted.includes(address);
    // Clearing an unfiled, not-business sender just brings them back.
    if (choice === '' && wasMuted && !data.categories[address]) return muteAddress(address, false, m.id);
    setFiling(address);
    setProblem('');
    try {
      const res = await fetch('/api/admin/inbox/category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address, category: choice || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblem(body.error || "Couldn't file that.");
        return;
      }
      setData((d) => {
        const categories = { ...d.categories };
        if (choice) categories[address] = choice as FileAs;
        else delete categories[address];
        // Filing someone brings them back from Not business (the server does the same).
        return { ...d, categories, muted: choice ? d.muted.filter((e) => e !== address) : d.muted };
      });
    } catch {
      setProblem("Couldn't reach the server.");
    } finally {
      setFiling(null);
    }
  };

  const muteSender = (m: Classified, mute: boolean) => muteAddress(m.fromAddress, mute, m.id);

  const muteAddress = async (rawAddress: string, mute: boolean, busyKey: string) => {
    const m = { fromAddress: rawAddress };
    if (muting) return;
    setMuting(busyKey);
    setProblem('');
    try {
      const res = await fetch('/api/admin/inbox/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: m.fromAddress, muted: mute }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setProblem(body.error || "Couldn't save that.");
        return;
      }
      const address = m.fromAddress.toLowerCase();
      setData((d) => ({
        ...d,
        muted: mute ? [...d.muted, address] : d.muted.filter((e) => e !== address),
      }));
    } catch {
      setProblem("Couldn't reach the server.");
    } finally {
      setMuting(null);
    }
  };

  // Where a conversation stands is kept on our side, with the time you said so:
  // a message that arrives after "done" brings the conversation back by itself.
  const setStatus = async (c: Conversation, status: ConvoStatus) => {
    if (marking || (c.state === status && !c.reopened)) return;
    setMarking(c.key);
    setProblem('');
    try {
      const res = await fetch('/api/admin/inbox/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: c.key, status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.data) {
        setProblem(body.error || "Couldn't save that.");
        return;
      }
      setData((d) => ({ ...d, marks: { ...d.marks, [c.key]: body.data } }));
    } catch {
      setProblem("Couldn't reach the server.");
    } finally {
      setMarking(null);
    }
  };

  // One mailbox at a time, when asked. Replies from leads stay whole: they are
  // matched to the lead, whichever mailbox they arrived in.
  const mail = box === 'all' ? data.mail : data.mail.filter((m) => m.mailbox === box);
  const needle = find.trim().toLowerCase();
  const found =
    needle.length < 2
      ? []
      : mail.filter((m) =>
          `${m.fromName} ${m.fromAddress} ${m.subject} ${m.summary}`.toLowerCase().includes(needle),
        );

  // Strangers, one row per person rather than one per message.
  const convos = buildConversations(
    mail.filter((m) => (m.kind === 'inquiry' || m.kind === 'other') && !hidden(m)),
    data.marks,
    data.repliedTo,
  );
  // A found email's conversation, so search results carry the same switch as the list.
  const convoOf = (m: Classified) => convos.find((c) => c.key === m.fromAddress.toLowerCase());
  // Every match from one address, and not a lead: offer to clear the lot.
  const oneSender =
    found.length && !found[0].leadId && found.every((m) => m.fromAddress === found[0].fromAddress) ? found[0] : null;

  // Everyone who wrote, not only people asking about ads: a complaint or a
  // question about the site needs an answer too. Complaints first, then sales.
  const weight = (c: Conversation) => (c.urgent ? 0 : c.asked ? 1 : 2);
  const todo = convos
    .filter((c) => c.state === 'todo')
    .sort((a, b) => weight(a) - weight(b) || b.latest.at.localeCompare(a.latest.at));
  // Your move first: a conversation waiting on them can sit, one waiting on you can't.
  const working = convos
    .filter((c) => c.state === 'working')
    .sort((a, b) => Number(b.turn === 'yours') - Number(a.turn === 'yours'));
  const finished = convos.filter((c) => c.state === 'done');
  const shown = tab === 'todo' ? todo : tab === 'working' ? working : finished;
  // Nobody is tucked away any more: every person is in To do until you say otherwise.
  const quietPeople: Conversation[] = [];
  const noise = mail.filter((m) => m.kind === 'noise' || hidden(m));
  const look = mail.filter((m) => ['money', 'bounce', 'stop'].includes(m.kind) && !hidden(m));
  const fromLeads = data.mail.filter((m) => m.kind === 'lead_reply');
  const report = data.report;
  const changed = report ? report.replies.length + report.contacted.length : 0;

  return (
    <AdminShell>
      <ReadContext.Provider value={readEmail}>
      <PageHead
        title="Inbox"
        help="Everyone waiting on you, from both mailboxes, spam included. Work down the page."
      >
        {checkedAt && !syncing && <span className="checked-at">Last checked {checkedAt}</span>}
        <button type="button" className="btn ghost" onClick={sync} disabled={syncing}>
          {syncing ? 'Checking mail…' : 'Check mail now'}
        </button>
      </PageHead>

      <Banner tone="crit">{problem || data.error}</Banner>

      <div className="boxes" aria-live="polite">
        {syncing && !checked ? (
          <span className="box">Checking Zoho and Gmail — inbox, spam and sent…</span>
        ) : (
          data.mailboxes.map((b) => (
            <span key={b.mailbox} className={`box ${b.connected ? (b.note ? 'warn' : 'ok') : 'off'}`}>
              <b>{BOX_NAME[b.mailbox]}</b>{' '}
              {b.connected
                ? `${b.label} · ${b.checked.length} ${b.checked.length === 1 ? 'folder' : 'folders'} read`
                : 'not connected — see below'}
              {b.connected && b.note && <em> — {b.note}</em>}
            </span>
          ))
        )}
      </div>

      {checked && data.mailboxes.some((b) => b.connected) && (
        <>
          <details className="covered">
            <summary>
              What was checked — {data.mail.length} received,{' '}
              {data.mailboxes.reduce((n, b) => n + b.checked.filter((f) => f.name === 'Sent').reduce((k, f) => k + f.count, 0), 0)} sent, from{' '}
              {data.mailboxes.reduce((n, b) => n + b.checked.length, 0)} folders
            </summary>
            <ul>
              {data.mailboxes
                .filter((b) => b.connected)
                .flatMap((b) =>
                  b.checked.map((f) => (
                    <li key={`${b.mailbox}-${f.name}`}>
                      <span className={`src ${b.mailbox}`}>{BOX_NAME[b.mailbox]}</span>
                      <b>{f.name}</b>
                      <span>
                        {!f.count
                          ? 'empty'
                          : f.complete
                            ? `all ${f.count} — the whole folder, back to ${day(f.since)}`
                            : `newest ${f.count}${f.total ? ` of ${f.total}` : ''}, back to ${day(f.since)}`}
                      </span>
                    </li>
                  )),
                )}
            </ul>
            <p className="cnote">
              “All” means every email in that folder is on this page. Where it says “newest”, older
              emails are still in your mailbox: type a name in Find an email and press Enter to search
              the whole mailbox. Every folder is read, including the ones Zoho files mail into by itself.
            </p>
          </details>

          <div className="mailbar">
            <div className="ctabs" role="group" aria-label="Which mailbox to show">
              {(
                [
                  ['all', 'Both mailboxes', data.mail.length],
                  ['zoho', 'Zoho', data.mail.filter((m) => m.mailbox === 'zoho').length],
                  ['gmail', 'Gmail', data.mail.filter((m) => m.mailbox === 'gmail').length],
                ] as const
              ).map(([key, label, n]) => (
                <button key={key} type="button" aria-pressed={box === key} onClick={() => setBox(key)}>
                  {key !== 'all' && <i className={`dot ${key}`} aria-hidden="true" />}
                  {label} <b>{n}</b>
                </button>
              ))}
            </div>
            <input
              type="search"
              value={find}
              onChange={(e) => {
                setFind(e.target.value);
                setDeep(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void searchEverywhere();
              }}
              placeholder="Find an email — a name or any words, then Enter"
              aria-label="Find an email"
            />
            <div className="seg" role="group" aria-label="How to lay the page out">
              <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')} title="Every email, nothing hidden">
                All mail
              </button>
              <button
                type="button"
                aria-pressed={view === 'needs'}
                onClick={() => setView('needs')}
                title="Replies to answer, emails to approve, conversations to do"
              >
                Needs you {data.replies.length + data.drafts.length + todo.length || ''}
              </button>
              <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}>
                Board
              </button>
            </div>
          </div>

          {needle.length >= 2 && (
            <section className="card" aria-labelledby="f-h" style={{ marginBottom: 12 }}>
              <h2 id="f-h">
                Found <small>{found.length || 'nothing'}</small>
              </h2>
              {view === 'all' && (
                <p className="cnote" style={{ margin: '0 0 6px' }}>
                  All mail below is narrowed to {found.length} {found.length === 1 ? 'email' : 'emails'} matching “{find.trim()}”.
                </p>
              )}
              {view !== 'all' && oneSender && found.length > 1 && (
                <p className="allfrom">
                  <span>
                    All {found.length} of these are from <b>{oneSender.fromAddress}</b>.
                  </span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => muteSender(oneSender, !hidden(oneSender))}
                    disabled={muting !== null}
                  >
                    {hidden(oneSender) ? 'Bring them all back' : `Not business — clear all ${found.length}`}
                  </button>
                </p>
              )}
              {view === 'all' ? null : found.length ? (
                found.map((m) => (
                  <MailRow
                    key={m.id}
                    m={m}
                    onAdd={!m.leadId && m.kind !== 'bounce' ? () => addAsLead(m) : undefined}
                    trusted={isTrusted(m)}
                    muted={hidden(m)}
                    onTrust={(trust) => trustSender(m, trust)}
                    onMute={m.leadId || m.folder === 'sent' ? undefined : (mute) => muteSender(m, mute)}
                    busy={trusting === m.id || muting === m.id || marking === m.fromAddress.toLowerCase()}
                    convo={convoOf(m)}
                    onStatus={convoOf(m) ? (status) => setStatus(convoOf(m) as Conversation, status) : undefined}
                  />
                ))
              ) : (
                <p className="empty-note">Nothing among the newest mail on this page matches “{find.trim()}”.</p>
              )}

              <div className="deep">
                {deep && deep.q === find.trim() ? (
                  <>
                    <h3>
                      In the whole mailbox <small>{deep.results.length || 'nothing'}</small>
                    </h3>
                    {deep.notes.map((n) => (
                      <p key={n} className="fmsg crit">
                        {n}
                      </p>
                    ))}
                    {deep.results.length ? (
                      deep.results.map((m) => (
                        <MailRow
                          key={m.id}
                          m={m}
                          onAdd={!m.leadId && m.folder !== 'sent' && m.kind !== 'bounce' ? () => addAsLead(m) : undefined}
                    trusted={isTrusted(m)}
                    muted={hidden(m)}
                    onTrust={(trust) => trustSender(m, trust)}
                    onMute={m.leadId || m.folder === 'sent' ? undefined : (mute) => muteSender(m, mute)}
                    busy={trusting === m.id || muting === m.id || marking === m.fromAddress.toLowerCase()}
                    convo={convoOf(m)}
                    onStatus={convoOf(m) ? (status) => setStatus(convoOf(m) as Conversation, status) : undefined}
                        />
                      ))
                    ) : (
                      <p className="empty-note">
                        No email in Zoho or Gmail — any folder, any age — mentions “{deep.q}”. Try one
                        word of the name, or part of the address.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="acts-row">
                    <button type="button" className="btn" onClick={searchEverywhere} disabled={searching}>
                      {searching ? 'Searching Zoho and Gmail…' : `Search the whole mailbox for “${find.trim()}”`}
                    </button>
                    <span className="cnote">Every folder, any age — not just the newest mail on this page.</span>
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {report && changed > 0 && (
        <p className="banner" role="status">
          Updated from your mail:{' '}
          {[
            ...report.replies.map(
              (r) => `${r.company} replied${r.folder === 'spam' ? ' (it was in spam)' : ''}`,
            ),
            ...report.contacted.map((c) => `you emailed ${c.company}`),
          ].join(' · ')}
          .
        </p>
      )}
      {report && report.errors.length > 0 && <Banner tone="warn">{report.errors.join(' ')}</Banner>}

      {checked && view === 'board' && (
        <Board
          convos={convos}
          leads={data.leads}
          onOpen={(address) => {
            setView('all');
            setFind(address);
            setDeep(null);
            window.scrollTo({ top: 0 });
          }}
        />
      )}

      {checked && view === 'all' && (
        <AllMail
          mail={mail}
          leads={data.leads}
          categories={data.categories}
          muted={data.muted}
          marks={data.marks}
          repliedTo={data.repliedTo}
          needle={needle.length >= 2 ? needle : ''}
          busy={filing || muting || marking}
          boxName={BOX_NAME}
          webmail={WEBMAIL}
          onRead={readEmail}
          onFile={fileSender}
          onStatus={setStatus}
          onAdd={addAsLead}
        />
      )}
      {!checked && view === 'all' && (
        <section className="card" style={{ marginBottom: 12 }}>
          <p className="empty-note">Checking both mailboxes — inbox, spam and every folder…</p>
        </section>
      )}

      <div hidden={view !== 'needs'}>
      <section className="card" aria-labelledby="r-h" style={{ marginBottom: 12 }}>
        <h2 id="r-h">
          1 · Replies to answer <small>{data.replies.length || 'none'}</small>
        </h2>
        {data.replies.length ? (
          data.replies.map((lead) => {
            const latest = fromLeads.find((m) => m.leadId === lead.id);
            return (
              <div key={lead.id} className="mail unread">
                <div className="top">
                  <span className="who">{lead.company}</span>
                  <span className="when">
                    {latest && <span className={`src ${latest.mailbox}`}>{BOX_NAME[latest.mailbox]}</span>}
                    replied {day(lead.last_reply_at)}
                  </span>
                </div>
                <p className="subj">
                  {latest ? latest.subject : [lead.contact_name, lead.email].filter(Boolean).join(' · ')}
                </p>
                {latest?.summary && <p className="sum">{latest.summary}</p>}
                <p className="acts-row">
                  <a
                    className="btn"
                    href={latest?.link || WEBMAIL[latest?.mailbox || 'zoho']}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Answer in {BOX_NAME[latest?.mailbox || 'zoho']}
                  </a>
                  <Link className="btn ghost" href={`/admin/leads/${lead.id}`}>
                    Open lead
                  </Link>
                  {latest && (
                    <button type="button" className="btn ghost" onClick={() => readEmail(latest)}>
                      Read full email
                    </button>
                  )}
                </p>
              </div>
            );
          })
        ) : (
          <p className="empty-note">
            No one is waiting on a reply. When you answer someone from Zoho or Gmail, they clear
            from here by themselves the next time mail is checked.
          </p>
        )}
      </section>

      <section className="card" id="approve" aria-labelledby="a-h" style={{ marginBottom: 12 }}>
        <h2 id="a-h">
          2 · Emails waiting for your approval <small>{data.drafts.length || 'none'}</small>
        </h2>
        {data.drafts.length ? (
          <>
            {data.drafts.map((d) => (
              <details key={d.id} className="mail" style={{ marginTop: 0 }}>
                <summary>
                  {d.company || '—'} — {d.subject}{' '}
                  <span className={`chip ${d.status === 'failed' ? 'crit' : 'none'}`}>
                    {d.status === 'failed'
                      ? 'send failed'
                      : `${SEQUENCE_LABEL[d.sequence_key] || d.sequence_key} · step ${d.step + 1}`}
                  </span>
                </summary>
                <p className="sum">To {d.email || 'no address on file'}</p>
                <pre className="mail-body">{d.body}</pre>
                {d.send_error && <p className="fmsg crit">{d.send_error}</p>}
                <p className="acts-row">
                  <Link className="btn ghost" href={`/admin/leads/${d.lead_id}`}>
                    Open lead
                  </Link>
                </p>
              </details>
            ))}
            <p className="acts-row" style={{ marginTop: 12 }}>
              <a className="btn" href={PARTNERSHIPS_URL} target="_blank" rel="noopener noreferrer">
                Approve &amp; send these →
              </a>
            </p>
          </>
        ) : (
          <p className="empty-note">
            Nothing to approve. Emails are written at 7:15 each morning for every lead whose
            follow-up is due.
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="n-h" style={{ marginBottom: 12 }}>
        <h2 id="n-h">
          3 · Conversations <small>{checked ? `${todo.length} to do` : '…'}</small>
        </h2>
        {checked ? (
          <>
            <p className="cnote" style={{ margin: '0 0 10px' }}>
              One row per person who wrote to you — about advertising or anything else — from either
              mailbox, spam included. A conversation moves to In
              progress by itself once your Sent folder shows you replied, and comes back from Done
              if they write again. Not about Culture Media — a newsletter, a personal email, a
              product update? <b>Not business</b> takes that sender off this page for good; the list at the
              bottom lets you bring anyone back.
            </p>
            <div className="ctabs" role="group" aria-label="Which conversations to show">
              {(
                [
                  ['todo', 'To do', todo.length],
                  ['working', 'In progress', working.length],
                  ['done', 'Done', finished.length],
                ] as const
              ).map(([key, label, n]) => (
                <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}>
                  {label} <b>{n}</b>
                </button>
              ))}
            </div>
            {shown.length ? (
              shown.map((c) => (
                <MailRow
                key={c.key}
                m={c.latest}
                onAdd={() => addAsLead(c.latest)}
                onTrust={(trust) => trustSender(c.latest, trust)}
                trusted={isTrusted(c.latest)}
                busy={trusting === c.latest.id || marking === c.key || muting === c.latest.id}
                convo={c}
                onStatus={(status) => setStatus(c, status)}
                onMute={(mute) => muteSender(c.latest, mute)}
              />
              ))
            ) : (
              <p className="empty-note">
                {tab === 'todo'
                  ? 'Nobody waiting. Everyone who writes to you lands here, whatever it is about.'
                  : tab === 'working'
                    ? 'Nothing in progress. Mark a conversation In progress, or just reply to it — the next mail check moves it here.'
                    : 'Nothing finished yet. Done conversations wait here, and come back to To do by themselves if the person writes again.'}
              </p>
            )}
          </>
        ) : (
          <p className="empty-note">Checking…</p>
        )}
      </section>

      {look.length > 0 && (
        <section className="card" aria-labelledby="w-h" style={{ marginBottom: 12 }}>
          <h2 id="w-h">
            4 · Worth a look <small>{look.length}</small>
          </h2>
          {look.map((m) => (
            <MailRow
              key={m.id}
              m={m}
              onStop={m.kind === 'stop' && m.leadId && !data.stopped.includes(m.leadId) ? () => stopEmailing(m) : undefined}
              stopped={Boolean(m.leadId && data.stopped.includes(m.leadId))}
              onTrust={(trust) => trustSender(m, trust)}
              trusted={isTrusted(m)}
              busy={trusting === m.id || stopping === m.leadId || muting === m.id}
              onMute={m.leadId ? undefined : (mute) => muteSender(m, mute)}
            />
          ))}
        </section>
      )}

      {checked && data.muted.length > 0 && (
        <details className="card guide" style={{ marginBottom: 12 }}>
          <summary>Not business — {data.muted.length} {data.muted.length === 1 ? 'sender' : 'senders'} kept off this page</summary>
          <p className="cnote" style={{ margin: '8px 0' }}>
            Newsletters, personal mail, product updates. Their mail is still in your mailbox; it just never
            shows up here as something to do. Bring one back if it turns out to matter.
          </p>
          <ul className="srows">
            {data.muted.map((address) => (
              <li key={address}>
                <span>{address}</span>
                <button type="button" onClick={() => muteAddress(address, false, address)} disabled={muting !== null}>
                  {muting === address ? 'Saving…' : 'Bring back'}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {checked && (
        <details className="card guide">
          <summary>
            Everything else — {quietPeople.length} from people, {noise.length} automated or not business
          </summary>
          {quietPeople.length + noise.length ? (
            <>
              {quietPeople.map((c) => (
                <MailRow
                key={c.key}
                m={c.latest}
                onAdd={() => addAsLead(c.latest)}
                onTrust={(trust) => trustSender(c.latest, trust)}
                trusted={isTrusted(c.latest)}
                busy={trusting === c.latest.id || marking === c.key || muting === c.latest.id}
                convo={c}
                onStatus={(status) => setStatus(c, status)}
                onMute={(mute) => muteSender(c.latest, mute)}
                quiet
              />
              ))}
              {noise.map((m) => (
                <MailRow
                  key={m.id}
                  m={m}
                  onTrust={(trust) => trustSender(m, trust)}
                  trusted={isTrusted(m)}
                  busy={trusting === m.id || muting === m.id}
                  onMute={hidden(m) ? (mute) => muteSender(m, mute) : undefined}
                  muted={hidden(m)}
                  quiet
                />
              ))}
            </>
          ) : (
            <p className="empty-note">Nothing else recent.</p>
          )}
        </details>
      )}

      </div>

      {checked && data.mailboxes.some((b) => !b.connected || b.note) && <ConnectHelp data={data} />}

      {reading && (
        <Detail title={`Email · ${BOX_NAME[reading.m.mailbox]} · ${day(reading.m.at)}`} onClose={() => setReading(null)}>
          <h3 className="mail-subject">{reading.m.subject || '(no subject)'}</h3>
          <p className="mail-from">
            {reading.m.folder === 'sent' ? 'You sent this' : 'From'}{' '}
            <b>{reading.m.fromName || reading.m.fromAddress}</b>
            {reading.m.fromName ? ` · ${reading.m.fromAddress}` : ''}
          </p>
          {reading.error ? (
            <p className="fmsg crit">{reading.error}</p>
          ) : reading.text === null ? (
            <p className="empty-note">Fetching the email from {BOX_NAME[reading.m.mailbox]}…</p>
          ) : (
            <>
              <pre className="mail-full">{reading.text || 'This email has no text — it may be only images or an attachment.'}</pre>
              {reading.cut && <p className="cnote">This is a long email; the rest is in {BOX_NAME[reading.m.mailbox]}.</p>}
            </>
          )}
          <p className="cnote">
            Shown as plain text, so images and attachments do not appear — and the sender cannot tell you opened
            it. Reading it here does not mark it read in {BOX_NAME[reading.m.mailbox]}.
          </p>
          <p className="acts-row">
            <a className="btn" href={reading.m.link || WEBMAIL[reading.m.mailbox]} target="_blank" rel="noopener noreferrer">
              {reading.m.folder === 'sent' ? 'Open' : 'Reply'} in {BOX_NAME[reading.m.mailbox]}
            </a>
          </p>
        </Detail>
      )}
      </ReadContext.Provider>
    </AdminShell>
  );
}

const KIND_LABEL: Record<string, { text: string; tone: string }> = {
  inquiry: { text: 'Asking about ads', tone: 'ok' },
  money: { text: 'Payment', tone: 'ok' },
  bounce: { text: 'Bounced', tone: 'crit' },
  stop: { text: 'Asked to stop', tone: 'crit' },
  lead_reply: { text: 'From a lead', tone: 'ok' },
  other: { text: 'Person', tone: 'none' },
  noise: { text: 'Automated', tone: 'none' },
};

const STATE_LABEL: Record<ConvoStatus, string> = { todo: 'To do', working: 'In progress', done: 'Done' };

function MailRow({
  m,
  onAdd,
  onStop,
  onTrust,
  trusted,
  stopped,
  busy,
  quiet,
  convo,
  onStatus,
  onMute,
  muted,
}: {
  m: Classified;
  onAdd?: () => void;
  onStop?: () => void;
  /** Mark this sender safe. One way: the row offers no "back to spam". */
  onTrust?: (trust: boolean) => void;
  /** The owner has already vouched for this sender. */
  trusted?: boolean;
  /** Already marked unsubscribed. */
  stopped?: boolean;
  busy?: boolean;
  quiet?: boolean;
  /** Set when the row stands for a whole conversation with this sender. */
  convo?: Conversation;
  onStatus?: (status: ConvoStatus) => void;
  /** Hide this sender for good, or bring them back. */
  onMute?: (mute: boolean) => void;
  /** The owner hid this sender. */
  muted?: boolean;
}) {
  const read = useContext(ReadContext);
  const label = KIND_LABEL[m.kind];
  // Still wearing the spam warning: in the spam folder and not vouched for.
  const flagged = m.folder === 'spam' && !trusted;
  return (
    <article className={`mail${m.unread && !quiet ? ' unread' : ''}${flagged ? ' flagged' : ''}`}>
      <div className="top">
        <span className="who">{m.fromName || m.fromAddress}</span>
        <span className="when">
          <span className={`src ${m.mailbox}`}>{BOX_NAME[m.mailbox]}</span>
          {day(m.at)}
        </span>
      </div>
      {/* The address itself: a friendly display name is the easy half to fake. */}
      {m.fromName && m.fromName.toLowerCase() !== m.fromAddress.toLowerCase() ? (
        <p className="addr">{m.fromAddress}</p>
      ) : null}
      <p className="subj">{m.subject || '(no subject)'}</p>
      {m.summary && !quiet && <p className="sum">{m.summary}</p>}
      <p className="tags">
        <span className={`chip ${label.tone}`} title={m.why}>
          {label.text}
        </span>
        {m.leadCompany && <span className="chip ok">{m.leadCompany}</span>}
        {flagged && <span className="chip warn">Found in spam</span>}
        {m.folderName && <span className="chip none">Filed under “{m.folderName}”</span>}
        {m.folder === 'spam' && trusted && <span className="chip none">You marked this not spam</span>}
        {stopped && <span className="chip none">Unsubscribed — no more emails</span>}
        {(convo?.urgent || m.urgent) && convo?.state !== 'done' && (
          <span className="chip crit" title="It mentions permission, copyright, a complaint, a correction or money owed">
            Reads like a complaint or legal notice · answer it
          </span>
        )}
        {muted && <span className="chip none">Marked not business</span>}
        {m.folder === 'sent' && <span className="chip none">You sent this</span>}
        {convo?.turn === 'theirs' && convo.repliedAt && (
          <span className="chip ok">You replied {day(convo.repliedAt)} · waiting on them</span>
        )}
        {convo?.turn === 'yours' && convo.state !== 'done' && (
          <span className="chip warn">They wrote back · your turn</span>
        )}
        {convo?.reopened && <span className="chip warn">New message since you marked it done</span>}
        {convo && convo.earlier > 0 && (
          <span className="chip none">
            +{convo.earlier} earlier {convo.earlier === 1 ? 'message' : 'messages'}
          </span>
        )}
      </p>
      <p className="acts-row">
        {onAdd && (
          <button type="button" className="btn" onClick={onAdd}>
            Add as lead
          </button>
        )}
        {onStop && (
          <button type="button" className="btn" onClick={onStop} disabled={busy}>
            {busy ? 'Saving…' : 'Stop emailing them'}
          </button>
        )}
        {m.kind === 'money' && (
          <Link className="btn" href="/admin/revenue">
            Record it in Revenue
          </Link>
        )}
        {m.leadId && (
          <Link className="btn ghost" href={`/admin/leads/${m.leadId}`}>
            Open lead
          </Link>
        )}
        {/* Once vouched for, the question is settled: no button to put it back. */}
        {onTrust && m.folder === 'spam' && !trusted && (
          <button type="button" className="btn ghost" onClick={() => onTrust(true)} disabled={busy}>
            {busy ? 'Saving…' : 'Not spam'}
          </button>
        )}
        {read && (
          <button type="button" className="btn ghost" onClick={() => read(m)}>
            Read full email
          </button>
        )}
        {onMute && !m.leadId && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => onMute(!muted)}
            disabled={busy}
            title={
              muted
                ? 'Put this sender back among your conversations'
                : 'Not about Culture Media: take this sender off the page for good. You can bring them back from the list at the bottom.'
            }
          >
            {muted ? 'Bring back' : 'Not business'}
          </button>
        )}
        <a
          className="btn ghost"
          href={m.link || WEBMAIL[m.mailbox]}
          target="_blank"
          rel="noopener noreferrer"
          title={m.link ? `Opens this email in ${BOX_NAME[m.mailbox]}` : undefined}
        >
          {m.link ? `Open in ${BOX_NAME[m.mailbox]}` : `Open ${BOX_NAME[m.mailbox]}`}
        </a>
        {convo && onStatus && (
          <span className="seg state" role="group" aria-label="Where this conversation stands">
            {(['todo', 'working', 'done'] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={convo.state === s}
                disabled={busy}
                onClick={() => onStatus(s)}
              >
                {STATE_LABEL[s]}
              </button>
            ))}
          </span>
        )}
      </p>
    </article>
  );
}

interface Card {
  key: string;
  title: string;
  sub: string;
  when: string | null;
  mailbox?: string;
  /** A lead opens its page; a conversation opens in the list. */
  href?: string;
  address?: string;
}

// Everyone at once, in four piles by whose move it is. Leads and strangers sit
// together on purpose: the question is "who is waiting on whom", not which
// table a person happens to live in.
function Board({
  convos,
  leads,
  onOpen,
}: {
  convos: Conversation[];
  leads: InboxData['leads'];
  onOpen: (address: string) => void;
}) {
  const leadCard = (l: InboxData['leads'][number], when: string | null, sub?: string): Card => ({
    key: `lead-${l.id}`,
    title: l.company,
    sub: sub || [l.contact_name, STAGE_LABEL[l.stage] || l.stage].filter(Boolean).join(' · '),
    when,
    href: `/admin/leads/${l.id}`,
  });
  const convoCard = (c: Conversation): Card => ({
    key: `convo-${c.key}`,
    title: c.latest.fromName || c.key,
    sub: c.latest.subject,
    when: c.latest.at,
    mailbox: c.latest.mailbox,
    address: c.key,
  });
  const newest = (a: Card, b: Card) => String(b.when || '').localeCompare(String(a.when || ''));

  const waitingOnYou = leads.filter(awaitingReply);
  const columns: { title: string; help: string; cards: Card[] }[] = [
    {
      title: 'Wrote to you',
      help: 'Your move. They are waiting on an answer.',
      cards: [
        ...waitingOnYou.map((l) => leadCard(l, l.last_reply_at, 'Replied — answer them')),
        ...convos.filter((c) => c.state === 'todo' || (c.state === 'working' && c.turn === 'yours')).map(convoCard),
      ].sort(newest),
    },
    {
      title: 'You reached out',
      help: 'Their move. Nothing to do until they answer or the follow-up is due.',
      cards: [
        ...leads.filter((l) => l.stage === 'contacted' && !awaitingReply(l)).map((l) => leadCard(l, l.last_contacted_at)),
        ...convos.filter((c) => c.state === 'working' && c.turn === 'theirs').map(convoCard),
      ].sort(newest),
    },
    {
      title: 'In conversation',
      help: 'Talking, or a proposal is out.',
      cards: [
        ...leads
          .filter((l) => (l.stage === 'engaged' || l.stage === 'proposal') && !awaitingReply(l))
          .map((l) => leadCard(l, l.last_reply_at || l.last_contacted_at)),
        ...convos.filter((c) => c.state === 'working' && c.turn === null).map(convoCard),
      ].sort(newest),
    },
    {
      title: 'Clients',
      help: 'They have bought. Check in before they go cold.',
      cards: leads
        .filter((l) => l.stage === 'won')
        .map((l) => leadCard(l, l.last_contacted_at, l.next_action_on ? `Check in ${day(l.next_action_on)}` : 'No check-in booked'))
        .sort(newest),
    },
  ];

  // "Dec 7" reads as this year. The newest date on the board is this year, so
  // anything from another year says which.
  const thisYear = columns
    .flatMap((c) => c.cards.map((card) => String(card.when || '').slice(0, 4)))
    .sort()
    .pop();
  const dated = (iso: string) => `${day(iso)}${iso.slice(0, 4) !== thisYear ? `, ${iso.slice(0, 4)}` : ''}`;

  return (
    <div className="board" aria-label="Everyone, by whose move it is">
      {columns.map((col) => (
        <section key={col.title} className="card" aria-label={col.title}>
          <h2>
            {col.title} <small>{col.cards.length}</small>
          </h2>
          <p className="cnote">{col.help}</p>
          {col.cards.length ? (
            <ul>
              {col.cards.map((card) => {
                const inner = (
                  <>
                    <b>{card.title}</b>
                    <span className="sub">{card.sub}</span>
                    <span className="when">
                      {card.mailbox && <span className={`src ${card.mailbox}`}>{BOX_NAME[card.mailbox]}</span>}
                      {card.when ? dated(card.when) : 'no contact yet'}
                    </span>
                  </>
                );
                return (
                  <li key={card.key}>
                    {card.href ? (
                      <Link href={card.href}>{inner}</Link>
                    ) : (
                      <button type="button" onClick={() => onOpen(card.address || '')}>
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty-note">Nobody here.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function ConnectHelp({ data }: { data: InboxData }) {
  const zoho = data.mailboxes.find((b) => b.mailbox === 'zoho');
  const gmail = data.mailboxes.find((b) => b.mailbox === 'gmail');
  return (
    <section className="card" aria-labelledby="c-h" style={{ marginTop: 12 }}>
      <h2 id="c-h">Finish connecting your mail</h2>
      <div className="prose">
        {zoho && (!zoho.connected || zoho.note) && (
          <>
            <p>
              <b>Zoho.</b> {zoho.note} Press the button, approve, then copy the new refresh token it
              shows into Vercel as <code>ZOHO_REFRESH_TOKEN</code> and redeploy. The new connection
              can also see Spam and Sent.
            </p>
            <p>
              <a className="btn" href="/api/zoho/connect">
                {zoho.connected ? 'Reconnect Zoho Mail' : 'Connect Zoho Mail'}
              </a>
            </p>
          </>
        )}
        {gmail && !gmail.connected && (
          <>
            <p>
              <b>Gmail.</b> {gmail.note}
            </p>
            <ol>
              <li>
                In the Gmail account, turn on 2-Step Verification (Google Account → Security).
              </li>
              <li>
                Open <code>myaccount.google.com/apppasswords</code>, make an app password named
                “Culture Media admin”, and copy the 16 letters.
              </li>
              <li>
                In Vercel → Environment Variables add <code>GMAIL_USER</code> (the full Gmail
                address) and <code>GMAIL_APP_PASSWORD</code> (the 16 letters). Tick Production and
                Preview, save, then redeploy.
              </li>
            </ol>
            <p className="cnote">
              The admin only ever opens Gmail read-only: it cannot send, delete or mark anything.
              You can revoke the app password at any time from the same Google page.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

'use client';

// The Inbox: everyone waiting on you, in the order to deal with them.
//   1. Leads who wrote back            — answer these first
//   2. Emails drafted for approval     — then send today's outreach
//   3. Conversations with new people   — one row per person: to do, in progress, done
//   4. Worth a look                    — payments, bounces, "please remove me"
//   5. Everything else                 — collapsed; spam is included so nothing hides
// Opening the page checks both mailboxes (Zoho and Gmail: inbox, spam, sent)
// and records what they prove. It never sends, deletes, moves or marks mail —
// including "Not spam", which is remembered here rather than in the mailbox.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { buildConversations, type Conversation, type ConvoStatus } from '@/lib/conversations';
import { PARTNERSHIPS_URL, SEQUENCE_LABEL } from '@/lib/crm';
import type { InboxData } from '@/lib/inbox';
import type { Classified } from '@/lib/mail';
import { PREFILL_KEY, type LeadPrefill } from '../_components/add-lead';
import { day } from '../_components/format';
import { AdminShell, PageHead } from '../_components/shell';
import { Banner } from '../_components/ui';

const WEBMAIL: Record<string, string> = {
  zoho: 'https://mail.zoho.com/',
  gmail: 'https://mail.google.com/',
};
const BOX_NAME: Record<string, string> = { zoho: 'Zoho', gmail: 'Gmail' };

export default function InboxView({ initial }: { initial: InboxData }) {
  const [data, setData] = useState<InboxData>(initial);
  const [syncing, setSyncing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [problem, setProblem] = useState('');
  const [stopping, setStopping] = useState<string | null>(null);
  const [trusting, setTrusting] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const [muting, setMuting] = useState<string | null>(null);
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
    } catch {
      setProblem("Couldn't reach the server.");
    } finally {
      setSyncing(false);
    }
  }, []);

  // Check the mailboxes as soon as the page opens.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void sync();
  }, [sync]);

  // Hand the sender to the add-a-lead form without putting them in a URL.
  const addAsLead = (m: Classified) => {
    const prefill: LeadPrefill = {
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

  const muteSender = async (m: Classified, mute: boolean) => {
    if (muting) return;
    setMuting(m.id);
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

  // Strangers, one row per person rather than one per message.
  const convos = buildConversations(
    data.mail.filter((m) => (m.kind === 'inquiry' || m.kind === 'other') && !hidden(m)),
    data.marks,
    data.repliedTo,
  );
  const todo = convos.filter((c) => c.state === 'todo' && c.asked);
  // Your move first: a conversation waiting on them can sit, one waiting on you can't.
  const working = convos
    .filter((c) => c.state === 'working')
    .sort((a, b) => Number(b.turn === 'yours') - Number(a.turn === 'yours'));
  const finished = convos.filter((c) => c.state === 'done');
  const shown = tab === 'todo' ? todo : tab === 'working' ? working : finished;
  // People who wrote about something the rules don't recognise, not yet dealt with.
  const quietPeople = convos.filter((c) => c.state === 'todo' && !c.asked);
  const noise = data.mail.filter((m) => m.kind === 'noise' || hidden(m));
  const look = data.mail.filter((m) => ['money', 'bounce', 'stop'].includes(m.kind) && !hidden(m));
  const fromLeads = data.mail.filter((m) => m.kind === 'lead_reply');
  const report = data.report;
  const changed = report ? report.replies.length + report.contacted.length : 0;

  return (
    <AdminShell>
      <PageHead
        title="Inbox"
        help="Everyone waiting on you, from both mailboxes, spam included. Work down the page."
      >
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
              {b.connected ? `${b.label} · ${b.folders.join(', ')}` : 'not connected — see below'}
              {b.connected && b.note && <em> — {b.note}</em>}
            </span>
          ))
        )}
      </div>

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
                  <span className="muted">replied {day(lead.last_reply_at)}</span>
                </div>
                <p className="subj">
                  {latest ? latest.subject : [lead.contact_name, lead.email].filter(Boolean).join(' · ')}
                </p>
                {latest?.summary && <p className="sum">{latest.summary}</p>}
                <p className="acts-row">
                  <a
                    className="btn"
                    href={WEBMAIL[latest?.mailbox || 'zoho']}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Answer in {BOX_NAME[latest?.mailbox || 'zoho']}
                  </a>
                  <Link className="btn ghost" href={`/admin/leads/${lead.id}`}>
                    Open lead
                  </Link>
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
          3 · Conversations with new people <small>{checked ? `${todo.length} to do` : '…'}</small>
        </h2>
        {checked ? (
          <>
            <p className="cnote" style={{ margin: '0 0 10px' }}>
              One row per person, from either mailbox, spam included. A conversation moves to In
              progress by itself once your Sent folder shows you replied, and comes back from Done
              if they write again. Not a person at all? <b>Hide sender</b> files a newsletter or product
              update under Everything else for good.
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
                  ? 'Nobody waiting. Strangers who mention advertising, rates, sponsorship, an event or a collaboration land here.'
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

      {checked && (
        <details className="card guide">
          <summary>
            Everything else — {quietPeople.length} from people, {noise.length} automated or hidden
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

      {checked && data.mailboxes.some((b) => !b.connected || b.note) && <ConnectHelp data={data} />}
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
  /** Mark this sender safe, or put the warning back. */
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
  const label = KIND_LABEL[m.kind];
  // Still wearing the spam warning: in the spam folder and not vouched for.
  const flagged = m.folder === 'spam' && !trusted;
  return (
    <article className={`mail${m.unread && !quiet ? ' unread' : ''}${flagged ? ' flagged' : ''}`}>
      <div className="top">
        <span className="who">{m.fromName || m.fromAddress}</span>
        <span className="when">
          {BOX_NAME[m.mailbox]} · {day(m.at)}
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
        {m.folder === 'spam' && trusted && <span className="chip none">You marked this not spam</span>}
        {stopped && <span className="chip none">Unsubscribed — no more emails</span>}
        {muted && <span className="chip none">You hid this sender</span>}
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
        {onTrust && m.folder === 'spam' && (
          <button type="button" className="btn ghost" onClick={() => onTrust(!trusted)} disabled={busy}>
            {busy ? 'Saving…' : trusted ? 'Back to spam' : 'Not spam'}
          </button>
        )}
        {onMute && !m.leadId && (
          <button type="button" className="btn ghost" onClick={() => onMute(!muted)} disabled={busy}>
            {muted ? 'Show again' : 'Hide sender'}
          </button>
        )}
        <a className="btn ghost" href={WEBMAIL[m.mailbox]} target="_blank" rel="noopener noreferrer">
          Open {BOX_NAME[m.mailbox]}
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

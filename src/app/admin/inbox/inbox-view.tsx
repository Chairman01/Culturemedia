'use client';

// The Inbox: everyone waiting on you, in the order to deal with them.
//   1. Leads who wrote back            — answer these first
//   2. Emails drafted for approval     — then send today's outreach
//   3. New people asking about ads     — strangers worth adding as leads
//   4. Worth a look                    — payments, bounces, "please remove me"
//   5. Everything else                 — collapsed; spam is included so nothing hides
// Opening the page checks both mailboxes (Zoho and Gmail: inbox, spam, sent)
// and records what they prove. It never sends, deletes, moves or marks mail —
// including "Not spam", which is remembered here rather than in the mailbox.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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

  const inquiries = data.mail.filter((m) => m.kind === 'inquiry');
  const look = data.mail.filter((m) => ['money', 'bounce', 'stop'].includes(m.kind));
  const fromLeads = data.mail.filter((m) => m.kind === 'lead_reply');
  const rest = data.mail.filter((m) => m.kind === 'other' || m.kind === 'noise');
  const restPeople = rest.filter((m) => m.kind === 'other');
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
          3 · New people asking about advertising <small>{checked ? inquiries.length || 'none' : '…'}</small>
        </h2>
        {inquiries.length ? (
          <>
            <p className="cnote" style={{ margin: '0 0 6px' }}>
              Strangers who mentioned advertising, rates, sponsorship, an event or a collaboration —
              from either mailbox, spam included. Add the real ones as leads and leave the rest.
            </p>
            {inquiries.map((m) => (
              <MailRow
                key={m.id}
                m={m}
                onAdd={() => addAsLead(m)}
                onTrust={(trust) => trustSender(m, trust)}
                trusted={isTrusted(m)}
                busy={trusting === m.id}
              />
            ))}
          </>
        ) : (
          <p className="empty-note">
            {checked
              ? 'Nobody new. This catches strangers who mention advertising, features, rates, sponsorship, events or a collaboration — in either mailbox, including spam.'
              : 'Checking…'}
          </p>
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
              busy={trusting === m.id || stopping === m.leadId}
            />
          ))}
        </section>
      )}

      {checked && (
        <details className="card guide">
          <summary>
            Everything else — {restPeople.length} from people, {rest.length - restPeople.length} automated
          </summary>
          {rest.length ? (
            rest.map((m) => (
              <MailRow
                key={m.id}
                m={m}
                onAdd={m.kind === 'other' ? () => addAsLead(m) : undefined}
                onTrust={(trust) => trustSender(m, trust)}
                trusted={isTrusted(m)}
                busy={trusting === m.id}
                quiet
              />
            ))
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

function MailRow({
  m,
  onAdd,
  onStop,
  onTrust,
  trusted,
  stopped,
  busy,
  quiet,
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
      {m.fromName ? <p className="addr">{m.fromAddress}</p> : null}
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
        <a className="btn ghost" href={WEBMAIL[m.mailbox]} target="_blank" rel="noopener noreferrer">
          Open {BOX_NAME[m.mailbox]}
        </a>
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

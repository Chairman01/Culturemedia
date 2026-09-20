'use client';

// The Inbox: everyone waiting on you, in the order to deal with them.
//   1. Leads who wrote back          — answer these first
//   2. Emails drafted for approval   — then send today's outreach
//   3. The recent Zoho inbox         — so an inquiry from a stranger is not missed
// This page only reads. Sending still happens through Approve & send.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { PARTNERSHIPS_URL, SEQUENCE_LABEL } from '@/lib/crm';
import type { InboxData, InboxMail } from '@/lib/inbox';
import { PREFILL_KEY, type LeadPrefill } from '../_components/add-lead';
import { day } from '../_components/format';
import { AdminShell, PageHead } from '../_components/shell';
import { Banner } from '../_components/ui';

const ZOHO_URL = 'https://mail.zoho.com/';

export default function InboxView({ initial }: { initial: InboxData }) {
  const [data, setData] = useState<InboxData>(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [showKnown, setShowKnown] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/inbox', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.data) setData(body.data as InboxData);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Hand the sender to the add-a-lead form without putting them in a URL.
  const addAsLead = (m: InboxMail) => {
    const prefill: LeadPrefill = {
      company: m.companyGuess,
      contact_name: m.fromName,
      email: m.fromAddress,
      consent_basis: 'implied_inquiry',
      sequence_key: '',
      notes: `Wrote in on ${day(m.receivedAt)}: “${m.subject}”`,
    };
    try {
      sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill));
    } catch {
      /* the form just opens empty */
    }
    router.push('/admin/leads?add=1');
  };

  const strangers = data.mail.filter((m) => !m.leadId);
  const mail = showKnown ? data.mail : strangers;

  return (
    <AdminShell>
      <PageHead
        title="Inbox"
        help="Everyone waiting on you. Work down the page: answer replies, approve today's emails, then check nobody new wrote in."
      >
        <a className="btn ghost" href={ZOHO_URL} target="_blank" rel="noopener noreferrer">
          Open Zoho Mail
        </a>
        <button type="button" className="btn ghost" onClick={load} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </PageHead>

      <Banner tone="crit">{data.error}</Banner>

      <section className="card" aria-labelledby="r-h" style={{ marginBottom: 12 }}>
        <h2 id="r-h">
          1 · Replies to answer <small>{data.replies.length || 'none'}</small>
        </h2>
        {data.replies.length ? (
          data.replies.map((lead) => (
            <div key={lead.id} className="mail unread">
              <div className="top">
                <span className="who">{lead.company}</span>
                <span className="muted">replied {day(lead.last_reply_at)}</span>
              </div>
              <p className="subj">{[lead.contact_name, lead.email].filter(Boolean).join(' · ')}</p>
              <p className="acts-row">
                <a className="btn" href={ZOHO_URL} target="_blank" rel="noopener noreferrer">
                  Answer in Zoho Mail
                </a>
                <Link className="btn ghost" href={`/admin/leads/${lead.id}`}>
                  Open lead &amp; log it
                </Link>
              </p>
            </div>
          ))
        ) : (
          <p className="empty-note">
            No one is waiting on a reply. Replies are picked up each morning at 7:15 — for anything
            newer, look at the Zoho list below.
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
                    {d.status === 'failed' ? 'send failed' : `${SEQUENCE_LABEL[d.sequence_key] || d.sequence_key} · step ${d.step + 1}`}
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
            <p className="cnote">
              Read them here; approving, editing, skipping and snoozing happen on the Partnerships
              page, which is the only place connected to send from your mailbox.
            </p>
          </>
        ) : (
          <p className="empty-note">
            Nothing to approve. Emails are written at 7:15 each morning for every lead whose
            follow-up is due — add a lead with follow-up emails today and it shows up here tomorrow.
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="z-h">
        <div className="chead">
          <h2 id="z-h">
            3 · Recent mail <small>{data.zohoConnected ? `${strangers.length} from people not in your leads` : 'Zoho not connected'}</small>
          </h2>
          {data.zohoConnected && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}>
              <input type="checkbox" checked={showKnown} onChange={(e) => setShowKnown(e.target.checked)} />
              Show mail from leads too
            </label>
          )}
        </div>
        {!data.zohoConnected ? (
          <>
            <Banner tone="warn">{data.zohoReason} Until it is, this list stays empty.</Banner>
            <a className="btn" href="/api/zoho/connect">
              Connect Zoho Mail
            </a>
          </>
        ) : mail.length ? (
          mail.map((m) => (
            <div key={m.id} className={`mail${m.unread ? ' unread' : ''}`}>
              <div className="top">
                <span className="who">
                  {m.fromName || m.fromAddress}
                  {m.leadCompany && <span className="chip ok" style={{ marginLeft: 8 }}>{m.leadCompany}</span>}
                </span>
                <span className="muted">{day(m.receivedAt)}</span>
              </div>
              <p className="subj">{m.subject}</p>
              {m.summary && <p className="sum">{m.summary}</p>}
              <p className="acts-row">
                {m.leadId ? (
                  <Link className="btn ghost" href={`/admin/leads/${m.leadId}`}>
                    Open lead
                  </Link>
                ) : (
                  <button type="button" onClick={() => addAsLead(m)}>
                    Add as lead
                  </button>
                )}
              </p>
            </div>
          ))
        ) : (
          <p className="empty-note">Nothing recent.</p>
        )}
      </section>
    </AdminShell>
  );
}

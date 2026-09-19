'use client';

// One lead: edit it, move it along, start its emails, and keep a record of
// every call, meeting and email. Nothing on this page sends anything.

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

import {
  CONSENT_BASES,
  CONSENT_LABEL,
  DEAL_LABEL,
  DEAL_TYPES,
  PARTNERSHIPS_URL,
  SEQUENCES,
  SEQUENCE_LABEL,
  STAGES,
  STAGE_LABEL,
  awaitingReply,
  isOpen,
  needsOf,
  type LeadRow,
} from '@/lib/crm';
import type { LeadDetail } from '@/lib/crm-admin';
import { day } from '../../_components/format';
import { AdminShell, PageHead } from '../../_components/shell';
import { Banner } from '../../_components/ui';

const FIELDS = [
  'company', 'contact_name', 'email', 'phone', 'website', 'city', 'category', 'stage', 'deal_type',
  'deal_value', 'term_months', 'consent_basis', 'sequence_key', 'next_action_on', 'notes',
] as const;

const asText = (v: unknown) => (v === null || v === undefined ? '' : String(v));

const DRAFT_STATUS: Record<string, string> = {
  pending: 'Waiting for approval',
  failed: 'Send failed',
  approved: 'Approved',
  sent: 'Sent',
  skipped: 'Skipped',
};

export default function LeadView({
  id,
  initial,
  initialError,
  today,
}: {
  id: string;
  initial: LeadDetail | null;
  initialError: string | null;
  today: string;
}) {
  const [detail, setDetail] = useState<LeadDetail | null>(initial);
  const [banner, setBanner] = useState<{ tone: 'warn' | 'crit' | ''; text: string }>(
    initialError ? { tone: 'crit', text: initialError } : { tone: '', text: '' },
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [logging, setLogging] = useState(false);
  const [kind, setKind] = useState('note');

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/leads/${id}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setDetail(body.data as LeadDetail);
  }, [id]);

  if (!detail) {
    return (
      <AdminShell>
        <Link href="/admin/leads" className="back">
          <ArrowLeft size={15} aria-hidden="true" /> All leads
        </Link>
        <PageHead title="Lead not found" />
        <Banner tone="crit">{banner.text || 'That lead could not be loaded.'}</Banner>
      </AdminShell>
    );
  }

  const { lead, events, drafts } = detail;
  const needs = needsOf(lead);
  const replied = awaitingReply(lead);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);

    // Send only what changed: picking the same sequence again must not restart it.
    const changes: Record<string, string> = {};
    for (const field of FIELDS) {
      const next = String(data.get(field) ?? '').trim();
      if (next !== asText(lead[field as keyof LeadRow]).trim()) changes[field] = next;
    }
    if (!Object.keys(changes).length) {
      setSaved('Nothing to save.');
      return;
    }

    setSaving(true);
    setSaved('');
    try {
      const res = await fetch(`/api/admin/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ tone: 'crit', text: body.error || `Couldn't save (${res.status}).` });
        return;
      }
      setBanner({ tone: '', text: '' });
      setSaved(
        changes.sequence_key
          ? 'Saved. Their first email is drafted on the next morning run, then waits for your approval.'
          : 'Saved.',
      );
      await reload();
    } catch {
      setBanner({ tone: 'crit', text: "Couldn't reach the server. Nothing was saved." });
    } finally {
      setSaving(false);
    }
  };

  const log = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (logging) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = String(data.get('body') ?? '').trim();
    if (!text) return;

    setLogging(true);
    try {
      const res = await fetch(`/api/admin/leads/${id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, body: text, touched: data.get('touched') === 'on' }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ tone: 'crit', text: body.error || "Couldn't save that." });
        return;
      }
      form.reset();
      setKind('note');
      await reload();
    } catch {
      setBanner({ tone: 'crit', text: "Couldn't reach the server." });
    } finally {
      setLogging(false);
    }
  };

  return (
    <AdminShell>
      <Link href="/admin/leads" className="back">
        <ArrowLeft size={15} aria-hidden="true" /> All leads
      </Link>
      <PageHead
        label={STAGE_LABEL[lead.stage] || lead.stage}
        title={lead.company}
        help={[lead.contact_name, lead.email, lead.phone, lead.city].filter(Boolean).join(' · ') || undefined}
      />

      <Banner tone={banner.tone}>{banner.text}</Banner>
      {replied && (
        <Banner tone="warn">
          They wrote back on {day(lead.last_reply_at)} and are waiting on you. Answer from Zoho Mail,
          then log it below with “counts as contacting them” ticked.
        </Banner>
      )}
      {lead.unsubscribed_at && (
        <Banner tone="crit">They unsubscribed on {day(lead.unsubscribed_at)}. Do not email them.</Banner>
      )}
      {isOpen(lead) && lead.next_action_on && lead.next_action_on < today && (
        <Banner tone="warn">The next step was due {day(lead.next_action_on)}.</Banner>
      )}
      {!lead.unsubscribed_at && needs.length > 0 && (
        <Banner tone="warn">Follow-up emails can&apos;t start yet — still needs: {needs.join(', ')}.</Banner>
      )}

      <div className="detail">
        <section className="card" aria-labelledby="d-h">
          <h2 id="d-h">Details</h2>
          <form className="form" onSubmit={save} key={lead.updated_at} noValidate>
            <label>
              Company *
              <input name="company" required maxLength={200} defaultValue={lead.company} />
            </label>
            <label>
              Contact name
              <input name="contact_name" maxLength={120} defaultValue={asText(lead.contact_name)} />
            </label>
            <label>
              Email
              <input name="email" type="email" maxLength={200} defaultValue={asText(lead.email)} />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" maxLength={40} defaultValue={asText(lead.phone)} />
            </label>
            <label>
              Website
              <input name="website" maxLength={200} defaultValue={asText(lead.website)} />
            </label>
            <label>
              City
              <input name="city" maxLength={80} defaultValue={asText(lead.city)} />
            </label>
            <label>
              What they do
              <input name="category" maxLength={80} defaultValue={asText(lead.category)} />
            </label>
            <label>
              Stage
              <select name="stage" defaultValue={lead.stage}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              What they might buy
              <select name="deal_type" defaultValue={asText(lead.deal_type)}>
                <option value="">Not sure yet</option>
                {DEAL_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {DEAL_LABEL[d]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Deal value, total ($)
              <input
                name="deal_value"
                type="number"
                min="0"
                step="1"
                inputMode="decimal"
                defaultValue={asText(lead.deal_value)}
              />
            </label>
            <label>
              Months (retainers)
              <input
                name="term_months"
                type="number"
                min="1"
                max="60"
                step="1"
                inputMode="numeric"
                defaultValue={asText(lead.term_months)}
              />
            </label>
            <label>
              Next step on
              <input name="next_action_on" type="date" defaultValue={asText(lead.next_action_on)} />
            </label>
            <label className="wide">
              Why you may email them
              <select name="consent_basis" defaultValue={asText(lead.consent_basis)}>
                <option value="">Not recorded yet — no emails until you set it</option>
                {CONSENT_BASES.map((k) => (
                  <option key={k} value={k}>
                    {CONSENT_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              Follow-up emails
              <select name="sequence_key" defaultValue={asText(lead.sequence_key)}>
                <option value="">None</option>
                {SEQUENCES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} — {s.cadence}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              Notes
              <textarea name="notes" maxLength={4000} defaultValue={asText(lead.notes)} />
            </label>
            <div className="actions">
              <button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <span className="fmsg ok" role="status" aria-live="polite">
                {saved}
              </span>
            </div>
            <p className="hint wide">
              Changing the follow-up emails restarts them from the first one. Marking a lead Client
              with a term sets its renewal emails for 45 days before the term ends. Lost or Declined
              cancels anything waiting to send.
            </p>
          </form>
        </section>

        <div className="stack">
          <section className="card" aria-labelledby="l-h">
            <h2 id="l-h">Log a call, meeting or note</h2>
            <form className="form" onSubmit={log} noValidate>
              <label className="wide">
                What happened
                <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                  <option value="note">Note to self</option>
                  <option value="call">Phone call</option>
                  <option value="meeting">Meeting</option>
                  <option value="email">Email I sent myself</option>
                </select>
              </label>
              <label className="wide">
                Details
                <textarea name="body" maxLength={4000} required />
              </label>
              <label className="wide" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  name="touched"
                  key={kind}
                  defaultChecked={kind !== 'note'}
                  style={{ width: 'auto' }}
                />
                Counts as contacting them (updates “last contact”)
              </label>
              <div className="actions">
                <button type="submit" disabled={logging}>
                  {logging ? 'Saving…' : 'Add to timeline'}
                </button>
              </div>
            </form>
          </section>

          <section className="card" aria-labelledby="e-h">
            <h2 id="e-h">
              Emails <small>{lead.sequence_key ? SEQUENCE_LABEL[lead.sequence_key] : 'no sequence'}</small>
            </h2>
            {drafts.length ? (
              drafts.map((d) => (
                <details key={d.id} className="mail" style={{ marginTop: 0 }}>
                  <summary>
                    Step {d.step + 1}: {d.subject}{' '}
                    <span className={`chip ${d.status === 'sent' ? 'ok' : d.status === 'failed' ? 'crit' : 'warn'}`}>
                      {DRAFT_STATUS[d.status] || d.status}
                      {d.sent_at ? ` ${day(d.sent_at)}` : ''}
                    </span>
                  </summary>
                  <pre className="mail-body">{d.body}</pre>
                  {(d.status === 'pending' || d.status === 'failed') && (
                    <p className="acts-row">
                      <a className="btn" href={PARTNERSHIPS_URL} target="_blank" rel="noopener noreferrer">
                        Approve &amp; send →
                      </a>
                    </p>
                  )}
                </details>
              ))
            ) : (
              <p className="empty-note">
                No emails written yet.{' '}
                {lead.sequence_key
                  ? 'The first one appears after the next 7:15 a.m. run.'
                  : 'Pick follow-up emails on the left to start.'}
              </p>
            )}
          </section>

          <section className="card" aria-labelledby="t-h">
            <h2 id="t-h">
              Timeline <small>added {day(lead.created_at)}</small>
            </h2>
            <ul className="timeline">
              {events.length ? (
                events.map((e) => (
                  <li key={e.id}>
                    <span className="when">{day(e.created_at)}</span>
                    <span>
                      <span className="kind">{e.type.replace(/_/g, ' ')}</span>
                      {e.body}
                    </span>
                  </li>
                ))
              ) : (
                <li>
                  <span />
                  <span className="muted">Nothing yet.</span>
                </li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

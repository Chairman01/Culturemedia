'use client';

// Sales, ported from the Claude page. Data comes from
// public.admin_sales_dashboard(); adding a lead goes through
// /api/admin/leads → public.admin_add_lead(), which writes the CRM row and
// nothing else. No email is ever scheduled or sent from this page.

import { useCallback, useState, type ReactNode } from 'react';

import type { Lead, SalesDashboard } from '@/lib/admin-types';
import { ago, day, money, num } from '../_components/format';
import { ActionRow, AdminNav, Banner, Seg, Tile } from '../_components/ui';

const STAGE_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  engaged: 'Talking',
  proposal: 'Proposal',
  won: 'Client',
  lost: 'Lost',
  declined: 'Declined',
};

const DEAL_LABEL: Record<string, string> = {
  retainer: 'Retainer',
  one_time: 'One-time',
  sponsorship: 'Sponsorship',
  partnership: 'Partnership',
  other: 'Other',
};

const CLOSED = ['won', 'lost', 'declined'];
const PARTNERSHIPS = 'https://www.culturealberta.com/admin/leads';

type Filter = 'open' | 'won' | 'all';

export default function SalesView({
  initial,
  initialError,
  today,
}: {
  initial: SalesDashboard | null;
  initialError: string | null;
  today: string;
}) {
  const [sales, setSales] = useState<SalesDashboard | null>(initial);
  const [banner, setBanner] = useState<{ tone: 'warn' | 'crit' | ''; text: string }>(
    initialError ? { tone: 'crit', text: initialError } : { tone: '', text: '' },
  );
  const [filter, setFilter] = useState<Filter>('open');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/sales', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({
          tone: 'crit',
          text:
            res.status === 401
              ? 'Your sign-in expired. Reload the page to sign in again.'
              : body.error || `Couldn't load the sales data (${res.status}).`,
        });
        return;
      }
      setSales(body.data as SalesDashboard);
      setBanner({ tone: '', text: '' });
    } catch {
      setBanner({ tone: 'crit', text: "Couldn't reach the server. Try Refresh." });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const markDone = useCallback(
    async (id: number) => {
      if (!Number.isInteger(id) || id <= 0) return;
      setBusyId(id);
      try {
        const res = await fetch('/api/admin/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setBanner({
            tone: 'crit',
            text:
              body.error ||
              "Couldn't confirm the update. Press Refresh to see whether it saved before trying again.",
          });
          return;
        }
        await load();
      } catch {
        setBanner({
          tone: 'crit',
          text: "Couldn't confirm the update. Press Refresh to see whether it saved.",
        });
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const t = sales?.totals || {};
  const a = sales?.automation || {};
  const pending = num(a.awaiting_approval) || 0;
  const noConsent = num(a.missing_consent) || 0;
  const errors = num(a.send_errors_7d) || 0;

  const setup = (sales?.setup || []).filter((x) => x.status !== 'done');
  const leads = sales?.leads || [];
  const shown = leads.filter((x) =>
    filter === 'all' ? true : filter === 'won' ? x.stage === 'won' : !CLOSED.includes(x.stage),
  );
  const events = sales?.events || [];
  const drafts = sales?.pending_drafts || [];

  return (
    <div className="wrap">
      <header>
        <div>
          <p className="eyebrow">Culture Media · Partnerships</p>
          <h1>Sales</h1>
        </div>
        <div className="hright">
          <button type="button" onClick={load} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <AdminNav current="sales" />
      <Banner tone={banner.tone}>{banner.text}</Banner>

      <div className="tiles">
        <Tile label="Open leads" value={String(t.open ?? 0)} foot={`${t.leads ?? 0} in the CRM`} />
        <Tile
          label="Replied"
          value={String(t.replied ?? 0)}
          foot={`${t.quiet ?? 0} gone quiet (14+ days)`}
        />
        <Tile
          label="Clients"
          value={String(t.clients ?? 0)}
          foot={`${money(t.booked)} booked`}
        />
        <Tile
          label="Retainer MRR"
          value={money(t.mrr)}
          foot={`${money(t.in_play)} in talks or proposals`}
        />
      </div>

      <div className="grid2">
        <section className="card" aria-labelledby="au-h">
          <h2 id="au-h">
            Automation <small>runs 7:15 a.m. daily</small>
          </h2>
          <ul className="srows">
            <Row label="Last drafted follow-ups" value={a.last_draft_written ? ago(a.last_draft_written, today) : 'not yet'} />
            <Row label="Waiting for your approval" value={String(pending)} tone={pending ? 'warn' : ''} />
            <Row label="Emails sent (7 days / all time)" value={`${a.sent_7d ?? 0} / ${a.sent_total ?? 0}`} />
            <Row label="Due for follow-up today" value={String(a.due_today ?? 0)} />
            <Row
              label="Blocked: no email permission recorded"
              value={String(noConsent)}
              tone={noConsent ? 'warn' : ''}
            />
            <Row label="No email sequence chosen yet" value={String(a.no_sequence ?? 0)} />
            <Row label="Send errors (7 days)" value={String(errors)} tone={errors ? 'crit' : ''} />
            <Row label="Unsubscribed" value={String(a.unsubscribed ?? 0)} />
          </ul>

          <p className="sub">Setup still to do</p>
          <ul className="acts">
            {setup.length ? (
              setup.map((x, i) => (
                <ActionRow
                  key={x.id}
                  action={x}
                  n={i + 1}
                  today={today}
                  onDone={markDone}
                  busy={busyId === Number(x.id)}
                  disabled={busyId !== null}
                />
              ))
            ) : (
              <li>
                <span />
                <span className="muted">All set.</span>
              </li>
            )}
          </ul>
        </section>

        <AddLeadCard onAdded={load} />
      </div>

      <section className="card" aria-labelledby="pl-h" style={{ marginBottom: 12 }}>
        <div className="chead">
          <h2 id="pl-h">
            Pipeline <small>{shown.length} shown</small>
          </h2>
          <Seg
            label="Pipeline filter"
            value={filter}
            onChange={setFilter}
            options={[
              { k: 'open', label: 'Open' },
              { k: 'won', label: 'Clients' },
              { k: 'all', label: 'All' },
            ]}
          />
        </div>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Type</th>
                <th>Stage</th>
                <th>Value</th>
                <th>Last contact</th>
                <th>Next step</th>
                <th>Needs</th>
              </tr>
            </thead>
            <tbody>
              {shown.length ? (
                shown.map((x, i) => <PipelineRow key={x.id ?? `${x.company}-${i}`} lead={x} />)
              ) : (
                <tr>
                  <td colSpan={7} className="l muted">
                    {leads.length
                      ? 'Nothing in this view.'
                      : 'No leads yet. Add one above, or connect your sheet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid2">
        <section className="card" aria-labelledby="ev-h">
          <h2 id="ev-h">Recent activity</h2>
          <ul className="srows">
            {events.length ? (
              events.slice(0, 12).map((e, i) => (
                <li key={i}>
                  <span>
                    {e.company || '—'}
                    <span className="sub-line">{e.body || e.type || ''}</span>
                  </span>
                  <b className="soft">{day(e.at)}</b>
                </li>
              ))
            ) : (
              <li className="empty-note">Nothing yet. Add a lead or import your sheet.</li>
            )}
          </ul>
        </section>

        <section className="card" aria-labelledby="dr-h">
          <h2 id="dr-h">
            Waiting for your approval{' '}
            <small>
              <a href={PARTNERSHIPS} target="_blank" rel="noopener noreferrer">
                Open Partnerships →
              </a>
            </small>
          </h2>
          <ul className="srows">
            {drafts.length ? (
              drafts.map((d, i) => (
                <li key={i}>
                  <span>
                    {d.company || '—'}
                    <span className="sub-line">{d.subject || ''}</span>
                  </span>
                  <b className="soft">step {(num(d.step) || 0) + 1}</b>
                </li>
              ))
            ) : (
              <li className="empty-note">Nothing waiting.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <li>
      <span>{label}</span>
      <b className={tone}>{value}</b>
    </li>
  );
}

function PipelineRow({ lead }: { lead: Lead }) {
  const needs: string[] = [];
  if (lead.unsubscribed) {
    needs.push('unsubscribed');
  } else {
    if (lead.email && !lead.consent_basis && lead.stage !== 'won') needs.push('email permission');
    if (!lead.email && lead.stage !== 'won') needs.push('email address');
    if (!lead.sequence_key && !CLOSED.includes(lead.stage)) needs.push('sequence');
  }

  const term = num(lead.term_months);
  const value = num(lead.deal_value);
  const valueText = value === null ? '—' : term ? `${money(value / term)}/mo × ${term}` : money(value);
  const who = [lead.contact_name, lead.email].filter(Boolean).join(' · ');

  return (
    <tr>
      <td className="co">
        <b>{lead.company}</b>
        <span>{who || lead.city || ''}</span>
      </td>
      <td className="l">{DEAL_LABEL[lead.deal_type || ''] || '—'}</td>
      <td className="l">
        <span className={`pill ${lead.stage}`}>{STAGE_LABEL[lead.stage] || lead.stage}</span>
      </td>
      <td>{valueText}</td>
      <td>{day(lead.last_contacted_at)}</td>
      <td>{lead.next_action_on ? day(lead.next_action_on) : '—'}</td>
      <td className="l">
        {needs.length ? (
          needs.map((n) => (
            <span key={n} className="flag">
              {n}{' '}
            </span>
          ))
        ) : (
          <span className="muted">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── add a lead ───────────────────────────────────────────────────────────────

function AddLeadCard({ onAdded }: { onAdded: () => Promise<void> }) {
  const [dealType, setDealType] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'crit' | ''; text: string }>({ tone: '', text: '' });
  const retainer = dealType === 'retainer';

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const val = (name: string) => String(data.get(name) ?? '').trim();

    if (!val('company')) {
      setMsg({ tone: 'crit', text: 'Company is required.' });
      (form.elements.namedItem('company') as HTMLInputElement | null)?.focus();
      return;
    }
    const price = val('deal_value') === '' ? null : Number(val('deal_value'));
    const months = val('term_months') === '' ? null : Math.round(Number(val('term_months')));
    if (price !== null && !(price >= 0)) {
      setMsg({ tone: 'crit', text: 'Check the value and months.' });
      return;
    }
    if (retainer && price !== null && !(months !== null && months >= 1)) {
      setMsg({ tone: 'crit', text: 'Add how many months the retainer runs.' });
      return;
    }

    // The monthly price and the term go over as typed; the route turns them
    // into deal_value = price × months for retainers.
    const payload = {
      company: val('company'),
      contact_name: val('contact_name'),
      email: val('email'),
      website: val('website'),
      city: val('city'),
      category: val('category'),
      deal_type: val('deal_type'),
      stage: val('stage'),
      consent_basis: val('consent_basis'),
      notes: val('notes'),
      deal_value: val('deal_value'),
      term_months: retainer ? val('term_months') : '',
    };

    setBusy(true);
    setMsg({ tone: '', text: 'Saving…' });
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({
          tone: 'crit',
          text:
            res.status === 401
              ? 'Your sign-in expired. Reload the page to sign in again.'
              : body.error || "Couldn't add it. Press Refresh and check the pipeline before trying again.",
        });
        return;
      }
      setMsg({ tone: 'ok', text: `Added ${payload.company}.` });
      form.reset();
      setDealType('');
      await onAdded();
    } catch {
      setMsg({
        tone: 'crit',
        text: "Couldn't confirm it saved. Press Refresh and check the pipeline before adding again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="add-h">
      <h2 id="add-h">Add a lead or client</h2>
      <form className="form" onSubmit={submit} noValidate>
        <label>
          Company *
          <input name="company" required maxLength={200} autoComplete="organization" />
        </label>
        <label>
          Contact name
          <input name="contact_name" maxLength={120} autoComplete="name" />
        </label>
        <label>
          Email
          <input name="email" type="email" maxLength={200} autoComplete="email" />
        </label>
        <label>
          Website
          <input name="website" maxLength={200} placeholder="example.com" />
        </label>
        <label>
          City
          <input name="city" maxLength={80} />
        </label>
        <label>
          What they do
          <input name="category" maxLength={80} placeholder="Restaurant, real estate…" />
        </label>
        <label>
          Deal type
          <select name="deal_type" value={dealType} onChange={(e) => setDealType(e.target.value)}>
            <option value="">Not sure yet</option>
            <option value="retainer">Retainer (monthly)</option>
            <option value="one_time">One-time campaign</option>
            <option value="sponsorship">Sponsorship (newsletter or section)</option>
            <option value="partnership">Partnership (trade or co-promotion)</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Stage
          <select name="stage" defaultValue="new">
            <option value="new">New lead</option>
            <option value="contacted">Contacted</option>
            <option value="engaged">Talking</option>
            <option value="proposal">Proposal sent</option>
            <option value="won">Client (signed)</option>
          </select>
        </label>
        <label>
          {retainer ? 'Monthly price ($)' : 'Deal value ($)'}
          <input name="deal_value" type="number" min="0" step="1" inputMode="decimal" />
        </label>
        {retainer && (
          <label>
            Months
            <input name="term_months" type="number" min="1" max="60" step="1" inputMode="numeric" />
          </label>
        )}
        <label className="wide">
          Email permission
          <select name="consent_basis" defaultValue="">
            <option value="">Not recorded yet (no emails until you set it)</option>
            <option value="implied_inquiry">They contacted us first</option>
            <option value="implied_published">
              Their business email is published on their website
            </option>
            <option value="express">They agreed to get emails from us</option>
          </select>
        </label>
        <label className="wide">
          Notes
          <textarea name="notes" maxLength={2000} />
        </label>
        <div className="actions">
          <button type="submit" disabled={busy}>
            Add to pipeline
          </button>
          <span className={`fmsg ${msg.tone}`} role="status" aria-live="polite">
            {msg.text}
          </span>
        </div>
        <p className="hint wide">
          Adding someone never sends an email. Follow-ups only start after you pick an email
          sequence for them in{' '}
          <a href={PARTNERSHIPS} target="_blank" rel="noopener noreferrer">
            Partnerships
          </a>
          , and every email still waits for your Approve &amp; send.
        </p>
      </form>
    </section>
  );
}

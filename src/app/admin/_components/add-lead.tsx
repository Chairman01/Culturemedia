'use client';

// The one form for getting someone into the CRM — a cold prospect, an inquiry
// that landed in the inbox, or a client who already signed. Posts to
// /api/admin/leads → public.admin_add_lead(). Saving never sends an email;
// choosing a sequence only asks the engine to draft one for approval.

import { useEffect, useState } from 'react';

import { CONSENT_BASES, CONSENT_LABEL, SEQUENCES } from '@/lib/crm';

export interface LeadPrefill {
  company?: string;
  contact_name?: string;
  email?: string;
  consent_basis?: string;
  sequence_key?: string;
  notes?: string;
  /** one_time, retainer… — from how the email was filed on the Inbox page. */
  deal_type?: string;
}

export const PREFILL_KEY = 'cm-admin-lead-prefill';

export function AddLeadForm({ onAdded }: { onAdded: (id: string | null) => void | Promise<void> }) {
  const [prefill, setPrefill] = useState<LeadPrefill>({});
  const [formKey, setFormKey] = useState(0);
  const [dealType, setDealType] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'crit' | ''; text: string }>({ tone: '', text: '' });
  const retainer = dealType === 'retainer';

  // "Add as lead" on the Inbox page hands the sender over through
  // sessionStorage, so a name and address never travel in a URL.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PREFILL_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PREFILL_KEY);
      const parsed = JSON.parse(raw) as LeadPrefill;
      setPrefill(parsed);
      if (parsed.deal_type) setDealType(parsed.deal_type);
      setFormKey((k) => k + 1);
    } catch {
      /* no prefill */
    }
  }, []);

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
    if (val('sequence_key') && (!val('email') || !val('consent_basis'))) {
      setMsg({
        tone: 'crit',
        text: 'To start emails they need an email address and an email permission.',
      });
      return;
    }

    const payload: Record<string, string> = {};
    for (const name of [
      'company', 'contact_name', 'email', 'phone', 'website', 'city', 'category', 'deal_type',
      'stage', 'consent_basis', 'sequence_key', 'notes', 'deal_value',
    ]) {
      payload[name] = val(name);
    }
    // The monthly price and the term go over as typed; the route turns them
    // into deal_value = price × months for retainers.
    payload.term_months = retainer ? val('term_months') : '';

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
              : body.error || "Couldn't add it. Check the list before trying again.",
        });
        return;
      }
      setMsg({
        tone: body.warning ? 'crit' : 'ok',
        text:
          body.warning ||
          (payload.sequence_key
            ? `Added ${payload.company}. Their first email will be drafted on the next morning run for you to approve.`
            : `Added ${payload.company}.`),
      });
      form.reset();
      setDealType('');
      setPrefill({});
      await onAdded(body.id ?? null);
    } catch {
      setMsg({ tone: 'crit', text: "Couldn't confirm it saved. Check the list before adding again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" key={formKey} onSubmit={submit} noValidate>
      <label>
        Company *
        <input name="company" required maxLength={200} defaultValue={prefill.company} autoComplete="off" />
      </label>
      <label>
        Contact name
        <input name="contact_name" maxLength={120} defaultValue={prefill.contact_name} autoComplete="off" />
      </label>
      <label>
        Email
        <input name="email" type="email" maxLength={200} defaultValue={prefill.email} autoComplete="off" />
      </label>
      <label>
        Phone
        <input name="phone" type="tel" maxLength={40} autoComplete="off" />
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
        Where they are at
        <select name="stage" defaultValue="new">
          <option value="new">New — not contacted yet</option>
          <option value="contacted">Contacted</option>
          <option value="engaged">Talking</option>
          <option value="proposal">Proposal sent</option>
          <option value="won">Client (signed)</option>
        </select>
      </label>
      <label>
        What they might buy
        <select name="deal_type" value={dealType} onChange={(e) => setDealType(e.target.value)}>
          <option value="">Not sure yet</option>
          <option value="one_time">One-time feature or campaign</option>
          <option value="sponsorship">Sponsorship (section or newsletter)</option>
          <option value="retainer">Retainer (monthly)</option>
          <option value="partnership">Partnership (trade or co-promotion)</option>
          <option value="other">Other</option>
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
        Why you may email them
        <select name="consent_basis" defaultValue={prefill.consent_basis ?? ''} key={`c-${formKey}`}>
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
        <select name="sequence_key" defaultValue={prefill.sequence_key ?? ''} key={`s-${formKey}`}>
          <option value="">Don&apos;t email yet</option>
          {SEQUENCES.filter((s) => s.key !== 'renewal').map((s) => (
            <option key={s.key} value={s.key}>
              {s.label} — {s.cadence}
            </option>
          ))}
        </select>
      </label>
      <label className="wide">
        Notes
        <textarea name="notes" maxLength={2000} defaultValue={prefill.notes} />
      </label>
      <div className="actions">
        <button type="submit" disabled={busy}>
          Add to leads
        </button>
        <span className={`fmsg ${msg.tone}`} role="status" aria-live="polite">
          {msg.text}
        </span>
      </div>
      <p className="hint wide">
        Saving never sends anything. If you pick follow-up emails, the first one is written for you
        on the next morning run (7:15 a.m.) and waits in your Inbox until you approve it.
      </p>
    </form>
  );
}

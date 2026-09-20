'use client';

// Revenue: everything the business takes in — Mediavine and AdSense, and the
// partnerships and retainers invoiced by hand — in CAD, year over year.

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

import type { Scorecard } from '@/lib/admin-types';
import {
  CATEGORY_LABEL,
  INVOICE_CATEGORIES,
  STATUS_LABEL,
  WORK_LABEL,
  growth,
  summarise,
  type Invoice,
} from '@/lib/revenue';
import { day, money, monthLabel } from '../_components/format';
import { RevenueColumns } from '../_components/revenue-chart';
import { AdminShell, PageHead } from '../_components/shell';
import { Banner, Seg, Tile } from '../_components/ui';

type Filter = 'all' | 'partnerships' | 'ads' | 'unpaid' | 'work';

function Delta({ now, before, label }: { now: number; before: number; label: string }) {
  const g = growth(now, before);
  if (!g) return <span>{before > 0 ? '' : `nothing by this date ${label}`}</span>;
  return (
    <>
      <span className={`delta ${g.up ? 'up' : 'down'}`}>{g.text}</span>
      <span>
        vs {money(before)} by this date {label}
      </span>
    </>
  );
}

export default function RevenueView({
  initial,
  initialError,
  scorecard,
  customers,
  today,
}: {
  /** `e:<email>` and `c:<company>` → lead id, so a customer name opens their record. */
  customers: Record<string, string>;
  initial: Invoice[];
  initialError: string | null;
  scorecard: Scorecard | null;
  today: string;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>(initial);
  const [banner, setBanner] = useState(initialError || '');
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const s = useMemo(() => summarise(invoices, scorecard, today), [invoices, scorecard, today]);
  const lastYear = String(s.thisYear - 1);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/revenue', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setInvoices(body.data as Invoice[]);
      setBanner('');
    } else {
      setBanner(body.error || `Couldn't load invoices (${res.status}).`);
    }
  }, []);

  const patch = async (id: number, changes: Record<string, unknown>) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/revenue/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner(body.error || "Couldn't save that.");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const shown = invoices.filter((i) =>
    filter === 'all'
      ? true
      : filter === 'ads'
        ? i.category === 'adsense'
        : filter === 'partnerships'
          ? i.category !== 'adsense'
          : filter === 'unpaid'
            ? i.status === 'sent'
            : i.status === 'paid' && i.work_status !== 'complete',
  );

  return (
    <AdminShell>
      <PageHead
        title="Revenue"
        help="Everything the business takes in — ads, partnerships and retainers — in Canadian dollars, counted in the month it was paid."
      >
        <button type="button" className="btn" onClick={() => setAdding((a) => !a)}>
          <Plus size={16} aria-hidden="true" />
          {adding ? 'Close' : 'Record an invoice'}
        </button>
      </PageHead>

      <Banner tone="crit">{banner}</Banner>

      {adding && (
        <section className="card" aria-labelledby="add-h" style={{ marginBottom: 12 }}>
          <h2 id="add-h">Record an invoice or a payment</h2>
          <AddInvoiceForm today={today} onAdded={load} />
        </section>
      )}

      <div className="tiles">
        <Tile
          label={`All revenue, ${s.thisYear} so far`}
          value={money(s.ytd.total)}
          foot={<Delta now={s.ytd.total} before={s.ytdLastYear.total} label={`in ${lastYear}`} />}
        />
        <Tile
          label="Partnerships & retainers"
          value={money(s.ytd.partnerships)}
          foot={<Delta now={s.ytd.partnerships} before={s.ytdLastYear.partnerships} label={`in ${lastYear}`} />}
        />
        <Tile
          label="Ads (Mediavine + AdSense)"
          value={money(s.ytd.ads)}
          foot={<span>{s.ytd.total > 0 ? `${Math.round((s.ytd.ads / s.ytd.total) * 100)}% of everything` : ''}</span>}
        />
        <Tile
          label="Loose ends"
          value={s.owed > 0 ? money(s.owed) : String(s.workOwed.length)}
          foot={
            <span>
              {s.owed > 0 ? `owed to you on ${s.owedCount} unpaid · ` : ''}
              {s.workOwed.length
                ? `${s.workOwed.length} paid job${s.workOwed.length === 1 ? '' : 's'} you still owe work on`
                : 'no paid work outstanding'}
            </span>
          }
        />
      </div>

      <div className="grid2">
        <section className="card" aria-labelledby="y-h">
          <h2 id="y-h">Year over year</h2>
          <RevenueColumns
            ariaLabel="Revenue by year, split into partnerships and ads"
            columns={s.years.map((y) => ({
              label: String(y.year),
              ads: y.ads,
              partnerships: y.partnerships,
              partial: y.year === s.thisYear,
            }))}
          />
          <p className="cnote">
            {s.thisYear} is lighter because it is still in progress. Mediavine is converted from
            USD at each month&apos;s Bank of Canada rate
            {s.approxFx ? '; months with no rate yet use the latest one' : ''}.
          </p>
        </section>

        <section className="card" aria-labelledby="m-h">
          <h2 id="m-h">
            {s.thisYear} month by month <small>grey is {lastYear}</small>
          </h2>
          <RevenueColumns
            ariaLabel={`Revenue by month in ${s.thisYear}, with ${lastYear} alongside`}
            ghostName={lastYear}
            columns={s.months.map((m) => ({
              label: monthLabel(m.month),
              ads: m.ads,
              partnerships: m.partnerships,
              ghost: m.lastYear,
              partial: m.partial,
              future: m.future,
            }))}
          />
          <p className="cnote">Hover a month for the split. The lighter month is this one, so far.</p>
        </section>
      </div>

      <details className="card guide" style={{ marginBottom: 12 }}>
        <summary>See the years as a table</summary>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Partnerships &amp; retainers</th>
                <th>Ads</th>
                <th>Total</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {s.years.map((y, i) => {
                const g = i > 0 ? growth(y.total, s.years[i - 1].total) : null;
                return (
                  <tr key={y.year}>
                    <td>
                      {y.year}
                      {y.year === s.thisYear ? ' (so far)' : ''}
                    </td>
                    <td>{money(y.partnerships)}</td>
                    <td>{money(y.ads)}</td>
                    <td>{money(y.total)}</td>
                    <td>{g ? g.text : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      <section className="card" aria-labelledby="i-h">
        <div className="chead">
          <h2 id="i-h">
            Invoices <small>{shown.length} shown</small>
          </h2>
          <Seg
            label="Which invoices"
            value={filter}
            onChange={setFilter}
            options={[
              { k: 'all', label: 'All' },
              { k: 'partnerships', label: 'Partnerships' },
              { k: 'ads', label: 'Ads' },
              { k: 'unpaid', label: `Unpaid ${s.owedCount}` },
              { k: 'work', label: `Work owed ${s.workOwed.length}` },
            ]}
          />
        </div>
        <div className="tw" style={{ marginTop: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>No.</th>
                <th>Type</th>
                <th>Invoiced</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Status</th>
                <th>Work</th>
              </tr>
            </thead>
            <tbody>
              {shown.length ? (
                shown.map((i) => (
                  <tr key={i.id}>
                    <td className="co">
                      <CustomerCell invoice={i} customers={customers} />
                    </td>
                    <td>{i.invoice_number || '—'}</td>
                    <td className="l">{CATEGORY_LABEL[i.category] || i.category}</td>
                    <td>{day(i.invoiced_on)} {i.invoiced_on.slice(0, 4)}</td>
                    <td>{money(i.amount)}</td>
                    <td>{i.paid_on ? `${day(i.paid_on)} ${i.paid_on.slice(0, 4)}` : '—'}</td>
                    <td className="l">
                      {i.status === 'sent' ? (
                        <button
                          type="button"
                          disabled={busy === i.id}
                          onClick={() => patch(i.id, { status: 'paid', paid_on: today, amount_paid: i.amount })}
                        >
                          Mark paid today
                        </button>
                      ) : (
                        <span className={`chip ${i.status === 'paid' ? 'ok' : 'none'}`}>
                          {STATUS_LABEL[i.status] || i.status}
                        </span>
                      )}
                    </td>
                    <td className="l">
                      {i.work_status !== 'complete' ? (
                        <button
                          type="button"
                          disabled={busy === i.id}
                          onClick={() => patch(i.id, { work_status: 'complete' })}
                          title={WORK_LABEL[i.work_status]}
                        >
                          Mark work done
                        </button>
                      ) : (
                        <span className="muted">Done</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="l muted">
                    Nothing in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}

/** The customer's name, linked to their record in Leads when there is one. */
function CustomerCell({ invoice, customers }: { invoice: Invoice; customers: Record<string, string> }) {
  const leadId =
    (invoice.email && customers[`e:${invoice.email.toLowerCase()}`]) ||
    customers[`c:${invoice.customer.toLowerCase()}`];
  const inner = (
    <>
      <b>{invoice.customer}</b>
      <span>{invoice.notes || invoice.email || ''}</span>
    </>
  );
  return leadId ? <Link href={`/admin/leads/${leadId}`}>{inner}</Link> : inner;
}

function AddInvoiceForm({ today, onAdded }: { today: string; onAdded: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('paid');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'crit' | ''; text: string }>({ tone: '', text: '' });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (!String(data.customer || '').trim()) {
      setMsg({ tone: 'crit', text: 'Who paid you? Customer is required.' });
      return;
    }
    setBusy(true);
    setMsg({ tone: '', text: 'Saving…' });
    try {
      const res = await fetch('/api/admin/revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ tone: 'crit', text: body.error || "Couldn't save it." });
        return;
      }
      const c = body.customer as { how: string; checkInOn: string | null } | null;
      const about = c
        ? ` ${c.how === 'created' ? 'Added them to your customers' : 'Updated their customer record'}${
            c.checkInOn ? `, check-in booked for ${day(c.checkInOn)}` : ''
          }.`
        : '';
      setMsg({ tone: 'ok', text: `Recorded ${String(data.customer)}.${about}` });
      form.reset();
      setStatus('paid');
      await onAdded();
    } catch {
      setMsg({ tone: 'crit', text: "Couldn't reach the server. Check the list before adding again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label>
        Customer *
        <input name="customer" required maxLength={200} autoComplete="off" />
      </label>
      <label>
        Their email
        <input name="email" type="email" maxLength={200} autoComplete="off" />
      </label>
      <label>
        Invoice number
        <input name="invoice_number" maxLength={40} />
      </label>
      <label>
        What it was for
        <select name="category" defaultValue="partnership">
          {INVOICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Invoice date
        <input name="invoiced_on" type="date" defaultValue={today} required />
      </label>
      <label>
        Amount ($ CAD)
        <input name="amount" type="number" min="0" step="0.01" inputMode="decimal" />
      </label>
      <label>
        Payment
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="paid">Paid</option>
          <option value="sent">Sent — not paid yet</option>
          <option value="draft">Draft</option>
        </select>
      </label>
      {status === 'paid' && (
        <label>
          Date paid
          <input name="paid_on" type="date" defaultValue={today} />
        </label>
      )}
      <label>
        The work
        <select name="work_status" defaultValue="complete">
          <option value="complete">Delivered</option>
          <option value="in_progress">In progress</option>
          <option value="pending">Not started — I owe it</option>
        </select>
      </label>
      <label className="wide">
        Notes
        <textarea name="notes" maxLength={2000} />
      </label>
      <div className="actions">
        <button type="submit" disabled={busy}>
          Save
        </button>
        <span className={`fmsg ${msg.tone}`} role="status" aria-live="polite">
          {msg.text}
        </span>
      </div>
    </form>
  );
}

'use client';

// Revenue: everything the business takes in — Mediavine and AdSense, and the
// partnerships and retainers invoiced by hand — against what it costs to run,
// in USD or CAD, year over year.

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Scorecard } from '@/lib/admin-types';
import {
  CATEGORY_LABEL,
  INVOICE_CATEGORIES,
  STATUS_LABEL,
  WORK_LABEL,
  growth,
  summarise,
  type Currency,
  type Expense,
  type Invoice,
} from '@/lib/revenue';
import { cash, day, money, monthLabel } from '../_components/format';
import { RevenueBand } from '../_components/revenue-band';
import { RevenueColumns } from '../_components/revenue-chart';
import { RevenueDetail, type RevenueTopic } from '../_components/revenue-detail';
import { AdminShell, PageHead } from '../_components/shell';
import { Banner, Seg, Tile } from '../_components/ui';

type Filter = 'all' | 'partnerships' | 'ads' | 'unpaid' | 'work';

// Shared with the Scorecard, so the choice follows you between the two pages.
const CURRENCY_KEY = 'cm-admin-currency';

export default function RevenueView({
  initial,
  initialExpenses,
  initialError,
  scorecard,
  customers,
  today,
}: {
  initial: Invoice[];
  initialExpenses: Expense[];
  initialError: string | null;
  scorecard: Scorecard | null;
  /** `e:<email>` and `c:<company>` → lead id, so a customer name opens their record. */
  customers: Record<string, string>;
  today: string;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>(initial);
  const [topic, setTopic] = useState<RevenueTopic | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [banner, setBanner] = useState(initialError || '');
  const [currency, setCurrency] = useState<Currency>('CAD');
  const [filter, setFilter] = useState<Filter>('all');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  // Read after mount: the server render cannot know the saved choice.
  useEffect(() => {
    try {
      if (localStorage.getItem(CURRENCY_KEY) === 'USD') setCurrency('USD');
    } catch {
      /* blocked storage — CAD is fine */
    }
  }, []);
  const pickCurrency = (c: Currency) => {
    setCurrency(c);
    try {
      localStorage.setItem(CURRENCY_KEY, c);
    } catch {
      /* ignore */
    }
  };

  const s = useMemo(
    () => summarise(invoices, scorecard, today, { currency, expenses }),
    [invoices, scorecard, today, currency, expenses],
  );
  const lastYear = String(s.thisYear - 1);
  const monthsSoFar = s.months.filter((m) => !m.future && m.expenses !== 0).length || 1;
  const biggest = s.expenseCategories[0];

  const loadInvoices = useCallback(async () => {
    const res = await fetch('/api/admin/revenue', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setInvoices(body.data as Invoice[]);
      setBanner('');
    } else {
      setBanner(body.error || `Couldn't load invoices (${res.status}).`);
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    const res = await fetch('/api/admin/revenue/expenses', { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (res.ok) setExpenses(body.data as Expense[]);
    else setBanner(body.error || `Couldn't load expenses (${res.status}).`);
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
      await loadInvoices();
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
        help="What came in, what it cost, and what you kept — ads, partnerships and retainers together, counted in the month the money moved."
      >
        <Seg
          label="Currency"
          value={currency}
          onChange={pickCurrency}
          options={[
            { k: 'CAD', label: 'CAD', title: 'Everything in Canadian dollars' },
            { k: 'USD', label: 'USD', title: 'Everything in US dollars' },
          ]}
        />
        <button type="button" className="btn" onClick={() => setAdding((a) => !a)}>
          <Plus size={16} aria-hidden="true" />
          {adding ? 'Close' : 'Record an invoice'}
        </button>
      </PageHead>

      <Banner tone="crit">{banner}</Banner>

      {adding && (
        <section className="card" aria-labelledby="add-h" style={{ marginBottom: 12 }}>
          <h2 id="add-h">Record an invoice or a payment</h2>
          <AddInvoiceForm today={today} onAdded={loadInvoices} />
        </section>
      )}

      <RevenueBand
        sc={scorecard}
        invoices={invoices}
        expenses={expenses}
        currency={currency}
        today={today}
        linkToRevenue={false}
      />

      {topic && (
        <RevenueDetail topic={topic} s={s} invoices={invoices} currency={currency} onClose={() => setTopic(null)} />
      )}

      <div className="tiles">
        <Tile
          onOpen={() => setTopic('expenses')}
          label={`Expenses, ${s.thisYear} so far`}
          value={cash(s.ytdExpenses, currency)}
          foot={<span>about {cash(s.ytdExpenses / monthsSoFar, currency)} a month</span>}
        />
        <Tile
          onOpen={() => setTopic('kept')}
          label="Kept after expenses"
          value={cash(s.ytdKept, currency)}
          foot={
            <span>
              {s.ytd.total > 0 ? `${Math.round((s.ytdKept / s.ytd.total) * 100)}% of what came in` : 'nothing in yet'}
            </span>
          }
        />
        <Tile
          onOpen={() => setTopic('expenses')}
          label="Biggest cost"
          value={biggest ? cash(biggest.total, currency) : '—'}
          foot={
            <span>
              {biggest
                ? `${biggest.category} · ${Math.round((biggest.total / (s.ytdExpenses || 1)) * 100)}% of spending`
                : 'no expenses on file'}
            </span>
          }
        />
        <Tile
          onOpen={() => setTopic('loose')}
          label="Loose ends"
          value={s.owed > 0 ? cash(s.owed, currency) : String(s.workOwed.length)}
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

      <section className="card" aria-labelledby="m-h" style={{ marginBottom: 12 }}>
        <h2 id="m-h">
          {s.thisYear} month by month <small>grey is {lastYear} · the black tick is that month&apos;s expenses</small>
        </h2>
        <RevenueColumns
          ariaLabel={`Revenue by month in ${s.thisYear} with expenses marked, and ${lastYear} alongside`}
          ghostName={lastYear}
          currency={currency}
          wide
          columns={s.months.map((m) => ({
            label: monthLabel(m.month),
            ads: m.ads,
            partnerships: m.partnerships,
            ghost: m.lastYear,
            expenses: m.future ? null : m.expenses,
            partial: m.partial,
            future: m.future,
          }))}
        />
        <p className="cnote">
          Hover a month for the split. Whatever stands above the tick is what that month kept; a bar
          below its tick lost money. The lighter month is this one, so far.
          {currency === 'USD'
            ? ' Canadian-dollar invoices and expenses are converted at each month’s Bank of Canada average; Mediavine is as reported.'
            : ' Mediavine is converted from USD at each month’s Bank of Canada average.'}
          {s.approxFx ? ' A month with no published rate yet uses the latest one.' : ''}
        </p>
      </section>

      <ExpensesCard
        expenses={expenses}
        summaryMonths={s.months.map((m) => ({ month: m.month, future: m.future }))}
        year={s.thisYear}
        today={today}
        onSaved={loadExpenses}
      />

      <details className="card guide" style={{ margin: '12px 0' }}>
        <summary>See the years as a table</summary>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Partnerships &amp; retainers</th>
                <th>Ads</th>
                <th>Total in</th>
                <th>Expenses</th>
                <th>Kept</th>
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
                    <td>{cash(y.partnerships, currency)}</td>
                    <td>{cash(y.ads, currency)}</td>
                    <td>{cash(y.total, currency)}</td>
                    <td>{y.expenses === null ? 'not on file' : cash(y.expenses, currency)}</td>
                    <td>{y.expenses === null ? '—' : cash(y.total - y.expenses, currency)}</td>
                    <td>{g ? g.text : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="cnote">
          Expenses are on file from {s.expensesSince ? monthLabel(s.expensesSince) + ' ' + s.expensesSince.slice(0, 4) : 'nowhere yet'},
          so earlier years show what came in only — not a profit.
        </p>
      </details>

      <section className="card" id="invoices" aria-labelledby="i-h">
        <div className="chead">
          <h2 id="i-h">
            Invoices <small>{shown.length} shown · as invoiced, in CAD</small>
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
                    <td>
                      {day(i.invoiced_on)} {i.invoiced_on.slice(0, 4)}
                    </td>
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

// ─── expenses ─────────────────────────────────────────────────────────────────

/**
 * The spreadsheet, as a page: categories down the side, months across, one
 * figure per cell. Always shown in CAD, as entered — the currency switch
 * changes the totals above, never the ledger.
 */
function ExpensesCard({
  expenses,
  summaryMonths,
  year,
  today,
  onSaved,
}: {
  expenses: Expense[];
  summaryMonths: { month: string; future: boolean }[];
  year: number;
  today: string;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'crit' | ''; text: string }>({ tone: '', text: '' });

  const months = summaryMonths.filter((m) => !m.future).map((m) => m.month);
  const rows = expenses.filter((e) => e.month.startsWith(String(year)));
  const categories = [...new Set(rows.map((e) => e.category))];
  const cell = (category: string, month: string) =>
    rows.find((e) => e.category === category && e.month.startsWith(month));
  const amountOf = (e?: Expense) => (e ? Number(e.amount) || 0 : 0);
  const showCad = (v: number) => (v === 0 ? '—' : v < 0 ? `+${money(-v)}` : money(v));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if (!String(data.category || '').trim()) {
      setMsg({ tone: 'crit', text: 'What was it for? Category is required.' });
      return;
    }
    setBusy(true);
    setMsg({ tone: '', text: 'Saving…' });
    try {
      const res = await fetch('/api/admin/revenue/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ tone: 'crit', text: body.error || "Couldn't save it." });
        return;
      }
      setMsg({
        tone: 'ok',
        text:
          body.result === 'cleared'
            ? `Cleared ${String(data.category)} for ${monthLabel(String(data.month))}.`
            : `Saved ${String(data.category)} for ${monthLabel(String(data.month))}.`,
      });
      (form.elements.namedItem('amount') as HTMLInputElement).value = '';
      (form.elements.namedItem('notes') as HTMLInputElement).value = '';
      await onSaved();
    } catch {
      setMsg({ tone: 'crit', text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-labelledby="x-h">
      <h2 id="x-h">
        Expenses {year} <small>as entered, in CAD · a “+” is a credit</small>
      </h2>
      <div className="tw" style={{ marginTop: 0 }}>
        <table>
          <thead>
            <tr>
              <th>What for</th>
              {months.map((m) => (
                <th key={m}>{monthLabel(m)}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {categories.length ? (
              categories.map((c) => (
                <tr key={c}>
                  <td>{c}</td>
                  {months.map((m) => {
                    const e = cell(c, m);
                    return (
                      <td key={m} title={e?.notes || undefined}>
                        {showCad(amountOf(e))}
                      </td>
                    );
                  })}
                  <td>
                    <b>{showCad(months.reduce((a, m) => a + amountOf(cell(c, m)), 0))}</b>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={months.length + 2} className="l muted">
                  No expenses on file for {year}. Add the first one below.
                </td>
              </tr>
            )}
            {categories.length > 0 && (
              <tr>
                <td className="grp">Total</td>
                {months.map((m) => (
                  <td key={m} className="grp num">
                    {showCad(categories.reduce((a, c) => a + amountOf(cell(c, m)), 0))}
                  </td>
                ))}
                <td className="grp num">
                  {showCad(categories.reduce((a, c) => a + months.reduce((b, m) => b + amountOf(cell(c, m)), 0), 0))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="sub">Set a month&apos;s figure</p>
      <form className="form expense-form" onSubmit={submit} noValidate>
        <label>
          Month
          <input name="month" type="month" defaultValue={today.slice(0, 7)} max={today.slice(0, 7)} required />
        </label>
        <label>
          What for
          <input name="category" list="expense-categories" maxLength={80} placeholder="Vercel, Claude, Phone…" required />
          <datalist id="expense-categories">
            {[...new Set(expenses.map((e) => e.category))].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          Amount ($ CAD)
          <input name="amount" type="number" step="0.01" inputMode="decimal" placeholder="blank clears it" />
        </label>
        <label>
          Note
          <input name="notes" maxLength={500} />
        </label>
        <div className="actions">
          <button type="submit" disabled={busy}>
            Save
          </button>
          <span className={`fmsg ${msg.tone}`} role="status" aria-live="polite">
            {msg.text}
          </span>
        </div>
        <p className="hint wide">
          One figure per thing per month, like your spreadsheet: saving the same month and name again
          replaces it, a blank amount clears it, and a negative amount is a credit or refund.
        </p>
      </form>
    </section>
  );
}

// ─── record an invoice ────────────────────────────────────────────────────────

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

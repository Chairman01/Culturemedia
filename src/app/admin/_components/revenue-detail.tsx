'use client';

// What is behind each revenue figure. Used by the revenue band (on both the
// Revenue and Scorecard pages) and by the Revenue page's tiles, so a number
// explains itself the same way wherever it is clicked.

import Link from 'next/link';

import { CATEGORY_LABEL, type Currency, type Invoice, type RevenueSummary } from '@/lib/revenue';
import { Detail, DetailTable, Explain } from './detail';
import { cash, day, monthLabel } from './format';

export type RevenueTopic = 'partnerships' | 'ads' | 'expenses' | 'kept' | 'loose';

const own = (inv: Invoice, field: 'amount' | 'amount_paid') =>
  cash(inv[field], inv.currency === 'USD' ? 'USD' : 'CAD');

export function RevenueDetail({
  topic,
  s,
  invoices,
  currency,
  onClose,
}: {
  topic: RevenueTopic;
  s: RevenueSummary;
  invoices: Invoice[];
  currency: Currency;
  onClose: () => void;
}) {
  const year = String(s.thisYear);
  // "Dec 7" reads as this year: a date from any other year says which.
  const dated = (iso: string | null | undefined) =>
    iso ? `${day(iso)}${iso.slice(0, 4) !== year ? `, ${iso.slice(0, 4)}` : ''}` : '—';
  // Months that have happened, newest first: the part of the year with numbers in it.
  const months = s.months.filter((m) => !m.future).reverse();
  const period = (m: { month: string; partial: boolean }) => `${monthLabel(m.month)}${m.partial ? ' (so far)' : ''}`;

  if (topic === 'partnerships') {
    // Cash basis, like the total: counted when the money arrived.
    const paid = invoices
      .filter((i) => i.category !== 'adsense' && i.paid_on && i.paid_on.startsWith(year) && Number(i.amount_paid) > 0)
      .sort((a, b) => String(b.paid_on).localeCompare(String(a.paid_on)));
    return (
      <Detail title={`Partnerships & retainers · ${year} so far`} value={cash(s.ytd.partnerships, currency)} onClose={onClose}>
        <Explain>
          Money from businesses that paid you directly — sponsored features, one-time partnerships and
          monthly retainers. It counts in the month the payment arrived, not the month you invoiced.
          This is the number the whole admin is built to grow: ads pay what traffic allows,
          partnerships pay what you sell.
        </Explain>
        <DetailTable
          head={['Paid', 'Customer', 'Type', 'Amount']}
          right={[3]}
          rows={paid.map((i) => [day(i.paid_on), i.customer, CATEGORY_LABEL[i.category] || i.category, own(i, 'amount_paid')])}
          empty={`No partnership payments have arrived in ${year} yet.`}
        />
        <p className="cnote">
          Amounts are shown as they were paid. The total above converts each one to {currency} at that
          month&apos;s average exchange rate.
        </p>
        <p className="acts-row">
          <Link className="btn ghost" href="/admin/revenue#invoices">
            All invoices
          </Link>
        </p>
      </Detail>
    );
  }

  if (topic === 'ads') {
    return (
      <Detail title={`Ad revenue · ${year} so far`} value={cash(s.ytd.ads, currency)} onClose={onClose}>
        <Explain>
          What Mediavine and AdSense earned from people reading the site. Mediavine pays in US dollars
          about 65 days after the month ends, so this is what was earned, not what has reached the bank
          yet. It moves with traffic: more readers and better-paying articles push it up.
        </Explain>
        <DetailTable
          head={['Month', `Ads (${currency})`, 'Same month last year']}
          right={[1, 2]}
          rows={months.map((m) => [period(m), cash(m.ads, currency), m.lastYear ? cash(m.lastYear, currency) : '—'])}
          foot={['Year so far', cash(s.ytd.ads, currency), '']}
        />
        <p className="cnote">
          “Same month last year” is all revenue for that month, ads and partnerships together.
          {currency === 'CAD' ? ' US dollars are converted at each month’s Bank of Canada average rate.' : ''}
        </p>
      </Detail>
    );
  }

  if (topic === 'expenses') {
    const total = s.ytdExpenses || 1;
    return (
      <Detail title={`Expenses · ${year} so far`} value={cash(s.ytdExpenses, currency)} onClose={onClose}>
        <Explain>
          What it cost to run the business: hosting, software, phone, help. One figure per category
          per month, entered from your own records
          {s.expensesSince ? `, on file from ${monthLabel(s.expensesSince)}` : ''}. Earlier years have
          no expenses on file, so they show no profit figure rather than a wrong one.
        </Explain>
        <DetailTable
          head={['Category', 'Year so far', 'Share']}
          right={[1, 2]}
          rows={s.expenseCategories.map((c) => [c.category, cash(c.total, currency), `${Math.round((c.total / total) * 100)}%`])}
          foot={['All expenses', cash(s.ytdExpenses, currency), '100%']}
          empty="No expenses on file yet."
        />
        <h3>Month by month</h3>
        <DetailTable
          head={['Month', 'Spent']}
          right={[1]}
          rows={months.map((m) => [period(m), cash(m.expenses, currency)])}
        />
      </Detail>
    );
  }

  if (topic === 'kept') {
    const margin = s.ytd.total > 0 ? Math.round((s.ytdKept / s.ytd.total) * 100) : null;
    return (
      <Detail title={`Kept after expenses · ${year} so far`} value={cash(s.ytdKept, currency)} onClose={onClose}>
        <Explain>
          Everything that came in, minus everything it cost
          {margin !== null ? ` — you kept ${margin}¢ of every dollar` : ''}. It is before tax and before
          paying yourself, so it is the money available, not take-home pay.
        </Explain>
        <DetailTable
          head={['Month', 'Came in', 'Spent', 'Kept']}
          right={[1, 2, 3]}
          rows={months.map((m) => [period(m), cash(m.total, currency), cash(m.expenses, currency), cash(m.total - m.expenses, currency)])}
          foot={['Year so far', cash(s.ytd.total, currency), cash(s.ytdExpenses, currency), cash(s.ytdKept, currency)]}
        />
      </Detail>
    );
  }

  // Loose ends: money not collected, and work not delivered.
  const unpaid = invoices.filter((i) => i.status === 'sent');
  return (
    <Detail
      title="Loose ends"
      value={`${unpaid.length + s.workOwed.length} to close`}
      onClose={onClose}
    >
      <Explain>
        Two kinds of unfinished business. An invoice you sent that has not been paid is money to chase.
        A job that was paid for and not delivered is a promise to keep — and the one most worth doing
        first, because that customer already said yes.
      </Explain>
      <h3>Paid, work still owed</h3>
      <DetailTable
        head={['Customer', 'Paid', 'Amount']}
        right={[2]}
        rows={s.workOwed.map((i) => [i.customer, dated(i.paid_on || i.invoiced_on), own(i, 'amount_paid')])}
        empty="Nothing owed. Every paid job is marked complete."
      />
      <h3>Invoiced, not paid</h3>
      <DetailTable
        head={['Customer', 'Invoiced', 'Owed']}
        right={[2]}
        rows={unpaid.map((i) => [
          i.customer,
          dated(i.invoiced_on),
          cash(Math.max(0, Number(i.amount) - Number(i.amount_paid)), i.currency === 'USD' ? 'USD' : 'CAD'),
        ])}
        empty="Nobody owes you money."
      />
    </Detail>
  );
}

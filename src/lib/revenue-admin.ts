// Server-side reads and writes on public.revenue_invoices (service role only).

import 'server-only';

import { INVOICE_CATEGORIES, INVOICE_STATUSES, WORK_STATUSES, type Expense, type Invoice } from './revenue';
import { getClient, NOT_CONFIGURED, type AdminResult } from './supabase-admin';

const COLUMNS =
  'id, invoice_number, customer, email, category, invoiced_on, amount, paid_on, amount_paid, status, work_status, currency, notes';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail<T>(where: string, error: unknown): AdminResult<T> {
  console.error(`[admin] ${where} failed`, error);
  return { data: null, error: (error as { message?: string } | null)?.message || `${where} failed` };
}

// ─── expenses ─────────────────────────────────────────────────────────────────

const EXPENSE_COLUMNS = 'id, month, category, amount, currency, notes';

export async function listExpenses(): Promise<AdminResult<Expense[]>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase
    .from('revenue_expenses')
    .select(EXPENSE_COLUMNS)
    .order('month', { ascending: true })
    .limit(5000);
  if (error) return fail('listExpenses', error);
  return { data: (data ?? []) as Expense[], error: null };
}

/**
 * One figure per category per month, like a spreadsheet cell: setting it again
 * replaces it, and an empty amount clears it. A negative amount is a credit.
 */
export async function setExpense(input: Record<string, unknown>): Promise<AdminResult<'saved' | 'cleared'>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };

  const month = text(input.month, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { data: null, error: 'Pick a month.' };
  const category = text(input.category, 80);
  if (!category) return { data: null, error: 'What was it for? Category is required.' };

  const raw = String(input.amount ?? '').replace(/[$,\s]/g, '');
  if (raw === '') {
    const { error } = await supabase.from('revenue_expenses').delete().eq('month', `${month}-01`).eq('category', category);
    if (error) return fail('setExpense', error);
    return { data: 'cleared', error: null };
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || Math.abs(amount) > 10_000_000) return { data: null, error: 'Check the amount.' };

  const { error } = await supabase.from('revenue_expenses').upsert(
    {
      month: `${month}-01`,
      category,
      amount: Math.round(amount * 100) / 100,
      notes: text(input.notes, 500) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'month,category' },
  );
  if (error) return fail('setExpense', error);
  return { data: 'saved', error: null };
}

// ─── invoices ─────────────────────────────────────────────────────────────────

export async function listInvoices(): Promise<AdminResult<Invoice[]>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase
    .from('revenue_invoices')
    .select(COLUMNS)
    .order('invoiced_on', { ascending: false })
    .order('id', { ascending: false })
    .limit(2000);
  if (error) return fail('listInvoices', error);
  return { data: (data ?? []) as Invoice[], error: null };
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Validates the fields present in `input`; returns the row to write or a message. */
function clean(input: Record<string, unknown>, partial: boolean): { row: Record<string, unknown> } | { error: string } {
  const row: Record<string, unknown> = {};
  const has = (k: string) => k in input;

  if (!partial || has('customer')) {
    const customer = text(input.customer, 200);
    if (!customer) return { error: 'Who paid you? Customer is required.' };
    row.customer = customer;
  }
  if (has('invoice_number')) row.invoice_number = text(input.invoice_number, 40) || null;
  if (has('notes')) row.notes = text(input.notes, 2000) || null;
  if (has('email')) {
    const email = text(input.email, 200).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "That email address doesn't look right." };
    row.email = email || null;
  }
  if (has('category')) {
    const category = text(input.category, 40) || 'partnership';
    if (!(INVOICE_CATEGORIES as readonly string[]).includes(category)) return { error: 'Pick a type.' };
    row.category = category;
  }
  if (has('status')) {
    const status = text(input.status, 40) || 'paid';
    if (!(INVOICE_STATUSES as readonly string[]).includes(status)) return { error: 'Pick a payment status.' };
    row.status = status;
  }
  if (has('work_status')) {
    const work = text(input.work_status, 40) || 'complete';
    if (!(WORK_STATUSES as readonly string[]).includes(work)) return { error: 'Pick a work status.' };
    row.work_status = work;
  }
  if (!partial || has('invoiced_on')) {
    const date = text(input.invoiced_on, 10);
    if (!DATE.test(date)) return { error: 'The invoice needs a date.' };
    row.invoiced_on = date;
  }
  if (has('paid_on')) {
    const date = text(input.paid_on, 10);
    if (date && !DATE.test(date)) return { error: 'Check the date paid.' };
    row.paid_on = date || null;
  }
  for (const field of ['amount', 'amount_paid'] as const) {
    if (!has(field)) continue;
    const raw = String(input[field] ?? '').replace(/[$,\s]/g, '');
    const value = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 10_000_000) return { error: 'Check the amounts.' };
    row[field] = Math.round(value * 100) / 100;
  }
  return { row };
}

export interface CustomerLink {
  leadId: string;
  /** 'created' when the invoice made a new customer record, 'updated' when one existed. */
  how: 'created' | 'updated';
  checkInOn: string | null;
}

const plusDays = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/**
 * Everyone who pays becomes (or stays) a customer in Leads with a check-in
 * booked about three months out, so nobody who has bought is ever forgotten.
 * Never emails anyone: it only writes the lead, its timeline and a date.
 */
async function ensureCustomer(inv: Invoice): Promise<CustomerLink | null> {
  const supabase = getClient();
  if (!supabase || inv.category === 'adsense') return null;

  const paidOn = inv.paid_on || inv.invoiced_on;
  const paidAt = new Date(`${paidOn}T18:00:00Z`).toISOString();
  const checkInOn = plusDays(paidOn, 91);
  const amount = Number(inv.amount_paid) || Number(inv.amount) || 0;
  const paid = inv.status === 'paid';
  const line = `Invoice${inv.invoice_number ? ` ${inv.invoice_number}` : ''} recorded: $${amount.toFixed(2)}${
    paid ? ' paid' : ' (not paid yet)'
  }.`;

  const columns = 'id, stage, next_action_on, unsubscribed_at, deal_value';
  let existing = inv.email
    ? (await supabase.from('leads').select(columns).ilike('email', inv.email).limit(1)).data?.[0]
    : undefined;
  existing ??= (await supabase.from('leads').select(columns).ilike('company', inv.customer).limit(1)).data?.[0];

  if (existing) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    // Paying is what makes someone a customer, whatever stage they were at.
    const becameCustomer = paid && !['won', 'lost', 'declined'].includes(existing.stage);
    if (becameCustomer) {
      patch.stage = 'won';
      patch.won_at = paidAt;
    }
    if (paid) patch.deal_value = (Number(existing.deal_value) || 0) + amount;
    if (!existing.next_action_on && !existing.unsubscribed_at) patch.next_action_on = checkInOn;
    await supabase.from('leads').update(patch).eq('id', existing.id);
    await supabase.from('lead_events').insert({
      lead_id: existing.id,
      type: becameCustomer ? 'stage_change' : 'note',
      body: becameCustomer ? `${line} Moved to won — they are a customer now.` : line,
      meta: { via: 'culturemedia.ca revenue', invoiceId: inv.id },
    });
    return {
      leadId: existing.id,
      how: 'updated',
      checkInOn: (patch.next_action_on as string | undefined) ?? existing.next_action_on ?? null,
    };
  }

  const { data: created, error } = await supabase
    .from('leads')
    .insert({
      company: inv.customer,
      email: inv.email,
      tier: 'smb',
      source: 'past_customer',
      stage: 'won',
      deal_type: inv.category === 'retainer' ? 'retainer' : 'one_time',
      deal_value: amount,
      won_at: paidAt,
      last_contacted_at: paidAt,
      next_action_on: checkInOn,
      consent_basis: inv.email ? 'implied_existing' : null,
      consent_note: inv.email
        ? `Bought from us on ${paidOn}. Under CASL that permits marketing email until ${plusDays(paidOn, 730)}.`
        : null,
      notes: `Customer created from an invoice. ${line}`,
    })
    .select('id')
    .single();
  if (error || !created) {
    console.error('[admin] ensureCustomer failed', error);
    return null;
  }
  await supabase.from('lead_events').insert({
    lead_id: created.id,
    type: 'created',
    body: `Customer added from the invoice ledger. ${line}`,
    meta: { via: 'culturemedia.ca revenue', invoiceId: inv.id },
  });
  return { leadId: created.id, how: 'created', checkInOn };
}

export async function addInvoice(
  input: Record<string, unknown>,
): Promise<AdminResult<Invoice> & { customer?: CustomerLink | null }> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  const result = clean(input, false);
  if ('error' in result) return { data: null, error: result.error };
  const row = result.row;

  // A paid invoice with no "paid" details was paid in full on the invoice date.
  if ((row.status ?? 'paid') === 'paid') {
    if (!row.paid_on) row.paid_on = row.invoiced_on;
    if (!('amount_paid' in input) || String(input.amount_paid ?? '') === '') row.amount_paid = row.amount ?? 0;
  }

  const { data, error } = await supabase.from('revenue_invoices').insert(row).select(COLUMNS).single();
  if (error) return fail('addInvoice', error);
  const invoice = data as Invoice;
  return { data: invoice, error: null, customer: await ensureCustomer(invoice) };
}

export async function updateInvoice(id: number, input: Record<string, unknown>): Promise<AdminResult<Invoice>> {
  const supabase = getClient();
  if (!supabase) return { data: null, error: NOT_CONFIGURED };
  if (!Number.isInteger(id) || id <= 0) return { data: null, error: 'Which invoice?' };
  const result = clean(input, true);
  if ('error' in result) return { data: null, error: result.error };
  if (!Object.keys(result.row).length) return { data: null, error: 'Nothing to change.' };

  const { data, error } = await supabase
    .from('revenue_invoices')
    .update({ ...result.row, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) return fail('updateInvoice', error);
  if (!data) return { data: null, error: 'That invoice no longer exists.' };
  return { data: data as Invoice, error: null };
}

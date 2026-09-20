// Server-side reads and writes on public.revenue_invoices (service role only).

import 'server-only';

import { INVOICE_CATEGORIES, INVOICE_STATUSES, WORK_STATUSES, type Invoice } from './revenue';
import { getClient, NOT_CONFIGURED, type AdminResult } from './supabase-admin';

const COLUMNS =
  'id, invoice_number, customer, email, category, invoiced_on, amount, paid_on, amount_paid, status, work_status, currency, notes';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail<T>(where: string, error: unknown): AdminResult<T> {
  console.error(`[admin] ${where} failed`, error);
  return { data: null, error: (error as { message?: string } | null)?.message || `${where} failed` };
}

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

export async function addInvoice(input: Record<string, unknown>): Promise<AdminResult<Invoice>> {
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
  return { data: data as Invoice, error: null };
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

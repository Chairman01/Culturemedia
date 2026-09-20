import { NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { addInvoice, listInvoices } from '@/lib/revenue-admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/revenue — every invoice, newest first
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { data, error } = await listInvoices();
  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json({ data });
}

// POST /api/admin/revenue — record an invoice or a payment. Whoever paid also
// becomes (or stays) a customer in Leads, with a check-in booked. No email is sent.
export async function POST(request: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected an invoice.' }, { status: 400 });
  }
  const { data, error, customer } = await addInvoice(body as Record<string, unknown>);
  if (error) return NextResponse.json({ error }, { status: 400 });
  // `customer` says which lead now carries this sale and when their check-in is.
  return NextResponse.json({ data, customer: customer ?? null });
}

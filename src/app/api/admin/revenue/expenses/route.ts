import { NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { listExpenses, setExpense } from '@/lib/revenue-admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/revenue/expenses — every expense, oldest first
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { data, error } = await listExpenses();
  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json({ data });
}

// PUT /api/admin/revenue/expenses — set one category's figure for one month
// ({ month: "2026-09", category, amount, notes }). An empty amount clears it.
export async function PUT(request: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected an expense.' }, { status: 400 });
  }
  const { data, error } = await setExpense(body as Record<string, unknown>);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true, result: data });
}

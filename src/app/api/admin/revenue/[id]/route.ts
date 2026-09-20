import { NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { updateInvoice } from '@/lib/revenue-admin';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/revenue/:id — mark paid, mark the work delivered, fix a typo
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected an object of changes.' }, { status: 400 });
  }
  const { data, error } = await updateInvoice(Number(id), body as Record<string, unknown>);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ data });
}

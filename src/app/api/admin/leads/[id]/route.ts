import { NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { getLeadDetail, isLeadId, updateLead } from '@/lib/crm-admin';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

// GET /api/admin/leads/:id — the lead, its timeline and its drafted emails
export async function GET(_request: NextRequest, { params }: Context) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { id } = await params;
  if (!isLeadId(id)) return NextResponse.json({ error: 'Not a lead id.' }, { status: 400 });
  const { data, error } = await getLeadDetail(id);
  if (error) return NextResponse.json({ error }, { status: data === null ? 404 : 502 });
  return NextResponse.json({ data });
}

// PATCH /api/admin/leads/:id — edit fields, move stage, pick a sequence.
// Picking a sequence only schedules: the engine drafts the first email on its
// next morning run, and nothing is sent until a draft is approved.
export async function PATCH(request: NextRequest, { params }: Context) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { id } = await params;
  if (!isLeadId(id)) return NextResponse.json({ error: 'Not a lead id.' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected an object of changes.' }, { status: 400 });
  }

  const by = process.env.DASHBOARD_USER || 'admin';
  const { data, error } = await updateLead(id, body as Record<string, unknown>, by);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ data });
}

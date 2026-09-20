import { NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { isLeadId, logLeadEvent } from '@/lib/crm-admin';

export const dynamic = 'force-dynamic';

// POST /api/admin/leads/:id/events — write a note, call, meeting or hand-sent
// email on the timeline. { kind, body, touched } — touched stamps "last
// contacted", which is what clears the lead from "replies to answer".
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { id } = await params;
  if (!isLeadId(id)) return NextResponse.json({ error: 'Not a lead id.' }, { status: 400 });

  let body: { kind?: unknown; body?: unknown; touched?: unknown; follow_up_on?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }

  const { error } = await logLeadEvent(
    id,
    String(body.kind ?? 'note'),
    String(body.body ?? ''),
    body.touched === true,
    typeof body.follow_up_on === 'string' && body.follow_up_on ? body.follow_up_on : null,
  );
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

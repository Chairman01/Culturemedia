import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { setSenderStatus } from '@/lib/mail-senders';

export const dynamic = 'force-dynamic';

// POST /api/admin/inbox/status — { email, status: 'todo' | 'working' | 'done' }
// Where the conversation with a sender stands. Stored on our side only: nothing
// is moved, marked or archived in Zoho or Gmail.
export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { data, error } = await setSenderStatus(body.email, body.status);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ data });
}

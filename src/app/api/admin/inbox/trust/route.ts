import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { setSenderTrust } from '@/lib/mail-senders';

export const dynamic = 'force-dynamic';

// POST /api/admin/inbox/trust — { email, trusted } — remember that a sender is
// safe (or is not after all). This only changes what this page shows: the Zoho
// and Gmail grants are read-only, so nothing is moved, marked or deleted in the
// mailbox itself.
export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { data, error } = await setSenderTrust(body.email, body.trusted !== false, body.note);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ data });
}

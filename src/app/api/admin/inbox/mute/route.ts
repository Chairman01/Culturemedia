import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { setSenderMuted } from '@/lib/mail-senders';

export const dynamic = 'force-dynamic';

// POST /api/admin/inbox/mute — { email, muted } — hide a sender whose mail is
// never something to act on (a newsletter, a product update), or bring them
// back. Stored on our side only: nothing is unsubscribed, filtered, moved or
// deleted in Zoho or Gmail.
export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { data, error } = await setSenderMuted(body.email, body.muted !== false);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ data });
}

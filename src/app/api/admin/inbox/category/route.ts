import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { setSenderCategory } from '@/lib/mail-senders';

export const dynamic = 'force-dynamic';

// POST /api/admin/inbox/category — { email, category } — file a sender as
// Mediavine, a partnership lead, retainer lead, story, client or platform
// (null clears it).
// Stored on our side only: nothing is moved, labelled or archived in Zoho or Gmail.
export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const { data, error } = await setSenderCategory(body.email, body.category ?? null);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ data });
}

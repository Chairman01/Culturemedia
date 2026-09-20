import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { syncInbox } from '@/lib/inbox';

export const dynamic = 'force-dynamic';
// Two mailboxes, three folders each: give it room.
export const maxDuration = 60;

// POST /api/admin/inbox/sync — read Zoho and Gmail (inbox, spam, sent) and
// record what they prove: a lead replied, or you emailed a lead. It never
// sends, deletes, moves or marks mail, and it is safe to run twice.
export async function POST() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  return NextResponse.json({ data: await syncInbox() });
}

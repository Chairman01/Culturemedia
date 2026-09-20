import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { loadInbox } from '@/lib/inbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// GET /api/admin/inbox — replies to answer, drafts to approve, and the mail from
// both mailboxes. Read-only: it changes nothing, in the mailboxes or the CRM.
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  return NextResponse.json({ data: await loadInbox() });
}

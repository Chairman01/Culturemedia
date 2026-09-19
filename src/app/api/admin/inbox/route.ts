import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { loadInbox } from '@/lib/inbox';

export const dynamic = 'force-dynamic';

// GET /api/admin/inbox — replies to answer, drafts to approve, recent Zoho mail.
// Read-only: nothing here sends, replies or marks anything as read.
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  return NextResponse.json({ data: await loadInbox() });
}

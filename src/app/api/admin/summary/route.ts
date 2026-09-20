import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { awaitingReply } from '@/lib/crm';
import { listLeads, listPendingDrafts } from '@/lib/crm-admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/summary — the counts behind the sidebar badges.
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const [leads, drafts] = await Promise.all([listLeads(), listPendingDrafts()]);
  if (leads.error) return NextResponse.json({ error: leads.error }, { status: 502 });

  return NextResponse.json({
    replies: (leads.data ?? []).filter(awaitingReply).length,
    drafts: (drafts.data ?? []).length,
  });
}

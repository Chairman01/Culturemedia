import { NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { isLeadId, unsubscribeLead } from '@/lib/crm-admin';

export const dynamic = 'force-dynamic';

// POST /api/admin/leads/:id/unsubscribe — they asked to stop; never email them again.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { id } = await params;
  if (!isLeadId(id)) return NextResponse.json({ error: 'Not a lead id.' }, { status: 400 });
  const { error } = await unsubscribeLead(id, process.env.DASHBOARD_USER || 'admin');
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}

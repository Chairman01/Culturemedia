import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { buildAlerts } from '@/lib/alerts';
import { awaitingReply } from '@/lib/crm';
import { listLeads, listPendingDrafts } from '@/lib/crm-admin';
import { listInvoices } from '@/lib/revenue-admin';
import { edmontonToday } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/summary — the counts behind the sidebar badges: mail waiting
// on you (Inbox) and things that are costing money or trust today (Today).
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const [leads, drafts, invoices] = await Promise.all([listLeads(), listPendingDrafts(), listInvoices()]);
  if (leads.error) return NextResponse.json({ error: leads.error }, { status: 502 });

  return NextResponse.json({
    replies: (leads.data ?? []).filter(awaitingReply).length,
    drafts: (drafts.data ?? []).length,
    // Red alerts only — paid work not delivered, money long unpaid, follow-ups
    // badly late. Overdue priorities are left out so the number stays meaningful.
    urgent: buildAlerts({
      invoices: invoices.data ?? [],
      leads: leads.data ?? [],
      actions: [],
      today: edmontonToday(),
    }).filter((a) => a.tone === 'crit').length,
  });
}

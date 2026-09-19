import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { fetchScorecard } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/scorecard — public.admin_kpi_scorecard()
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { data, error } = await fetchScorecard();
  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json({ data });
}

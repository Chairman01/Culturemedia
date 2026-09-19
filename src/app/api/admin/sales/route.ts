import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { fetchSales } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/sales — public.admin_sales_dashboard()
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const { data, error } = await fetchSales();
  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json({ data });
}

import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { searchMail } from '@/lib/mail-search';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// POST /api/admin/inbox/search — { q } — search the whole of Zoho and Gmail,
// any folder, any age. POST so the words searched for stay out of URLs and
// logs. Read-only: it never sends, moves, marks or deletes mail.
export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const found = await searchMail(body.q);
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: 400 });
  return NextResponse.json({ data: found });
}

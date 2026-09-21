import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { readBody } from '@/lib/mail-body';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// POST /api/admin/inbox/message — { id, folderId? } — the whole text of one email,
// fetched from Zoho or Gmail when the owner asks to read it. Read-only: it does
// not mark the message as read, and the text comes back as plain text, never HTML.
export async function POST(request: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const found = await readBody(body);
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: 400 });
  return NextResponse.json({ data: found });
}

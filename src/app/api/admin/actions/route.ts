import { NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { completeAction } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// POST /api/admin/actions — mark one ops_actions row done
export async function POST(request: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON.' }, { status: 400 });
  }

  const { id, note } = (body ?? {}) as { id?: unknown; note?: unknown };
  const actionId = Number(id);
  if (!Number.isInteger(actionId) || actionId <= 0) {
    return NextResponse.json({ error: 'Which action? Send a positive id.' }, { status: 400 });
  }
  const text = typeof note === 'string' && note.trim() ? note.trim().slice(0, 2000) : null;

  const { error } = await completeAction(actionId, text);
  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json({ ok: true });
}

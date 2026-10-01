import { NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { mediavineStatus, syncMediavine } from '@/lib/mediavine-sync';

export const dynamic = 'force-dynamic';
// A handful of report calls, more on the weekly by-page load: give it room.
export const maxDuration = 60;

// GET /api/admin/mediavine — is Mediavine connected, and how fresh are the figures
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  return NextResponse.json({ data: await mediavineStatus() });
}

// POST /api/admin/mediavine — read Mediavine's reporting API into the warehouse.
// { auto: true } is the background check every admin page makes: it does nothing
// if the figures were updated in the last few hours. Without it, it always runs
// (the Update now button). { full: true } re-reads everything since the first day.
// Read-only at Mediavine; safe to run twice.
export async function POST(request: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  let body: { auto?: unknown; full?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // No body means a plain "update now".
  }
  const report = await syncMediavine({ force: body?.auto !== true, full: body?.full === true });
  return NextResponse.json({ data: report, status: await mediavineStatus() });
}

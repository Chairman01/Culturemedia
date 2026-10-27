import { NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { fetchNewsletterIssue } from '@/lib/newsletter-admin';

export const dynamic = 'force-dynamic';

// GET /api/admin/newsletter/issue?subject=… — public.admin_newsletter_issue()
export async function GET(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  const subject = (new URL(req.url).searchParams.get('subject') || '').trim();
  if (!subject) return NextResponse.json({ error: 'Which email? Pass its subject line.' }, { status: 400 });

  const { data, error } = await fetchNewsletterIssue(subject);
  if (error) return NextResponse.json({ error }, { status: 502 });
  return NextResponse.json({ data });
}

import { NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/admin-auth';
import { addLead } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const DEAL_TYPES = ['retainer', 'one_time', 'sponsorship', 'partnership', 'other'];
const STAGES = ['new', 'contacted', 'engaged', 'proposal', 'won'];
const CONSENT = ['implied_inquiry', 'implied_published', 'express'];

/** admin_add_lead raises these; turn them into something readable. */
const DB_ERRORS: Record<string, string> = {
  company_required: 'Company is required.',
  company_too_long: 'Company name is too long.',
  email_invalid: "That email address doesn't look right.",
  duplicate_email: 'Someone with that email is already in the CRM.',
  number_invalid: 'Check the value and months.',
  stage_invalid: 'Pick a stage.',
  deal_type_invalid: 'Pick a deal type.',
  consent_invalid: 'Pick an email permission option.',
};

function friendly(message: string): string {
  const hit = Object.keys(DB_ERRORS).find((k) => message.includes(k));
  return hit ? DB_ERRORS[hit] : message;
}

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * POST /api/admin/leads — public.admin_add_lead(p jsonb)
 *
 * Adding a lead only writes the CRM row and a lead_events row. It never
 * schedules or sends email: follow-ups start only when a sequence is chosen in
 * Partnerships, and each email still waits for an explicit approval there.
 *
 * Retainers arrive as the monthly price plus a term, and are stored the way the
 * function expects: deal_value = price × months, term_months = months.
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad('Expected JSON.');
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const company = text(b.company, 200);
  if (!company) return bad(DB_ERRORS.company_required);

  const dealType = text(b.deal_type, 40);
  if (dealType && !DEAL_TYPES.includes(dealType)) return bad(DB_ERRORS.deal_type_invalid);

  const stage = text(b.stage, 40) || 'new';
  if (!STAGES.includes(stage)) return bad(DB_ERRORS.stage_invalid);

  const consent = text(b.consent_basis, 40);
  if (consent && !CONSENT.includes(consent)) return bad(DB_ERRORS.consent_invalid);

  const email = text(b.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(DB_ERRORS.email_invalid);

  const rawValue = text(b.deal_value, 20);
  const rawTerm = text(b.term_months, 10);
  const price = rawValue === '' ? null : Number(rawValue);
  const months = rawTerm === '' ? null : Math.round(Number(rawTerm));
  if (price !== null && !(Number.isFinite(price) && price >= 0)) return bad(DB_ERRORS.number_invalid);
  if (months !== null && !(Number.isInteger(months) && months >= 1 && months <= 60)) {
    return bad(DB_ERRORS.number_invalid);
  }
  const retainer = dealType === 'retainer';
  if (retainer && price !== null && months === null) {
    return bad('Add how many months the retainer runs.');
  }

  const total = price === null ? '' : String(retainer && months ? price * months : price);

  const payload = {
    company,
    contact_name: text(b.contact_name, 120),
    email,
    website: text(b.website, 200),
    city: text(b.city, 80),
    category: text(b.category, 80),
    deal_type: dealType,
    stage,
    consent_basis: consent,
    notes: text(b.notes, 2000),
    deal_value: total,
    term_months: retainer && months !== null ? String(months) : '',
  };

  const { error } = await addLead(payload);
  if (error) {
    const message = friendly(error);
    // A validation message from the function is the caller's problem, not ours.
    const known = message !== error;
    return NextResponse.json({ error: message }, { status: known ? 400 : 502 });
  }
  return NextResponse.json({ ok: true, company });
}

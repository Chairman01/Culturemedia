import { requireAdminPage } from '@/lib/admin-auth';
import { listLeads } from '@/lib/crm-admin';
import { listInvoices } from '@/lib/revenue-admin';
import { edmontonToday, fetchScorecard } from '@/lib/supabase-admin';

import RevenueView from './revenue-view';

export const dynamic = 'force-dynamic';

// /admin/revenue — invoices from public.revenue_invoices plus Mediavine's
// calendar months from the scorecard, combined into one CAD picture.
export default async function RevenuePage() {
  await requireAdminPage();
  const [invoices, scorecard, leads] = await Promise.all([listInvoices(), fetchScorecard(), listLeads()]);

  // Customer name → their record in Leads, matched on email first, then name.
  const customers: Record<string, string> = {};
  for (const lead of leads.data ?? []) {
    if (lead.email) customers[`e:${lead.email.toLowerCase()}`] = lead.id;
    customers[`c:${lead.company.toLowerCase()}`] ??= lead.id;
  }

  return (
    <RevenueView
      initial={invoices.data ?? []}
      initialError={invoices.error}
      scorecard={scorecard.data}
      customers={customers}
      today={edmontonToday()}
    />
  );
}

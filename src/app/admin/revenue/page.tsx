import { requireAdminPage } from '@/lib/admin-auth';
import { listLeads } from '@/lib/crm-admin';
import { listExpenses, listInvoices } from '@/lib/revenue-admin';
import { edmontonToday, fetchScorecard } from '@/lib/supabase-admin';

import RevenueView from './revenue-view';

export const dynamic = 'force-dynamic';

// /admin/revenue — invoices (public.revenue_invoices), running costs
// (public.revenue_expenses) and Mediavine's calendar months from the scorecard,
// combined into one picture in USD or CAD.
export default async function RevenuePage() {
  await requireAdminPage();
  const [invoices, scorecard, leads, expenses] = await Promise.all([
    listInvoices(),
    fetchScorecard(),
    listLeads(),
    listExpenses(),
  ]);

  // Customer name → their record in Leads, matched on email first, then name.
  const customers: Record<string, string> = {};
  for (const lead of leads.data ?? []) {
    if (lead.email) customers[`e:${lead.email.toLowerCase()}`] = lead.id;
    customers[`c:${lead.company.toLowerCase()}`] ??= lead.id;
  }

  return (
    <RevenueView
      initial={invoices.data ?? []}
      initialExpenses={expenses.data ?? []}
      initialError={invoices.error || expenses.error}
      scorecard={scorecard.data}
      customers={customers}
      today={edmontonToday()}
    />
  );
}

import { requireAdminPage } from '@/lib/admin-auth';
import { listInvoices } from '@/lib/revenue-admin';
import { edmontonToday, fetchScorecard } from '@/lib/supabase-admin';

import RevenueView from './revenue-view';

export const dynamic = 'force-dynamic';

// /admin/revenue — invoices from public.revenue_invoices plus Mediavine's
// calendar months from the scorecard, combined into one CAD picture.
export default async function RevenuePage() {
  await requireAdminPage();
  const [invoices, scorecard] = await Promise.all([listInvoices(), fetchScorecard()]);

  return (
    <RevenueView
      initial={invoices.data ?? []}
      initialError={invoices.error}
      scorecard={scorecard.data}
      today={edmontonToday()}
    />
  );
}

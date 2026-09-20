import { requireAdminPage } from '@/lib/admin-auth';
import { listExpenses, listInvoices } from '@/lib/revenue-admin';
import { edmontonToday, fetchScorecard } from '@/lib/supabase-admin';

import ScorecardView from './scorecard-view';

export const dynamic = 'force-dynamic';

export default async function ScorecardPage() {
  await requireAdminPage();

  // The service-role key stays here: only the JSON crosses into the client
  // component.
  // Invoices ride along so the page can show ALL revenue, not just ads.
  const [scorecard, invoices, expenses] = await Promise.all([fetchScorecard(), listInvoices(), listExpenses()]);

  return (
    <ScorecardView
      initial={scorecard.data}
      initialError={scorecard.error}
      invoices={invoices.data ?? []}
      expenses={expenses.data ?? []}
      today={edmontonToday()}
    />
  );
}

import { requireAdminPage } from '@/lib/admin-auth';
import { loadArticleCount, loadSources } from '@/lib/content-admin';
import { listExpenses, listInvoices } from '@/lib/revenue-admin';
import { edmontonToday, fetchScorecard } from '@/lib/supabase-admin';
import { buildValuation } from '@/lib/valuation';
import { valuationInput } from '@/lib/valuation-input';

import ValuationView from './valuation-view';

export const dynamic = 'force-dynamic';

// /admin/valuation — what the business would sell for today, from the same
// figures the Revenue and Scorecard pages show.
export default async function ValuationPage() {
  await requireAdminPage();
  const today = edmontonToday();
  const [scorecard, invoices, expenses, sources, articles] = await Promise.all([
    fetchScorecard(),
    listInvoices(),
    listExpenses(),
    loadSources(),
    loadArticleCount(),
  ]);
  const input = valuationInput({ sc: scorecard.data, invoices: invoices.data ?? [], expenses: expenses.data ?? [], sources, articles, today });
  return (
    <ValuationView
      valuation={buildValuation(input)}
      input={input}
      error={scorecard.error || invoices.error || expenses.error}
      freshness={scorecard.data?.freshness ?? null}
    />
  );
}

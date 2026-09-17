import { requireAdminPage } from '@/lib/admin-auth';
import { edmontonToday, fetchScorecard } from '@/lib/supabase-admin';

import ScorecardView from './scorecard-view';

export const dynamic = 'force-dynamic';

export default async function ScorecardPage() {
  await requireAdminPage();

  // The service-role key stays here: only the JSON crosses into the client
  // component.
  const { data, error } = await fetchScorecard();

  return <ScorecardView initial={data} initialError={error} today={edmontonToday()} />;
}

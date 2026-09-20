import { requireAdminPage } from '@/lib/admin-auth';
import { listLeads } from '@/lib/crm-admin';
import { edmontonToday } from '@/lib/supabase-admin';

import LeadsView from './leads-view';

export const dynamic = 'force-dynamic';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string; show?: string }>;
}) {
  await requireAdminPage();
  const [{ data, error }, params] = await Promise.all([listLeads(), searchParams]);

  return (
    <LeadsView
      initial={data ?? []}
      initialError={error}
      today={edmontonToday()}
      openAdd={params.add === '1'}
      initialFilter={
        params.show === 'blocked' ? 'blocked' : params.show === 'cold' ? 'cold' : params.show === 'customers' ? 'won' : 'open'
      }
    />
  );
}

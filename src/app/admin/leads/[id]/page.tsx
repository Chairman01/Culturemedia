import { requireAdminPage } from '@/lib/admin-auth';
import { getLeadDetail } from '@/lib/crm-admin';
import { edmontonToday } from '@/lib/supabase-admin';

import LeadView from './lead-view';

export const dynamic = 'force-dynamic';

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const { data, error } = await getLeadDetail(id);

  return <LeadView id={id} initial={data} initialError={error} today={edmontonToday()} />;
}

import { requireAdminPage } from '@/lib/admin-auth';
import { edmontonToday, fetchSales } from '@/lib/supabase-admin';

import SalesView from './sales-view';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  await requireAdminPage();

  const { data, error } = await fetchSales();

  return <SalesView initial={data} initialError={error} today={edmontonToday()} />;
}

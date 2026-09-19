import { requireAdminPage } from '@/lib/admin-auth';

import BidsDashboard from './bids-dashboard';

export const dynamic = 'force-dynamic';

// Alberta Purchasing Connection tenders, formerly /dashboard and /admin/pipeline.
// Its data lives in this browser's localStorage, so moving the route moved nothing.
export default async function BidsPage() {
  await requireAdminPage();
  return <BidsDashboard />;
}

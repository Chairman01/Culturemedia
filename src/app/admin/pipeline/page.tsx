import { requireAdminPage } from '@/lib/admin-auth';

import PipelineDashboard from './pipeline-dashboard';

export const dynamic = 'force-dynamic';

// The APC / outreach / Zoho pipeline, formerly /dashboard. Its data lives in
// this browser's localStorage, so moving the route changed nothing it stores.
export default async function PipelinePage() {
  await requireAdminPage();
  return <PipelineDashboard />;
}

import { requireAdminPage } from '@/lib/admin-auth';

import SetupView from './setup-view';

export const dynamic = 'force-dynamic';

// Bookmarklet setup for the APC sync, formerly /dashboard/setup.
export default async function SetupPage() {
  await requireAdminPage();
  return <SetupView />;
}

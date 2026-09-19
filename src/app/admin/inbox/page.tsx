import { requireAdminPage } from '@/lib/admin-auth';
import { loadInbox } from '@/lib/inbox';

import InboxView from './inbox-view';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  await requireAdminPage();
  return <InboxView initial={await loadInbox()} />;
}

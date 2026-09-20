import { requireAdminPage } from '@/lib/admin-auth';
import { loadInboxQuick } from '@/lib/inbox';

import InboxView from './inbox-view';

export const dynamic = 'force-dynamic';

// The page paints from the CRM straight away; the view then checks both
// mailboxes in the background, because IMAP and Zoho take a few seconds.
export default async function InboxPage() {
  await requireAdminPage();
  return <InboxView initial={await loadInboxQuick()} />;
}

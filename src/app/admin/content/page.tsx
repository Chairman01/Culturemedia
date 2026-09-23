import { requireAdminPage } from '@/lib/admin-auth';
import { loadContent } from '@/lib/content-admin';

import ContentView from './content-view';

export const dynamic = 'force-dynamic';

// /admin/content — what the articles earn, what to write next and what to fix,
// worked out from the warehouse tables the Wednesday data drop fills.
export default async function ContentPage() {
  await requireAdminPage();
  return <ContentView data={await loadContent()} />;
}

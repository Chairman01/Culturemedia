import { requireAdminPage } from '@/lib/admin-auth';
import { fetchNewsletterDashboard } from '@/lib/newsletter-admin';
import { edmontonToday } from '@/lib/supabase-admin';

import NewsletterView from './newsletter-view';

export const dynamic = 'force-dynamic';

// /admin/newsletter — members and newsletter performance, from the per-email
// events Resend posts back and the members list the site keeps.
export default async function NewsletterPage() {
  await requireAdminPage();
  const { data, error } = await fetchNewsletterDashboard();
  return <NewsletterView data={data} error={error} today={edmontonToday()} />;
}

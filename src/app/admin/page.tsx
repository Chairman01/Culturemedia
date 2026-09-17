import Link from 'next/link';

import { requireAdminPage } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function AdminIndex() {
  await requireAdminPage();

  return (
    <div className="wrap">
      <header>
        <div>
          <p className="eyebrow">Culture Media · Check Mondays</p>
          <h1>Admin</h1>
        </div>
      </header>

      <div className="home">
        <Link href="/admin/scorecard" className="card">
          <b>Scorecard</b>
          <span>
            The eight KPIs against target, weekly and monthly trends, this week&apos;s insights and
            priorities. Ad revenue in USD or CAD.
          </span>
        </Link>
        <Link href="/admin/sales" className="card">
          <b>Sales</b>
          <span>
            Pipeline, retainer MRR, what the daily automation is waiting on, and the form for adding
            a lead or a signed client.
          </span>
        </Link>
      </div>

      <p className="links">
        <Link href="/dashboard">APC &amp; Zoho pipeline →</Link>
        <span>
          Live from Culture Alberta&apos;s Supabase project: <code>admin_kpi_scorecard()</code> and{' '}
          <code>admin_sales_dashboard()</code>.
        </span>
      </p>
    </div>
  );
}

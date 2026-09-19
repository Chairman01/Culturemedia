import Link from 'next/link';

import { requireAdminPage } from '@/lib/admin-auth';

import { AdminShell } from './_components/ui';

export const dynamic = 'force-dynamic';

// The admin hub: everything Culture Media runs from one place.
export default async function AdminIndex() {
  await requireAdminPage();

  return (
    <AdminShell>
      <header>
        <div>
          <p className="eyebrow">Culture Media</p>
          <h1>Admin</h1>
        </div>
        <div className="hright">
          <SignOut />
        </div>
      </header>

      <div className="home">
        <Link href="/admin/scorecard" className="card">
          <b>Scorecard</b>
          <span>
            The eight Culture Alberta KPIs against target, weekly and monthly trends, this week&apos;s
            insights and priorities. Ad revenue in USD or CAD. Check Mondays.
          </span>
        </Link>
        <Link href="/admin/sales" className="card">
          <b>Sales</b>
          <span>
            Culture Alberta partnerships: pipeline, retainer MRR, what the daily automation is
            waiting on, and the form for adding a lead or a signed client.
          </span>
        </Link>
        <Link href="/admin/pipeline" className="card">
          <b>APC pipeline</b>
          <span>
            Alberta Purchasing Connection listings, your outreach leads and Zoho Mail sync — the
            agency&apos;s own deals. Re-sync from the <em>Sync APC</em> button in its sidebar.
          </span>
        </Link>
        <Link href="/admin/setup" className="card">
          <b>APC sync setup</b>
          <span>
            Install the one-click bookmarklet that pulls listings in from purchasing.alberta.ca.
            Only needed once per browser.
          </span>
        </Link>
      </div>

      <p className="links">
        <Link href="/">← culturemedia.ca</Link>
        <span>
          Scorecard and Sales read the Culture Alberta Supabase project live;
          the APC pipeline keeps its data in this browser.
        </span>
      </p>
    </AdminShell>
  );
}

// A plain form so this stays a server component: the button posts to the
// logout route, which clears the cookie.
function SignOut() {
  return (
    <form action="/api/dashboard-auth/logout" method="post">
      <button type="submit">Sign out</button>
    </form>
  );
}

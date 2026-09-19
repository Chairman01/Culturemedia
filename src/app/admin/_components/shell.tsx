'use client';

// The one frame every admin page sits in: a white sidebar on the left, the page
// on the right. Six destinations, in the order a working day uses them.

import { ChartColumn, ExternalLink, Gavel, House, Inbox, LogOut, Package, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

const NAV = [
  { href: '/admin', label: 'Today', icon: House, exact: true },
  { href: '/admin/leads', label: 'Leads', icon: Users },
  { href: '/admin/inbox', label: 'Inbox', icon: Inbox, badge: true },
  { href: '/admin/packages', label: 'Packages', icon: Package },
  { href: '/admin/scorecard', label: 'Scorecard', icon: ChartColumn },
  { href: '/admin/bids', label: 'Bids', icon: Gavel, also: ['/admin/setup'] },
] as const;

export function AdminShell({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const pathname = usePathname() || '';
  const [waiting, setWaiting] = useState<number | null>(null);

  // Replies to answer + emails to approve, so the Inbox can't be missed from
  // any page. A failed fetch just means no badge.
  useEffect(() => {
    if (bare) return;
    let alive = true;
    fetch('/api/admin/summary', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setWaiting((Number(d.replies) || 0) + (Number(d.drafts) || 0));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [bare, pathname]);

  if (bare) {
    return (
      <div className="adm adm-bare">
        <div className="wrap">{children}</div>
      </div>
    );
  }

  return (
    <div className="adm">
      <aside className="side" aria-label="Admin">
        <Link href="/admin" className="brand">
          Culture Media
        </Link>
        <nav>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              'exact' in item && item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href) ||
                  ('also' in item && item.also.some((p) => pathname.startsWith(p)));
            return (
              <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                <span>{item.label}</span>
                {'badge' in item && waiting ? <b className="count">{waiting}</b> : null}
              </Link>
            );
          })}
        </nav>
        <div className="side-foot">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            <span>View site</span>
          </a>
          <form action="/api/dashboard-auth/logout" method="post">
            <button type="submit">
              <LogOut size={16} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </aside>
      <main className="main">
        <div className="wrap">{children}</div>
      </main>
    </div>
  );
}

/** Page title block: a small label, the title, one line of help, actions on the right. */
export function PageHead({
  label,
  title,
  help,
  children,
}: {
  label?: string;
  title: string;
  help?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {label && <p className="eyebrow">{label}</p>}
        <h1>{title}</h1>
        {help && <p className="help">{help}</p>}
      </div>
      {children && <div className="hright">{children}</div>}
    </header>
  );
}

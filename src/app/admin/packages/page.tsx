import { requireAdminPage } from '@/lib/admin-auth';
import {
  EMAIL_RULES,
  OUTREACH_FACTS,
  PACKAGES,
  ROADS_TO_TARGET,
  SELLING_RULES,
  SOURCES,
  type AudienceStats,
  type PackageDef,
} from '@/lib/packages';
import { fetchScorecard } from '@/lib/supabase-admin';

import { CopyButton } from '../_components/copy-button';
import { group, num } from '../_components/format';
import { AdminShell, PageHead } from '../_components/shell';

export const dynamic = 'force-dynamic';

/** Round down to a number you can say out loud: 162,452 → "160,000". */
function spoken(n: number | null, fallback: string): string {
  if (!n || n <= 0) return fallback;
  const step = n >= 100000 ? 10000 : n >= 10000 ? 1000 : 100;
  return group(Math.floor(n / step) * step);
}

// /admin/packages — what is for sale, how to sell it, and paste-ready wording
// that quotes the live audience numbers from the scorecard.
export default async function PackagesPage() {
  await requireAdminPage();

  const { data: sc } = await fetchScorecard();
  const months = (sc?.monthly_trend?.calendar ?? [])
    .filter((r) => r.source === 'vercel' && r.complete === true)
    .sort((a, b) => (a.month < b.month ? 1 : -1));
  const last = months[0];
  const stats: AudienceStats = {
    visitors: spoken(num(last?.visitors), '160,000'),
    pageviews: spoken(num(last?.pageviews), '230,000'),
    subscribers: spoken(num(sc?.current?.active_subscribers), '1,300'),
  };

  const oneTime = PACKAGES.filter((p) => p.kind === 'one_time');
  const retainers = PACKAGES.filter((p) => p.kind === 'retainer');

  return (
    <AdminShell>
      <PageHead
        title="Packages"
        help={`What you sell and how to sell it. The pitch text quotes your latest full month: ${stats.visitors} visitors, ${stats.pageviews} pageviews, ${stats.subscribers} newsletter subscribers.`}
      />

      <p className="banner" data-tone="warn">
        These prices are starting points based on what comparable local publishers charge, not
        prices you have agreed to. Settle your own numbers, then ask Claude to update this page.
      </p>

      <h2 className="section-title">One-time partnerships</h2>
      <p className="section-help">
        The way in. Show a local business all three and recommend the bundle.
      </p>
      <div className="pkgs">
        {oneTime.map((p) => (
          <PackageCard key={p.key} p={p} stats={stats} />
        ))}
      </div>

      <h2 className="section-title">Retainers</h2>
      <p className="section-help">
        Where the $5,000 a month comes from. Offer these after a feature has run and you have
        numbers to show — or straight away to an institution.
      </p>
      <div className="pkgs">
        {retainers.map((p) => (
          <PackageCard key={p.key} p={p} stats={stats} />
        ))}
      </div>

      <section className="card" aria-labelledby="road-h" style={{ margin: '12px 0' }}>
        <h2 id="road-h">Ways to reach $5,000 a month</h2>
        <ul className="srows">
          {ROADS_TO_TARGET.map((r) => (
            <li key={r.mix}>
              <span>{r.mix}</span>
              <b>{r.total}</b>
            </li>
          ))}
        </ul>
        <p className="cnote">
          Four or five signed retainers, not forty. That is why one good lead a weekday is enough.
        </p>
      </section>

      <h2 className="section-title">The playbook</h2>
      <p className="section-help">Open these when you need them. They are the research behind the numbers above.</p>

      <details className="card guide">
        <summary>How to sell them — seven rules</summary>
        <div className="prose">
          <ol>
            {SELLING_RULES.map((r) => (
              <li key={r.rule}>
                <b>{r.rule}</b> {r.why}
              </li>
            ))}
          </ol>
        </div>
      </details>

      <details className="card guide">
        <summary>What to expect from outreach</summary>
        <div className="prose">
          <ul>
            {OUTREACH_FACTS.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </details>

      <details className="card guide">
        <summary>Who you are allowed to email (Canada&apos;s anti-spam law)</summary>
        <div className="prose">
          <ul>
            {EMAIL_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <p className="cnote">
          A plain-language summary, not legal advice. Penalties under CASL are large, so when in
          doubt, don&apos;t send.
        </p>
      </details>

      <p className="sources">
        Sources:{' '}
        {SOURCES.map((s, i) => (
          <span key={s.href}>
            {i > 0 && ' · '}
            <a href={s.href} target="_blank" rel="noopener noreferrer">
              {s.label}
            </a>
          </span>
        ))}
      </p>
    </AdminShell>
  );
}

function PackageCard({ p, stats }: { p: PackageDef; stats: AudienceStats }) {
  return (
    <article className={`card pkg${p.anchor ? ' anchor' : ''}`}>
      <span className="kind">{p.anchor ? 'Lead with this' : p.kind === 'retainer' ? 'Retainer' : 'One-time'}</span>
      <h3>{p.name}</h3>
      <span className="price">
        {p.price} <span className="muted" style={{ fontWeight: 400 }}>· {p.term}</span>
      </span>
      <p className="for">{p.bestFor}</p>
      <ul>
        {p.includes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <CopyButton text={p.pitch(stats)} />
    </article>
  );
}

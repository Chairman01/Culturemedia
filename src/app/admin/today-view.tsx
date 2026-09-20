'use client';

// Today: three things in the order to do them, the week's outreach at a glance,
// and the money. Deliberately short — everything else is one click away in the
// sidebar.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { OpsAction, SalesTotals } from '@/lib/admin-types';
import { STAGE_LABEL } from '@/lib/crm';
import type { OutreachDay } from '@/lib/crm-admin';
import { day, money } from './_components/format';
import { AdminShell, PageHead } from './_components/shell';
import { useRefreshOnFocus } from './_components/use-refresh';
import { ActionRow, Banner, Tile } from './_components/ui';

const MRR_TARGET = 5000;
const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function TodayView({
  today,
  todayLabel,
  isWeekend,
  totals,
  setup,
  replies,
  drafts,
  blocked,
  cold,
  due,
  week,
  revenue,
  error,
}: {
  /** CAD. `kept` is null until there are expenses on file. */
  revenue: { year: number; total: number; partnerships: number; lastYear: number; kept: number | null };
  today: string;
  todayLabel: string;
  isWeekend: boolean;
  totals: SalesTotals | null;
  setup: OpsAction[];
  replies: number;
  drafts: number;
  blocked: number;
  /** Customers with no check-in booked and no contact in six months. */
  cold: number;
  due: { id: string; company: string; on: string; stage: string; customer: boolean }[];
  week: OutreachDay[];
  error: string | null;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [banner, setBanner] = useState(error || '');
  const [mailNote, setMailNote] = useState('');
  const checkedMail = useRef(false);

  // Opening the admin checks both mailboxes once, quietly. If a lead replied
  // (or you answered one), the counts above are re-read so step 1 is true.
  useEffect(() => {
    if (checkedMail.current) return;
    checkedMail.current = true;
    fetch('/api/admin/inbox/sync', { method: 'POST', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        const report = body?.data?.report;
        if (!report) return;
        const parts = [
          ...report.replies.map((r: { company: string }) => `${r.company} replied`),
          ...report.contacted.map((c: { company: string }) => `you emailed ${c.company}`),
        ];
        if (parts.length) {
          setMailNote(`Updated from your mail: ${parts.join(' · ')}.`);
          router.refresh();
        }
      })
      .catch(() => {});
  }, [router]);

  useRefreshOnFocus(() => router.refresh());

  const addedToday = week.find((w) => w.date === today)?.added ?? 0;
  const daysHit = week.filter((w) => w.added > 0 || w.firstTouches > 0).length;
  const t = totals || {};

  const markDone = async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/admin/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBanner(body.error || "Couldn't mark it done.");
        return;
      }
      router.refresh();
    } catch {
      setBanner("Couldn't reach the server.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminShell>
      <PageHead
        label={todayLabel}
        title="Today"
        help="Three things, in this order. Twenty minutes a weekday is the whole system."
      />

      <Banner tone="crit">{banner}</Banner>
      <Banner>{mailNote}</Banner>

      <ol className="steps">
        <Step
          n={1}
          done={replies === 0}
          title={replies ? `Answer ${replies} ${replies === 1 ? 'reply' : 'replies'}` : 'Answer replies'}
          text={
            replies
              ? 'Someone wrote back. A fast answer is worth more than any new email you could send.'
              : 'No one is waiting on you.'
          }
          href="/admin/inbox"
          cta="Open inbox"
        />
        <Step
          n={2}
          done={drafts === 0}
          title={drafts ? `Approve ${drafts} ${drafts === 1 ? 'email' : 'emails'}` : "Approve today's emails"}
          text={
            drafts
              ? 'Written for you this morning. Read each one, fix what sounds off, send.'
              : 'Nothing drafted today. Emails appear here the morning after you add a lead with follow-ups.'
          }
          href="/admin/inbox#approve"
          cta="Review"
        />
        <Step
          n={3}
          done={addedToday > 0}
          title={addedToday ? `Added ${addedToday} today` : 'Add one new lead'}
          text={
            addedToday
              ? 'Done for today. If you picked follow-up emails, the first one is waiting for your approval tomorrow morning.'
              : isWeekend
              ? 'Weekend — nothing owed. Add one if you spot a good fit.'
              : 'One Alberta business that could buy a feature. Pick follow-up emails and tomorrow’s outreach writes itself.'
          }
          href="/admin/leads?add=1"
          cta="Add a lead"
        />
      </ol>

      <section className="card" aria-labelledby="w-h" style={{ marginBottom: 12 }}>
        <h2 id="w-h">
          This week&apos;s outreach <small>{daysHit} of 5 weekdays</small>
        </h2>
        <div className="week">
          {week.map((w, i) => {
            const hit = w.added > 0 || w.firstTouches > 0;
            const cls = hit ? 'hit' : w.date < today ? 'miss' : w.date === today ? '' : 'later';
            return (
              <div key={w.date} className={`${cls}${w.date === today ? ' now' : ''}`}>
                <span className="d">{SHORT[i]}</span>
                <span className="m">{hit ? '✓' : w.date > today ? '·' : '–'}</span>
                <span className="s">
                  {w.added} added · {w.sent} sent
                </span>
              </div>
            );
          })}
        </div>
        <p className="cnote">
          A day counts when you add a new lead or a first email goes out. Five a week is about 250
          businesses a year — at a typical 5% reply rate that is a dozen real conversations.
        </p>
      </section>

      <div className="tiles">
        <Tile
          label="Retainer MRR"
          value={money(t.mrr ?? 0)}
          foot={`target ${money(MRR_TARGET)} a month`}
        />
        <Tile
          label={`All revenue, ${revenue.year} so far`}
          value={money(revenue.total)}
          foot={
            revenue.kept === null
              ? `${money(revenue.partnerships)} from partnerships · ${money(revenue.lastYear)} by now last year`
              : `${money(revenue.kept)} kept after expenses · ${money(revenue.partnerships)} from partnerships`
          }
        />
        <Tile label="In talks or proposals" value={money(t.in_play ?? 0)} foot={`${t.open ?? 0} open leads`} />
        <Tile
          label="Gone quiet"
          value={String(t.quiet ?? 0)}
          foot={blocked ? `${blocked} ${blocked === 1 ? 'lead needs' : 'leads need'} fixing` : 'nothing blocked'}
        />
      </div>

      <div className="grid2">
        <section className="card" aria-labelledby="d-h">
          <h2 id="d-h">
            Next steps due <small>{due.length || 'none'}</small>
          </h2>
          <ul className="srows">
            {due.length ? (
              due.map((l) => (
                <li key={l.id}>
                  <span>
                    <Link href={`/admin/leads/${l.id}`} style={{ color: 'inherit', fontWeight: 600 }}>
                      {l.company}
                    </Link>
                    <span className="sub-line">
                      {l.customer ? 'Past customer — check in' : STAGE_LABEL[l.stage] || l.stage}
                    </span>
                  </span>
                  <b className={l.on < today ? 'crit' : ''}>{day(l.on)}</b>
                </li>
              ))
            ) : (
              <li className="empty-note">Nothing due. Set a “next step” date on a lead to see it here.</li>
            )}
          </ul>
          {cold > 0 && (
            <p className="acts-row" style={{ marginTop: 10 }}>
              <Link className="btn ghost" href="/admin/leads?show=cold">
                {cold} past {cold === 1 ? 'customer has' : 'customers have'} no check-in booked
              </Link>
            </p>
          )}
          {blocked > 0 && (
            <p className="acts-row" style={{ marginTop: 10 }}>
              <Link className="btn ghost" href="/admin/leads?show=blocked">
                Fix {blocked} {blocked === 1 ? 'lead' : 'leads'} that can&apos;t be emailed yet
              </Link>
            </p>
          )}
        </section>

        <section className="card" aria-labelledby="s-h">
          <h2 id="s-h">
            One-time setup <small>{setup.length ? `${setup.length} left` : 'done'}</small>
          </h2>
          <ul className="acts">
            {setup.length ? (
              setup.map((a, i) => (
                <ActionRow
                  key={a.id}
                  action={a}
                  n={i + 1}
                  today={today}
                  onDone={markDone}
                  busy={busyId === Number(a.id)}
                  disabled={busyId !== null}
                />
              ))
            ) : (
              <li>
                <span />
                <span className="muted">All set.</span>
              </li>
            )}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}

function Step({
  n,
  done,
  title,
  text,
  href,
  cta,
}: {
  n: number;
  done: boolean;
  title: string;
  text: string;
  href: string;
  cta: string;
}) {
  return (
    <li className={`step ${done ? 'clear' : 'todo'}`}>
      <span className="n">{done ? '✓' : n}</span>
      <b>{title}</b>
      <p>{text}</p>
      <Link className={`btn${done ? ' ghost' : ''}`} href={href}>
        {cta}
      </Link>
    </li>
  );
}

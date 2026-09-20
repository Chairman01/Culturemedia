import { requireAdminPage } from '@/lib/admin-auth';
import { awaitingReply, isOpen, needsOf } from '@/lib/crm';
import { listLeads, listPendingDrafts, outreachWeek } from '@/lib/crm-admin';
import { summarise } from '@/lib/revenue';
import { listInvoices } from '@/lib/revenue-admin';
import { edmontonToday, fetchSales, fetchScorecard } from '@/lib/supabase-admin';

import TodayView from './today-view';

export const dynamic = 'force-dynamic';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// /admin — the page a working day starts on: what is waiting, what to send,
// who to add, and whether the week is on track.
export default async function TodayPage() {
  await requireAdminPage();

  const today = edmontonToday();
  const [sales, leads, drafts, week, invoices, scorecard] = await Promise.all([
    fetchSales(),
    listLeads(),
    listPendingDrafts(),
    outreachWeek(today),
    listInvoices(),
    fetchScorecard(),
  ]);
  // Every source, not just ads: invoices plus Mediavine converted to CAD.
  const money = summarise(invoices.data ?? [], scorecard.data, today);

  const [y, m, d] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const all = leads.data ?? [];

  return (
    <TodayView
      today={today}
      todayLabel={`${WEEKDAYS[weekday]}, ${MONTHS[m - 1]} ${d}`}
      isWeekend={weekday === 0 || weekday === 6}
      totals={sales.data?.totals ?? null}
      setup={(sales.data?.setup ?? []).filter((a) => a.status !== 'done')}
      replies={all.filter(awaitingReply).length}
      drafts={(drafts.data ?? []).length}
      blocked={all.filter((l) => needsOf(l).length > 0).length}
      due={all
        .filter((l) => isOpen(l) && l.next_action_on && l.next_action_on <= today)
        .sort((a, b) => String(a.next_action_on).localeCompare(String(b.next_action_on)))
        .slice(0, 8)
        .map((l) => ({ id: l.id, company: l.company, on: String(l.next_action_on), stage: l.stage }))}
      week={week.data ?? []}
      revenue={{
        year: money.thisYear,
        total: money.ytd.total,
        partnerships: money.ytd.partnerships,
        lastYear: money.ytdLastYear.total,
      }}
      error={sales.error || leads.error || week.error}
    />
  );
}

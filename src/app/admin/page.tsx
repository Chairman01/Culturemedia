import { requireAdminPage } from '@/lib/admin-auth';
import { buildAlerts, ownPriorities } from '@/lib/alerts';
import { awaitingReply, isCustomer, isFollowable, needsOf } from '@/lib/crm';
import { listLeads, listPendingDrafts, outreachWeek } from '@/lib/crm-admin';
import { summarise } from '@/lib/revenue';
import { listExpenses, listInvoices } from '@/lib/revenue-admin';
import { edmontonToday, fetchSales, fetchScorecard } from '@/lib/supabase-admin';

import TodayView from './today-view';

export const dynamic = 'force-dynamic';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// /admin — the page a working day starts on: what is slipping, the three daily
// things, your priorities, and whether the week is on track.
export default async function TodayPage() {
  await requireAdminPage();

  const today = edmontonToday();
  const [sales, leads, drafts, week, invoices, scorecard, expenses] = await Promise.all([
    fetchSales(),
    listLeads(),
    listPendingDrafts(),
    outreachWeek(today),
    listInvoices(),
    fetchScorecard(),
    listExpenses(),
  ]);
  // Every source, not just ads: invoices plus Mediavine converted to CAD.
  const money = summarise(invoices.data ?? [], scorecard.data, today, { expenses: expenses.data ?? [] });

  const [y, m, d] = today.split('-').map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const all = leads.data ?? [];
  const actions = scorecard.data?.actions ?? [];
  const mine = ownPriorities(actions);
  // Your own actions only: the bar should measure the list underneath it.
  const mineDone = actions.filter((a) => a.status === 'done' && /you/i.test(a.owner)).length;

  return (
    <TodayView
      today={today}
      todayLabel={`${WEEKDAYS[weekday]}, ${MONTHS[m - 1]} ${d}`}
      isWeekend={weekday === 0 || weekday === 6}
      totals={sales.data?.totals ?? null}
      alerts={buildAlerts({ invoices: invoices.data ?? [], leads: all, actions, today })}
      priorities={mine}
      done={mineDone}
      total={mine.length + mineDone}
      claudeOpen={actions.filter((a) => (a.status === 'todo' || a.status === 'in_progress') && !/you/i.test(a.owner)).length}
      replies={all.filter(awaitingReply).length}
      drafts={(drafts.data ?? []).length}
      blocked={all.filter((l) => needsOf(l).length > 0).length}
      due={all
        // Customers too: a booked check-in is a next step like any other.
        .filter((l) => isFollowable(l) && l.next_action_on && l.next_action_on <= today)
        .sort((a, b) => String(a.next_action_on).localeCompare(String(b.next_action_on)))
        .slice(0, 8)
        .map((l) => ({
          id: l.id,
          company: l.company,
          on: String(l.next_action_on),
          stage: l.stage,
          customer: isCustomer(l),
        }))}
      week={week.data ?? []}
      revenue={{
        year: money.thisYear,
        total: money.ytd.total,
        partnerships: money.ytd.partnerships,
        lastYear: money.ytdLastYear.total,
        kept: money.expensesSince ? money.ytdKept : null,
      }}
      error={sales.error || leads.error || week.error}
    />
  );
}

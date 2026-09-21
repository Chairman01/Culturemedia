// Shapes of the two Supabase payloads: public.admin_kpi_scorecard() and
// public.admin_sales_dashboard(). Everything is optional — a metric that has no
// data loaded yet is simply absent, and the pages render "—" for it.

/** A metric column looked up by name, e.g. week.revenue or week.pageviews. */
export type MetricRow = Record<string, unknown>;

export interface WeekRow extends MetricRow {
  week_start: string;
  is_current_week?: boolean;
  /** Late-July pageviews include a few estimated days. */
  pv_estimated?: boolean;
}

export interface Target {
  metric: string;
  label: string;
  pillar: string;
  unit: string;
  cadence: 'weekly' | 'monthly' | string;
  direction: 'higher' | 'lower' | string;
  target: number | string | null;
  baseline: number | string | null;
  why?: string;
}

export interface Insight {
  tone: 'good' | 'watch' | 'bad' | string;
  headline: string;
  detail: string;
  sources?: string;
  dump_on?: string;
}

export interface OpsAction {
  id: number;
  title: string;
  detail?: string;
  owner: string;
  status: 'todo' | 'in_progress' | 'done' | string;
  priority?: number;
  due_on?: string | null;
  completed_at?: string | null;
  /** Set on a job that comes round again: every N days from due_on (7 = weekly). */
  repeat_days?: number | null;
  /** The last time a repeating job was done; marking it done moves due_on on instead of closing it. */
  last_done_on?: string | null;
  times_done?: number | null;
}

export interface CalendarMonth extends MetricRow {
  month: string;
  source: 'mediavine' | 'vercel' | string;
  revenue?: number | string | null;
  sessions?: number | string | null;
  pageviews?: number | string | null;
  visitors?: number | string | null;
  estimated?: boolean;
}

export interface MonthlyTrend {
  calendar?: CalendarMonth[];
  subscribers?: { month: string; net: number | string | null }[];
  members?: { month: string; new: number | string | null }[];
}

export interface Freshness {
  mediavine_daily_through?: string | null;
  search_console_through?: string | null;
  bing_through?: string | null;
  ga4_through?: string | null;
  clarity_loaded?: string | null;
}

/** Bank of Canada average rates, keyed by week start and by YYYY-MM. */
export interface Fx {
  latest?: { rate?: number | string | null } | null;
  weekly?: Record<string, number | string | null>;
  monthly?: Record<string, number | string | null>;
  window_30d?: number | string | null;
}

export interface Scorecard {
  weeks?: WeekRow[];
  targets?: Target[];
  current?: (MetricRow & { mrr?: number | string | null; pipeline?: Record<string, number | string | null> }) | null;
  monthly?: MetricRow | null;
  monthly_trend?: MonthlyTrend | null;
  insights?: Insight[];
  actions?: OpsAction[];
  freshness?: Freshness | null;
  fx?: Fx | null;
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export interface SalesTotals {
  leads?: number | null;
  open?: number | null;
  replied?: number | null;
  quiet?: number | null;
  clients?: number | null;
  mrr?: number | string | null;
  booked?: number | string | null;
  in_play?: number | string | null;
}

export interface SalesAutomation {
  last_draft_written?: string | null;
  awaiting_approval?: number | null;
  sent_7d?: number | null;
  sent_total?: number | null;
  due_today?: number | null;
  missing_consent?: number | null;
  no_sequence?: number | null;
  send_errors_7d?: number | null;
  unsubscribed?: number | null;
}

export interface Lead {
  id?: number;
  company: string;
  contact_name?: string | null;
  email?: string | null;
  city?: string | null;
  deal_type?: string | null;
  stage: string;
  deal_value?: number | string | null;
  term_months?: number | string | null;
  last_contacted_at?: string | null;
  next_action_on?: string | null;
  consent_basis?: string | null;
  sequence_key?: string | null;
  unsubscribed?: boolean | null;
}

export interface LeadEvent {
  company?: string | null;
  type?: string | null;
  body?: string | null;
  at?: string | null;
}

export interface PendingDraft {
  company?: string | null;
  subject?: string | null;
  step?: number | string | null;
}

export interface SalesDashboard {
  totals?: SalesTotals | null;
  automation?: SalesAutomation | null;
  setup?: OpsAction[];
  leads?: Lead[];
  events?: LeadEvent[];
  pending_drafts?: PendingDraft[];
}

-- Newsletter & members: the figures behind culturemedia.ca/admin/newsletter.
--
-- Everything is read from tables the Culture Alberta site already fills:
--   newsletter_email_events        one row per Resend webhook event (delivered,
--                                  opened, clicked, bounced, complained) per
--                                  recipient, since 2026-03-14; opens and clicks
--                                  since 2026-04-22, when tracking was turned on
--   newsletter_subscriptions       the members list (status active/unsubscribed)
--   newsletter_subscription_events every sign-up and unsubscribe, dated
--   newsletter_alert_sends         one-off blasts (the AMBER Alert etc.)
--   resend_daily_metrics / resend_metrics_runs   Resend's own account totals,
--                                  filled nightly once the API key is in Vault
--
-- Resend's dashboard mixes the newsletter with sign-up confirmations and
-- notifications, so emails are sorted into kinds by their subject line:
--   newsletter    "The Capital · Edmonton · Monday, October 19"
--   alert         a one-off blast recorded in newsletter_alert_sends
--   welcome       "Welcome to Culture Alberta, Name" (sent on sign-up)
--   notification  "X replied to your comment"
--   test          anything starting with [TEST] — never counted
--
-- Service-role only, like the other admin_* functions. Nothing here writes.
--
-- Applied to project itdmwpbsnviassgqfhxk on 2026-10-27 (migration newsletter_dashboard_functions).
-- The accounts block (site logins vs the newsletter list) was added afterwards and
-- still has to be re-applied: run the admin_newsletter_dashboard() definition below again.

create or replace function public.newsletter_email_kind(subject text)
returns text
language sql
immutable
as $$
  select case
    when subject is null then 'other'
    when subject ~* '^\[?test' then 'test'
    when subject ~* '^(amber alert|breaking|alert:)' then 'alert'
    when subject ~* '^welcome to culture alberta' then 'welcome'
    when subject ~* 'replied to your comment|commented on|liked your|new comment' then 'notification'
    when subject ~ '^The [^·—]+ · [^·—]+ [·—] ' then 'newsletter'
    else 'other'
  end
$$;

create or replace function public.admin_newsletter_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with
today as (
  select (now() at time zone 'America/Edmonton')::date as d
),
alerts as (
  select distinct subject from public.newsletter_alert_sends where subject is not null
),
ev as (
  select e.email, e.event_type, e.email_id, e.subject, e.clicked_url, e.created_at,
         (e.created_at at time zone 'America/Edmonton')::date as day,
         case when a.subject is not null then 'alert' else public.newsletter_email_kind(e.subject) end as kind
  from public.newsletter_email_events e
  left join alerts a on a.subject = e.subject
),
ok as (
  select * from ev where kind <> 'test'
),
subs as (
  select id, lower(email) as email, status, city, signup_source, created_at
  from public.newsletter_subscriptions
),
accounts as (
  -- People with a login on culturealberta.com (comments, saved stories,
  -- polls). A separate thing from the newsletter list: most newsletter
  -- members never make an account. Matched to the list by email.
  select lower(u.email) as email, u.created_at, u.last_sign_in_at,
         nullif(u.raw_user_meta_data ->> 'city', '') as city
  from auth.users u
  where u.deleted_at is null and coalesce(u.is_anonymous, false) = false and u.email is not null
),
sev as (
  select lower(email) as email, event, signup_source, city, occurred_at,
         (occurred_at at time zone 'America/Edmonton')::date as day
  from public.newsletter_subscription_events
),
active_now as (
  select count(*)::int as n from subs where status = 'active'
),
weeks as (
  select generate_series(
           date_trunc('week', (select d from today))::date - 25 * 7,
           date_trunc('week', (select d from today))::date,
           interval '7 days')::date as week_start
),
-- Members at the end of each week, walked back from today's count.
weekly as (
  select w.week_start,
         (select count(*)::int from sev where event = 'subscribed' and day between w.week_start and w.week_start + 6) as subscribed,
         (select count(*)::int from sev where event = 'unsubscribed' and day between w.week_start and w.week_start + 6) as unsubscribed,
         (select n from active_now)
           - (select coalesce(sum(case event when 'subscribed' then 1 when 'unsubscribed' then -1 else 0 end), 0)::int
              from sev where day > w.week_start + 6) as active_end
  from weeks w
),
issue_rows as (
  select subject, kind,
         coalesce(min(day) filter (where event_type = 'delivered'), min(day)) as sent_on,
         count(*) filter (where event_type = 'delivered')::int as delivered,
         count(distinct email) filter (where event_type = 'opened')::int as opened,
         count(distinct email) filter (where event_type = 'clicked')::int as clicked,
         count(*) filter (where event_type = 'clicked')::int as clicks,
         count(*) filter (where event_type = 'bounced')::int as bounced,
         count(*) filter (where event_type = 'complained')::int as complained
  from ok
  where kind in ('newsletter', 'alert')
  group by subject, kind
),
issues as (
  select i.*,
         case when i.kind = 'alert' then 'Alert'
              else (regexp_match(i.subject, '^(The [^·—]+) · '))[1] end as edition,
         case when i.kind = 'alert' then 'Alberta'
              else trim((regexp_match(i.subject, '^The [^·—]+ · ([^·—]+?) ?[·—] '))[1]) end as city,
         case when i.kind = 'alert' then i.subject
              else (regexp_match(i.subject, '^The [^·—]+ · [^·—]+ [·—] (.+)$'))[1] end as label
  from issue_rows i
),
win as (
  select case when sent_on >= (select d from today) - 29 then 'cur'
              when sent_on >= (select d from today) - 59 then 'prev' end as period,
         count(*)::int as issues,
         sum(delivered)::int as delivered,
         sum(opened)::int as opened,
         sum(clicked)::int as clicked,
         sum(bounced)::int as bounced,
         sum(complained)::int as complained
  from issues
  where kind = 'newsletter' and sent_on >= (select d from today) - 59
  group by 1
),
ed_recent as (
  select *, row_number() over (partition by edition, city order by sent_on desc, subject desc) as rn
  from issues
  where kind = 'newsletter'
),
editions as (
  select e.edition, e.city,
         count(*)::int as issues_8,
         round(avg(e.delivered))::int as delivered_avg,
         sum(e.opened)::int as opened,
         sum(e.delivered)::int as delivered,
         sum(e.clicked)::int as clicked,
         max(e.sent_on) as last_sent_on,
         case when e.city = 'Alberta' then null
              else (select count(*)::int from subs s where s.status = 'active' and s.city = lower(replace(e.city, ' ', '-'))) end as active_members,
         (select count(*)::int from issues i2 where i2.kind = 'newsletter' and i2.edition = e.edition and i2.city = e.city) as issues_all
  from ed_recent e
  where e.rn <= 8
  group by e.edition, e.city
),
monthly as (
  select to_char(day, 'YYYY-MM') as month, kind,
         count(*) filter (where event_type = 'delivered')::int as delivered,
         count(distinct email_id) filter (where event_type = 'opened')::int as opened,
         count(distinct email_id) filter (where event_type = 'clicked')::int as clicked,
         count(*) filter (where event_type = 'bounced')::int as bounced
  from ok
  group by 1, 2
),
kinds as (
  select kind,
         count(*) filter (where event_type = 'delivered')::int as delivered,
         count(distinct email_id) filter (where event_type = 'opened')::int as opened,
         count(distinct email_id) filter (where event_type = 'clicked')::int as clicked,
         count(*) filter (where event_type = 'bounced')::int as bounced,
         count(*) filter (where event_type = 'complained')::int as complained,
         count(distinct subject)::int as subjects,
         min(day) as first_on,
         max(day) as last_on
  from ok
  group by kind
),
-- Stories only (section pages and the home link are navigation, not reading).
-- Ranked by distinct readers: company mail filters open every link in an
-- email to check it, which inflates raw clicks.
links30 as (
  select clicked_url as url, count(*)::int as clicks, count(distinct email)::int as people
  from ok
  where event_type = 'clicked' and kind in ('newsletter', 'alert')
    and day >= (select d from today) - 29
    and clicked_url ~* '/articles/'
    and clicked_url !~* 'unsubscribe|preferences|manage|mailto:'
  group by clicked_url
  order by people desc, clicks desc
  limit 15
),
people90 as (
  select lower(email) as email,
         count(*) filter (where event_type = 'clicked')::int as clicks,
         count(distinct subject) filter (where event_type = 'clicked')::int as issues_clicked,
         count(*) filter (where event_type = 'opened')::int as opens,
         to_char(max(created_at) filter (where event_type = 'clicked') at time zone 'America/Edmonton', 'YYYY-MM-DD HH24:MI') as last_click
  from ok
  where kind in ('newsletter', 'alert') and day >= (select d from today) - 89
  group by lower(email)
),
top_people as (
  select p.email, p.clicks, p.issues_clicked, p.opens, p.last_click, s.city, s.status
  from people90 p
  left join subs s on s.email = p.email
  where p.clicks > 0
  order by p.issues_clicked desc, p.clicks desc
  limit 25
),
recv90 as (
  select lower(email) as email,
         count(*) filter (where event_type = 'delivered')::int as delivered,
         count(*) filter (where event_type in ('opened', 'clicked'))::int as engaged
  from ok
  where kind = 'newsletter' and day >= (select d from today) - 89
  group by lower(email)
),
engaged_ever as (
  select lower(email) as email, max(day) as last_engaged
  from ok
  where event_type in ('opened', 'clicked')
  group by lower(email)
),
-- Still subscribed, got at least four issues in 90 days, opened none of them.
dormant as (
  select s.email, s.city, r.delivered, g.last_engaged
  from subs s
  join recv90 r on r.email = s.email
  left join engaged_ever g on g.email = s.email
  where s.status = 'active' and r.delivered >= 4 and r.engaged = 0
),
bounced90 as (
  select s.email, s.city, count(*)::int as bounces,
         to_char(max(o.created_at) at time zone 'America/Edmonton', 'YYYY-MM-DD') as last_on
  from ok o
  join subs s on s.email = lower(o.email)
  where o.event_type = 'bounced' and s.status = 'active' and o.day >= (select d from today) - 89
  group by s.email, s.city
)
select jsonb_build_object(
  'as_of', (select d from today),
  'tracking', jsonb_build_object(
    'events_since', (select min(day) from ok),
    'opens_since', (select min(day) from ok where event_type = 'opened'),
    'events', (select count(*) from ok)
  ),
  'members', jsonb_build_object(
    'active', (select n from active_now),
    'unsubscribed', (select count(*) from subs where status = 'unsubscribed'),
    'total', (select count(*) from subs),
    'new_7d', (select count(*) from sev where event = 'subscribed' and day >= (select d from today) - 6),
    'new_30d', (select count(*) from sev where event = 'subscribed' and day >= (select d from today) - 29),
    'new_prev_30d', (select count(*) from sev where event = 'subscribed' and day between (select d from today) - 59 and (select d from today) - 30),
    'unsub_30d', (select count(*) from sev where event = 'unsubscribed' and day >= (select d from today) - 29),
    'unsub_prev_30d', (select count(*) from sev where event = 'unsubscribed' and day between (select d from today) - 59 and (select d from today) - 30),
    'by_city', (select coalesce(jsonb_agg(jsonb_build_object('city', c.city, 'active', c.active, 'total', c.total) order by c.active desc), '[]'::jsonb)
                from (select coalesce(city, 'unknown') as city,
                             count(*) filter (where status = 'active')::int as active,
                             count(*)::int as total
                      from subs group by 1) c),
    'sources_30d', (select coalesce(jsonb_agg(jsonb_build_object('source', s.source, 'n', s.n) order by s.n desc), '[]'::jsonb)
                    from (select coalesce(signup_source, 'not recorded') as source, count(*)::int as n
                          from sev where event = 'subscribed' and day >= (select d from today) - 29
                          group by 1) s),
    'weekly', (select coalesce(jsonb_agg(to_jsonb(w) order by w.week_start), '[]'::jsonb) from weekly w),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object(
                 'email', r.email, 'event', r.event, 'city', r.city, 'source', r.signup_source,
                 'at', to_char(r.occurred_at at time zone 'America/Edmonton', 'YYYY-MM-DD HH24:MI')) order by r.occurred_at desc), '[]'::jsonb)
               from (select * from sev order by occurred_at desc limit 80) r)
  ),
  'accounts', jsonb_build_object(
    'total', (select count(*) from accounts),
    'with_city', (select count(*) from accounts where city is not null),
    'signed_in_30d', (select count(*) from accounts where last_sign_in_at >= now() - interval '30 days'),
    'new_30d', (select count(*) from accounts where created_at >= now() - interval '30 days'),
    'on_list', (select count(*) from accounts a where exists (select 1 from subs s where s.email = a.email and s.status = 'active')),
    'left_list', (select count(*) from accounts a where exists (select 1 from subs s where s.email = a.email)
                                                   and not exists (select 1 from subs s where s.email = a.email and s.status = 'active')),
    'never_subscribed', (select count(*) from accounts a where not exists (select 1 from subs s where s.email = a.email)),
    'members_without_account', (select count(*) from subs s where s.status = 'active' and not exists (select 1 from accounts a where a.email = s.email))
  ),
  'kinds', (select coalesce(jsonb_agg(to_jsonb(k) order by k.delivered desc), '[]'::jsonb) from kinds k),
  'monthly', (select coalesce(jsonb_agg(to_jsonb(m) order by m.month, m.kind), '[]'::jsonb) from monthly m),
  'issues', (select coalesce(jsonb_agg(to_jsonb(i) order by i.sent_on desc, i.subject desc), '[]'::jsonb) from issues i),
  'window', jsonb_build_object(
    'days', 30,
    'cur', (select to_jsonb(w) - 'period' from win w where w.period = 'cur'),
    'prev', (select to_jsonb(w) - 'period' from win w where w.period = 'prev')
  ),
  'editions', (select coalesce(jsonb_agg(to_jsonb(e) order by e.active_members desc nulls last, e.delivered desc), '[]'::jsonb) from editions e),
  'top_links_30d', (select coalesce(jsonb_agg(to_jsonb(l) order by l.people desc, l.clicks desc), '[]'::jsonb) from links30 l),
  'top_people_90d', (select coalesce(jsonb_agg(to_jsonb(p) order by p.issues_clicked desc, p.clicks desc), '[]'::jsonb) from top_people p),
  'dormant', jsonb_build_object(
    'count', (select count(*) from dormant),
    'sample', (select coalesce(jsonb_agg(to_jsonb(d) order by d.delivered desc, d.email), '[]'::jsonb)
               from (select * from dormant order by delivered desc, email limit 60) d)
  ),
  'bounced', jsonb_build_object(
    'count', (select count(*) from bounced90),
    'sample', (select coalesce(jsonb_agg(to_jsonb(b) order by b.bounces desc, b.last_on desc), '[]'::jsonb)
               from (select * from bounced90 order by bounces desc, last_on desc limit 60) b)
  ),
  'complaints_90d', (select count(*) from ok where event_type = 'complained' and day >= (select d from today) - 89),
  'resend', jsonb_build_object(
    'daily', (select coalesce(jsonb_agg(to_jsonb(r) - 'raw' order by r.day desc), '[]'::jsonb)
              from (select * from public.resend_daily_metrics order by day desc limit 30) r),
    'last_run', (select to_jsonb(r)
                 from (select status, error, requested_at, completed_at, rows_upserted, start_date, end_date
                       from public.resend_metrics_runs order by requested_at desc limit 1) r)
  )
)
$$;

-- One issue in full: what was clicked and by whom, who opened without
-- clicking, who bounced, and how quickly the opens came in.
create or replace function public.admin_newsletter_issue(p_subject text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with
ev as (
  select lower(email) as email, event_type, clicked_url, created_at
  from public.newsletter_email_events
  where subject = p_subject
),
sent as (
  select min(created_at) as at from ev where event_type = 'delivered'
),
clickers as (
  select email, count(*)::int as clicks,
         to_char(max(created_at) at time zone 'America/Edmonton', 'YYYY-MM-DD HH24:MI') as last_at,
         (array_agg(distinct clicked_url) filter (where clicked_url is not null))[1:3] as urls
  from ev where event_type = 'clicked'
  group by email
),
openers as (
  select email, count(*)::int as opens,
         to_char(max(created_at) at time zone 'America/Edmonton', 'YYYY-MM-DD HH24:MI') as last_at
  from ev where event_type = 'opened'
  group by email
),
links as (
  select clicked_url as url, count(*)::int as clicks, count(distinct email)::int as people
  from ev where event_type = 'clicked' and clicked_url is not null
  group by clicked_url
  order by clicks desc
  limit 40
),
subs as (
  select lower(email) as email, city, status from public.newsletter_subscriptions
),
opens_timing as (
  select least(72, floor(extract(epoch from (o.created_at - s.at)) / 3600))::int as hour, count(*)::int as opens
  from ev o, sent s
  where o.event_type = 'opened' and s.at is not null and o.created_at >= s.at
  group by 1
)
select jsonb_build_object(
  'subject', p_subject,
  'sent_at', (select to_char(at at time zone 'America/Edmonton', 'YYYY-MM-DD HH24:MI') from sent),
  'delivered', (select count(*) from ev where event_type = 'delivered'),
  'opened', (select count(*) from openers),
  'clicked', (select count(*) from clickers),
  'clicks', (select count(*) from ev where event_type = 'clicked'),
  'bounced', (select count(*) from ev where event_type = 'bounced'),
  'complained', (select count(*) from ev where event_type = 'complained'),
  'links', (select coalesce(jsonb_agg(to_jsonb(l) order by l.clicks desc), '[]'::jsonb) from links l),
  'clickers', (select coalesce(jsonb_agg(jsonb_build_object(
                 'email', c.email, 'clicks', c.clicks, 'last_at', c.last_at, 'urls', c.urls,
                 'city', s.city, 'status', s.status) order by c.clicks desc, c.last_at desc), '[]'::jsonb)
               from (select * from clickers order by clicks desc, last_at desc limit 600) c
               left join subs s on s.email = c.email),
  'openers', (select coalesce(jsonb_agg(jsonb_build_object(
                'email', o.email, 'opens', o.opens, 'last_at', o.last_at, 'city', s.city) order by o.opens desc, o.last_at desc), '[]'::jsonb)
              from (select * from openers o
                    where not exists (select 1 from clickers c where c.email = o.email)
                    order by opens desc, last_at desc limit 600) o
              left join subs s on s.email = o.email),
  'bounces', (select coalesce(jsonb_agg(jsonb_build_object(
                'email', email, 'at', to_char(created_at at time zone 'America/Edmonton', 'YYYY-MM-DD HH24:MI')) order by created_at), '[]'::jsonb)
              from ev where event_type = 'bounced'),
  'opens_by_hour', (select coalesce(jsonb_agg(to_jsonb(t) order by t.hour), '[]'::jsonb) from opens_timing t)
)
$$;

revoke all on function public.newsletter_email_kind(text) from public;
grant execute on function public.newsletter_email_kind(text) to service_role;
revoke all on function public.admin_newsletter_dashboard() from public;
grant execute on function public.admin_newsletter_dashboard() to service_role;
revoke all on function public.admin_newsletter_issue(text) from public;
grant execute on function public.admin_newsletter_issue(text) to service_role;

-- Check: the newest issue, the member count and the accounts split.
select d -> 'members' ->> 'active' as active_members,
       d -> 'accounts' ->> 'total' as accounts,
       d -> 'accounts' ->> 'on_list' as accounts_on_list,
       d -> 'issues' -> 0 ->> 'subject' as newest_issue,
       jsonb_array_length(d -> 'issues') as issues
from (select public.admin_newsletter_dashboard() as d) x;

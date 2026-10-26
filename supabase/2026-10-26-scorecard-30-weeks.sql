-- Widen analytics.kpi_scorecard() from 12 to 30 weeks of history.
--
-- The Scorecard's 90-day average (13 full weeks) and the detail panel's
-- "three months ago" comparison (the 4-week average 12 weeks earlier)
-- need about 29 weeks behind the newest one. With 12 weeks returned, the
-- 90-day average is really an 11-week average and the comparison is blank.
-- Every consumer takes its own window off the end of the list, so nothing
-- else changes.
--
-- Rewrites the one line
--   where k.week_start >= date_trunc('week', (now() at time zone 'America/Edmonton'))::date - 12 * 7
-- to use 30 * 7, keeping the rest of the function exactly as it is.
do $$
declare
  def text := pg_get_functiondef('analytics.kpi_scorecard'::regproc);
  n int := (length(def) - length(replace(def, '- 12 * 7', ''))) / length('- 12 * 7');
begin
  if n <> 1 then
    raise exception 'expected exactly one week-window clause, found %', n;
  end if;
  execute replace(def, '- 12 * 7', '- 30 * 7');
end $$;

-- Check: should now return every full week since early May.
select jsonb_array_length(s -> 'weeks') as weeks_returned,
       s -> 'weeks' -> 0 ->> 'week_start'  as first_week,
       s -> 'weeks' -> -1 ->> 'week_start' as last_week
from (select analytics.kpi_scorecard() as s) x;

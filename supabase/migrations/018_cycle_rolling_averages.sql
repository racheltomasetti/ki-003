-- Ki — cycle rolling averages
--
-- Extends the period_logs change trigger (017_cycle.sql) to auto-update
-- profiles.average_cycle_length / average_period_length once real cycle
-- data exists, so onboarding guesses get replaced by the user's own pattern
-- over time — the same "phases refine as Ki learns" principle cycle_day
-- stamping already follows.
--
-- Ported from terra-001's rebuildCyclesFromPeriodLogs: average the last 3
-- COMPLETED cycles only (a cycle is "completed" once a later one has
-- started, so its length is knowable). Fewer than 3 completed cycles —
-- leave the user's entered values untouched; one or two irregular cycles
-- shouldn't swing the average.

create or replace function public.update_cycle_averages_for_user(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_avg_cycle_length   int;
  v_avg_period_length  int;
  v_completed_count    int;
begin
  with dated as (
    -- Gaps-and-islands: consecutive dates share the same island once you
    -- subtract their row number (in date order) as a day offset.
    select
      date,
      (date - (row_number() over (order by date))::int * interval '1 day')::date as island
    from public.period_logs
    where user_id = p_user_id
  ),
  clusters as (
    select min(date) as start_date, count(*) as day_count
    from dated
    group by island
  ),
  clusters_with_next as (
    select
      start_date,
      day_count,
      lead(start_date) over (order by start_date) as next_start_date
    from clusters
  ),
  completed as (
    select
      day_count,
      (next_start_date - start_date)::int as cycle_length
    from clusters_with_next
    where next_start_date is not null  -- excludes the most recent (possibly ongoing) cycle
    order by start_date desc
    limit 3
  )
  select
    count(*),
    round(avg(cycle_length))::int,
    round(avg(day_count))::int
  into v_completed_count, v_avg_cycle_length, v_avg_period_length
  from completed;

  if v_completed_count < 3 then
    return;
  end if;

  update public.profiles
  set average_cycle_length  = v_avg_cycle_length,
      average_period_length = v_avg_period_length
  where id = p_user_id
    and (average_cycle_length is distinct from v_avg_cycle_length
         or average_period_length is distinct from v_avg_period_length);
end;
$$;

-- Extend the existing period_logs trigger function (017_cycle.sql) to also
-- check for a rolling-average update, right after re-stamping cycle_day.
create or replace function public.restamp_cycle_on_period_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.restamp_cycle_for_user(coalesce(new.user_id, old.user_id));
  perform public.update_cycle_averages_for_user(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

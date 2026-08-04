-- Ki — cycle (the body layer)
--
-- Adds the cycle as a layer under every capture, not a standalone feature.
-- See docs/active/cycle-tracker.md for the full spec and rationale.
--
-- The core decision: every enrichment is stamped with cycle_day, never
-- cycle_phase. period_logs are the only source of truth; cycle_day is a
-- recomputable cache. Phases are derived at runtime (packages/utils),
-- so nothing stored ever goes stale.
--
-- Menstrual cycle only for this phase — the specific, proven case before
-- generalizing outward. cycle_type = null means not opted in; nothing
-- stamps. A future migration widens the check constraint and
-- compute_cycle_day() to add 'lunar' as a universal, zero-setup option for
-- anyone not tracking a menstrual cycle. See "Next: Lunar" in
-- docs/active/cycle-tracker.md.

-- ─── profiles: cycle preferences ───────────────────────────────────────────

alter table public.profiles
  add column cycle_type             text check (cycle_type in ('menstrual')),
  add column average_cycle_length   int  check (average_cycle_length is null or average_cycle_length between 15 and 60),
  add column average_period_length  int  check (average_period_length is null or average_period_length between 1 and 14);

-- ─── period_logs ────────────────────────────────────────────────────────────
-- One row per bleeding day. Immutable source of truth — insert and delete
-- only, never update. Cycles are derived, not stored: a date is a cycle
-- start when there is no logged bleeding day immediately before it.

create table public.period_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  date        date not null,
  created_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index period_logs_user_date_idx on public.period_logs (user_id, date);

alter table public.period_logs enable row level security;

create policy "Users manage their own period logs"
  on public.period_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── daily_logs ─────────────────────────────────────────────────────────────
-- One structured check-in per day — the logged (vs. inferred) body signal.
-- Available to every user regardless of cycle_type. At least one field must
-- be filled to save.

create table public.daily_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  log_date      date not null,
  energy_level  int check (energy_level between 1 and 5),
  emotions      text[],
  body_signals  text[],
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, log_date),
  check (
    energy_level is not null
    or (emotions is not null and array_length(emotions, 1) > 0)
    or (body_signals is not null and array_length(body_signals, 1) > 0)
  )
);

create index daily_logs_user_date_idx on public.daily_logs (user_id, log_date);

alter table public.daily_logs enable row level security;

create policy "Users manage their own daily logs"
  on public.daily_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger daily_logs_updated_at
  before update on public.daily_logs
  for each row execute procedure public.handle_updated_at();

-- ─── enrichments: the stamp ─────────────────────────────────────────────────

alter table public.enrichments
  add column cycle_day         int,
  add column cycle_start_date  date;

create index enrichments_cycle_day_idx on public.enrichments (cycle_day);

-- ─── compute_cycle_day ──────────────────────────────────────────────────────
-- Pure derivation, no writes. Given a user and a timestamp, returns the
-- cycle day and the cycle-instance start date for that moment — or nulls
-- if the user has no cycle_type or no period_logs yet.
--
-- The most recent cycle start on or before captured_at, where a cycle start
-- is a period_logs date with no logged day immediately before it.

create or replace function public.compute_cycle_day(p_user_id uuid, p_captured_at timestamptz)
returns table (cycle_day int, cycle_start_date date)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_cycle_type  text;
  v_start       date;
begin
  select p.cycle_type into v_cycle_type
  from public.profiles p
  where p.id = p_user_id;

  if v_cycle_type = 'menstrual' then
    select pl.date into v_start
    from public.period_logs pl
    where pl.user_id = p_user_id
      and pl.date <= p_captured_at::date
      and not exists (
        select 1 from public.period_logs prev
        where prev.user_id = p_user_id and prev.date = pl.date - 1
      )
    order by pl.date desc
    limit 1;

    if v_start is null then
      return query select null::int, null::date;
      return;
    end if;

    return query select (p_captured_at::date - v_start + 1)::int, v_start;
    return;

  else
    return query select null::int, null::date;
    return;
  end if;
end;
$$;

-- ─── restamp_cycle_for_user ─────────────────────────────────────────────────
-- Re-derives cycle_day / cycle_start_date for every enrichment belonging to
-- a user. Cheap enough to re-stamp the whole corpus rather than compute the
-- precise affected window — the corpus stays correct, always, with one
-- mechanism. Also usable ad hoc: re-running this for every user is how a
-- future improvement to compute_cycle_day (e.g. personalized phases)
-- propagates across the whole corpus.

create or replace function public.restamp_cycle_for_user(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.enrichments e
  set cycle_day        = c.cycle_day,
      cycle_start_date = c.cycle_start_date
  from public.captures cap
  cross join lateral public.compute_cycle_day(cap.user_id, cap.captured_at) c
  where e.capture_id = cap.id
    and cap.user_id = p_user_id;
end;
$$;

-- ─── stamp on capture creation ──────────────────────────────────────────────
-- Extends the existing create_pending_enrichment trigger (001_initial_schema)
-- so every capture is stamped the moment its pending enrichment row is
-- created — no dependency on the enrich-capture Edge Function completing.

create or replace function public.create_pending_enrichment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_cycle_day    int;
  v_cycle_start  date;
begin
  select cycle_day, cycle_start_date
  into v_cycle_day, v_cycle_start
  from public.compute_cycle_day(new.user_id, new.captured_at);

  insert into public.enrichments (capture_id, cycle_day, cycle_start_date)
  values (new.id, v_cycle_day, v_cycle_start);

  return new;
end;
$$;

-- ─── re-stamp on period_logs change ─────────────────────────────────────────
-- Backdating or removing a period log changes derived cycle boundaries.
-- The stamp is a cache, not a truth — re-stamp the user's corpus whenever
-- the source of truth changes.

create or replace function public.restamp_cycle_on_period_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.restamp_cycle_for_user(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

create trigger period_logs_restamp
  after insert or delete on public.period_logs
  for each row execute procedure public.restamp_cycle_on_period_change();

-- ─── re-stamp on cycle preference change ────────────────────────────────────
-- Opting in, switching menstrual/lunar, or correcting average lengths all
-- change the derivation — back-stamp the full corpus when they change.

create or replace function public.restamp_cycle_on_profile_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.cycle_type is distinct from old.cycle_type
     or new.average_cycle_length is distinct from old.average_cycle_length
     or new.average_period_length is distinct from old.average_period_length
  then
    perform public.restamp_cycle_for_user(new.id);
  end if;
  return new;
end;
$$;

create trigger profiles_restamp_cycle
  after update of cycle_type, average_cycle_length, average_period_length on public.profiles
  for each row execute procedure public.restamp_cycle_on_profile_change();

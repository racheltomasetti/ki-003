-- Ki — flow tracker
--
-- A universal start/stop timer: fasts, deep work, yoga, anything. One flow
-- running at a time, enforced at the DB level (not app-level, to close the
-- two-tabs / double-click race a pre-check alone can't). Every capture made
-- while a flow is running is linked to it automatically — same "Postgres
-- derives, app never writes" shape cycle_day stamping already uses
-- (017_cycle.sql), but here the stamped field lives on the same row being
-- inserted (captures.flow_id), so it's a BEFORE INSERT trigger setting NEW
-- directly, not an AFTER INSERT + separate write into a sibling table like
-- create_pending_enrichment does.

-- ─── flows ──────────────────────────────────────────────────────────────────

create table public.flows (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  label             text not null check (length(btrim(label)) > 0),
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  energy_after      int check (energy_after is null or energy_after between 1 and 5),
  debrief           text,
  cycle_day         int,          -- derived, stamped by Postgres — never by the app
  cycle_start_date  date,
  created_at        timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

-- One running flow per user, enforced in Postgres — not just checked in the
-- app — so two tabs or a double-click can never both succeed.
create unique index flows_one_running_idx
  on public.flows (user_id)
  where ended_at is null;

create index flows_user_started_idx
  on public.flows (user_id, started_at desc);

alter table public.flows enable row level security;

create policy "Users manage their own flows"
  on public.flows
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── cycle_day stamp on flows ───────────────────────────────────────────────
-- Same compute_cycle_day() used for enrichments (017_cycle.sql). BEFORE
-- INSERT because the field lives on the row being inserted — no second
-- write needed, unlike the enrichments case.

create or replace function public.stamp_flow_cycle_day()
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
  from public.compute_cycle_day(new.user_id, new.started_at);

  new.cycle_day := v_cycle_day;
  new.cycle_start_date := v_cycle_start;
  return new;
end;
$$;

create trigger flows_stamp_cycle_day
  before insert on public.flows
  for each row execute procedure public.stamp_flow_cycle_day();

-- ─── captures.flow_id ────────────────────────────────────────────────────────
-- Nullable — most captures happen with no flow running. Captures must never
-- be deleted as a side effect of deleting a flow, so ON DELETE SET NULL,
-- not CASCADE.

alter table public.captures
  add column flow_id uuid references public.flows (id) on delete set null;

create index captures_flow_id_idx on public.captures (flow_id);

-- Stamps every new capture with whichever flow is currently running for its
-- owner, if any. BEFORE INSERT so it's one write, not two — mirrors the
-- shape above rather than extending create_pending_enrichment, which writes
-- a different table (enrichments) that doesn't exist yet at this point.
-- Captures are immutable after write, so this only ever needs to fire on
-- INSERT, never UPDATE.

create or replace function public.stamp_capture_flow()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_flow_id uuid;
begin
  select id into v_flow_id
  from public.flows
  where user_id = new.user_id
    and ended_at is null
  order by started_at desc
  limit 1;

  new.flow_id := v_flow_id;
  return new;
end;
$$;

create trigger captures_stamp_flow
  before insert on public.captures
  for each row execute procedure public.stamp_capture_flow();

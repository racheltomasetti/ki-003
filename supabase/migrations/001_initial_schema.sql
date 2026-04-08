-- ─── Ki — Initial Schema ─────────────────────────────────────────────────────
-- Phase 1 only: profiles, captures, enrichments, tags, capture_tags.
-- RLS policies → 002_rls.sql. pgvector → 003_embeddings.sql.

-- ─── profiles ────────────────────────────────────────────────────────────────

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text,
  avatar_url        text,
  bio               text,
  memory_document   text,        -- UI-facing narrative layer: 7 sections shown as editable cards on Profile screen
  memory_updated_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── captures ────────────────────────────────────────────────────────────────

create table public.captures (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  type                text not null check (type in ('voice', 'text', 'file')),
  source_type         text not null check (
                        source_type in ('voice', 'text', 'file', 'oura', 'apple_health', 'manual')
                      ),
  source_url          text,
  source_title        text,
  source_metadata     jsonb,     -- flexible per-source data
  title               text,      -- optional; auto-set by pipeline from summary if blank
  body                text,      -- nullable: voice captures are inserted before transcription completes
  media_paths         text[],
  user_context        text,      -- user's significance note; surfaced in UI as "add context"
  parent_id           uuid references public.captures (id) on delete cascade,
  chunk_index         int,
  is_chunked          boolean not null default false,
  enrichment_profile  text not null check (enrichment_profile in ('personal', 'artifact')),
  status              text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  visibility          text not null default 'private' check (visibility in ('private', 'friends', 'public')),
  is_starred          boolean not null default false,
  captured_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Full-text search over body. coalesce handles null body during voice transcription.
-- Phase 2: upgrade to hybrid BM25 + pgvector.
alter table public.captures
  add column fts_body tsvector generated always as (
    to_tsvector('english', coalesce(body, ''))
  ) stored;

create index captures_fts_idx         on public.captures using gin (fts_body);
create index captures_user_id_idx     on public.captures (user_id);
create index captures_captured_at_idx on public.captures (captured_at desc);
create index captures_status_idx      on public.captures (status);
create index captures_is_starred_idx  on public.captures (is_starred);

-- ─── enrichments ─────────────────────────────────────────────────────────────
-- Written by the enrich-capture Edge Function only — never by the app.
-- A pending row is auto-created on captures INSERT so the function always updates, never inserts.

create table public.enrichments (
  id                uuid primary key default gen_random_uuid(),
  capture_id        uuid not null unique references public.captures (id) on delete cascade,
  summary           text,
  themes            text[],
  sentiment         text check (sentiment in ('positive', 'neutral', 'negative', 'mixed')),
  mood_tags         text[],
  energy_level      text check (energy_level in ('low', 'medium', 'high')),
  capture_intent    text check (
                      capture_intent in (
                        'reflection', 'idea', 'question', 'observation', 'gratitude', 'processing'
                      )
                    ),
  questions_raised  text[],
  people_mentioned  text[],
  time_of_day_cat   text check (time_of_day_cat in ('morning', 'afternoon', 'evening', 'night')),
  key_quotes        text[],
  entities          jsonb,
  source_sentiment  text check (source_sentiment in ('positive', 'neutral', 'negative', 'mixed')),
  user_context      text,
  enrichment_status text not null default 'pending' check (
                      enrichment_status in ('pending', 'complete', 'failed')
                    ),
  processed_at      timestamptz,
  model_used        text,
  updated_at        timestamptz not null default now()
);

create or replace function public.create_pending_enrichment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.enrichments (capture_id)
  values (new.id);
  return new;
end;
$$;

create trigger on_capture_created
  after insert on public.captures
  for each row execute procedure public.create_pending_enrichment();

create index enrichments_capture_id_idx on public.enrichments (capture_id);
create index enrichments_status_idx     on public.enrichments (enrichment_status);

-- ─── tags ────────────────────────────────────────────────────────────────────

create table public.tags (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles (id) on delete cascade,
  name      text not null,
  unique (user_id, name)
);

create index tags_user_id_idx on public.tags (user_id);

-- ─── capture_tags (junction) ─────────────────────────────────────────────────

create table public.capture_tags (
  capture_id  uuid not null references public.captures (id) on delete cascade,
  tag_id      uuid not null references public.tags (id) on delete cascade,
  primary key (capture_id, tag_id)
);

-- ─── updated_at trigger (shared) ─────────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger set_captures_updated_at
  before update on public.captures
  for each row execute procedure public.handle_updated_at();

create trigger set_enrichments_updated_at
  before update on public.enrichments
  for each row execute procedure public.handle_updated_at();

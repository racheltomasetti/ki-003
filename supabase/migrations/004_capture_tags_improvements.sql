-- ─── capture_tags improvements ───────────────────────────────────────────────
-- Add user_id (denormalized for RLS performance) and created_at.
-- Add indexes for the two most common query patterns.
-- Replace subquery-based RLS policies with direct user_id checks.

alter table public.capture_tags
  add column user_id    uuid not null references public.profiles (id) on delete cascade,
  add column created_at timestamptz not null default now();

create index capture_tags_tag_id_idx  on public.capture_tags (tag_id);
create index capture_tags_user_id_idx on public.capture_tags (user_id);

-- Replace RLS policies with simpler, faster direct user_id checks.
drop policy "Users can view tags on their own captures"            on public.capture_tags;
drop policy "Users can tag their own captures with their own tags" on public.capture_tags;
drop policy "Users can remove tags from their own captures"        on public.capture_tags;

create policy "Users can view their own capture tags"
  on public.capture_tags for select
  using (auth.uid() = user_id);

create policy "Users can tag their own captures"
  on public.capture_tags for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own capture tags"
  on public.capture_tags for delete
  using (auth.uid() = user_id);

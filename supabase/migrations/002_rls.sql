-- ─── Ki — Row Level Security ──────────────────────────────────────────────────
-- RLS on every table. Users read and write only their own rows.
-- Enrichments: readable by owner, written by pipeline via service role only.

-- ─── profiles ────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ─── captures ────────────────────────────────────────────────────────────────

alter table public.captures enable row level security;

create policy "Users can view their own captures"
  on public.captures for select
  using (auth.uid() = user_id);

create policy "Users can insert their own captures"
  on public.captures for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own captures"
  on public.captures for update
  using (auth.uid() = user_id);

create policy "Users can delete their own captures"
  on public.captures for delete
  using (auth.uid() = user_id);

-- ─── enrichments ─────────────────────────────────────────────────────────────
-- App reads enrichments via a join on captures — ownership enforced via capture.
-- Pipeline (Edge Function) writes via service role, which bypasses RLS.

alter table public.enrichments enable row level security;

create policy "Users can view enrichments for their own captures"
  on public.enrichments for select
  using (
    exists (
      select 1 from public.captures
      where captures.id = enrichments.capture_id
        and captures.user_id = auth.uid()
    )
  );

-- ─── tags ────────────────────────────────────────────────────────────────────

alter table public.tags enable row level security;

create policy "Users can view their own tags"
  on public.tags for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tags"
  on public.tags for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tags"
  on public.tags for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tags"
  on public.tags for delete
  using (auth.uid() = user_id);

-- ─── capture_tags ────────────────────────────────────────────────────────────

alter table public.capture_tags enable row level security;

create policy "Users can view tags on their own captures"
  on public.capture_tags for select
  using (
    exists (
      select 1 from public.captures
      where captures.id = capture_tags.capture_id
        and captures.user_id = auth.uid()
    )
  );

-- Both the capture and the tag must belong to the same user.
create policy "Users can tag their own captures with their own tags"
  on public.capture_tags for insert
  with check (
    exists (
      select 1 from public.captures
      where captures.id = capture_tags.capture_id
        and captures.user_id = auth.uid()
    )
    and
    exists (
      select 1 from public.tags
      where tags.id = capture_tags.tag_id
        and tags.user_id = auth.uid()
    )
  );

create policy "Users can remove tags from their own captures"
  on public.capture_tags for delete
  using (
    exists (
      select 1 from public.captures
      where captures.id = capture_tags.capture_id
        and captures.user_id = auth.uid()
    )
  );
